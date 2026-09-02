# Security Policy

## Supported Versions

Only the latest release is supported with security fixes — please update before reporting an issue that might already be fixed.

| Version | Supported |
|---------|-----------|
| 1.1.x   | ✅ |
| < 1.1   | ❌ (superseded) |

## Reporting a Vulnerability

Please **do not open a public GitHub issue** for security vulnerabilities.

Instead, use [GitHub's private vulnerability reporting](https://github.com/Protik1810/Solframe-Studio/security/advisories/new) for this repository, or open a private conversation via the [creator's GitHub profile](https://github.com/Protik1810) if that option isn't available to you.

When reporting, please include:
- A description of the vulnerability and its potential impact
- Steps to reproduce (a minimal example helps a lot)
- The affected version/commit

## Scope

Solframe Studio runs entirely on your local machine — the local control server binds to `127.0.0.1` only and is not intended to be exposed to a network. Relevant security surface includes:
- The local HTTP API (`electron/engine/apiRoutes.cjs`) and its Origin/path-traversal guards
- The Electron main process (window navigation, IPC)
- The Hugging Face model downloader

Vulnerabilities in third-party engines this project bundles or interoperates with (`stable-diffusion.cpp`, `llama.cpp`) should be reported to those projects directly, not here — unless the issue is specifically in how Solframe Studio invokes or wraps them.

## Threat Model

This section exists so a reporter (or an auditor) doesn't have to guess which behaviors are known trade-offs versus genuine bugs. See [ARCHITECTURE.md](ARCHITECTURE.md) for the full design rationale behind the two servers described below.

- **The internal API (`apiRoutes.cjs`) has no authentication, by design.** It relies entirely on Origin/Host header checks (`electron/engine/security.cjs`) to reject any caller that isn't this app's own renderer. This is intentional, not a placeholder — see "Why a localhost HTTP server instead of Electron IPC + contextBridge" in ARCHITECTURE.md for why Origin/Host checking is the right tool for a browser-context caller. A bug in `isAllowedOrigin`/`isAllowedHost` is a real vulnerability; the absence of a bearer token is not.
- **The Agent API (`agentApiServer.cjs`) is deliberately reachable by other local processes.** It's off by default, and when enabled it's gated by a bearer API key (`agentAuth.cjs`, compared with `crypto.timingSafeEqual`) rather than Origin checking, since its whole purpose is to serve non-browser callers (scripts, other local tools) that never send an Origin header. Anyone who can read the API key from this machine can call it — the key is the entire trust boundary, so treat it like a password.
- **A Content-Security-Policy is enforced on every response** (`security.cjs::applySecurityHeaders`, applied identically in dev and production) restricting scripts/styles/connections/frames to the app's own origin plus the Google Fonts CDN it actually loads from. `style-src` still needs `'unsafe-inline'` because of this codebase's pervasive React `style={{...}}` usage — tightening that further would require an inline-style audit across the whole component tree, not a config change.
- **Electron permission requests (camera, microphone, geolocation, notifications) are denied unconditionally** (`electron/main.cjs::installPermissionHandlers`) — the app's own UI never needs any of them, so there's no legitimate path where a prompt should ever reach the user.
- **User-supplied model files are outside this app's trust boundary.** Solframe Studio does not sandbox, scan, or validate the contents of `.safetensors`/`.gguf` files beyond what `stable-diffusion.cpp`/`llama.cpp` themselves do before loading them — a maliciously crafted model file is a supply-chain risk against those upstream engines, not something this app can meaningfully defend against on its own. Only load models from sources you trust.
- **There is no auto-updater.** Solframe Studio does not bundle `electron-updater` or check for updates by silently downloading and installing anything — `/api/check-update` only compares the running version against the latest GitHub release tag and links the user to the releases page. This is deliberate: an auto-updater is itself a high-value attack target (a compromised update server or man-in-the-middled update channel can push malicious code directly to every installed copy), and this project doesn't yet have the release-signing/attestation infrastructure that would make silent auto-updates trustworthy. Until then, every update is a manual, deliberate action by the user downloading a new installer themselves.

## Response

This is a community project maintained on a best-effort basis (see [TERMS.md](TERMS.md)). There's no guaranteed response time, but genuine security reports will be prioritized over feature requests.
