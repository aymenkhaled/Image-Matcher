import { Router, type IRouter } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { runPythonCommand, getDbPaths } from "../lib/python-bridge";
import { logger } from "../lib/logger";

const router: IRouter = Router();

const { DB_DIR } = getDbPaths();

if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

const UPLOADS_DIR = path.resolve(process.cwd(), "uploaded_images");
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = path.extname(file.originalname);
    cb(null, `${unique}${ext}`);
  },
});

const upload = multer({
  storage,
  fileFilter: (_req, file, cb) => {
    const allowed = /\.(png|jpe?g|webp|bmp|gif)$/i;
    if (allowed.test(file.originalname)) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed"));
    }
  },
  limits: { fileSize: 50 * 1024 * 1024 },
});

router.get("/images/stats", async (req, res): Promise<void> => {
  try {
    const result = await runPythonCommand({ cmd: "stats" });
    res.json(result);
  } catch (err) {
    req.log.error({ err }, "Failed to get stats");
    res.status(500).json({ error: String(err) });
  }
});

router.get("/images/list", async (req, res): Promise<void> => {
  try {
    const result = await runPythonCommand({ cmd: "list" }) as { images: Array<{ id: number; path: string; filename: string }> };
    res.json({ images: result.images || [] });
  } catch (err) {
    req.log.error({ err }, "Failed to list images");
    res.status(500).json({ error: String(err) });
  }
});

router.post("/images/clear", async (req, res): Promise<void> => {
  try {
    await runPythonCommand({ cmd: "clear" });
    res.json({ success: true, message: "Database cleared successfully" });
  } catch (err) {
    req.log.error({ err }, "Failed to clear database");
    res.status(500).json({ error: String(err) });
  }
});

router.post("/images/index", async (req, res): Promise<void> => {
  const { folderPath } = req.body as { folderPath?: string };
  if (!folderPath) {
    res.status(400).json({ error: "folderPath is required" });
    return;
  }

  if (!fs.existsSync(folderPath)) {
    res.status(400).json({ error: `Folder not found: ${folderPath}` });
    return;
  }

  const exts = /\.(png|jpe?g|webp|bmp|gif)$/i;
  const imagePaths: string[] = [];

  function walkDir(dir: string) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walkDir(full);
      } else if (exts.test(entry.name)) {
        imagePaths.push(full);
      }
    }
  }

  walkDir(folderPath);

  if (imagePaths.length === 0) {
    res.status(400).json({ error: "No images found in folder" });
    return;
  }

  try {
    const result = await runPythonCommand({ cmd: "index", paths: imagePaths }) as { count: number };
    res.json({ success: true, message: `Indexed ${result.count} images`, count: result.count || 0 });
  } catch (err) {
    req.log.error({ err }, "Failed to index folder");
    res.status(500).json({ error: String(err) });
  }
});

router.post(
  "/images/upload",
  upload.array("files", 100),
  async (req, res): Promise<void> => {
    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) {
      res.status(400).json({ error: "No image files provided" });
      return;
    }

    const paths = files.map((f) => f.path);
    try {
      const result = await runPythonCommand({ cmd: "add", paths }) as { count: number };
      res.json({
        success: true,
        message: `Uploaded and indexed ${result.count} images`,
        count: result.count || 0,
      });
    } catch (err) {
      req.log.error({ err }, "Failed to upload images");
      res.status(500).json({ error: String(err) });
    }
  },
);

router.get("/images/:id", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(rawId, 10);

  if (isNaN(id) || id < 0) {
    res.status(400).json({ error: "Invalid image ID" });
    return;
  }

  try {
    const result = await runPythonCommand({ cmd: "list" }) as { images: Array<{ id: number; path: string }> };
    const images = result.images || [];
    const img = images.find((i) => i.id === id);

    if (!img) {
      res.status(404).json({ error: "Image not found" });
      return;
    }

    if (!fs.existsSync(img.path)) {
      res.status(404).json({ error: "Image file not found on disk" });
      return;
    }

    res.sendFile(path.resolve(img.path));
  } catch (err) {
    req.log.error({ err }, "Failed to serve image");
    res.status(500).json({ error: String(err) });
  }
});

export default router;
