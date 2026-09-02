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

There's no fetch script for these yet (see the roadmap) — for now, grab a current release from [`leejet/stable-diffusion.cpp`](https://github.com/leejet/stable-diffusion.cpp/releases) and [`ggml-org/llama.cpp`](https://github.com/ggml-org/llama.cpp/releases) matching your platform, and unpack into `backend/win/{cuda,vulkan,cpu,llama}/` or `backend/mac/{metal,llama}/`.

## Code style

- TypeScript/React on the frontend (`src/`), CommonJS on the Electron/Node side (`electron/`).
- No comments explaining *what* code does — only *why*, when it's non-obvious.
- Don't add abstractions, error handling, or config options for scenarios that can't happen. Match the existing minimal, direct style.
- Tests live in `src/tests/`, run via Vitest.

## Pull requests

- Keep PRs focused — one change, one PR.
- Explain the *why* in the description, not just the *what*.
- If you're touching `electron/engine/*.cjs`, add or update a test in `src/tests/` — these files are shared between dev mode (`vite.config.ts`) and the packaged app (`electron/server.cjs`), so a regression there breaks both.

## Reporting bugs

Use the bug report template — it asks for OS, GPU, driver version, and the model file involved, since most real bugs here turn out to be hardware- or model-specific.
