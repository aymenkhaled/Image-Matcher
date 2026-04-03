import { execSync, spawn } from "child_process";
import path from "path";
import app from "./app";
import { logger } from "./lib/logger";
import { PYTHON_SCRIPT, getPythonPort, setPythonReady } from "./lib/python-bridge";

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

// In production the model is pre-downloaded to .hf_cache during the build step.
// In development the model downloads to the default HuggingFace cache on first run.
const isProduction = process.env["NODE_ENV"] === "production";
const artifactDir = path.resolve(path.dirname(PYTHON_SCRIPT), "..");
const HF_HOME = isProduction
  ? path.join(artifactDir, ".hf_cache")
  : (process.env["HF_HOME"] ?? path.join(artifactDir, ".hf_cache"));

function installPythonDeps(): void {
  if (isProduction) {
    // Packages are pre-installed at build time — skip the slow pip install
    logger.info("Production: Python packages already installed at build time, skipping pip install");
    return;
  }
  const reqFile = path.join(path.dirname(PYTHON_SCRIPT), "requirements.txt");
  logger.info({ reqFile }, "Installing Python dependencies...");
  try {
    execSync(
      `python3 -m pip install -r "${reqFile}" --quiet --disable-pip-version-check`,
      { stdio: "inherit" },
    );
    logger.info("Python dependencies ready");
  } catch (err) {
    logger.error({ err }, "pip install failed — continuing anyway");
  }
}

async function startPythonServer(): Promise<void> {
  const pythonPort = getPythonPort();

  logger.info({ script: PYTHON_SCRIPT, port: pythonPort, HF_HOME }, "Starting Python image server");

  const proc = spawn("python3", [PYTHON_SCRIPT, String(pythonPort)], {
    stdio: ["ignore", "inherit", "inherit"],
    detached: false,
    env: {
      ...process.env,
      HF_HOME,
    },
  });

  proc.on("error", (err) => {
    logger.error({ err }, "Python server process error");
  });

  proc.on("exit", (code, signal) => {
    if (code !== 0) {
      logger.warn({ code, signal }, "Python server exited unexpectedly");
    }
  });

  // Poll until Python server is healthy (up to 5 minutes for first-time model download)
  for (let i = 0; i < 300; i++) {
    await new Promise<void>((r) => setTimeout(r, 1000));
    try {
      const res = await fetch(`http://127.0.0.1:${pythonPort}/health`);
      if (res.ok) {
        logger.info("Python image server is ready");
        setPythonReady(true);
        return;
      }
    } catch {
      // not up yet, keep waiting
    }
  }

  throw new Error("Python server did not become ready in 5 minutes");
}

async function main() {
  // Start Express immediately so the port opens (required for deployment health checks)
  await new Promise<void>((resolve, reject) => {
    app.listen(port, (err) => {
      if (err) {
        logger.error({ err }, "Error listening on port");
        reject(err);
        return;
      }
      logger.info({ port }, "Server listening (Python AI server warming up in background)");
      resolve();
    });
  });

  // Install deps + start Python server in the background
  // API routes return 503 until pythonReady = true
  void (async () => {
    try {
      installPythonDeps();
      await startPythonServer();
    } catch (err) {
      logger.error({ err }, "Python server failed to start");
    }
  })();
}

main().catch((err) => {
  logger.error({ err }, "Fatal startup error");
  process.exit(1);
});
