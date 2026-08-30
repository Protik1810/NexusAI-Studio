# Security Policy

## Supported Versions

Solframe Studio is currently at v1.0.0. Only the latest release is supported with security fixes — please update before reporting an issue that might already be fixed.

| Version | Supported |
|---------|-----------|
| 1.0.x   | ✅ |
| < 1.0   | ❌ (pre-release / internal builds) |

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

## Response

This is a community project maintained on a best-effort basis (see [TERMS.md](TERMS.md)). There's no guaranteed response time, but genuine security reports will be prioritized over feature requests.
