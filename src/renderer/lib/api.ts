let cachedPort: number | null = null;

export async function getApiBase(): Promise<string> {
  if (cachedPort) return `http://localhost:${cachedPort}`;
  const port = await window.noticiando.getBackendPort();
  cachedPort = port;
  return `http://localhost:${port}`;
}
