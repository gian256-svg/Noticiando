import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

// Dev-mode mock for window.noticiando when running outside Electron
if (!window.noticiando) {
  (window as any).noticiando = {
    invoke: async (channel: string, ...args: unknown[]) => {
      console.log(`[mock] invoke: ${channel}`, args);
      if (channel === "backend:port") return 8765;
      if (channel === "scripts:list") return [];

      if (channel === "video:generate-scenes") {
        const payload = args[0];
        try {
          const resp = await fetch("http://localhost:8765/generate-video-scenes", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
          if (!resp.ok) {
            const detail = await resp.text().catch(() => String(resp.status));
            return { error: `Erro do backend mock: ${detail}` };
          }
          return await resp.json();
        } catch (err) {
          return { error: `Erro de rede mock: ${String(err)}` };
        }
      }

      if (channel === "video:render") {
        const payload = args[0] as any;
        const mappedPayload = {
          composition_props: payload.compositionProps,
          news_title: payload.newsTitle,
          total_frames: payload.totalFrames,
        };
        try {
          const resp = await fetch("http://localhost:8765/render-video", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(mappedPayload),
          });
          if (!resp.ok) {
            const detail = await resp.text().catch(() => String(resp.status));
            return { error: `Erro do backend mock: ${detail}` };
          }
          const result = await resp.json();
          return {
            ok: result.ok,
            outputPath: result.output_path,
            error: result.error,
          };
        } catch (err) {
          return { error: `Erro de rede mock: ${String(err)}` };
        }
      }

      return null;
    },
    on: (_channel: string, _cb: unknown) => () => {},
    getBackendPort: async () => 8765,
    window: {
      minimize: () => {},
      maximize: () => {},
      close: () => {},
      isMaximized: async () => false,
    },
  };
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
