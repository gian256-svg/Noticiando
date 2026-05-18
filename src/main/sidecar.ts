import { ChildProcess, spawn } from "child_process";
import path from "path";
import net from "net";
import { app } from "electron";

let sidecarProcess: ChildProcess | null = null;
let backendPort = 0;

function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, () => {
      const addr = server.address();
      server.close(() => resolve((addr as net.AddressInfo).port));
    });
  });
}

function getBackendDir(): string {
  return app.isPackaged
    ? process.resourcesPath
    : path.join(app.getAppPath(), "backend");
}

function getBackendExecutable(): string {
  if (app.isPackaged) {
    const exe = process.platform === "win32" ? "noticiando_backend.exe" : "noticiando_backend";
    return path.join(process.resourcesPath, exe);
  }
  // Dev mode: use the venv Python so all packages are available
  const backendDir = getBackendDir();
  return process.platform === "win32"
    ? path.join(backendDir, ".venv", "Scripts", "python.exe")
    : path.join(backendDir, ".venv", "bin", "python3");
}

function getBackendArgs(port: number): string[] {
  if (app.isPackaged) {
    return [`--port=${port}`];
  }
  return ["main.py", `--port=${port}`];
}

export async function startSidecar(): Promise<number> {
  backendPort = await getFreePort();
  const exe = getBackendExecutable();
  const args = getBackendArgs(backendPort);

  sidecarProcess = spawn(exe, args, {
    cwd: getBackendDir(),
    env: { ...process.env, PORT: String(backendPort) },
    stdio: ["ignore", "pipe", "pipe"],
  });

  sidecarProcess.stdout?.on("data", (d: Buffer) => {
    if (process.env.NODE_ENV === "development") {
      process.stdout.write(`[backend] ${d}`);
    }
  });

  sidecarProcess.stderr?.on("data", (d: Buffer) => {
    process.stderr.write(`[backend:err] ${d}`);
  });

  sidecarProcess.on("exit", (code) => {
    console.log(`Backend exited with code ${code}`);
    sidecarProcess = null;
  });

  // Wait for backend to be ready
  await waitForBackend(backendPort);
  return backendPort;
}

export function stopSidecar() {
  if (sidecarProcess && !sidecarProcess.killed) {
    sidecarProcess.kill("SIGTERM");
    sidecarProcess = null;
  }
}

export function getBackendPort(): number {
  return backendPort;
}

async function waitForBackend(port: number, retries = 30, delayMs = 500): Promise<void> {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(`http://localhost:${port}/health`);
      if (response.ok) return;
    } catch {
      // not ready yet
    }
    await new Promise((r) => setTimeout(r, delayMs));
  }
  throw new Error(`Backend did not start on port ${port} after ${retries} retries`);
}
