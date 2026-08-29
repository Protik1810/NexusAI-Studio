# ✨ NexusAI Studio v1.0.0

Autonomous, sovereign & 100% offline local Generative AI workstation by **Protik**.

[![License: GPL v3](https://img.shields.io/badge/License-GNU%20GPL%20v3.0-blue.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/Platform-Windows%20x64-blue.svg)](https://github.com/Protik1810/NexusAI-Studio)

---

### 🚀 Highlights
- **Image Studio**: Native `stable-diffusion.cpp` support for FLUX.2-Klein, SDXL Lightning (4-step), and LoRA dynamic stacking.
- **Uncensored LLM Chat**: Native `llama.cpp` streaming engine for GGUF models (Qwen 2.5, Llama 3, DeepSeek) with 1-click prompt export to Image Studio.
- **Dynamic Drive Scanner**: Auto-discovers checkpoints and weights across all drives (`C:`, `D:`, `E:`, ComfyUI, WebUI) with sub-ms cache load.
- **Hardware Acceleration**: Automatic routing to **NVIDIA CUDA 12**, **AMD/Intel Vulkan**, or **AVX2 CPU**.
- **6 Ambient Themes**: Dark Void, Neon Cyber, Cinema Gold, Synthwave Sunset, Anime Fantasy, and Emerald Matrix.

---

### 📦 Downloads

| File | Size | Description |
|---|---|---|
| 📦 **NexusAI-Studio-Setup-1.0.0.exe** | ~806 MB | Complete offline installer (bundled CUDA, Vulkan, CPU engines) |
| 🪶 **NexusAI-Studio-Setup-1.0.0-Lightweight.exe** | ~120 MB | Lightweight installer (download engines on-demand) |

---

### 🛠️ Key Fixes in v1.0.0
- Fixed CUDA exit code 1 file flush handling via async retry poller.
- Enhanced multi-drive recursive checkpoint auto-discovery.
- Fixed non-diffusion model misclassification.
- Modularized core backend engine and decoupled React 19 UI components.

---

### 💻 Linux & macOS Quick Start (Terminal)

```bash
# 🐧 Linux & 🍎 macOS: Clone, Install & Launch
git clone https://github.com/Protik1810/NexusAI-Studio.git && cd NexusAI-Studio && npm install && npm run dev
```

---

### 📜 License
Released under the **GNU General Public License v3.0 (GPL-3.0)**.  
*Created & Engineered by **[Protik](https://github.com/Protik1810)**.*
