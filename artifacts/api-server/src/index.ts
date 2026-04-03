import { spawn } from "child_process";
import app from "./app";
import { logger } from "./lib/logger";
import { PYTHON_SCRIPT, getPythonPort } from "./lib/python-bridge";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

async function startPythonServer(): Promise<void> {
  const pythonPort = getPythonPort();

  logger.info({ script: PYTHON_SCRIPT, port: pythonPort }, "Starting Python image server");

  const proc = spawn("python3", [PYTHON_SCRIPT, String(pythonPort)], {
    stdio: ["ignore", "inherit", "inherit"],
    detached: false,
  });

  proc.on("error", (err) => {
    logger.error({ err }, "Python server process error");
  });

  proc.on("exit", (code, signal) => {
    if (code !== 0) {
      logger.warn({ code, signal }, "Python server exited unexpectedly");
    }
  });

  // Poll until Python server is healthy (up to 3 minutes for model load/download)
  for (let i = 0; i < 180; i++) {
    await new Promise<void>((r) => setTimeout(r, 1000));
    try {
      const res = await fetch(`http://127.0.0.1:${pythonPort}/health`);
      if (res.ok) {
        logger.info("Python image server is ready");
        return;
      }
    } catch {
      // not up yet, keep waiting
    }
  }

  throw new Error("Python server did not become ready in 3 minutes");
}

async function main() {
  await startPythonServer();

  app.listen(port, (err) => {
    if (err) {
      logger.error({ err }, "Error listening on port");
      process.exit(1);
    }
    logger.info({ port }, "Server listening");
  });
}

main().catch((err) => {
  logger.error({ err }, "Fatal startup error");
  process.exit(1);
});
