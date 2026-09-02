# Architecture

This document covers the decisions in this codebase that aren't obvious from reading any single file — the ones you'd otherwise have to reconstruct from git history or ask the author about.

## Why a localhost HTTP server instead of Electron IPC + contextBridge

The renderer never talks to the main process via `ipcRenderer`/`contextBridge`. Instead, both `vite.config.ts` (dev mode) and `electron/server.cjs` (the packaged app) start a plain Node `http.createServer` on `127.0.0.1`, and the React frontend talks to it exclusively via `fetch()` — the same code path in dev and prod.

**Why:** the alternative — a preload script exposing an IPC-backed API — means writing (and keeping in sync) two implementations of every backend operation: one for `npm run dev` against Vite's dev server, one for the packaged app's main process. Model scanning, generation, downloads, and the LLM proxy all needed to behave identically in both, and IPC has no direct dev-mode equivalent without a second, parallel mechanism. A shared HTTP router (`electron/engine/apiRoutes.cjs`) sidesteps that: `vite.config.ts` mounts it as a middleware plugin, `electron/server.cjs` mounts it as the request handler for its own `http.createServer` — one implementation, two hosts.

**What it costs:** an HTTP server on localhost is reachable by *any* local process, not just this app's own renderer — a fundamentally different threat model than IPC, which only the process holding the right `contextBridge` reference can call. That's the whole reason `electron/engine/security.cjs` exists:

- `isAllowedOrigin` rejects any request whose `Origin` header doesn't match the app's own origin — this blocks a malicious page open in the user's *regular* browser from CSRF-ing the local server, since real cross-origin browser requests always carry an `Origin` header.
- `isAllowedHost` closes the gap in that check: after a DNS-rebinding attack, an attacker's page becomes same-origin with `127.0.0.1:<port>` from the browser's perspective and sends *no* `Origin` header at all, sailing through the first check. The `Host` header can't be spoofed the same way, so it's checked too.
- `safeJoin` guards every request-driven filesystem path (including the Hugging Face download destination) against `../` traversal, since path segments arriving over HTTP are untrusted input in a way a same-process IPC argument typically isn't.

None of this is needed for a "real" IPC-based app. It's the direct cost of the dev/prod-parity decision above, and it's why this app has more custom request-validation code than a typical Electron app of similar size.

## Two servers, two auth models

There are genuinely two separate HTTP servers, and they're authenticated completely differently — not an oversight, a deliberate split based on who's allowed to call each one:

| | `electron/engine/apiRoutes.cjs` | `electron/engine/agentApiServer.cjs` |
|---|---|---|
| **Purpose** | Internal UI-facing API — model scanning, generation, LLM proxy, downloads | External OpenAI-compatible API (`/v1/chat/completions`, `/v1/images/generations`) for other tools/agents to call |
| **Who's allowed to call it** | Only this app's own renderer | Deliberately *any* local process |
| **Auth mechanism** | Origin + Host header checks (`security.cjs`) | Bearer API key, `crypto.timingSafeEqual` comparison (`agentAuth.cjs`) |
| **Why this mechanism** | The caller is always a browser context, so Origin/Host headers are always present and meaningful | The caller is explicitly *not* required to be a browser — a Python script or curl invocation sends no Origin header at all, so origin checking would either block legitimate external callers or (if the "no Origin = allow" fallback were used here too) let anyone in |
| **Off by default** | N/A — always running when the app is | Yes — user opts in from Settings |

Origin/Host checking is the right tool when you can assume the caller is a browser obeying browser rules. It's the wrong tool the moment you *want* non-browser callers — hence the second server, gated by an actual secret instead.

## `engineCore.cjs`: one process manager, shared by both servers

`electron/engine/engineCore.cjs` owns the actual `llama-server` and `sd-cli` child-process lifecycle — starting, stopping, tracking the currently-loaded model, spawning generations. Both `apiRoutes.cjs` and `agentApiServer.cjs` are handed the *same* `engineCore` instance rather than each constructing their own.

**Why it has to be one instance:** both the internal UI and the external Agent API can trigger `llama-server` starts and image generations. If each server maintained its own process-tracking state, two independent copies could each spawn a `llama-server` believing they're the only one, both bind (or fight over) the same GPU, and each track a stale/wrong notion of "is anything running right now." A single shared instance means "start llama" from the Agent API and "start llama" from the UI are the same operation on the same state — the second call correctly sees a server already running and reuses or replaces it deliberately, rather than racing.

## Model scanner cache lifecycle

Scanning every configured drive/directory for model files is slow, so `apiRoutes.cjs` never blocks a request on a live scan. The lifecycle:

1. **On server startup:** try loading a previously-saved scan (`loadScanCache`, checking a global `~/.solframe/scan_cache.json` first, then a local `models/.scan_cache.json` fallback). If one exists, `scanState` is immediately `'ready'` and every model-listing endpoint (`/api/local-models`, `/api/local-llm-models`, etc.) serves it right away — even though it may be stale.
2. **Simultaneously, always:** kick off `runBackgroundScan()` regardless of whether a cache was loaded. This walks the real filesystem, classifies every file found (`modelScanner.cjs::classifyModelFile`), and once done, replaces `cachedModels` in memory and persists the fresh result via `saveScanCache` — to *both* the global and local paths, so either one being unwritable doesn't lose the cache.
3. **While scanning:** `scanState` is `'scanning'`; the UI's "Rescan" button is disabled to prevent overlapping scans (`runBackgroundScan` also no-ops if a scan is already in flight).
4. **`/api/rescan`:** the user-triggered "Rescan" button. Sets `cachedModels = null` and re-runs the same background scan — after this call, every listing endpoint temporarily falls back to its empty-object default until the scan completes, rather than serving the (now explicitly discarded) old cache.

The net effect: the app never shows a blank model list while scanning, but a fresh install with no prior cache does show one until the first scan finishes.

## What's in `backend/win/` and `backend/mac/`, and why they aren't committed

These directories hold the actual compiled inference engines — `sd-cli.exe`/`llama-server.exe` and their CUDA/Vulkan/Metal backend DLLs/dylibs — downloaded directly from [`leejet/stable-diffusion.cpp`](https://github.com/leejet/stable-diffusion.cpp) and [`ggml-org/llama.cpp`](https://github.com/ggml-org/llama.cpp)'s own release binaries, not built from source in this repo.

They're gitignored rather than committed because:

- They're large (the CUDA backend alone is several hundred MB), and git handles large binary churn poorly — every engine update would bloat the repo's history permanently.
- They update independently of this app's own release cadence — a `stable-diffusion.cpp` bugfix shouldn't require a Solframe Studio commit to pick up.
- They're platform- and backend-specific (`backend/win/{cuda,vulkan,cpu}/`, `backend/mac/metal/`), so committing all variants would multiply the problem across every supported configuration.

The practical consequence (see [CONTRIBUTING.md](CONTRIBUTING.md#a-note-on-the-inference-engines)): CI can build a real, installable app for every platform, but only a UI-shell one — `.github/workflows/release-build.yml` builds directly from committed source, so it has no access to these binaries and never claims to. The Windows *Complete* installer (the one with working inference) is still assembled by hand for each release, from a local copy of these engine binaries. This is the gap the roadmap's `fetch-engines.js` proposal (pinned, checksum-verified downloads) is meant to close.
