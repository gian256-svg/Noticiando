let cachedPort: number | null = null;

const BROWSER_FALLBACK_PORT = 8765;

export async function getApiBase(): Promise<string> {
  if (cachedPort) return `http://localhost:${cachedPort}`;
  if (typeof window !== "undefined" && window.noticiando?.getBackendPort) {
    const port = await window.noticiando.getBackendPort();
    if (port) {
      // Only cache a real port — if sidecar isn't ready yet (port=0), don't cache so next call retries
      cachedPort = port;
    } else {
      return `http://localhost:${BROWSER_FALLBACK_PORT}`;
    }
  } else {
    cachedPort = BROWSER_FALLBACK_PORT;
  }
  return `http://localhost:${cachedPort}`;
}

export function clearPortCache() {
  cachedPort = null;
}
