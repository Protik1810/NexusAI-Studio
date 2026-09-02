#!/usr/bin/env node
// Downloads the stable-diffusion.cpp / llama.cpp engine binaries this repo
// doesn't commit (see ARCHITECTURE.md "What's in backend/win/ and
// backend/mac/, and why they aren't committed") into backend/win/ and
// backend/mac/, verifying each download's SHA-256 against a checked-in
// lockfile (engines-lock.json) so a compromised or corrupted upstream
// asset can't silently end up bundled into a release.
//
// IMPORTANT — read before relying on this: the asset name patterns in
// TARGETS below (the `match` arrays) are this script's best-effort guess
// at each project's current release-asset naming, written without live
// access to GitHub's API to confirm them against the real, current asset
// list (see the git history around this file's introduction for why). Run
//   node scripts/fetch-engines.js --list-assets stable-diffusion.cpp
//   node scripts/fetch-engines.js --list-assets llama.cpp
// first and compare the real names against `match` below before trusting
// a real fetch — adjust the substrings if they don't line up.
//
// Usage:
//   node scripts/fetch-engines.js --list-assets <sd.cpp|llama.cpp>   list every asset in that project's latest release
//   node scripts/fetch-engines.js --bootstrap                        fetch everything, write engines-lock.json from what was downloaded
//   node scripts/fetch-engines.js                                    fetch everything, verify each download's SHA-256 against engines-lock.json
//   node scripts/fetch-engines.js --only win.cuda                    restrict to one target (see TARGETS keys below)
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const LOCKFILE = path.join(ROOT, 'engines-lock.json');

const REPOS = {
  'stable-diffusion.cpp': 'leejet/stable-diffusion.cpp',
  'llama.cpp': 'ggml-org/llama.cpp'
};

// Each target: which repo, which substrings a release asset's filename
// must ALL contain (case-insensitive) to be picked, which substrings
// disqualify a candidate even if `match` hits (both projects also publish
// a separate "cudart-*" asset that's just the CUDA redistributable DLLs,
// not the actual sd-cli/llama-server binaries, and matches the same
// win+cuda substrings), and where to unpack the result.
//
// win.llama and mac.llama are pinned to CUDA 12.4 / arm64 specifically —
// verified live against ggml-org/llama.cpp's b10752 release (2026-09):
// CUDA 12 matches the cublas64_12.dll/cudart64_12.dll already vendored in
// backend/win/llama, and arm64 matches the "Apple Silicon" build this
// project's own RELEASE_NOTES.md advertises. An Intel Mac engine build
// would need llama-b<N>-bin-macos-x64.tar.gz instead — not fetched here,
// since backend/mac/ is currently shared as-is across both electron-
// builder mac targets (see package.json's "mac" config) rather than
// built per-architecture.
const TARGETS = {
  'win.cuda': { repo: 'stable-diffusion.cpp', match: ['win', 'cuda'], exclude: ['cudart'], destDir: 'backend/win/cuda' },
  'win.vulkan': { repo: 'stable-diffusion.cpp', match: ['win', 'vulkan'], exclude: ['cudart'], destDir: 'backend/win/vulkan' },
  'win.cpu': { repo: 'stable-diffusion.cpp', match: ['win', 'cpu'], exclude: ['cudart'], destDir: 'backend/win/cpu' },
  'win.llama': { repo: 'llama.cpp', match: ['win', 'cuda-12.4'], exclude: ['cudart'], destDir: 'backend/win/llama' },
  'mac.metal': { repo: 'stable-diffusion.cpp', match: ['macos'], destDir: 'backend/mac/metal' },
  'mac.llama': { repo: 'llama.cpp', match: ['macos', 'arm64'], destDir: 'backend/mac/llama' }
};

function parseArgs(argv) {
  const args = { bootstrap: false, listAssets: null, only: null };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--bootstrap') args.bootstrap = true;
    else if (argv[i] === '--list-assets') args.listAssets = argv[++i];
    else if (argv[i] === '--only') args.only = argv[++i];
  }
  return args;
}

// GitHub's own "latest" designation (the /releases/latest endpoint) is
// wrong for at least one of these two projects: leejet/stable-diffusion.cpp
// tags every merge as a rolling "master-<N>-<sha>" release correctly
// flagged latest, but ggml-org/llama.cpp's /releases/latest returns an old
// "v0.3.0" marker release with a single placeholder asset — its real,
// current binary builds are separately-tagged "b<N>" releases that GitHub
// doesn't consider "latest" by semver sorting. Fetching the single most
// recently *published* release (regardless of the latest flag) is correct
// for both — verified live against both repos' actual release lists.
async function fetchLatestRelease(repo) {
  const res = await fetch(`https://api.github.com/repos/${repo}/releases?per_page=1`, {
    headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'solframe-studio-fetch-engines' }
  });
  if (!res.ok) throw new Error(`GitHub API HTTP ${res.status} fetching releases for ${repo}`);
  const releases = await res.json();
  if (!releases[0]) throw new Error(`${repo} has no releases`);
  return releases[0];
}

function pickAsset(assets, matchSubstrings, excludeSubstrings) {
  const exclude = excludeSubstrings || [];
  const candidates = assets.filter(a => {
    const name = a.name.toLowerCase();
    return matchSubstrings.every(s => name.includes(s.toLowerCase())) &&
      !exclude.some(s => name.includes(s.toLowerCase()));
  });
  if (candidates.length === 0) {
    throw new Error(`No release asset matched [${matchSubstrings.join(', ')}] (excluding [${exclude.join(', ')}]) — run --list-assets to see what's actually available and adjust TARGETS.`);
  }
  if (candidates.length > 1) {
    throw new Error(`${candidates.length} assets matched [${matchSubstrings.join(', ')}] (ambiguous): ${candidates.map(a => a.name).join(', ')} — narrow the match/exclude substrings in TARGETS.`);
  }
  return candidates[0];
}

async function downloadFile(url, destPath) {
  const res = await fetch(url, { headers: { 'User-Agent': 'solframe-studio-fetch-engines' } });
  if (!res.ok) throw new Error(`HTTP ${res.status} downloading ${url}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(destPath, buffer);
  return buffer;
}

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

// No zip-extraction npm dependency needed — bsdtar (bundled with Windows
// 10 1803+ as tar.exe) and macOS/Linux's own tar both handle .zip
// transparently via -xf, so this stays dependency-free.
// `tar -xf` extracts .zip transparently on macOS and Windows (both ship
// bsdtar, which auto-detects zip vs tar), but plain Linux distros ship GNU
// tar, which has no zip support at all and fails with "This does not look
// like a tar archive" — verified live in WSL/Ubuntu. .tar.gz assets (the
// macOS llama.cpp build) extract fine with tar everywhere; .zip assets
// need `unzip` specifically on a GNU-tar system.
function extractArchive(archivePath, destDir) {
  fs.mkdirSync(destDir, { recursive: true });
  if (archivePath.toLowerCase().endsWith('.zip') && process.platform === 'linux') {
    try {
      execFileSync('unzip', ['-o', archivePath, '-d', destDir], { stdio: 'inherit' });
      return;
    } catch (e) {
      // Fall through to python3's zipfile module — no extra install needed
      // on most Linux dev/CI environments that already have Python.
    }
    try {
      execFileSync('python3', ['-m', 'zipfile', '-e', archivePath, destDir], { stdio: 'inherit' });
      return;
    } catch (e) {
      throw new Error(`Couldn't extract ${path.basename(archivePath)}: GNU tar can't read .zip files, and neither 'unzip' nor 'python3' worked (try: sudo apt-get install unzip).`);
    }
  }
  execFileSync('tar', ['-xf', archivePath, '-C', destDir], { stdio: 'inherit' });
}

function loadLockfile() {
  if (!fs.existsSync(LOCKFILE)) return {};
  return JSON.parse(fs.readFileSync(LOCKFILE, 'utf8'));
}

function saveLockfile(lock) {
  fs.writeFileSync(LOCKFILE, JSON.stringify(lock, null, 2) + '\n');
}

async function listAssets(projectKey) {
  const repo = REPOS[projectKey];
  if (!repo) throw new Error(`Unknown project "${projectKey}" — expected one of: ${Object.keys(REPOS).join(', ')}`);
  const release = await fetchLatestRelease(repo);
  console.log(`${repo} latest release: ${release.tag_name}`);
  for (const asset of release.assets) {
    console.log(`  ${asset.name}  (${(asset.size / 1e6).toFixed(1)} MB)`);
  }
}

async function fetchTarget(key, target, lock, bootstrap) {
  const repo = REPOS[target.repo];
  const release = await fetchLatestRelease(repo);
  const asset = pickAsset(release.assets, target.match, target.exclude);

  const tmpZip = path.join(os.tmpdir(), `solframe-engine-${key.replace(/\./g, '-')}-${Date.now()}.zip`);
  console.log(`[${key}] downloading ${asset.name} from ${target.repo} ${release.tag_name}...`);
  let buffer;
  try {
    buffer = await downloadFile(asset.browser_download_url, tmpZip);
    const hash = sha256(buffer);

    if (bootstrap) {
      lock[key] = { repo: target.repo, tag: release.tag_name, asset: asset.name, sha256: hash };
      console.log(`[${key}] recorded ${asset.name} @ ${hash.slice(0, 12)}... into the lockfile`);
    } else {
      const expected = lock[key];
      if (!expected) {
        throw new Error(`No lockfile entry for "${key}" — run with --bootstrap first to create engines-lock.json.`);
      }
      if (expected.sha256 !== hash) {
        throw new Error(`SHA-256 mismatch for ${key}: expected ${expected.sha256}, got ${hash}. Refusing to unpack a download that doesn't match the lockfile.`);
      }
      console.log(`[${key}] checksum verified against engines-lock.json`);
    }

    // macOS release archives contain real Unix symlinks (e.g.
    // libggml.dylib -> libggml.0.dylib) for versioned .dylib files —
    // standard practice, but Windows can't create those without Developer
    // Mode (or admin) enabled, and bsdtar fails the whole extraction the
    // moment it hits one ("Invalid argument"). Verified live: this is
    // exactly what happened extracting llama.cpp's macOS build here.
    // Downloading and checksum-verifying still succeeds and is still
    // useful (the lockfile entry works for a subsequent run on macOS/
    // Linux, or in CI on a macOS runner) — only unpacking is skipped.
    if (process.platform === 'win32' && target.destDir.startsWith('backend/mac')) {
      console.log(`[${key}] downloaded and verified, but skipping extraction: Windows can't unpack this macOS archive's symlinks without Developer Mode enabled. Run this script on macOS or Linux to actually unpack ${target.destDir}.`);
    } else {
      console.log(`[${key}] extracting into ${target.destDir}...`);
      extractArchive(tmpZip, path.join(ROOT, target.destDir));
    }
  } finally {
    fs.rmSync(tmpZip, { force: true });
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.listAssets) {
    await listAssets(args.listAssets);
    return;
  }

  const keys = args.only ? [args.only] : Object.keys(TARGETS);
  const lock = loadLockfile();

  for (const key of keys) {
    const target = TARGETS[key];
    if (!target) throw new Error(`Unknown target "${key}" — expected one of: ${Object.keys(TARGETS).join(', ')}`);
    await fetchTarget(key, target, lock, args.bootstrap);
    // Saved after every target, not just once at the end — a later
    // target failing (verified live: a macOS archive's symlinks failing
    // to extract on Windows) would otherwise discard every already-
    // verified download's lockfile entry along with it.
    if (args.bootstrap) saveLockfile(lock);
  }

  if (args.bootstrap) {
    console.log(`\nWrote ${LOCKFILE} — review it, then commit it so future runs verify against these exact versions.`);
  }
}

main().catch(err => {
  console.error(`\n[fetch-engines] ${err.message}`);
  process.exit(1);
});
