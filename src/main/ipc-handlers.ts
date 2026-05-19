import { ipcMain, BrowserWindow, Notification, app, shell } from "electron";
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

  ipcMain.handle("shell:open-external", (_e, url: string) => shell.openExternal(url));
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
}
