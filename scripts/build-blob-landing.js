const fs = require('fs');
const path = require('path');

console.log('🔄 Copying assets alongside the showcase page...');

const rootDir = path.resolve(__dirname, '..');
const docsDir = path.join(rootDir, 'docs');
const SITE_BASE_URL = 'https://protik1810.github.io/Solframe-Studio/';

// Wipe docs/ before regenerating — otherwise a renamed/removed source asset
// (e.g. the screenshots switching from .png to .webp) leaves its old file
// behind forever, since copyAsset only ever adds files, never removes them.
fs.rmSync(docsDir, { recursive: true, force: true });

// Base64-inlining every asset used to make this a genuinely single-file
// page, but it also made the page ~15MB — well past the size cap most
// link-preview crawlers (confirmed: opengraph.xyz's 5MB limit, and very
// likely WhatsApp/Facebook's) enforce before they'll even attempt to read
// og:* tags, regardless of how early those tags appear in the document.
// Copying assets as real sibling files keeps this a single generated
// output directory while letting the actual index.html stay small.
const copyAsset = (relPath, destSubpath) => {
  const src = path.join(rootDir, relPath);
  if (!fs.existsSync(src)) return '';
  const dest = path.join(docsDir, destSubpath);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
  return destSubpath.replace(/\\/g, '/');
};

const logoUrl = copyAsset('public/logo.png', 'logo.png');
const faviconUrl = copyAsset('public/favicon.png', 'favicon.png');
const creatorAvatarUrl = copyAsset('public/avatars/protik-github.jpg', 'avatars/protik-github.jpg');
// The footer links to these by relative path — without copying them here,
// they 404 on the live site since docs/ never had them.
copyAsset('LICENSE', 'LICENSE');
copyAsset('TERMS.md', 'TERMS.md');
const CREATOR_GITHUB_URL = 'https://github.com/Protik1810';
const CREATOR_NAME = 'Lord Protik';

const screenshots = {
  lion: copyAsset('public/screenshots/showcase-lion-artwork.webp', 'screenshots/showcase-lion-artwork.webp'),
  canvas: copyAsset('public/screenshots/studio-image-canvas.webp', 'screenshots/studio-image-canvas.webp'),
  step16: copyAsset('public/screenshots/sampling-progress-step16.webp', 'screenshots/sampling-progress-step16.webp'),
  step44: copyAsset('public/screenshots/sampling-progress-step44.webp', 'screenshots/sampling-progress-step44.webp'),
  llm: copyAsset('public/screenshots/llm-chat-studio.webp', 'screenshots/llm-chat-studio.webp')
};

const themes = {
  darkVoid: copyAsset('public/themes/dark-void.jpg', 'themes/dark-void.jpg'),
  neonCyber: copyAsset('public/themes/neon-cyber.jpg', 'themes/neon-cyber.jpg'),
  cinemaGold: copyAsset('public/themes/cinema-gold.jpg', 'themes/cinema-gold.jpg'),
  synthwave: copyAsset('public/themes/synthwave.jpg', 'themes/synthwave.jpg'),
  animeFantasy: copyAsset('public/themes/anime-fantasy.jpg', 'themes/anime-fantasy.jpg'),
  emeraldMatrix: copyAsset('public/themes/emerald-matrix.jpg', 'themes/emerald-matrix.jpg')
};

console.log('✅ All assets copied successfully!');

const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Solframe Studio — Sovereign Desktop Generative AI Workstation</title>
  <meta name="description" content="100% private, sovereign desktop AI workstation combining FLUX.2 Klein & SDXL Lightning image synthesis with native llama.cpp GGUF dialogue engines. Designed & engineered by Protik.">
  <link rel="icon" type="image/png" href="${faviconUrl}">
  <!-- Open Graph / Twitter Card: link-preview crawlers (WhatsApp, Facebook,
       Slack, Discord, etc.) look for these tags specifically, and og:image
       must be a real fetchable URL — a data: URI is not valid per the OG
       spec, which is also why every asset on this page is now a real
       sibling file instead of inlined (see the copyAsset comment above). -->
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="Solframe Studio">
  <meta property="og:url" content="${SITE_BASE_URL}">
  <meta property="og:title" content="Solframe Studio — Sovereign Desktop Generative AI Workstation">
  <meta property="og:description" content="100% private, sovereign desktop AI workstation combining FLUX.2 Klein & SDXL Lightning image synthesis with native llama.cpp GGUF dialogue engines. Designed & engineered by Protik.">
  <meta property="og:image" content="${SITE_BASE_URL}${logoUrl}">
  <meta property="og:image:width" content="512">
  <meta property="og:image:height" content="512">
  <meta name="twitter:card" content="summary">
  <meta name="twitter:title" content="Solframe Studio — Sovereign Desktop Generative AI Workstation">
  <meta name="twitter:description" content="100% private, sovereign desktop AI workstation combining FLUX.2 Klein & SDXL Lightning image synthesis with native llama.cpp GGUF dialogue engines.">
  <meta name="twitter:image" content="${SITE_BASE_URL}${logoUrl}">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet">
  <style>
    :root {
      /* Cinema Gold is the default theme on first visit (no saved preference yet) */
      --bg-color: #030712;
      --panel-bg: rgba(13, 20, 36, 0.82);
      --accent: #eab308;
      --accent-secondary: #f97316;
      --accent-glow: rgba(234, 179, 8, 0.45);
      --text-primary: #ffffff;
      --text-secondary: #94a3b8;
      --text-muted: #64748b;
      --border-color: rgba(255, 255, 255, 0.1);
      --card-bg: rgba(255, 255, 255, 0.04);
      --wallpaper: url('${themes.cinemaGold}');
    }

    [data-theme="dark-void"] {
      --accent: #06b6d4;
      --accent-secondary: #8b5cf6;
      --accent-glow: rgba(6, 182, 212, 0.45);
      --wallpaper: url('${themes.darkVoid}');
    }

    [data-theme="neon-cyber"] {
      --accent: #ec4899;
      --accent-secondary: #06b6d4;
      --accent-glow: rgba(236, 72, 153, 0.45);
      --wallpaper: url('${themes.neonCyber}');
    }

    [data-theme="cinema-gold"] {
      --accent: #eab308;
      --accent-secondary: #f97316;
      --accent-glow: rgba(234, 179, 8, 0.45);
      --wallpaper: url('${themes.cinemaGold}');
    }

    [data-theme="synthwave"] {
      --accent: #f43f5e;
      --accent-secondary: #8b5cf6;
      --accent-glow: rgba(244, 63, 94, 0.45);
      --wallpaper: url('${themes.synthwave}');
    }

    [data-theme="anime-fantasy"] {
      --accent: #a855f7;
      --accent-secondary: #ec4899;
      --accent-glow: rgba(168, 85, 247, 0.45);
      --wallpaper: url('${themes.animeFantasy}');
    }

    [data-theme="emerald-matrix"] {
      --accent: #10b981;
      --accent-secondary: #06b6d4;
      --accent-glow: rgba(16, 185, 129, 0.45);
      --wallpaper: url('${themes.emeraldMatrix}');
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    html, body {
      background-color: #030712 !important;
      color: #ffffff !important;
      min-height: 100vh;
    }

    body {
      font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif;
      background-color: var(--bg-color);
      background-image: 
        linear-gradient(180deg, rgba(6, 10, 20, 0.82) 0%, rgba(3, 5, 12, 0.95) 100%),
        var(--wallpaper);
      background-size: cover;
      background-position: center;
      background-attachment: fixed;
      color: var(--text-primary);
      line-height: 1.6;
      min-height: 100vh;
      overflow-x: hidden;
      transition: background-image 0.4s ease;
    }

    /* Top Navigation */
    .navbar {
      position: sticky;
      top: 0;
      z-index: 1000;
      backdrop-filter: blur(24px) saturate(180%);
      -webkit-backdrop-filter: blur(24px) saturate(180%);
      background: rgba(8, 12, 24, 0.85);
      border-bottom: 1px solid var(--border-color);
      padding: 16px 24px;
    }

    .nav-container {
      max-width: 1240px;
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
      width: 40px;
      height: 40px;
      border-radius: 10px;
      box-shadow: 0 0 20px var(--accent-glow);
      border: 1px solid rgba(255, 255, 255, 0.2);
    }

    .hero-logo {
      display: block;
      width: 112px;
      height: 112px;
      margin: 0 auto 24px;
      border-radius: 26px;
      box-shadow: 0 0 55px var(--accent-glow), 0 0 110px var(--accent-glow);
      border: 1px solid rgba(255, 255, 255, 0.25);
    }

    .brand-title {
      font-size: 20px;
      font-weight: 800;
      letter-spacing: -0.02em;
      background: linear-gradient(135deg, #ffffff 40%, var(--accent) 100%);
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
      padding: 9px 20px;
      border-radius: 9px;
      font-size: 13px;
      font-weight: 700;
      box-shadow: 0 4px 16px var(--accent-glow);
      transition: transform 0.2s, filter 0.2s;
      display: inline-flex;
      align-items: center;
      gap: 8px;
    }

    .btn-nav-download:hover {
      transform: translateY(-1px);
      filter: brightness(1.15);
    }

    /* Container */
    .container {
      max-width: 1240px;
      margin: 0 auto;
      padding: 0 24px;
    }

    /* Glass Panels */
    .glass-card {
      background: var(--panel-bg);
      backdrop-filter: blur(24px) saturate(160%);
      -webkit-backdrop-filter: blur(24px) saturate(160%);
      border: 1px solid var(--border-color);
      border-radius: 18px;
      padding: 36px;
      box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5);
      transition: border-color 0.3s;
    }

    /* Hero Section */
    .hero {
      padding: 80px 0 50px;
      text-align: center;
      position: relative;
    }

    .hero-badge {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 7px 16px;
      background: rgba(6, 182, 212, 0.12);
      border: 1px solid rgba(6, 182, 212, 0.3);
      border-radius: 99px;
      font-size: 12px;
      font-weight: 700;
      color: var(--accent);
      margin-bottom: 24px;
      box-shadow: 0 0 25px var(--accent-glow);
    }

    .platform-banner {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 7px 16px;
      margin-bottom: 20px;
      background: rgba(16, 185, 129, 0.12);
      border: 1px solid rgba(16, 185, 129, 0.35);
      border-radius: 99px;
      font-size: 12px;
      font-weight: 700;
      color: #34d399;
    }

    .platform-banner a {
      color: inherit;
      text-decoration: underline;
    }

    [data-platform] {
      transition: opacity 0.3s ease, filter 0.3s ease;
    }

    [data-platform].platform-dim {
      opacity: 0.45;
      filter: grayscale(40%);
    }

    .hero-title {
      font-size: 56px;
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
      font-size: 19px;
      color: var(--text-secondary);
      max-width: 800px;
      margin: 0 auto 36px;
      line-height: 1.6;
    }

    .btn-primary {
      background: linear-gradient(135deg, var(--accent) 0%, var(--accent-secondary) 100%);
      color: #fff;
      text-decoration: none;
      padding: 16px 36px;
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
      padding: 16px 30px;
      border-radius: 12px;
      font-size: 16px;
      font-weight: 600;
      border: 1px solid rgba(255, 255, 255, 0.15);
      display: inline-flex;
      align-items: center;
      gap: 8px;
      transition: background 0.2s, border-color 0.2s, transform 0.2s;
    }

    .btn-secondary:hover {
      background: rgba(255, 255, 255, 0.14);
      border-color: rgba(255, 255, 255, 0.3);
      transform: translateY(-2px);
    }

    /* Interactive Showcase Gallery */
    .showcase-section {
      margin: 40px 0 80px;
    }

    .showcase-header {
      text-align: center;
      margin-bottom: 24px;
    }

    .showcase-nav {
      display: flex;
      justify-content: center;
      gap: 12px;
      flex-wrap: wrap;
      margin-bottom: 24px;
    }

    .showcase-tab {
      background: rgba(255, 255, 255, 0.06);
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 10px;
      padding: 10px 20px;
      color: var(--text-secondary);
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 8px;
      transition: all 0.2s;
    }

    .showcase-tab.active, .showcase-tab:hover {
      background: rgba(6, 182, 212, 0.18);
      border-color: var(--accent);
      color: #fff;
      box-shadow: 0 0 20px var(--accent-glow);
    }

    .showcase-frame {
      background: #000;
      border-radius: 16px;
      overflow: hidden;
      border: 1px solid rgba(255, 255, 255, 0.15);
      box-shadow: 0 25px 70px rgba(0, 0, 0, 0.8);
      position: relative;
    }

    .window-header {
      background: #0d121f;
      padding: 12px 18px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    }

    .window-dots {
      display: flex;
      gap: 8px;
    }

    .window-dot {
      width: 12px;
      height: 12px;
      border-radius: 50%;
    }

    .window-title {
      font-size: 12px;
      color: var(--text-muted);
      font-family: 'JetBrains Mono', monospace;
    }

    .showcase-img {
      width: 100%;
      height: auto;
      display: block;
      transition: opacity 0.3s ease;
    }

    /* Downloads Grid */
    .platform-group {
      margin-bottom: 36px;
    }

    .platform-group-title {
      font-size: 15px;
      font-weight: 700;
      color: var(--text-secondary);
      text-transform: uppercase;
      letter-spacing: 0.06em;
      margin-bottom: 4px;
    }

    .downloads-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
      gap: 24px;
      margin: 16px 0;
    }

    .download-card {
      background: var(--panel-bg);
      border: 1px solid var(--border-color);
      border-radius: 16px;
      padding: 32px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      position: relative;
      overflow: hidden;
      transition: transform 0.2s, border-color 0.2s;
    }

    .download-card:hover {
      transform: translateY(-4px);
      border-color: var(--accent);
    }

    .download-badge-popular {
      position: absolute;
      top: 18px;
      right: 18px;
      background: linear-gradient(135deg, #06b6d4, #8b5cf6);
      color: #fff;
      font-size: 11px;
      font-weight: 800;
      padding: 4px 10px;
      border-radius: 99px;
      text-transform: uppercase;
      letter-spacing: 0.06em;
    }

    .download-icon {
      font-size: 36px;
      margin-bottom: 16px;
    }

    .download-title {
      font-size: 22px;
      font-weight: 800;
      margin-bottom: 8px;
    }

    .download-size {
      font-size: 13px;
      color: var(--accent);
      font-weight: 700;
      margin-bottom: 12px;
    }

    .download-desc {
      font-size: 14px;
      color: var(--text-secondary);
      margin-bottom: 24px;
      line-height: 1.6;
    }

    /* Direct Installation / Terminal Box */
    .terminal-section {
      margin: 60px 0;
    }

    .terminal-box {
      background: #060913;
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 14px;
      padding: 20px;
      margin-top: 16px;
      font-family: 'JetBrains Mono', monospace;
      font-size: 13px;
      color: #22d3ee;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      position: relative;
    }

    .terminal-text {
      overflow-x: auto;
      white-space: nowrap;
      flex: 1;
    }

    .btn-copy {
      background: rgba(255, 255, 255, 0.08);
      border: 1px solid rgba(255, 255, 255, 0.15);
      color: #fff;
      padding: 6px 14px;
      border-radius: 8px;
      font-size: 12px;
      font-family: inherit;
      cursor: pointer;
      transition: background 0.2s;
      flex-shrink: 0;
    }

    .btn-copy:hover {
      background: rgba(255, 255, 255, 0.18);
    }

    /* Theme switcher widget */
    .theme-switcher-box {
      margin: 40px auto;
      max-width: 960px;
      padding: 24px;
      border-radius: 16px;
      background: rgba(0, 0, 0, 0.45);
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

    /* Creator Spotlight */
    .creator-card {
      background: linear-gradient(135deg, rgba(139, 92, 246, 0.14) 0%, rgba(6, 182, 212, 0.08) 100%);
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
      object-fit: cover;
      border: 1px solid rgba(255, 255, 255, 0.2);
      box-shadow: 0 0 30px rgba(139, 92, 246, 0.4);
      flex-shrink: 0;
      display: block;
    }

    /* Footer */
    footer {
      border-top: 1px solid var(--border-color);
      padding: 40px 0;
      margin-top: 80px;
      text-align: center;
      color: var(--text-muted);
      font-size: 13px;
      background: rgba(0, 0, 0, 0.7);
    }

    @media (max-width: 768px) {
      .hero-title { font-size: 36px; }
      .nav-links { display: none; }
    }

    /* Scroll-driven cinematic reveal system */
    html {
      scroll-behavior: smooth;
    }

    .scroll-progress {
      position: fixed;
      top: 0;
      left: 0;
      height: 3px;
      width: 0%;
      background: linear-gradient(90deg, var(--accent), var(--accent-secondary));
      box-shadow: 0 0 12px var(--accent-glow);
      z-index: 2000;
      transition: width 0.1s ease-out;
    }

    @keyframes fadeInUp {
      from { opacity: 0; transform: translateY(26px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .hero-badge, .hero-logo, .hero-title, .hero-subtitle {
      opacity: 0;
      animation: fadeInUp 0.9s cubic-bezier(0.16, 1, 0.3, 1) forwards;
    }
    .hero-badge { animation-delay: 0.05s; }
    .hero-logo { animation-delay: 0.12s; }
    .hero-title { animation-delay: 0.2s; }
    .hero-subtitle { animation-delay: 0.32s; }

    .reveal {
      opacity: 0;
      transform: translateY(36px);
      transition: opacity 0.8s cubic-bezier(0.16, 1, 0.3, 1), transform 0.8s cubic-bezier(0.16, 1, 0.3, 1);
    }
    .reveal.visible {
      opacity: 1;
      transform: translateY(0);
    }

    .reveal-scale {
      opacity: 0;
      transform: scale(0.94);
      transition: opacity 0.9s cubic-bezier(0.16, 1, 0.3, 1), transform 0.9s cubic-bezier(0.16, 1, 0.3, 1);
    }
    .reveal-scale.visible {
      opacity: 1;
      transform: scale(1);
    }

    .reveal-stagger > * {
      opacity: 0;
      transform: translateY(26px);
      transition: opacity 0.6s cubic-bezier(0.16, 1, 0.3, 1), transform 0.6s cubic-bezier(0.16, 1, 0.3, 1);
    }
    .reveal-stagger.visible > *:nth-child(1) { opacity: 1; transform: translateY(0); transition-delay: 0.04s; }
    .reveal-stagger.visible > *:nth-child(2) { opacity: 1; transform: translateY(0); transition-delay: 0.1s; }
    .reveal-stagger.visible > *:nth-child(3) { opacity: 1; transform: translateY(0); transition-delay: 0.16s; }
    .reveal-stagger.visible > *:nth-child(4) { opacity: 1; transform: translateY(0); transition-delay: 0.22s; }
    .reveal-stagger.visible > *:nth-child(5) { opacity: 1; transform: translateY(0); transition-delay: 0.28s; }
    .reveal-stagger.visible > *:nth-child(6) { opacity: 1; transform: translateY(0); transition-delay: 0.34s; }

    @media (prefers-reduced-motion: reduce) {
      html { scroll-behavior: auto; }
      .hero-badge, .hero-logo, .hero-title, .hero-subtitle,
      .reveal, .reveal-scale, .reveal-stagger > * {
        animation: none !important;
        transition: none !important;
        opacity: 1 !important;
        transform: none !important;
      }
    }
  </style>
</head>
<body>

  <div class="scroll-progress" id="scroll-progress"></div>
  <noscript>
    <style>
      .hero-badge, .hero-logo, .hero-title, .hero-subtitle,
      .reveal, .reveal-scale, .reveal-stagger > * { opacity: 1 !important; transform: none !important; animation: none !important; }
    </style>
  </noscript>

  <!-- Navigation Bar -->
  <nav class="navbar">
    <div class="nav-container">
      <a href="#" class="brand">
        <img src="${logoUrl}" alt="Solframe Studio Logo" class="brand-logo">
        <span class="brand-title">Solframe Studio</span>
      </a>
      <div class="nav-links">
        <a href="#showcase" class="nav-link">Showcase</a>
        <a href="#downloads" class="nav-link">Downloads</a>
        <a href="#terminal-install" class="nav-link">Terminal Install</a>
        <a href="#themes" class="nav-link">Themes</a>
        <a href="https://github.com/Protik1810/Solframe-Studio" target="_blank" class="nav-link">GitHub</a>
        <a href="https://github.com/Protik1810/Solframe-Studio/releases/download/v1.0.0/Solframe-Studio-Setup-1.0.0.exe" class="btn-nav-download">
          <span>🚀</span> Download v1.0.0
        </a>
      </div>
    </div>
  </nav>

  <div class="container">

    <!-- Hero Section -->
    <header class="hero">
      <div class="hero-badge">
        <span>⚡</span> v1.0.0 Production Release &bull; 100% Sovereign & Offline
      </div>
      <div id="platform-banner" class="platform-banner" style="display:none;"></div>
      <img src="${logoUrl}" alt="Solframe Studio Logo" class="hero-logo">
      <h1 class="hero-title">
        The Sovereign Desktop<br>
        <span class="hero-gradient">Generative AI Workstation</span>
      </h1>
      <p class="hero-subtitle">
        Synthesize photorealistic <strong>FLUX.2 Klein & SDXL Lightning</strong> artwork and dialogue with uncensored <strong>GGUF LLMs</strong> — powered by native C++ hardware kernels directly on your GPU. Zero cloud telemetry. Zero subscription fees.
      </p>

      <!-- Live Theme Switcher -->
      <div class="theme-switcher-box reveal" id="themes">
        <div style="font-size: 13px; font-weight: 700; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.08em; display: flex; align-items: center; justify-content: center; gap: 8px;">
          <span>🎨</span> Live Visual Wallpaper Themes (Click to Change Backdrop):
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

    <!-- Product Showcase Gallery with Real App Screenshots -->
    <section id="showcase" class="showcase-section">
      <div class="showcase-header reveal">
        <h2 style="font-size: 32px; font-weight: 800; margin-bottom: 8px;">🖼️ Product Showcase & Viewport</h2>
        <p style="font-size: 15px; color: var(--text-secondary);">Interactive preview of Solframe Studio running real local inference on GPU.</p>
      </div>

      <div class="showcase-nav reveal-stagger">
        <button class="showcase-tab active" onclick="switchScreenshot('lion', this)">
          <span>🦁</span> Photorealistic Synthesis
        </button>
        <button class="showcase-tab" onclick="switchScreenshot('canvas', this)">
          <span>🎨</span> Image Studio Canvas
        </button>
        <button class="showcase-tab" onclick="switchScreenshot('step16', this)">
          <span>⚡</span> Live Sampling (Step 16)
        </button>
        <button class="showcase-tab" onclick="switchScreenshot('step44', this)">
          <span>✨</span> Sampling Complete (Step 44)
        </button>
        <button class="showcase-tab" onclick="switchScreenshot('llm', this)">
          <span>💬</span> Uncensored LLM Chat
        </button>
      </div>

      <div class="showcase-frame reveal-scale">
        <div class="window-header">
          <div class="window-dots">
            <div class="window-dot" style="background: #ef4444;"></div>
            <div class="window-dot" style="background: #eab308;"></div>
            <div class="window-dot" style="background: #22c55e;"></div>
          </div>
          <div class="window-title">Solframe Studio — Hardware GPU Canvas</div>
          <div style="font-size: 11px; color: #06b6d4; font-weight: 700;">GPU Accelerated &bull; Local Inference</div>
        </div>
        <img id="active-screenshot" src="${screenshots.lion}" alt="Solframe Studio Screenshot" class="showcase-img" loading="lazy">
      </div>

      <p style="font-size: 12px; color: var(--text-muted); text-align: center; margin-top: 16px; max-width: 720px; margin-left: auto; margin-right: auto;">
        ⚠️ Uncensored models can produce inaccurate, offensive, or unsafe content. Use uncensored models at your own risk — you are solely responsible for what you generate and how you use it.
      </p>
    </section>

    <!-- Downloads Section -->
    <section id="downloads">
      <div style="text-align: center; margin-bottom: 32px;" class="reveal">
        <h2 style="font-size: 32px; font-weight: 800; margin-bottom: 8px;">📦 Download Solframe Studio</h2>
        <p style="font-size: 15px; color: var(--text-secondary);">Native installers for Windows, Linux, and macOS &mdash; hosted on GitHub Releases.</p>
      </div>

      <div class="platform-group reveal" data-platform="windows">
        <div class="platform-group-title">🪟 Windows &mdash; full local inference (CUDA / Vulkan / CPU)</div>
        <div class="downloads-grid reveal-stagger">

          <!-- Full Setup -->
          <div class="download-card">
            <div class="download-badge-popular">Recommended</div>
            <div>
              <div class="download-icon">📦</div>
              <h3 class="download-title">Complete Installer</h3>
              <div class="download-size">Size: ~806 MB &bull; Standalone Setup</div>
              <p class="download-desc">
                All-in-one offline installation package. Bundles all pre-compiled C++ inference engines (NVIDIA CUDA 12, AMD/Intel Vulkan, AVX2 CPU, and <code>llama-server</code>).
              </p>
            </div>
            <a href="https://github.com/Protik1810/Solframe-Studio/releases/download/v1.0.0/Solframe-Studio-Setup-1.0.0.exe" class="btn-primary" style="justify-content: center;">
              <span>⬇️</span> Download Full Setup (.exe)
            </a>
          </div>

          <!-- Lightweight Setup -->
          <div class="download-card">
            <div>
              <div class="download-icon">🪶</div>
              <h3 class="download-title">Lightweight Installer</h3>
              <div class="download-size">Size: ~97 MB &bull; Fast Download</div>
              <p class="download-desc">
                Faster initial download — ships the UI shell without bundled GPU acceleration libraries. If you need image generation or local LLM chat, use the <strong>Complete Installer</strong> instead.
              </p>
            </div>
            <a href="https://github.com/Protik1810/Solframe-Studio/releases/download/v1.0.0/Solframe-Studio-Setup-1.0.0-Lightweight.exe" class="btn-secondary" style="justify-content: center;">
              <span>⬇️</span> Download Lightweight (.exe)
            </a>
          </div>

        </div>
      </div>

      <div class="platform-group reveal" data-platform="linux">
        <div class="platform-group-title">🐧 Linux &mdash; UI shell (native engines coming later, see below)</div>
        <div class="downloads-grid reveal-stagger">

          <!-- AppImage -->
          <div class="download-card">
            <div class="download-badge-popular">Recommended</div>
            <div>
              <div class="download-icon">📦</div>
              <h3 class="download-title">AppImage</h3>
              <div class="download-size">Size: ~133 MB &bull; Any distro, no install</div>
              <p class="download-desc">
                Portable single-file app &mdash; <code>chmod +x</code> then run. Works across most modern Linux distributions.
              </p>
            </div>
            <a href="https://github.com/Protik1810/Solframe-Studio/releases/download/v1.0.0/Solframe-Studio-1.0.0-x86_64.AppImage" class="btn-primary" style="justify-content: center;">
              <span>⬇️</span> Download AppImage
            </a>
          </div>

          <!-- .deb -->
          <div class="download-card">
            <div>
              <div class="download-icon">📥</div>
              <h3 class="download-title">.deb Package</h3>
              <div class="download-size">Size: ~86 MB &bull; Debian / Ubuntu</div>
              <p class="download-desc">
                Install with <code>sudo apt install ./solframe-studio_1.0.0_amd64.deb</code> on Debian-based distributions.
              </p>
            </div>
            <a href="https://github.com/Protik1810/Solframe-Studio/releases/download/v1.0.0/solframe-studio_1.0.0_amd64.deb" class="btn-secondary" style="justify-content: center;">
              <span>⬇️</span> Download .deb
            </a>
          </div>

        </div>
      </div>

      <div class="platform-group reveal" data-platform="mac">
        <div class="platform-group-title">🍎 macOS &mdash; UI shell (native engines coming later, see below)</div>
        <div class="downloads-grid reveal-stagger">

          <!-- macOS zip -->
          <div class="download-card">
            <div>
              <div class="download-icon">🗜️</div>
              <h3 class="download-title">App Bundle (.zip)</h3>
              <div class="download-size">Size: ~127 MB &bull; Unsigned build</div>
              <p class="download-desc">
                Unzip and move to Applications. Unsigned, so the first launch needs right-click &rarr; Open to bypass Gatekeeper.
              </p>
            </div>
            <a href="https://github.com/Protik1810/Solframe-Studio/releases/download/v1.0.0/Solframe-Studio-1.0.0-mac.zip" class="btn-secondary" style="justify-content: center;">
              <span>⬇️</span> Download .zip
            </a>
          </div>

        </div>
      </div>

      <p style="font-size: 13px; color: var(--text-muted); text-align: center; margin-top: -8px;">
        Linux and macOS builds ship the interface only right now &mdash; the bundled diffusion/LLM engines are Windows-only binaries. See <a href="#terminal-install" style="color: var(--accent);">Direct Installation by Terminal</a> below to build your own from source.
      </p>
    </section>

    <!-- Direct Terminal Installation -->
    <section id="terminal-install" class="terminal-section">
      <div class="glass-card reveal">
        <h2 style="font-size: 26px; font-weight: 800; margin-bottom: 6px;">💻 Direct Installation by Terminal</h2>
        <p style="font-size: 14px; color: var(--text-secondary); margin-bottom: 24px;">
          Install and launch Solframe Studio instantly via terminal on Windows, Linux, and macOS.
        </p>

        <!-- Linux & macOS One Liner -->
        <div style="margin-bottom: 20px;" data-platform="linux mac">
          <div style="font-size: 13px; font-weight: 700; color: #fff; display: flex; align-items: center; gap: 8px;">
            <span>🐧</span> Linux &amp; <span>🍎</span> macOS (UI Preview — 1-Line Terminal Install):
          </div>
          <div class="terminal-box">
            <span class="terminal-text" id="cmd-linux">curl -fsSL https://raw.githubusercontent.com/Protik1810/Solframe-Studio/main/install.sh | bash</span>
            <button class="btn-copy" onclick="copyCommand('cmd-linux', this)">Copy</button>
          </div>
        </div>

        <!-- Linux/macOS Native Installer Build -->
        <div style="margin-bottom: 20px;" data-platform="linux mac">
          <div style="font-size: 13px; font-weight: 700; color: #fff; display: flex; align-items: center; gap: 8px;">
            <span>📦</span> Build a Native Linux/macOS Installer:
          </div>
          <div class="terminal-box">
            <span class="terminal-text" id="cmd-native">git clone https://github.com/Protik1810/Solframe-Studio.git && cd Solframe-Studio && npm install && npm run electron:build:linux</span>
            <button class="btn-copy" onclick="copyCommand('cmd-native', this)">Copy</button>
          </div>
          <p style="font-size: 12px; color: var(--text-muted); margin-top: 6px;">
            Produces an AppImage + .deb on Linux (swap in <code>electron:build:mac</code> on macOS for a .zip app bundle). No winget package exists yet — Windows users should use the installers above.
          </p>
        </div>

        <!-- Cross-Platform Git -->
        <div>
          <div style="font-size: 13px; font-weight: 700; color: #fff; display: flex; align-items: center; gap: 8px;">
            <span>⚡</span> Cross-Platform Git &amp; npm Run:
          </div>
          <div class="terminal-box">
            <span class="terminal-text" id="cmd-git">git clone https://github.com/Protik1810/Solframe-Studio.git && cd Solframe-Studio && npm install && npm run dev</span>
            <button class="btn-copy" onclick="copyCommand('cmd-git', this)">Copy</button>
          </div>
        </div>

      </div>
    </section>

    <!-- Creator Spotlight -->
    <section class="creator-card reveal-scale">
      <a href="${CREATOR_GITHUB_URL}" target="_blank" rel="noopener">
        <img class="creator-avatar" src="${creatorAvatarUrl}" alt="${CREATOR_NAME} on GitHub" loading="lazy">
      </a>
      <div style="flex: 1; min-width: 280px;">
        <div style="font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #a78bfa; margin-bottom: 4px;">
          Lead Creator & Architect
        </div>
        <h2 style="font-size: 28px; font-weight: 800; color: #fff; margin-bottom: 12px;">
          <a href="${CREATOR_GITHUB_URL}" target="_blank" rel="noopener" style="color: #fff; text-decoration: none;">${CREATOR_NAME}</a>
          <a href="${CREATOR_GITHUB_URL}" target="_blank" rel="noopener" style="font-size: 14px; font-weight: 600; color: var(--accent); text-decoration: none; margin-left: 8px;">@Protik1810</a>
        </h2>
        <p style="font-size: 14px; color: var(--text-secondary); line-height: 1.7; margin-bottom: 16px;">
          Engineered and crafted by <strong><a href="${CREATOR_GITHUB_URL}" target="_blank" rel="noopener" style="color: inherit;">${CREATOR_NAME}</a></strong> with a mission for sovereign, privacy-first generative AI. Built to give creators complete autonomy over cutting-edge diffusion synthesis and large language models directly on personal desktop hardware — free from cloud subscriptions, data mining, and platform lock-in.
        </p>
        <div style="font-size: 13px; color: var(--text-muted);">
          Solframe Studio Engine &bull; Released under GNU General Public License v3.0 (GPL-3.0)
        </div>
      </div>
    </section>

  </div>

  <!-- Footer -->
  <footer class="reveal">
    <div class="container">
      <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px;">
        <div style="display: flex; align-items: center; gap: 10px;">
          <img src="${logoUrl}" alt="Logo" style="width: 24px; height: 24px; border-radius: 6px;" loading="lazy">
          <strong>Solframe Studio</strong> &bull; Created by <strong><a href="${CREATOR_GITHUB_URL}" target="_blank" rel="noopener" style="color: inherit;">${CREATOR_NAME}</a></strong>
        </div>
        <div>
          Powered by <code>stable-diffusion.cpp</code> &amp; <code>llama.cpp</code> &bull; <a href="LICENSE" style="color: var(--accent); text-decoration: none;">GNU GPL v3.0</a> &bull; <a href="TERMS.md" style="color: var(--accent); text-decoration: none;">Terms &amp; Conditions</a>
        </div>
      </div>
    </div>
  </footer>

  <script>
    const screenshotMap = {
      lion: '${screenshots.lion}',
      canvas: '${screenshots.canvas}',
      step16: '${screenshots.step16}',
      step44: '${screenshots.step44}',
      llm: '${screenshots.llm}'
    };

    function setTheme(theme) {
      document.body.setAttribute('data-theme', theme);
      localStorage.setItem('product-theme', theme);
    }
    const saved = localStorage.getItem('product-theme');
    if (saved) setTheme(saved);

    function switchScreenshot(key, tabBtn) {
      const img = document.getElementById('active-screenshot');
      if (screenshotMap[key]) {
        img.style.opacity = '0.3';
        setTimeout(() => {
          img.src = screenshotMap[key];
          img.style.opacity = '1';
        }, 120);

        document.querySelectorAll('.showcase-tab').forEach(t => t.classList.remove('active'));
        tabBtn.classList.add('active');
      }
    }

    function copyCommand(elemId, btn) {
      const text = document.getElementById(elemId).innerText;
      navigator.clipboard.writeText(text).then(() => {
        const original = btn.innerText;
        btn.innerText = 'Copied! ✓';
        btn.style.borderColor = '#22c55e';
        btn.style.color = '#22c55e';
        setTimeout(() => {
          btn.innerText = original;
          btn.style.borderColor = '';
          btn.style.color = '';
        }, 2000);
      });
    }

    // Detect the visitor's OS from the (best-effort, spoofable) UA/platform
    // strings and use it to point them at the right install method — dims
    // the sections that don't apply rather than hiding them, since detection
    // isn't perfectly reliable and every option should stay reachable.
    function detectPlatform() {
      const ua = navigator.userAgent || '';
      const plat = navigator.platform || '';
      if (/Win/i.test(plat) || /Windows/i.test(ua)) return 'windows';
      if (/Mac/i.test(plat) || /Macintosh|Mac OS X/i.test(ua)) return 'mac';
      if (/Linux/i.test(plat) || /Linux/i.test(ua)) return 'linux';
      return null;
    }

    function applyPlatformDetection() {
      const platform = detectPlatform();
      if (!platform) return;

      const labels = { windows: 'Windows', mac: 'macOS', linux: 'Linux' };
      const banner = document.getElementById('platform-banner');
      if (banner) {
        banner.innerHTML = '<span>✅</span> Detected: ' + labels[platform] +
          ' — <a href="#downloads">jump to your download ↓</a>';
        banner.style.display = 'inline-flex';
      }

      document.querySelectorAll('[data-platform]').forEach(el => {
        const supported = el.getAttribute('data-platform').split(/\\s+/);
        if (!supported.includes(platform)) {
          el.classList.add('platform-dim');
        }
      });
    }

    applyPlatformDetection();

    // Cinematic scroll interactions: a top progress bar, gentle hero-logo
    // parallax, and Intersection Observer-driven reveal-on-scroll for every
    // section below the fold. Kept dependency-free since this page is a
    // single self-contained file with no bundler.
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const scrollProgressEl = document.getElementById('scroll-progress');
    const heroLogoEl = document.querySelector('.hero-logo');

    function updateScrollEffects() {
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      const pct = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
      if (scrollProgressEl) scrollProgressEl.style.width = pct + '%';
      if (heroLogoEl && !prefersReducedMotion) {
        const offset = Math.min(scrollTop * 0.12, 60);
        heroLogoEl.style.transform = 'translateY(' + offset + 'px)';
      }
    }
    window.addEventListener('scroll', updateScrollEffects, { passive: true });
    updateScrollEffects();

    if (!prefersReducedMotion && 'IntersectionObserver' in window) {
      const revealEls = document.querySelectorAll('.reveal, .reveal-scale, .reveal-stagger');
      const revealObserver = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            revealObserver.unobserve(entry.target);
          }
        });
      }, { threshold: 0.15, rootMargin: '0px 0px -60px 0px' });
      revealEls.forEach((el) => revealObserver.observe(el));
    } else {
      document.querySelectorAll('.reveal, .reveal-scale, .reveal-stagger').forEach((el) => el.classList.add('visible'));
    }
  </script>
</body>
</html>`;

// docs/index.html is a build artifact, not a committed file — it's gitignored,
// and .github/workflows/pages.yml runs this exact script during deploy so the
// live site is always built fresh from source. Run it locally only to preview
// (see scripts/build-product-page.js) or to eyeball a change before pushing.
// Root index.html is the separate Vite/Electron app entry point (loads
// src/main.tsx) and must never be overwritten with this marketing page again —
// doing so silently breaks `npm run build`/`electron:build` (see git history).
if (!fs.existsSync(docsDir)) fs.mkdirSync(docsDir, { recursive: true });
fs.writeFileSync(path.join(docsDir, 'index.html'), html, 'utf8');

console.log('✅ Generated docs/index.html + copied assets (themes/, screenshots/, avatars/, logo.png, favicon.png, LICENSE, TERMS.md)!');
console.log('   This is a gitignored build output — push to main and the Pages workflow regenerates + deploys it automatically.');
