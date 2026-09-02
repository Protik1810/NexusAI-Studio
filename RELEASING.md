# Releasing Solframe Studio

What's automated, what's still manual, and the order to do it in. If you're
just contributing a PR, you don't need this file — it's for cutting an
actual versioned release.

## What CI does for you

Pushing a tag matching `v*` (e.g. `v1.2.0`) triggers
`.github/workflows/release-build.yml`, which:

1. Builds the Linux AppImage + `.deb`, the macOS `.dmg` + `.zip`, and the
   Windows Lightweight installer — all from committed source only, so
   none of these bundle real inference engines (see
   [ARCHITECTURE.md](ARCHITECTURE.md#whats-in-backendwin-and-backendmac-and-why-they-arent-committed)).
2. Attaches a GitHub build-provenance attestation to each artifact
   (verify later with `gh attestation verify <file> --repo Protik1810/Solframe-Studio`).
3. Opens a **draft** GitHub Release named after the tag, with those
   artifacts attached and a `CHECKSUMS.txt` covering just them.

It's a draft on purpose — the release isn't complete yet at this point.
Don't publish it until you've finished the manual steps below.

## What you still have to do by hand

1. **Bump the version.** Update `package.json`'s `version` field, and make
   sure `RELEASE_NOTES.md` describes what's actually in this release (this
   also becomes the polished release body — CI's auto-generated one is a
   placeholder).

2. **Build the Windows Complete and Portable installers**, from a machine
   with real `backend/win/` engine binaries in place (`node
   scripts/fetch-engines.js` if you don't have them already, or verify what
   you have against `engines-lock.json`):
   ```bash
   npm run build:installer
   ```

3. **Build the real macOS app**, from an actual Mac with `backend/mac/`
   populated (same `fetch-engines.js` command, run on macOS so it can
   actually unpack the archives — see the note in
   [CONTRIBUTING.md](CONTRIBUTING.md#a-note-on-the-inference-engines) about
   why that step fails on Windows):
   ```bash
   npm run electron:build:mac
   ```
   This produces the inference-capable `.zip`/`.dmg` — replace the
   UI-shell-only ones CI already attached to the draft with these.

4. **Regenerate `CHECKSUMS.txt`** covering every final asset (not just the
   CI-built subset) and upload it to the release, replacing the one CI
   generated:
   ```bash
   sha256sum Solframe-Studio-*.exe Solframe.Studio-*.zip *.AppImage *.deb > CHECKSUMS.txt
   ```
   (`Get-FileHash -Algorithm SHA256` on Windows PowerShell if that's more
   convenient than a Git Bash/WSL shell.)

5. **Upload everything to the draft release** — the two Windows installers
   from step 2, the real macOS build from step 3, and the regenerated
   `CHECKSUMS.txt` from step 4. Remove CI's placeholder body text and paste
   in the relevant `RELEASE_NOTES.md` section.

6. **Rebuild the landing page** (`docs/index.html`) so its download links
   and file sizes match this release — this happens automatically on the
   next push to `main` via `.github/workflows/pages.yml`, which also runs
   `scripts/check-release-links.js` to catch a broken download link before
   it goes live.

7. **Review, then publish the draft.** Once every asset is attached and the
   body reads correctly, hit Publish on GitHub.

## Commit messages

This project follows [Conventional Commits](https://www.conventionalcommits.org/)
(`feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`, `security:` —
see `git log` for real examples) — not enforced by a bot, just the
convention every PR is expected to follow. It's what makes `CHANGELOG.md`
easy to keep in sync with actual commit history.
