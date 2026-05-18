let cachedPort: number | null = null;

const BROWSER_FALLBACK_PORT = 8765;

export async function getApiBase(): Promise<string> {
  if (cachedPort) return `http://localhost:${cachedPort}`;
  // In Electron the preload exposes getBackendPort(); in browser dev use fixed port
  if (typeof window !== "undefined" && window.noticiando?.getBackendPort) {
    cachedPort = await window.noticiando.getBackendPort();
  } else {
    cachedPort = BROWSER_FALLBACK_PORT;
  }
  return `http://localhost:${cachedPort}`;
}
