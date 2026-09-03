#!/usr/bin/env bash
#
# build-linux-cuda.sh — build the CUDA diffusion engine for Linux.
#
# Every other engine this app ships is downloaded prebuilt by
# scripts/fetch-engines.js. Linux CUDA is the exception: neither
# stable-diffusion.cpp nor llama.cpp publishes a prebuilt Linux CUDA binary
# (both ship CUDA for Windows, and vulkan/rocm/cpu for Linux), because a
# prebuilt would have to pin an exact CUDA runtime *and* glibc across every
# distro. So it is compiled here instead.
#
# The output is committed to no repo and fetched by no script — it is a
# build input, produced on a machine with the CUDA toolkit and dropped into
# backend/linux/cuda/ so electron-builder can bundle it. End users install
# nothing: they get the binary the same way Windows users already do.
#
# Requires: cmake, gcc/g++, git, and the CUDA toolkit (nvcc). Install the
# toolkit with NVIDIA's network repo — use the `cuda-toolkit` package, NOT
# `cuda` or `cuda-drivers`, which pull in kernel driver packages that can
# clash with a working display driver:
#
#   wget https://developer.download.nvidia.com/compute/cuda/repos/<distro>/x86_64/cuda-keyring_1.1-1_all.deb
#   sudo dpkg -i cuda-keyring_1.1-1_all.deb && sudo apt-get update
#   sudo apt-get install -y cuda-toolkit
#
# <distro> is the id+version with no dot, e.g. ubuntu2604. See
# https://docs.nvidia.com/cuda/cuda-installation-guide-linux/
#
# Usage:  bash scripts/build-linux-cuda.sh [git-ref]
#
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEST="$REPO_DIR/backend/linux/cuda"
WORK="${SD_CUDA_WORKDIR:-$HOME/.cache/solframe-sd-cuda}"

# Pin to the same upstream commit engines-lock.json records for the
# prebuilt Linux targets, so the CUDA build isn't silently a different
# version of the engine than the Vulkan/CPU ones it sits beside.
REF="${1:-$(node -e "
  try {
    const l = require('$REPO_DIR/engines-lock.json');
    const tag = (l['linux.vulkan'] || {}).tag || '';
    // Tags look like 'master-841-6b3edaa' — the trailing short SHA is the
    // actual commit, and is what git can check out.
    process.stdout.write(tag.split('-').pop() || 'master');
  } catch (e) { process.stdout.write('master'); }
" 2>/dev/null || echo master)}"

# Turing (the GTX 16xx/RTX 20xx era) through Blackwell. Every extra
# architecture is a separate device compile, so this list is the main
# driver of build time — trim it if you only need your own card.
CUDA_ARCHS="${SD_CUDA_ARCHS:-75;86;89;120}"

command -v cmake >/dev/null || { echo "cmake not found — sudo apt-get install -y cmake build-essential"; exit 1; }
NVCC="$(command -v nvcc || echo /usr/local/cuda/bin/nvcc)"
[ -x "$NVCC" ] || { echo "nvcc not found. Install the CUDA toolkit (see the header of this script)."; exit 1; }
export PATH="$(dirname "$NVCC"):$PATH"

echo "==> stable-diffusion.cpp @ $REF   archs=$CUDA_ARCHS"
echo "==> $("$NVCC" --version | tail -1)"

mkdir -p "$WORK"
if [ ! -d "$WORK/src/.git" ]; then
  git clone --recursive https://github.com/leejet/stable-diffusion.cpp "$WORK/src"
fi
cd "$WORK/src"
git fetch --all --tags --quiet
git checkout --quiet "$REF"
git submodule update --init --recursive --quiet

cmake -S . -B build \
  -DCMAKE_BUILD_TYPE=Release \
  -DSD_CUDA=ON \
  -DCMAKE_CUDA_ARCHITECTURES="$CUDA_ARCHS" \
  -DSD_BUILD_SHARED_LIBS=ON
cmake --build build --config Release -j"$(nproc)"

echo "==> collecting into $DEST"
rm -rf "$DEST"; mkdir -p "$DEST"
find build -maxdepth 3 -type f \( -name 'sd' -o -name 'sd-cli' -o -name '*.so*' \) -exec cp -a {} "$DEST/" \;
# Upstream names the CLI 'sd' in some versions and 'sd-cli' in others; the
# app looks for sd-cli.
[ -f "$DEST/sd-cli" ] || { [ -f "$DEST/sd" ] && mv "$DEST/sd" "$DEST/sd-cli"; }

# Bundle the CUDA runtime libs the binary links against, the same way the
# Windows build ships cudart64_12.dll/cublas64_12.dll — otherwise this only
# runs on machines that already have a matching CUDA toolkit installed.
#
# Copied by resolving the binary's own NEEDED entries rather than globbing a
# guessed lib directory: CUDA 13 resolves these through
# targets/<arch>/lib rather than the lib64 symlink, so a glob can silently
# match nothing and produce a bundle that only runs where CUDA is already
# installed. libcuda.so.1 is deliberately excluded — that one ships with the
# NVIDIA driver, and bundling a copy would override the user's own driver.
missing=0
for lib in libcudart libcublas libcublasLt; do
  src="$(ldd "$DEST/libstable-diffusion.so" 2>/dev/null | awk -v l="$lib" '$1 ~ "^"l"\\.so" {print $3; exit}')"
  if [ -n "$src" ] && [ -e "$src" ]; then
    cp -aL "$src" "$DEST/"                       # -L: flatten the symlink to a real file
    echo "    bundled $(basename "$src")"
  else
    echo "    WARNING: could not locate $lib — the bundle will need a system CUDA install"
    missing=1
  fi
done
[ "$missing" -eq 0 ] || echo "  (some CUDA runtime libs were not bundled)"

chmod +x "$DEST/sd-cli" 2>/dev/null || true
echo "==> done:"
ls -la "$DEST" | head -20
echo
echo "Sanity check:  \"$DEST/sd-cli\" --list-devices"
