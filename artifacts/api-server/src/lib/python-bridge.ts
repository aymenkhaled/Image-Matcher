import { spawn } from "child_process";
import path from "path";
import { logger } from "./logger";

const DB_DIR = path.resolve(process.cwd(), "data");
const DB_FILE = path.join(DB_DIR, "images.index");
const PATHS_FILE = path.join(DB_DIR, "image_paths.json");
const SCRIPT_PATH = path.resolve(
  process.cwd(),
  "python_scripts/image_search.py",
);

export function getDbPaths() {
  return { DB_FILE, PATHS_FILE, DB_DIR };
}

export async function runPythonCommand(
  command: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const input = JSON.stringify({
      ...command,
      db_file: DB_FILE,
      paths_file: PATHS_FILE,
    });

    const proc = spawn("python3", [SCRIPT_PATH]);

    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (data: Buffer) => {
      stdout += data.toString();
    });

    proc.stderr.on("data", (data: Buffer) => {
      stderr += data.toString();
    });

    proc.on("close", (code) => {
      if (stderr) {
        logger.warn({ stderr }, "Python script stderr");
      }

      if (!stdout.trim()) {
        reject(new Error(`Python script produced no output. Exit code: ${code}. stderr: ${stderr}`));
        return;
      }

      try {
        const result = JSON.parse(stdout.trim());
        resolve(result);
      } catch (err) {
        reject(new Error(`Failed to parse Python output: ${stdout}. Error: ${String(err)}`));
      }
    });

    proc.on("error", (err) => {
      reject(new Error(`Failed to spawn python3: ${err.message}`));
    });

    proc.stdin.write(input);
    proc.stdin.end();
  });
}
