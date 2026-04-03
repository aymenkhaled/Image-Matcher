import path from "path";

const PYTHON_PORT = 5050;

// import.meta.dirname = artifacts/api-server/dist/ in both dev and prod
// (dev script builds first then runs from dist/)
const BASE_DIR = path.resolve(import.meta.dirname, "..");
export const DB_FILE = path.join(BASE_DIR, "data", "images.index");
export const PATHS_FILE = path.join(BASE_DIR, "data", "image_paths.json");
export const UPLOADS_DIR = path.join(BASE_DIR, "uploaded_images");
export const PYTHON_SCRIPT = path.join(BASE_DIR, "python_scripts", "image_server.py");

// Set to true once the Python server is healthy and ready to serve requests.
// Routes should check this and return 503 while it is false.
export let pythonReady = false;

export function setPythonReady(value: boolean): void {
  pythonReady = value;
}

export function getPythonPort() {
  return PYTHON_PORT;
}

export async function runPythonCommand(
  command: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const payload = {
    ...command,
    db_file: DB_FILE,
    paths_file: PATHS_FILE,
  };

  const response = await fetch(`http://127.0.0.1:${PYTHON_PORT}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(120_000),
  });

  if (!response.ok) {
    throw new Error(`Python server returned ${response.status}`);
  }

  return (await response.json()) as Record<string, unknown>;
}
