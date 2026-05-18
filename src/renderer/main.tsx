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
