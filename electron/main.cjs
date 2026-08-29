const { app, BrowserWindow, shell, Menu } = require("electron");
const path = require("path");
const fs = require("fs");
const { createServer } = require("./server.cjs");

const PORT = 1420;
let mainWindow = null;
let splashWindow = null;
let appServer = null;

function getPaths() {
  const isPackaged = app.isPackaged;
  let rootDir = path.join(__dirname, "..");
  let resourcesPath = rootDir;
  let distDir = path.join(rootDir, "dist");
  let publicDir = path.join(rootDir, "public");

  if (isPackaged) {
    resourcesPath = process.resourcesPath;
    rootDir = path.join(process.resourcesPath, "app");
    distDir = path.join(__dirname, "..", "dist");
    publicDir = path.join(__dirname, "..", "public");
    if (!fs.existsSync(distDir)) {
      distDir = path.join(process.resourcesPath, "app", "dist");
    }
    if (!fs.existsSync(publicDir)) {
      publicDir = path.join(process.resourcesPath, "app", "public");
    }
  }

  return { rootDir, resourcesPath, isPackaged, distDir, publicDir };
}

function createSplashWindow() {
  const { publicDir } = getPaths();
  const iconPath = path.join(publicDir, "logo.png");
  const iconExists = fs.existsSync(iconPath);

  splashWindow = new BrowserWindow({
    width: 460,
    height: 300,
    frame: false,
    center: true,
    alwaysOnTop: true,
    backgroundColor: "#050810",
    show: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  const iconUrl = iconExists ? "file://" + iconPath.replace(/\\/g, "/") : "";

  splashWindow.loadURL("data:text/html," + encodeURIComponent(`
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"/></head>
    <body style="margin:0;background:radial-gradient(circle at center, #0f172a 0%, #050810 100%);display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;font-family:'Segoe UI',system-ui,sans-serif;color:#f8fafc;user-select:none;-webkit-app-region:drag;overflow:hidden;border:1px solid rgba(255,255,255,0.1);border-radius:14px;">
      ${iconUrl ? '<img src="' + iconUrl + '" style="width:78px;height:78px;border-radius:18px;margin-bottom:14px;box-shadow:0 0 25px rgba(6,182,212,0.4);border:1px solid rgba(255,255,255,0.2);">' : '<div style="font-size:52px;margin-bottom:12px;">✨</div>'}
      <h1 style="font-size:22px;font-weight:800;letter-spacing:-0.02em;margin:0 0 4px;background:linear-gradient(135deg,#22d3ee 0%,#a855f7 100%);-webkit-background-clip:text;-webkit-text-fill-color:transparent;">NexusAI Studio</h1>
      <p style="color:#64748b;font-size:12px;font-weight:500;margin:0 0 20px;letter-spacing:0.06em;text-transform:uppercase;">Generative AI &bull; FLUX &bull; LLM</p>
      <div style="width:180px;height:3px;background:rgba(255,255,255,0.08);border-radius:99px;overflow:hidden;">
        <div id="bar" style="width:35%;height:100%;background:linear-gradient(90deg,#06b6d4,#8b5cf6);border-radius:99px;transition:width 0.25s;"></div>
      </div>
      <p id="msg" style="color:#475569;font-size:11px;margin-top:10px;">Initializing neural engines...</p>
      <script>
        let w=35;setInterval(()=>{w=Math.min(95,w+Math.random()*6);document.getElementById("bar").style.width=w+"%";},300);
      </script>
    </body>
    </html>
  `));
}

function createMainWindow() {
  const { publicDir } = getPaths();
  const iconPath = path.join(publicDir, "nexusai-icon.png");

  mainWindow = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 1024,
    minHeight: 700,
    center: true,
    title: "NexusAI Studio",
    icon: fs.existsSync(iconPath) ? iconPath : undefined,
    backgroundColor: "#050810",
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  Menu.setApplicationMenu(null);

  mainWindow.loadURL(`http://127.0.0.1:${PORT}`);

  mainWindow.once("ready-to-show", () => {
    if (splashWindow && !splashWindow.isDestroyed()) {
      splashWindow.close();
      splashWindow = null;
    }
    mainWindow.show();
    mainWindow.focus();
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("http") && !url.includes("127.0.0.1") && !url.includes("localhost")) {
      shell.openExternal(url);
      return { action: "deny" };
    }
    return { action: "allow" };
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createSplashWindow();

  const paths = getPaths();
  console.log("[NexusAI Desktop] Initializing standalone engine with paths:", paths);

  appServer = createServer({ ...paths, port: PORT });
  appServer.listen(PORT, () => {
    console.log(`[NexusAI Desktop] Engine listening on http://127.0.0.1:${PORT}`);
    createMainWindow();
  });
});

app.on("window-all-closed", () => {
  if (appServer) {
    try { appServer.close(); } catch (e) {}
    appServer = null;
  }
  app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createMainWindow();
  }
});

app.on("before-quit", () => {
  if (appServer) {
    try { appServer.close(); } catch (e) {}
    appServer = null;
  }
});