import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  root: path.resolve(__dirname, "src/renderer"),
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src/renderer"),
    },
  },
  // Remotion: keep only browser-safe packages in the renderer bundle.
  // @remotion/cli, @remotion/bundler, @remotion/renderer are Node.js-only
  // and must never be bundled for the browser/Electron renderer.
  optimizeDeps: {
    include: ["remotion", "@remotion/player"],
    exclude: ["@remotion/cli", "@remotion/bundler", "@remotion/renderer"],
  },
  build: {
    rollupOptions: {
      external: ["@remotion/cli", "@remotion/bundler", "@remotion/renderer"],
    },
  },
  define: {
    // Remotion reads process.env.NODE_ENV at runtime
    "process.env.NODE_ENV": JSON.stringify(process.env.NODE_ENV ?? "development"),
  },
});
