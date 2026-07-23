// Electron main process for the portable "Find Frekvensen" build.
//
// Why Electron: the app uses the Web Serial API (to read the base-station
// micro:bit), which needs a real Chromium and a secure context. Bundling our
// own Chromium means the .exe runs on ANY Windows PC with nothing installed and
// no internet — and we can auto-connect to the micro:bit so there's no serial
// port picker to fumble with in front of the kids.
//
// It serves the statically-exported Next app (../out) over http://127.0.0.1 (a
// secure context) and loads it in a fullscreen window.

const { app, BrowserWindow, session } = require("electron");
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const OUT_DIR = path.join(__dirname, "..", "out");
const MICROBIT_VENDOR_ID = 0x0d28; // BBC micro:bit (ARM mbed / DAPLink)

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".map": "application/json; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".wasm": "application/wasm",
};

// Minimal static file server for the exported app. Reads through the asar
// archive fine (Electron patches fs). Falls back to index.html for routes.
function startServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      let pathname = "/";
      try {
        pathname = decodeURIComponent(new URL(req.url, "http://127.0.0.1").pathname);
      } catch {
        pathname = "/";
      }

      let filePath = path.join(OUT_DIR, pathname);
      // Prevent path traversal outside OUT_DIR.
      if (!filePath.startsWith(OUT_DIR)) {
        res.writeHead(403);
        res.end("Forbidden");
        return;
      }

      const sendFile = (fp) => {
        fs.readFile(fp, (err, data) => {
          if (err) {
            res.writeHead(404);
            res.end("Not found");
            return;
          }
          res.writeHead(200, { "Content-Type": MIME[path.extname(fp)] || "application/octet-stream" });
          res.end(data);
        });
      };

      fs.stat(filePath, (err, stat) => {
        if (!err && stat.isDirectory()) filePath = path.join(filePath, "index.html");
        if (!err && stat.isFile()) return sendFile(filePath);
        if (err && !path.extname(pathname)) {
          // SPA-style fallback for extension-less routes.
          return sendFile(path.join(OUT_DIR, "index.html"));
        }
        return sendFile(filePath);
      });
    });
    server.listen(0, "127.0.0.1", () => {
      resolve(server.address().port);
    });
  });
}

function wireSerial(sess) {
  // Allow the 'serial' permission for our local app.
  sess.setPermissionCheckHandler((_wc, permission) => permission === "serial" || permission === "media");
  sess.setDevicePermissionHandler((details) => details.deviceType === "serial");

  // Auto-select the base-station micro:bit (no picker dialog). Prefer a
  // micro:bit by USB vendor id; otherwise fall back to the first port.
  sess.on("select-serial-port", (event, portList, _wc, callback) => {
    event.preventDefault();
    const isMicrobit = (p) => {
      const v = p.vendorId;
      return v != null && (parseInt(v, 10) === MICROBIT_VENDOR_ID || parseInt(v, 16) === MICROBIT_VENDOR_ID);
    };
    const chosen = portList.find(isMicrobit) || portList[0];
    callback(chosen ? chosen.portId : "");
  });
}

async function createWindow() {
  const port = await startServer();

  const win = new BrowserWindow({
    width: 1600,
    height: 900,
    fullscreen: true,
    backgroundColor: "#efe7d6",
    autoHideMenuBar: true,
    title: "Find Frekvensen",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  wireSerial(win.webContents.session);

  // Keyboard: F11 toggles fullscreen, Esc leaves fullscreen, Ctrl+Q quits.
  win.webContents.on("before-input-event", (event, input) => {
    if (input.type !== "keyDown") return;
    if (input.key === "F11") {
      win.setFullScreen(!win.isFullScreen());
      event.preventDefault();
    } else if (input.key === "Escape" && win.isFullScreen()) {
      win.setFullScreen(false);
      event.preventDefault();
    } else if (input.control && (input.key === "q" || input.key === "Q")) {
      app.quit();
    }
  });

  win.loadURL(`http://127.0.0.1:${port}/`);
}

// Single instance — avoid two windows fighting over the serial port.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.whenReady().then(createWindow);
  app.on("second-instance", () => {
    const win = BrowserWindow.getAllWindows()[0];
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });
  app.on("window-all-closed", () => app.quit());
}

// Keep a reference so the linter/bundler doesn't tree-shake session import.
void session;
