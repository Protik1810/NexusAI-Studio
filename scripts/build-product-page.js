const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

console.log('[ProductPage] Generating NexusAI Studio Product Showcase Website...');

const rootDir = path.resolve(__dirname, '..');
const outDir = path.join(os.tmpdir(), 'nexusai-product-landing');

if (fs.existsSync(outDir)) {
  fs.rmSync(outDir, { recursive: true, force: true });
}
fs.mkdirSync(outDir, { recursive: true });
fs.mkdirSync(path.join(outDir, 'themes'), { recursive: true });

// Copy logo and themes
fs.copyFileSync(path.join(rootDir, 'public/logo.png'), path.join(outDir, 'logo.png'));
fs.copyFileSync(path.join(rootDir, 'public/nexusai-icon.png'), path.join(outDir, 'nexusai-icon.png'));

const themeFiles = ['dark-void.jpg', 'neon-cyber.jpg', 'cinema-gold.jpg', 'synthwave.jpg', 'anime-fantasy.jpg', 'emerald-matrix.jpg'];
for (const tf of themeFiles) {
  const p = path.join(rootDir, 'public/themes', tf);
  if (fs.existsSync(p)) {
    fs.copyFileSync(p, path.join(outDir, 'themes', tf));
  }
}

fs.writeFileSync(path.join(outDir, '.nojekyll'), '');

const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="icon" type="image/png" href="logo.png">
  <title>NexusAI Studio — Sovereign Desktop Generative AI Workstation</title>
  <meta name="description" content="NexusAI Studio is an autonomous, 100% private desktop AI workstation combining FLUX.2 Klein & SDXL Lightning image synthesis with native llama.cpp GGUF dialogue engines. Designed & engineered by Protik.">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg-color: #030712;
      --panel-bg: rgba(13, 20, 36, 0.72);
      --accent: #06b6d4;
      --accent-secondary: #8b5cf6;
      --accent-glow: rgba(6, 182, 212, 0.4);
      --text-primary: #ffffff;
      --text-secondary: #94a3b8;
      --text-muted: #64748b;
      --border-color: rgba(255, 255, 255, 0.08);
      --card-bg: rgba(255, 255, 255, 0.03);
      --wallpaper: url('themes/dark-void.jpg');
    }

    [data-theme="neon-cyber"] {
      --accent: #ec4899;
      --accent-secondary: #06b6d4;
      --accent-glow: rgba(236, 72, 153, 0.45);
      --wallpaper: url('themes/neon-cyber.jpg');
    }

    [data-theme="cinema-gold"] {
      --accent: #eab308;
      --accent-secondary: #f97316;
      --accent-glow: rgba(234, 179, 8, 0.45);
      --wallpaper: url('themes/cinema-gold.jpg');
    }

    [data-theme="synthwave"] {
      --accent: #f43f5e;
      --accent-secondary: #8b5cf6;
      --accent-glow: rgba(244, 63, 94, 0.45);
      --wallpaper: url('themes/synthwave.jpg');
    }

    [data-theme="anime-fantasy"] {
      --accent: #a855f7;
      --accent-secondary: #ec4899;
      --accent-glow: rgba(168, 85, 247, 0.45);
      --wallpaper: url('themes/anime-fantasy.jpg');
    }

    [data-theme="emerald-matrix"] {
      --accent: #10b981;
      --accent-secondary: #06b6d4;
      --accent-glow: rgba(16, 185, 129, 0.45);
      --wallpaper: url('themes/emerald-matrix.jpg');
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif;
      background-color: var(--bg-color);
      background-image: 
        linear-gradient(180deg, rgba(6, 10, 20, 0.75) 0%, rgba(3, 5, 12, 0.92) 100%),
        var(--wallpaper);
      background-size: cover;
      background-position: center;
      background-attachment: fixed;
      color: var(--text-primary);
      line-height: 1.6;
      min-height: 100vh;
      overflow-x: hidden;
      transition: background-image 0.5s ease;
    }

    /* Navigation */
    .navbar {
      position: sticky;
      top: 0;
      z-index: 100;
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      background: rgba(8, 12, 24, 0.7);
      border-bottom: 1px solid var(--border-color);
      padding: 16px 24px;
    }

    .nav-container {
      max-width: 1200px;
      margin: 0 auto;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .brand {
      display: flex;
      align-items: center;
      gap: 12px;
      text-decoration: none;
      color: #fff;
    }

    .brand-logo {
      width: 38px;
      height: 38px;
      border-radius: 10px;
      box-shadow: 0 0 16px var(--accent-glow);
      border: 1px solid rgba(255, 255, 255, 0.2);
    }

    .brand-title {
      font-size: 20px;
      font-weight: 800;
      letter-spacing: -0.02em;
      background: linear-gradient(135deg, #fff 40%, var(--accent) 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }

    .nav-links {
      display: flex;
      align-items: center;
      gap: 24px;
    }

    .nav-link {
      color: var(--text-secondary);
      text-decoration: none;
      font-size: 14px;
      font-weight: 600;
      transition: color 0.2s;
    }

    .nav-link:hover {
      color: #fff;
    }

    .btn-nav-download {
      background: linear-gradient(135deg, var(--accent) 0%, var(--accent-secondary) 100%);
      color: #fff;
      text-decoration: none;
      padding: 8px 18px;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 700;
      box-shadow: 0 4px 14px var(--accent-glow);
      transition: transform 0.2s, filter 0.2s;
    }

    .btn-nav-download:hover {
      transform: translateY(-1px);
      filter: brightness(1.15);
    }

    /* Container */
    .container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 0 24px;
    }

    /* Glass Panels */
    .glass-card {
      background: var(--panel-bg);
      backdrop-filter: blur(24px) saturate(160%);
      -webkit-backdrop-filter: blur(24px) saturate(160%);
      border: 1px solid var(--border-color);
      border-radius: 16px;
      padding: 32px;
      box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5);
      transition: border-color 0.3s, transform 0.3s;
    }

    .glass-card:hover {
      border-color: rgba(255, 255, 255, 0.15);
    }

    /* Hero Section */
    .hero {
      padding: 90px 0 60px;
      text-align: center;
      position: relative;
    }

    .hero-badge {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 6px 14px;
      background: rgba(6, 182, 212, 0.12);
      border: 1px solid rgba(6, 182, 212, 0.3);
      border-radius: 20px;
      font-size: 12px;
      font-weight: 700;
      color: var(--accent);
      margin-bottom: 24px;
      box-shadow: 0 0 20px var(--accent-glow);
    }

    .hero-title {
      font-size: 54px;
      font-weight: 800;
      letter-spacing: -0.03em;
      line-height: 1.15;
      margin-bottom: 20px;
      color: #ffffff;
    }

    .hero-gradient {
      background: linear-gradient(135deg, #ffffff 30%, var(--accent) 70%, var(--accent-secondary) 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }

    .hero-subtitle {
      font-size: 18px;
      color: var(--text-secondary);
      max-width: 760px;
      margin: 0 auto 36px;
      line-height: 1.6;
    }

    .hero-cta {
      display: flex;
      justify-content: center;
      gap: 16px;
      flex-wrap: wrap;
      margin-bottom: 50px;
    }

    .btn-primary {
      background: linear-gradient(135deg, var(--accent) 0%, var(--accent-secondary) 100%);
      color: #fff;
      text-decoration: none;
      padding: 15px 32px;
      border-radius: 12px;
      font-size: 16px;
      font-weight: 700;
      display: inline-flex;
      align-items: center;
      gap: 10px;
      box-shadow: 0 8px 30px var(--accent-glow);
      transition: transform 0.2s, filter 0.2s;
    }

    .btn-primary:hover {
      transform: translateY(-2px);
      filter: brightness(1.15);
    }

    .btn-secondary {
      background: rgba(255, 255, 255, 0.08);
      color: #fff;
      text-decoration: none;
      padding: 15px 28px;
      border-radius: 12px;
      font-size: 16px;
      font-weight: 600;
      border: 1px solid rgba(255, 255, 255, 0.12);
      display: inline-flex;
      align-items: center;
      gap: 8px;
      transition: background 0.2s, border-color 0.2s, transform 0.2s;
    }

    .btn-secondary:hover {
      background: rgba(255, 255, 255, 0.14);
      border-color: rgba(255, 255, 255, 0.25);
      transform: translateY(-2px);
    }

    /* Interactive Theme Bar */
    .theme-switcher-box {
      margin: 40px auto;
      max-width: 900px;
      padding: 24px;
      border-radius: 16px;
      background: rgba(0, 0, 0, 0.4);
      border: 1px solid var(--border-color);
    }

    .theme-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
      gap: 10px;
      margin-top: 14px;
    }

    .theme-card-btn {
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 10px;
      padding: 10px;
      color: #fff;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 6px;
      transition: all 0.2s;
    }

    .theme-card-btn:hover {
      border-color: var(--accent);
      background: rgba(255, 255, 255, 0.1);
    }

    .theme-dot {
      width: 14px;
      height: 14px;
      border-radius: 50%;
    }

    /* Feature Grid */
    .features-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(270px, 1fr));
      gap: 24px;
      margin: 60px 0;
    }

    .feature-card {
      background: var(--panel-bg);
      border: 1px solid var(--border-color);
      border-radius: 16px;
      padding: 28px;
      transition: transform 0.2s, border-color 0.2s;
    }

    .feature-card:hover {
      transform: translateY(-4px);
      border-color: var(--accent);
    }

    .feature-icon {
      width: 48px;
      height: 48px;
      border-radius: 12px;
      background: rgba(6, 182, 212, 0.15);
      color: var(--accent);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 22px;
      margin-bottom: 16px;
    }

    .feature-title {
      font-size: 18px;
      font-weight: 700;
      margin-bottom: 10px;
      color: #fff;
    }

    .feature-desc {
      font-size: 13px;
      color: var(--text-secondary);
      line-height: 1.6;
    }

    /* Creator Spotlight */
    .creator-card {
      background: linear-gradient(135deg, rgba(139, 92, 246, 0.12) 0%, rgba(6, 182, 212, 0.08) 100%);
      border: 1px solid rgba(139, 92, 246, 0.35);
      border-radius: 20px;
      padding: 40px;
      margin: 60px 0;
      display: flex;
      align-items: center;
      gap: 32px;
      flex-wrap: wrap;
    }

    .creator-avatar {
      width: 80px;
      height: 80px;
      border-radius: 20px;
      background: linear-gradient(135deg, #8b5cf6 0%, #06b6d4 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 36px;
      box-shadow: 0 0 30px rgba(139, 92, 246, 0.4);
      flex-shrink: 0;
    }

    /* Spec table */
    .spec-table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 16px;
      font-size: 13px;
    }

    .spec-table th, .spec-table td {
      padding: 12px 16px;
      border-bottom: 1px solid var(--border-color);
      text-align: left;
    }

    .spec-table th {
      color: var(--text-muted);
      font-weight: 600;
      text-transform: uppercase;
      font-size: 11px;
      letter-spacing: 0.05em;
    }

    /* Footer */
    footer {
      border-top: 1px solid var(--border-color);
      padding: 40px 0;
      margin-top: 80px;
      text-align: center;
      color: var(--text-muted);
      font-size: 13px;
      background: rgba(0, 0, 0, 0.6);
    }

    @media (max-width: 768px) {
      .hero-title { font-size: 36px; }
      .nav-links { display: none; }
    }
  </style>
</head>
<body>

  <!-- Navigation -->
  <nav class="navbar">
    <div class="nav-container">
      <a href="#" class="brand">
        <img src="logo.png" alt="NexusAI Studio Logo" class="brand-logo">
        <span class="brand-title">NexusAI Studio</span>
      </a>
      <div class="nav-links">
        <a href="#features" class="nav-link">Features</a>
        <a href="#themes" class="nav-link">6 Themes</a>
        <a href="#hardware" class="nav-link">Hardware Engine</a>
        <a href="#creator" class="nav-link">Creator</a>
        <a href="https://github.com/Protik1810/NexusAI-Studio" target="_blank" class="nav-link">GitHub</a>
        <a href="https://github.com/Protik1810/NexusAI-Studio/releases" class="btn-nav-download">Download v1.0.0</a>
      </div>
    </div>
  </nav>

  <div class="container">

    <!-- Hero Section -->
    <header class="hero">
      <div class="hero-badge">
        <span>⚡</span> v1.0.0 Production Release &bull; 100% Private & Offline
      </div>
      <h1 class="hero-title">
        The Sovereign Desktop<br>
        <span class="hero-gradient">Generative AI Workstation</span>
      </h1>
      <p class="hero-subtitle">
        Synthesize photorealistic <strong>FLUX.2 Klein & SDXL Lightning</strong> artwork and chat with uncensored <strong>GGUF LLMs</strong> — powered by native C++ hardware kernels directly on your GPU. Zero cloud telemetry. Zero subscription fees.
      </p>

      <div class="hero-cta">
        <a href="https://github.com/Protik1810/NexusAI-Studio/releases" class="btn-primary">
          <span>🚀</span> Download Windows Setup (.exe)
        </a>
        <a href="https://github.com/Protik1810/NexusAI-Studio" target="_blank" class="btn-secondary">
          <span>⭐</span> Star on GitHub
        </a>
      </div>

      <!-- Interactive Theme Preview Box -->
      <div class="theme-switcher-box" id="themes">
        <div style="font-size: 13px; font-weight: 700; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.08em; display: flex; align-items: center; justify-content: center; gap: 8px;">
          <span>🎨</span> Live Visual Wallpaper Themes (Click to Preview Website Backdrop):
        </div>
        <div class="theme-grid">
          <button class="theme-card-btn" onclick="setTheme('dark-void')">
            <div class="theme-dot" style="background: #06b6d4;"></div>
            <span>Dark Void</span>
          </button>
          <button class="theme-card-btn" onclick="setTheme('neon-cyber')">
            <div class="theme-dot" style="background: #ec4899;"></div>
            <span>Neon Cyber</span>
          </button>
          <button class="theme-card-btn" onclick="setTheme('cinema-gold')">
            <div class="theme-dot" style="background: #eab308;"></div>
            <span>Cinema Gold</span>
          </button>
          <button class="theme-card-btn" onclick="setTheme('synthwave')">
            <div class="theme-dot" style="background: #f43f5e;"></div>
            <span>Synthwave</span>
          </button>
          <button class="theme-card-btn" onclick="setTheme('anime-fantasy')">
            <div class="theme-dot" style="background: #a855f7;"></div>
            <span>Anime Fantasy</span>
          </button>
          <button class="theme-card-btn" onclick="setTheme('emerald-matrix')">
            <div class="theme-dot" style="background: #10b981;"></div>
            <span>Emerald Matrix</span>
          </button>
        </div>
      </div>
    </header>

    <!-- Core Features Grid -->
    <section id="features" class="features-grid">
      
      <div class="feature-card">
        <div class="feature-icon">🎨</div>
        <h3 class="feature-title">FLUX.2 & SDXL Image Synthesis</h3>
        <p class="feature-desc">
          Powered by <code>stable-diffusion.cpp</code> with hardware acceleration. Supports split-architecture FLUX.2 Klein models with 32-channel VAEs, GGUF text encoders, and 4-step SDXL Lightning checkpoints.
        </p>
      </div>

      <div class="feature-card">
        <div class="feature-icon">💬</div>
        <h3 class="feature-title">Uncensored Local LLM Chat</h3>
        <p class="feature-desc">
          Native <code>llama.cpp</code> GPU server engine for GGUF dialogue models (DeepSeek, Qwen 2.5, Gemma 4, Llama 3). Real-time token streaming, persona presets, and 1-click prompt export to the image canvas.
        </p>
      </div>

      <div class="feature-card">
        <div class="feature-icon">🎮</div>
        <h3 class="feature-title">Cross-Vendor GPU Auto-Routing</h3>
        <p class="feature-desc">
          Automatically detects NVIDIA GPUs (routing to <strong>CUDA Tensor Cores</strong>) and AMD Radeon / Intel Arc GPUs (routing to <strong>Vulkan Shaders</strong>) with multi-threaded AVX2 CPU fallback.
        </p>
      </div>

      <div class="feature-card">
        <div class="feature-icon">🗄️</div>
        <h3 class="feature-title">Universal Multi-Drive Scanner</h3>
        <p class="feature-desc">
          Zero hardcoded paths. Scans all mounted drives (<code>C:</code>, <code>D:</code>, <code>E:</code>) and AI directories with sub-millisecond cold starts via persistent cache (<code>~/.nexusai/scan_cache.json</code>).
        </p>
      </div>

    </section>

    <!-- Hardware Matrix -->
    <section id="hardware" class="glass-card" style="margin: 60px 0;">
      <h2 style="font-size: 24px; font-weight: 800; margin-bottom: 8px;">🎮 Hardware Acceleration & Engine Matrix</h2>
      <p style="font-size: 14px; color: var(--text-secondary); margin-bottom: 20px;">
        NexusAI Studio automatically queries your system graphics adapters and selects the most performant backend binary without manual configuration.
      </p>

      <div style="overflow-x: auto;">
        <table class="spec-table">
          <thead>
            <tr>
              <th>GPU Family</th>
              <th>Backend Engine</th>
              <th>Acceleration Technology</th>
              <th>Supported Architectures</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><strong>NVIDIA GeForce / RTX / Quadro</strong></td>
              <td><span style="color: #22d3ee; font-weight: 700;">CUDA 12.x</span></td>
              <td>Tensor Cores + cuBLAS</td>
              <td>FLUX.2 Klein, SDXL, SD 1.5, GGUF LLMs</td>
            </tr>
            <tr>
              <td><strong>AMD Radeon RX / Instinct</strong></td>
              <td><span style="color: #f43f5e; font-weight: 700;">Vulkan 1.3</span></td>
              <td>Cross-Platform GPU Shaders</td>
              <td>FLUX.2 Klein, SDXL, SD 1.5, GGUF LLMs</td>
            </tr>
            <tr>
              <td><strong>Intel Arc & Iris Xe</strong></td>
              <td><span style="color: #a855f7; font-weight: 700;">Vulkan 1.3</span></td>
              <td>SPIR-V Compute Kernels</td>
              <td>SDXL Lightning, SD 1.5, GGUF LLMs</td>
            </tr>
            <tr>
              <td><strong>CPU Fallback (No Discrete GPU)</strong></td>
              <td><span style="color: #94a3b8; font-weight: 700;">AVX2 / Multi-Thread</span></td>
              <td>SIMD Vectorization</td>
              <td>Quantized GGUF Diffusion & LLMs</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <!-- Creator Spotlight -->
    <section id="creator" class="creator-card">
      <div class="creator-avatar">👨‍💻</div>
      <div style="flex: 1; min-width: 280px;">
        <div style="font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #a78bfa; margin-bottom: 4px;">
          Lead Creator & Architect
        </div>
        <h2 style="font-size: 28px; font-weight: 800; color: #fff; margin-bottom: 12px;">Protik</h2>
        <p style="font-size: 14px; color: var(--text-secondary); line-height: 1.7; margin-bottom: 16px;">
          Engineered and crafted by <strong>Protik</strong> with a mission for sovereign, privacy-first generative AI. Built to give creators complete autonomy over cutting-edge diffusion synthesis and large language models directly on personal desktop hardware — free from cloud subscriptions, data mining, and platform lock-in.
        </p>
        <div style="font-size: 13px; color: var(--text-muted);">
          NexusAI Studio Engine &bull; Designed & Engineered by Protik
        </div>
      </div>
    </section>

  </div>

  <!-- Footer -->
  <footer>
    <div class="container">
      <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px;">
        <div style="display: flex; align-items: center; gap: 10px;">
          <img src="logo.png" alt="Logo" style="width: 24px; height: 24px; border-radius: 6px;">
          <strong>NexusAI Studio</strong> &bull; Created by <strong>Protik</strong>
        </div>
        <div>
          Powered by <code>stable-diffusion.cpp</code> & <code>llama.cpp</code> &bull; Released under MIT License
        </div>
      </div>
    </div>
  </footer>

  <script>
    function setTheme(theme) {
      document.body.setAttribute('data-theme', theme);
      localStorage.setItem('product-theme', theme);
    }
    const saved = localStorage.getItem('product-theme');
    if (saved) setTheme(saved);
  </script>
</body>
</html>`;

fs.writeFileSync(path.join(outDir, 'index.html'), htmlContent, 'utf8');
fs.writeFileSync(path.join(outDir, '404.html'), htmlContent, 'utf8');

console.log('[ProductPage] Pushing Product Showcase Website to origin gh-pages...');
execSync('git init', { cwd: outDir, stdio: 'inherit' });
execSync('git config user.name "Protik"', { cwd: outDir, stdio: 'inherit' });
execSync('git config user.email "protik@nexusai.local"', { cwd: outDir, stdio: 'inherit' });
execSync('git checkout -b gh-pages', { cwd: outDir, stdio: 'inherit' });
execSync('git add .', { cwd: outDir, stdio: 'inherit' });
execSync('git commit -m "feat: deploy NexusAI Studio Product Showcase Website to GitHub Pages by Protik"', { cwd: outDir, stdio: 'inherit' });
execSync('git remote add origin https://github.com/Protik1810/NexusAI-Studio.git', { cwd: outDir, stdio: 'inherit' });
execSync('git push -f origin gh-pages', { cwd: outDir, stdio: 'inherit' });

fs.rmSync(outDir, { recursive: true, force: true });
console.log('🎉 Product Website successfully deployed to https://protik1810.github.io/NexusAI-Studio/ !');