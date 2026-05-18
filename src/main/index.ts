import { app, BrowserWindow, nativeTheme, shell } from "electron";
import path from "path";
import { setupIpcHandlers } from "./ipc-handlers";
import { startSidecar, stopSidecar } from "./sidecar";
import { initDb } from "./db";

declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string;
declare const MAIN_WINDOW_VITE_NAME: string;

nativeTheme.themeSource = "dark";

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    backgroundColor: "#0A0A0F",
    titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "hidden",
    frame: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
    show: false,
  });

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`)
    );
  }

  mainWindow.once("ready-to-show", () => {
    mainWindow?.show();
    if (process.env.NODE_ENV === "development") {
      mainWindow?.webContents.openDevTools({ mode: "detach" });
    }
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });
}

app.on("ready", async () => {
  initDb();

  // Register IPC handlers once — they read the port dynamically via getBackendPort()
  setupIpcHandlers();

  // Create window immediately — don't wait for backend
  createWindow();

  // Start backend in background — port is stored in sidecar module
  startSidecar()
    .then((port) => {
      mainWindow?.webContents.send("backend:ready", port);
    })
    .catch((err) => {
      console.error("Backend failed to start:", err);
      mainWindow?.webContents.send("backend:error", String(err));
    });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    stopSidecar();
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

app.on("before-quit", () => {
  stopSidecar();
});
