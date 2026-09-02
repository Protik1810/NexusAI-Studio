# Contributing to Solframe Studio

Thanks for considering a contribution. This is a solo passion project, so responses may not be instant, but real issues and PRs are welcome.

## Setup

```bash
git clone https://github.com/Protik1810/Solframe-Studio.git
cd Solframe-Studio
npm install
npm run dev
```

Before opening a PR, make sure both of these pass:

```bash
npm run lint
npm test
```

## A note on the inference engines

`backend/win/**` and `backend/mac/**` (the compiled `stable-diffusion.cpp` and `llama.cpp` binaries) are **not committed to this repo** — they're large local build inputs, gitignored, and currently placed by hand. This means:

- `npm run dev` gives you the full UI, model scanner, and Hugging Face downloader working against real state.
- Image generation and local LLM chat **will not run** unless you've placed working engine binaries in `backend/win/` (or `backend/mac/` on macOS) yourself, matching the paths `electron/engine/pathUtils.cjs` expects.
- If you're contributing to UI, model management, or the API layer, you generally don't need real engines — the test suite and dev server both work without them.
- If you're contributing to `sdEngine.cjs`, `engineCore.cjs`, or anything that spawns the engines, you'll need real binaries to verify your change actually works, not just that it type-checks.

Run `node scripts/fetch-engines.js` to fetch and unpack them automatically — it downloads the current release from [`leejet/stable-diffusion.cpp`](https://github.com/leejet/stable-diffusion.cpp/releases) and [`ggml-org/llama.cpp`](https://github.com/ggml-org/llama.cpp/releases), verifies each download's SHA-256 against the checked-in `engines-lock.json`, and unpacks into `backend/win/{cuda,vulkan,cpu,llama}/` or `backend/mac/{metal,llama}/`. On Windows it can't unpack the macOS targets specifically (their archives contain Unix symlinks Windows won't create without Developer Mode) — run it on macOS or Linux for those, or grab them by hand.

## Code style

- TypeScript/React on the frontend (`src/`), CommonJS on the Electron/Node side (`electron/`).
- No comments explaining *what* code does — only *why*, when it's non-obvious.
- Don't add abstractions, error handling, or config options for scenarios that can't happen. Match the existing minimal, direct style.
- Tests live in `src/tests/`, run via Vitest.

## Pull requests

- Keep PRs focused — one change, one PR.
- Explain the *why* in the description, not just the *what*.
- If you're touching `electron/engine/*.cjs`, add or update a test in `src/tests/` — these files are shared between dev mode (`vite.config.ts`) and the packaged app (`electron/server.cjs`), so a regression there breaks both.
- Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `chore:`, `docs:`, etc. — see `git log` for real examples). Not bot-enforced, just the convention — it's what keeps [CHANGELOG.md](CHANGELOG.md) easy to maintain.

## Reporting bugs

Use the bug report template — it asks for OS, GPU, driver version, and the model file involved, since most real bugs here turn out to be hardware- or model-specific.
