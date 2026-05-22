import { ipcMain, BrowserWindow, Notification, app, shell, dialog } from "electron";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { getBackendPort } from "./sidecar";
import { getSavedScripts, saveScript, deleteScript } from "./db";
import Store from "electron-store";

const store = new Store();

// Called ONCE at app startup — no port arg needed, port is read dynamically
export function setupIpcHandlers() {
  ipcMain.handle("backend:port", () => getBackendPort());

  // Window controls
  ipcMain.handle("window:minimize", () => {
    BrowserWindow.getFocusedWindow()?.minimize();
  });
  ipcMain.handle("window:maximize", () => {
    const win = BrowserWindow.getFocusedWindow();
    if (win?.isMaximized()) win.unmaximize();
    else win?.maximize();
  });
  ipcMain.handle("window:close", () => {
    BrowserWindow.getFocusedWindow()?.close();
  });
  ipcMain.handle("window:isMaximized", () => {
    return BrowserWindow.getFocusedWindow()?.isMaximized() ?? false;
  });

  // Saved scripts (local SQLite)
  ipcMain.handle("scripts:list", () => getSavedScripts());
  ipcMain.handle("scripts:save", (_e, script: { newsId: string; title: string; content: string; format: string }) => {
    return saveScript(script);
  });
  ipcMain.handle("scripts:delete", (_e, id: string) => deleteScript(id));

  // Desktop notifications for high viral score news
  ipcMain.handle("notify:viral", (_e, { title, score }: { title: string; score: number }) => {
    if (!Notification.isSupported()) return;
    new Notification({
      title: `🔥 Notícia viral detectada (Score: ${score})`,
      body: title,
      urgency: "normal",
    }).show();
  });

  ipcMain.handle("shell:open-external", async (_e, url: string) => {
    try {
      await shell.openExternal(url);
      return { success: true };
    } catch (err) {
      console.error("[shell:open-external] Failed to open external URL:", err);
      return { success: false, error: String(err) };
    }
  });

  // Open file's containing folder and select/highlight it
  ipcMain.handle("shell:show-item", async (_e, filePath: string) => {
    try {
      if (filePath) shell.showItemInFolder(filePath);
      return { success: true };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  });

  // Save As dialog — let user choose where to save the rendered video
  ipcMain.handle("video:save-dialog", async (_e, { newsTitle }: { newsTitle: string }) => {
    const safe = newsTitle
      .replace(/[^\w\s]/g, "")
      .trim()
      .replace(/\s+/g, "_")
      .slice(0, 40);
    const { canceled, filePath } = await dialog.showSaveDialog({
      title: "Salvar Reels",
      defaultPath: `Reels_${safe}.mp4`,
      filters: [{ name: "Vídeo MP4", extensions: ["mp4"] }],
    });
    return { canceled, filePath };
  });
  ipcMain.handle("app:version", () => app.getVersion());

  // video:generate-scenes — calls Python sidecar (Gemini → Groq cascade)
  ipcMain.handle("video:generate-scenes", async (_e, payload: {
    news_id: string;
    title: string;
    summary: string;
    category: string;
    duration: number;
    thumbnail_url: string | null;
    article_url?: string | null;
    pasted_script?: string | null;
  }) => {
    const port = getBackendPort();
    if (!port) return { error: "Backend ainda não iniciou. Aguarde alguns segundos e tente novamente." };
    try {
      const res = await fetch(`http://127.0.0.1:${port}/generate-video-scenes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const detail = await res.text();
        return { error: `Backend error: ${detail}` };
      }
      return await res.json();
    } catch (err) {
      console.error("[IPC video:generate-scenes]", err);
      return { error: String(err) };
    }
  });

  // video:render — delegates to Python backend which runs `npx remotion render`
  ipcMain.handle("video:render", async (_e, payload: {
    compositionProps: Record<string, unknown>;
    newsTitle: string;
    totalFrames: number;
    outputPath?: string;
  }) => {
    const port = getBackendPort();
    if (!port) return { ok: false, error: "Backend não iniciado." };
    try {
      const res = await fetch(`http://127.0.0.1:${port}/render-video`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          composition_props: payload.compositionProps,
          news_title: payload.newsTitle,
          total_frames: payload.totalFrames,
          output_path: payload.outputPath ?? null,
        }),
      });
      if (!res.ok) {
        const detail = await res.text();
        return { ok: false, error: `Backend: ${detail}` };
      }
      const data = await res.json() as { ok: boolean; output_path?: string; error?: string };
      return { ok: data.ok, outputPath: data.output_path, error: data.error };
    } catch (err) {
      console.error("[IPC video:render]", err);
      return { ok: false, error: String(err) };
    }
  });

  // news:get — fetch latest news items from the Python sidecar
  ipcMain.handle("news:get", async (_e, filters?: { limit?: number; category?: string; min_score?: number; period?: string }) => {
    const port = getBackendPort();
    if (!port) return { total: 0, items: [] };
    try {
      const limit = filters?.limit ?? 100;
      const category = filters?.category ?? "all";
      const min_score = filters?.min_score ?? 0;
      const period = filters?.period ?? "6h";
      const res = await fetch(`http://127.0.0.1:${port}/news?limit=${limit}&category=${category}&min_score=${min_score}&period=${period}`);
      if (!res.ok) throw new Error("Failed to fetch news from sidecar");
      return await res.json();
    } catch (error) {
      console.error("[IPC news:get] Error:", error);
      return { total: 0, items: [] };
    }
  });

  // script:generate — trigger script generation on the Python sidecar
  ipcMain.handle("script:generate", async (_e, payload: {
    news_id: string;
    title: string;
    summary: string;
    sources: string[];
    published_at: string;
    viral_score: number;
    category: string;
    format_type: string;
    duration: number;
    api_key: string;
  }) => {
    const port = getBackendPort();
    if (!port) return { error: "Backend não iniciado." };
    try {
      const res = await fetch(`http://127.0.0.1:${port}/generate-script`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Failed to generate script from sidecar");
      return await res.json();
    } catch (error) {
      console.error("[IPC script:generate] Error:", error);
      return { error: String(error) };
    }
  });

  // config:get / config:set — persistent key-value store
  ipcMain.handle("config:get", (_e, key: string, defaultValue?: unknown) => {
    return (store as any).get(key, defaultValue);
  });
  ipcMain.handle("config:set", (_e, key: string, value: unknown) => {
    (store as any).set(key, value);
    return { success: true };
  });

  // scripts:export-pdf — gera um PDF do roteiro usando printToPDF nativo do Electron
  ipcMain.handle("scripts:export-pdf", async (_e, { title, content }: { title: string; content: string }) => {
    const safeTitle = title
      .slice(0, 40)
      .replace(/[^\w\s-]/g, "")
      .trim()
      .replace(/\s+/g, "-");

    const { canceled, filePath } = await dialog.showSaveDialog({
      title: "Exportar Roteiro como PDF",
      defaultPath: `roteiro-${safeTitle}.pdf`,
      filters: [{ name: "PDF", extensions: ["pdf"] }],
    });

    if (canceled || !filePath) return { ok: false };

    const htmlContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; max-width: 680px; margin: 48px auto; color: #111; line-height: 1.7; }
    h1 { font-size: 1rem; font-weight: 600; border-bottom: 1px solid #ddd; padding-bottom: 10px; margin-bottom: 28px; color: #333; }
    pre { white-space: pre-wrap; font-family: inherit; font-size: 0.88rem; }
  </style>
</head>
<body>
  <h1>${title.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</h1>
  <pre>${content.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</pre>
</body>
</html>`;

    const tmpFile = path.join(os.tmpdir(), `noticiando-${Date.now()}.html`);

    try {
      fs.writeFileSync(tmpFile, htmlContent, "utf-8");

      const hiddenWin = new BrowserWindow({ show: false });
      await hiddenWin.loadFile(tmpFile);
      const pdfBuffer = await hiddenWin.webContents.printToPDF({ printBackground: false });
      hiddenWin.destroy();

      fs.writeFileSync(filePath, pdfBuffer);
      shell.openPath(filePath);
      return { ok: true, filePath };
    } catch (err) {
      console.error("[IPC scripts:export-pdf]", err);
      return { ok: false, error: String(err) };
    } finally {
      try { fs.unlinkSync(tmpFile); } catch { /* ignora se já foi removido */ }
    }
  });
}
