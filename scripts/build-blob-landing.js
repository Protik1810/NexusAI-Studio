const fs = require('fs');
const path = require('path');

console.log('🔄 Copying assets alongside the showcase page...');

const rootDir = path.resolve(__dirname, '..');
const docsDir = path.join(rootDir, 'docs');
const SITE_BASE_URL = 'https://protik1810.github.io/Solframe-Studio/';
const VERSION = require(path.join(rootDir, 'package.json')).version;

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
const REPO_URL = 'https://github.com/Protik1810/Solframe-Studio';
const RELEASE_BASE = `${REPO_URL}/releases/download/v${VERSION}`;

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

// Optional, per-theme atmospheric backdrops for the Hero and Showcase
// sections only (a circuit/schematic-style image tinted to that theme's
// accent, mirroring the Bolt reference design's hero-bg.webp/showcase-bg.webp).
// These are entirely optional — copyAsset returns '' when a file doesn't
// exist yet, and the CSS below falls back to `none` for that layer, so the
// page renders exactly as before (just the ambient wallpaper) until someone
// drops matching webp files into these two folders.
const THEME_KEYS = ['dark-void', 'neon-cyber', 'cinema-gold', 'synthwave', 'anime-fantasy', 'emerald-matrix'];
const heroBgs = {};
const showcaseBgs = {};
for (const key of THEME_KEYS) {
  heroBgs[key] = copyAsset(`public/themes/hero/${key}.webp`, `themes/hero/${key}.webp`);
  showcaseBgs[key] = copyAsset(`public/themes/showcase/${key}.webp`, `themes/showcase/${key}.webp`);
}
const heroBgCss = (key) => heroBgs[key] ? `url('${heroBgs[key]}')` : 'none';
const showcaseBgCss = (key) => showcaseBgs[key] ? `url('${showcaseBgs[key]}')` : 'none';

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
  <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet">
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
      --hero-bg: ${heroBgCss('cinema-gold')};
      --showcase-bg: ${showcaseBgCss('cinema-gold')};
    }

    [data-theme="dark-void"] {
      --accent: #06b6d4;
      --accent-secondary: #8b5cf6;
      --accent-glow: rgba(6, 182, 212, 0.45);
      --wallpaper: url('${themes.darkVoid}');
      --hero-bg: ${heroBgCss('dark-void')};
      --showcase-bg: ${showcaseBgCss('dark-void')};
    }

    [data-theme="neon-cyber"] {
      --accent: #ec4899;
      --accent-secondary: #06b6d4;
      --accent-glow: rgba(236, 72, 153, 0.45);
      --wallpaper: url('${themes.neonCyber}');
      --hero-bg: ${heroBgCss('neon-cyber')};
      --showcase-bg: ${showcaseBgCss('neon-cyber')};
    }

    [data-theme="cinema-gold"] {
      --accent: #eab308;
      --accent-secondary: #f97316;
      --accent-glow: rgba(234, 179, 8, 0.45);
      --wallpaper: url('${themes.cinemaGold}');
      --hero-bg: ${heroBgCss('cinema-gold')};
      --showcase-bg: ${showcaseBgCss('cinema-gold')};
    }

    [data-theme="synthwave"] {
      --accent: #f43f5e;
      --accent-secondary: #8b5cf6;
      --accent-glow: rgba(244, 63, 94, 0.45);
      --wallpaper: url('${themes.synthwave}');
      --hero-bg: ${heroBgCss('synthwave')};
      --showcase-bg: ${showcaseBgCss('synthwave')};
    }

    [data-theme="anime-fantasy"] {
      --accent: #a855f7;
      --accent-secondary: #ec4899;
      --accent-glow: rgba(168, 85, 247, 0.45);
      --wallpaper: url('${themes.animeFantasy}');
      --hero-bg: ${heroBgCss('anime-fantasy')};
      --showcase-bg: ${showcaseBgCss('anime-fantasy')};
    }

    [data-theme="emerald-matrix"] {
      --accent: #10b981;
      --accent-secondary: #06b6d4;
      --accent-glow: rgba(16, 185, 129, 0.45);
      --wallpaper: url('${themes.emeraldMatrix}');
      --hero-bg: ${heroBgCss('emerald-matrix')};
      --showcase-bg: ${showcaseBgCss('emerald-matrix')};
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

    html {
      scroll-behavior: smooth;
    }

    body {
      font-family: 'Space Grotesk', -apple-system, BlinkMacSystemFont, sans-serif;
      background-color: var(--bg-color);
      background-image:
        linear-gradient(180deg, rgba(6, 10, 20, 0.85) 0%, rgba(3, 5, 12, 0.96) 100%),
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
      backdrop-filter: blur(20px) saturate(180%);
      -webkit-backdrop-filter: blur(20px) saturate(180%);
      background: rgba(8, 12, 24, 0.78);
      border-bottom: 1px solid var(--border-color);
      padding: 14px 24px;
      transition: background 0.4s ease, border-color 0.4s ease;
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
      width: 36px;
      height: 36px;
      border-radius: 9px;
      box-shadow: 0 0 18px var(--accent-glow);
      border: 1px solid rgba(255, 255, 255, 0.2);
    }

    .hero-logo {
      display: block;
      width: 108px;
      height: 108px;
      margin: 0 auto 22px;
      border-radius: 24px;
      box-shadow: 0 0 55px var(--accent-glow), 0 0 110px var(--accent-glow);
      border: 1px solid rgba(255, 255, 255, 0.25);
    }

    .brand-title {
      font-size: 19px;
      font-weight: 700;
      letter-spacing: -0.01em;
      color: #fff;
    }

    .brand-title span {
      color: var(--accent);
    }

    .nav-links {
      display: flex;
      align-items: center;
      gap: 22px;
    }

    .nav-link {
      color: var(--text-secondary);
      text-decoration: none;
      font-size: 14px;
      font-weight: 500;
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
      transition: transform 0.3s cubic-bezier(0.4,0,0.2,1), filter 0.3s cubic-bezier(0.4,0,0.2,1);
      display: inline-flex;
      align-items: center;
      gap: 8px;
    }

    .btn-nav-download:hover {
      transform: translateY(-2px);
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
      padding: 96px 0 56px;
      text-align: center;
      position: relative;
      overflow: hidden;
      /* Falls back to fully transparent (revealing the body's own ambient
         wallpaper) until a matching hero/<theme>.webp exists — see the
         heroBgs comment in build-blob-landing.js. */
      background-image: linear-gradient(180deg, rgba(3, 5, 12, 0.35) 0%, rgba(3, 5, 12, 0.8) 100%), var(--hero-bg, none);
      background-size: cover;
      background-position: center;
    }

    /* Grid texture, faded radially — mirrors the app's own diffusion-canvas
       grid so the marketing page and the product feel like one visual family. */
    .hero-grid {
      position: absolute;
      inset: -10% -10%;
      background-image:
        linear-gradient(var(--accent-glow) 1px, transparent 1px),
        linear-gradient(90deg, var(--accent-glow) 1px, transparent 1px);
      background-size: 48px 48px;
      opacity: 0.06;
      -webkit-mask-image: radial-gradient(ellipse at 50% 30%, black 25%, transparent 70%);
      mask-image: radial-gradient(ellipse at 50% 30%, black 25%, transparent 70%);
      pointer-events: none;
      z-index: 0;
    }

    /* Floating glow orb — pure CSS so it recolors with the active theme
       instead of needing a separate raster asset per accent. */
    .hero-orb {
      position: absolute;
      top: 6%;
      right: 8%;
      width: 220px;
      height: 220px;
      border-radius: 50%;
      background: radial-gradient(circle at 35% 35%, var(--accent-glow), transparent 70%);
      filter: blur(6px);
      animation: floatY 6s ease-in-out infinite;
      pointer-events: none;
      z-index: 0;
    }

    @media (max-width: 900px) {
      .hero-orb { display: none; }
    }

    .hero > * {
      position: relative;
      z-index: 1;
    }

    .hero-chips {
      display: flex;
      justify-content: center;
      flex-wrap: wrap;
      gap: 10px;
      margin-bottom: 22px;
    }

    .hero-chip {
      display: inline-flex;
      align-items: center;
      gap: 7px;
      padding: 7px 15px;
      border-radius: 99px;
      font-size: 12.5px;
      font-weight: 600;
    }

    .hero-chip.chip-accent {
      background: color-mix(in srgb, var(--accent) 12%, transparent);
      border: 1px solid color-mix(in srgb, var(--accent) 30%, transparent);
      color: var(--accent);
      box-shadow: 0 0 20px var(--accent-glow);
    }

    .hero-chip.chip-neutral {
      background: rgba(255, 255, 255, 0.06);
      border: 1px solid rgba(255, 255, 255, 0.14);
      color: var(--text-secondary);
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

    .hero-overline {
      display: block;
      font-size: 13px;
      font-weight: 700;
      letter-spacing: 0.18em;
      text-transform: uppercase;
      color: var(--accent);
      margin-bottom: 14px;
    }

    .hero-title {
      font-size: 56px;
      font-weight: 700;
      letter-spacing: -0.03em;
      line-height: 1.12;
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
      max-width: 760px;
      margin: 0 auto 32px;
      line-height: 1.6;
    }

    .hero-ctas {
      display: flex;
      justify-content: center;
      flex-wrap: wrap;
      gap: 16px;
      margin-bottom: 8px;
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
      transition: transform 0.3s cubic-bezier(0.4,0,0.2,1), filter 0.3s cubic-bezier(0.4,0,0.2,1);
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
      transition: background 0.25s ease, border-color 0.25s ease, transform 0.3s cubic-bezier(0.4,0,0.2,1);
    }

    .btn-secondary:hover {
      background: rgba(255, 255, 255, 0.14);
      border-color: rgba(255, 255, 255, 0.3);
      transform: translateY(-2px);
    }

    /* Scroll indicator */
    .scroll-indicator {
      display: none;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      margin-top: 56px;
    }

    @media (min-width: 900px) {
      .scroll-indicator { display: flex; }
    }

    .scroll-indicator span {
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.15em;
      color: var(--text-muted);
    }

    .scroll-indicator-track {
      width: 1px;
      height: 40px;
      background: var(--accent-glow);
      border-radius: 4px;
      position: relative;
      overflow: hidden;
    }

    .scroll-indicator-track::after {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 40%;
      background: var(--accent);
      border-radius: 4px;
      animation: scanline 2s ease-in-out infinite;
    }

    /* Section headers, shared by Features / Showcase / Downloads */
    .section-header {
      text-align: center;
      max-width: 620px;
      margin: 0 auto 40px;
    }

    .section-overline {
      display: block;
      font-size: 12.5px;
      font-weight: 700;
      letter-spacing: 0.16em;
      text-transform: uppercase;
      color: var(--accent);
      margin-bottom: 10px;
    }

    .section-title {
      font-size: 34px;
      font-weight: 700;
      letter-spacing: -0.02em;
      margin-bottom: 10px;
    }

    .section-desc {
      font-size: 15px;
      color: var(--text-secondary);
      line-height: 1.6;
    }

    /* Feature Cards */
    .features-section {
      margin: 40px 0 80px;
    }

    .features-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 22px;
    }

    .feature-card {
      background: var(--card-bg);
      border: 1px solid var(--border-color);
      border-radius: 16px;
      padding: 28px;
      transition: transform 0.3s cubic-bezier(0.4,0,0.2,1), border-color 0.3s ease, box-shadow 0.3s ease;
    }

    .feature-card:hover {
      transform: translateY(-4px);
      border-color: color-mix(in srgb, var(--accent) 35%, transparent);
      box-shadow: 0 0 32px var(--accent-glow), 0 12px 24px rgba(0,0,0,0.3);
    }

    .feature-icon {
      width: 52px;
      height: 52px;
      border-radius: 12px;
      background: color-mix(in srgb, var(--accent) 10%, transparent);
      border: 1px solid color-mix(in srgb, var(--accent) 18%, transparent);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 24px;
      margin-bottom: 18px;
    }

    .feature-title {
      font-size: 17px;
      font-weight: 700;
      margin-bottom: 8px;
    }

    .feature-desc {
      font-size: 14px;
      color: var(--text-secondary);
      line-height: 1.65;
    }

    /* Interactive Showcase Gallery */
    .showcase-section {
      margin: 0 0 80px;
      position: relative;
      /* Same optional-backdrop fallback pattern as .hero, above. */
      background-image: linear-gradient(180deg, var(--bg-color) 0%, transparent 25%, transparent 75%, var(--bg-color) 100%), var(--showcase-bg, none);
      background-size: cover;
      background-position: center;
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
      background: color-mix(in srgb, var(--accent) 16%, transparent);
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
      max-width: 960px;
      margin: 0 auto;
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

    .warning-box {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      max-width: 760px;
      margin: 24px auto 0;
      padding: 16px 20px;
      border-radius: 14px;
      background: rgba(251, 146, 60, 0.08);
      border: 1px solid rgba(251, 146, 60, 0.22);
    }

    .warning-box span.icon {
      flex-shrink: 0;
      margin-top: 1px;
    }

    .warning-box p {
      font-size: 13px;
      color: #fdba74;
      line-height: 1.6;
    }

    /* Downloads Grid */
    .platform-group {
      margin-bottom: 36px;
    }

    .platform-group-title {
      font-size: 14px;
      font-weight: 700;
      color: var(--text-secondary);
      text-transform: uppercase;
      letter-spacing: 0.06em;
      margin-bottom: 4px;
    }

    .downloads-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
      gap: 22px;
      margin: 16px 0;
    }

    .download-card {
      background: var(--panel-bg);
      border: 1px solid var(--border-color);
      border-radius: 16px;
      padding: 30px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      position: relative;
      overflow: hidden;
      transition: transform 0.3s cubic-bezier(0.4,0,0.2,1), border-color 0.3s ease, box-shadow 0.3s ease;
    }

    .download-card:hover {
      transform: translateY(-4px);
      border-color: var(--accent);
      box-shadow: 0 0 24px var(--accent-glow);
    }

    .download-badge-popular {
      position: absolute;
      top: 18px;
      right: 18px;
      background: linear-gradient(135deg, var(--accent), var(--accent-secondary));
      color: #fff;
      font-size: 11px;
      font-weight: 800;
      padding: 4px 10px;
      border-radius: 99px;
      text-transform: uppercase;
      letter-spacing: 0.06em;
    }

    .download-icon-box {
      width: 48px;
      height: 48px;
      border-radius: 10px;
      background: color-mix(in srgb, var(--accent) 10%, transparent);
      border: 1px solid color-mix(in srgb, var(--accent) 16%, transparent);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 22px;
      margin-bottom: 16px;
    }

    .download-title {
      font-size: 21px;
      font-weight: 700;
      margin-bottom: 6px;
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
      color: var(--accent);
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
      margin: 40px auto 0;
      max-width: 960px;
      padding: 24px;
      border-radius: 16px;
      background: rgba(0, 0, 0, 0.45);
      border: 1px solid var(--border-color);
    }

    .theme-switcher-label {
      font-size: 13px;
      font-weight: 700;
      color: var(--text-secondary);
      text-transform: uppercase;
      letter-spacing: 0.08em;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
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
      font-family: inherit;
    }

    .theme-card-btn:hover {
      border-color: var(--accent);
      background: rgba(255, 255, 255, 0.1);
    }

    .theme-card-btn.active {
      border-color: var(--accent);
      background: color-mix(in srgb, var(--accent) 14%, transparent);
      box-shadow: 0 0 16px var(--accent-glow);
    }

    .theme-dot {
      width: 14px;
      height: 14px;
      border-radius: 50%;
    }

    /* Creator Spotlight */
    .creator-card {
      position: relative;
      background: linear-gradient(135deg, rgba(139, 92, 246, 0.14) 0%, rgba(6, 182, 212, 0.08) 100%);
      border: 1px solid rgba(139, 92, 246, 0.35);
      border-radius: 20px;
      padding: 40px;
      margin: 60px 0;
      display: flex;
      align-items: center;
      gap: 32px;
      flex-wrap: wrap;
      overflow: hidden;
    }

    .creator-card::before {
      content: '';
      position: absolute;
      top: -60px;
      right: -60px;
      width: 200px;
      height: 200px;
      border-radius: 50%;
      background: radial-gradient(circle, rgba(139, 92, 246, 0.16), transparent 70%);
      pointer-events: none;
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
      position: relative;
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

    @keyframes floatY {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-14px); }
    }

    @keyframes scanline {
      0% { transform: translateY(-100%); }
      100% { transform: translateY(100%); }
    }

    .hero-chips, .hero-logo, .hero-title, .hero-subtitle, .hero-ctas {
      opacity: 0;
      animation: fadeInUp 0.9s cubic-bezier(0.16, 1, 0.3, 1) forwards;
    }
    .hero-chips { animation-delay: 0.05s; }
    .hero-logo { animation-delay: 0.12s; }
    .hero-title { animation-delay: 0.2s; }
    .hero-subtitle { animation-delay: 0.32s; }
    .hero-ctas { animation-delay: 0.42s; }

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
      .hero-chips, .hero-logo, .hero-title, .hero-subtitle, .hero-ctas,
      .reveal, .reveal-scale, .reveal-stagger > * {
        animation: none !important;
        transition: none !important;
        opacity: 1 !important;
        transform: none !important;
      }
      .hero-orb { animation: none !important; }
    }
  </style>
</head>
<body>

  <div class="scroll-progress" id="scroll-progress"></div>
  <noscript>
    <style>
      .hero-chips, .hero-logo, .hero-title, .hero-subtitle, .hero-ctas,
      .reveal, .reveal-scale, .reveal-stagger > * { opacity: 1 !important; transform: none !important; animation: none !important; }
    </style>
  </noscript>

  <!-- Navigation Bar -->
  <nav class="navbar">
    <div class="nav-container">
      <a href="#" class="brand">
        <img src="${logoUrl}" alt="Solframe Studio Logo" class="brand-logo">
        <span class="brand-title">Solframe<span> Studio</span></span>
      </a>
      <div class="nav-links">
        <a href="#features" class="nav-link">Features</a>
        <a href="#showcase" class="nav-link">Showcase</a>
        <a href="#downloads" class="nav-link">Downloads</a>
        <a href="#themes" class="nav-link">Themes</a>
        <a href="${REPO_URL}" target="_blank" class="nav-link">GitHub</a>
        <a href="${RELEASE_BASE}/Solframe-Studio-Setup-${VERSION}.exe" class="btn-nav-download">
          <span>🚀</span> Download v${VERSION}
        </a>
      </div>
    </div>
  </nav>

  <div class="container">

    <!-- Hero Section -->
    <header class="hero">
      <div class="hero-grid" aria-hidden="true"></div>
      <div class="hero-orb" aria-hidden="true"></div>

      <div class="hero-chips">
        <span class="hero-chip chip-accent">⚡ Zero cloud. Zero subscriptions.</span>
        <span class="hero-chip chip-neutral">Privacy-first</span>
      </div>

      <div id="platform-banner" class="platform-banner" style="display:none;"></div>

      <img src="${logoUrl}" alt="Solframe Studio Logo" class="hero-logo">

      <span class="hero-overline">The Sovereign Desktop</span>
      <h1 class="hero-title">
        <span class="hero-gradient">Generative AI Workstation</span>
      </h1>
      <p class="hero-subtitle">
        Synthesize photorealistic <strong>FLUX.2 Klein &amp; SDXL Lightning</strong> artwork and dialogue with uncensored <strong>GGUF LLMs</strong> — powered by native C++ hardware kernels directly on your GPU. Zero cloud telemetry. Zero subscription fees.
      </p>

      <div class="hero-ctas">
        <a href="#downloads" class="btn-primary">
          <span>⬇️</span> Download Now
        </a>
        <a href="${REPO_URL}" target="_blank" rel="noopener noreferrer" class="btn-secondary">
          <span>★</span> View on GitHub
        </a>
      </div>

      <!-- Live Theme Switcher -->
      <div class="theme-switcher-box reveal" id="themes">
        <div class="theme-switcher-label">
          <span>🎨</span> Live Visual Wallpaper Themes (Click to Change Backdrop):
        </div>
        <div class="theme-grid" id="theme-grid">
          <button class="theme-card-btn" data-theme-btn="dark-void" onclick="setTheme('dark-void')">
            <div class="theme-dot" style="background: #06b6d4;"></div>
            <span>Dark Void</span>
          </button>
          <button class="theme-card-btn" data-theme-btn="neon-cyber" onclick="setTheme('neon-cyber')">
            <div class="theme-dot" style="background: #ec4899;"></div>
            <span>Neon Cyber</span>
          </button>
          <button class="theme-card-btn" data-theme-btn="cinema-gold" onclick="setTheme('cinema-gold')">
            <div class="theme-dot" style="background: #eab308;"></div>
            <span>Cinema Gold</span>
          </button>
          <button class="theme-card-btn" data-theme-btn="synthwave" onclick="setTheme('synthwave')">
            <div class="theme-dot" style="background: #f43f5e;"></div>
            <span>Synthwave</span>
          </button>
          <button class="theme-card-btn" data-theme-btn="anime-fantasy" onclick="setTheme('anime-fantasy')">
            <div class="theme-dot" style="background: #a855f7;"></div>
            <span>Anime Fantasy</span>
          </button>
          <button class="theme-card-btn" data-theme-btn="emerald-matrix" onclick="setTheme('emerald-matrix')">
            <div class="theme-dot" style="background: #10b981;"></div>
            <span>Emerald Matrix</span>
          </button>
        </div>
      </div>

      <div class="scroll-indicator">
        <span>SCROLL</span>
        <div class="scroll-indicator-track"></div>
      </div>
    </header>

    <!-- Why Solframe: Feature Grid -->
    <section id="features" class="features-section">
      <div class="section-header reveal">
        <span class="section-overline">Why Solframe</span>
        <h2 class="section-title">Sovereign by Design</h2>
        <p class="section-desc">Complete autonomy over cutting-edge diffusion synthesis and large language models — directly on your personal hardware.</p>
      </div>

      <div class="features-grid reveal-stagger">
        <div class="feature-card">
          <div class="feature-icon">🖥️</div>
          <h3 class="feature-title">Native GPU Acceleration</h3>
          <p class="feature-desc">Pre-compiled C++ inference engines for NVIDIA CUDA 12, AMD/Intel Vulkan, and AVX2 CPU backends — no driver gymnastics required.</p>
        </div>
        <div class="feature-card">
          <div class="feature-icon">🧠</div>
          <h3 class="feature-title">Uncensored Local LLMs</h3>
          <p class="feature-desc">Run GGUF large language models via llama.cpp with full dialogue capabilities — entirely offline, entirely yours.</p>
        </div>
        <div class="feature-card">
          <div class="feature-icon">🔒</div>
          <h3 class="feature-title">Zero Telemetry</h3>
          <p class="feature-desc">No cloud calls, no usage tracking, no data mining. Your prompts, your outputs, and your models never leave your machine.</p>
        </div>
        <div class="feature-card">
          <div class="feature-icon">📦</div>
          <h3 class="feature-title">One-Click Offline Install</h3>
          <p class="feature-desc">The Complete installer ships every Windows engine pre-compiled. Get from download to first generation in minutes.</p>
        </div>
        <div class="feature-card">
          <div class="feature-icon">💻</div>
          <h3 class="feature-title">Cross-Platform Installers</h3>
          <p class="feature-desc">Native builds for Windows (full GPU inference), plus Linux and macOS UI-preview installers — see Downloads for platform details.</p>
        </div>
        <div class="feature-card">
          <div class="feature-icon">⌘</div>
          <h3 class="feature-title">Open-Source Core</h3>
          <p class="feature-desc">Built on stable-diffusion.cpp and llama.cpp. Inspect, modify, and extend — the engine is transparent by design.</p>
        </div>
      </div>
    </section>

    <!-- Product Showcase Gallery with Real App Screenshots -->
    <section id="showcase" class="showcase-section">
      <div class="section-header reveal">
        <span class="section-overline">Product Showcase</span>
        <h2 class="section-title">The Viewport</h2>
        <p class="section-desc">Interactive preview of Solframe Studio running real local inference on GPU — no cloud, no streaming, no compromise.</p>
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
          <div class="window-title">solframe-studio — viewport</div>
          <div style="font-size: 11px; color: var(--accent); font-weight: 700;">GPU Accelerated &bull; Local Inference</div>
        </div>
        <img id="active-screenshot" src="${screenshots.lion}" alt="Solframe Studio Screenshot" class="showcase-img" loading="lazy">
      </div>

      <div class="warning-box">
        <span class="icon">⚠️</span>
        <p>Uncensored models can produce inaccurate, offensive, or unsafe content. Use uncensored models at your own risk — you are solely responsible for what you generate and how you use it.</p>
      </div>
    </section>

    <!-- Downloads Section -->
    <section id="downloads">
      <div class="section-header reveal">
        <span class="section-overline">Get Started</span>
        <h2 class="section-title">Download Solframe Studio</h2>
        <p class="section-desc">Native installers for Windows, Linux, and macOS &mdash; hosted on GitHub Releases.</p>
      </div>

      <div class="platform-group reveal" data-platform="windows">
        <div class="platform-group-title">🪟 Windows &mdash; full local inference (CUDA / Vulkan / CPU)</div>
        <div class="downloads-grid reveal-stagger">

          <!-- Full Setup -->
          <div class="download-card">
            <div class="download-badge-popular">Recommended</div>
            <div>
              <div class="download-icon-box">📦</div>
              <h3 class="download-title">Complete Installer</h3>
              <div class="download-size">Size: ~806 MB &bull; Standalone Setup</div>
              <p class="download-desc">
                All-in-one offline installation package. Bundles all pre-compiled C++ inference engines (NVIDIA CUDA 12, AMD/Intel Vulkan, AVX2 CPU, and <code>llama-server</code>).
              </p>
            </div>
            <a href="${RELEASE_BASE}/Solframe-Studio-Setup-${VERSION}.exe" class="btn-primary" style="justify-content: center;">
              <span>⬇️</span> Download Full Setup (.exe)
            </a>
          </div>

          <!-- Lightweight Setup -->
          <div class="download-card">
            <div>
              <div class="download-icon-box">🪶</div>
              <h3 class="download-title">Lightweight Installer</h3>
              <div class="download-size">Size: ~97 MB &bull; Fast Download</div>
              <p class="download-desc">
                Faster initial download — ships the UI shell without bundled GPU acceleration libraries. If you need image generation or local LLM chat, use the <strong>Complete Installer</strong> instead.
              </p>
            </div>
            <a href="${RELEASE_BASE}/Solframe-Studio-Setup-${VERSION}-Lightweight.exe" class="btn-secondary" style="justify-content: center;">
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
              <div class="download-icon-box">📦</div>
              <h3 class="download-title">AppImage</h3>
              <div class="download-size">Size: ~133 MB &bull; Any distro, no install</div>
              <p class="download-desc">
                Portable single-file app &mdash; <code>chmod +x</code> then run. Works across most modern Linux distributions.
              </p>
            </div>
            <a href="${RELEASE_BASE}/Solframe-Studio-${VERSION}-x86_64.AppImage" class="btn-primary" style="justify-content: center;">
              <span>⬇️</span> Download AppImage
            </a>
          </div>

          <!-- .deb -->
          <div class="download-card">
            <div>
              <div class="download-icon-box">📥</div>
              <h3 class="download-title">.deb Package</h3>
              <div class="download-size">Size: ~86 MB &bull; Debian / Ubuntu</div>
              <p class="download-desc">
                Install with <code>sudo apt install ./solframe-studio_${VERSION}_amd64.deb</code> on Debian-based distributions.
              </p>
            </div>
            <a href="${RELEASE_BASE}/solframe-studio_${VERSION}_amd64.deb" class="btn-secondary" style="justify-content: center;">
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
              <div class="download-icon-box">🗜️</div>
              <h3 class="download-title">App Bundle (.zip)</h3>
              <div class="download-size">Size: ~127 MB &bull; Unsigned build</div>
              <p class="download-desc">
                Unzip and move to Applications. Unsigned, so the first launch needs right-click &rarr; Open to bypass Gatekeeper.
              </p>
            </div>
            <a href="${RELEASE_BASE}/Solframe-Studio-${VERSION}-mac.zip" class="btn-secondary" style="justify-content: center;">
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
        <h2 style="font-size: 25px; font-weight: 700; margin-bottom: 6px;">💻 Direct Installation by Terminal</h2>
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
            <span class="terminal-text" id="cmd-native">git clone ${REPO_URL}.git && cd Solframe-Studio && npm install && npm run electron:build:linux</span>
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
            <span class="terminal-text" id="cmd-git">git clone ${REPO_URL}.git && cd Solframe-Studio && npm install && npm run dev</span>
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
      <div style="flex: 1; min-width: 280px; position: relative;">
        <div style="font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #a78bfa; margin-bottom: 4px;">
          Lead Creator & Architect
        </div>
        <h2 style="font-size: 27px; font-weight: 700; color: #fff; margin-bottom: 12px;">
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
      document.querySelectorAll('[data-theme-btn]').forEach((btn) => {
        btn.classList.toggle('active', btn.getAttribute('data-theme-btn') === theme);
      });
    }
    const saved = localStorage.getItem('product-theme');
    setTheme(saved || 'cinema-gold');

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
