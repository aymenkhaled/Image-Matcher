import { Router, type IRouter } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import os from "os";
import { runPythonCommand } from "../lib/python-bridge";

const router: IRouter = Router();

const uploadTemp = multer({
  dest: os.tmpdir(),
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

router.post(
  "/search",
  uploadTemp.single("query"),
  async (req, res): Promise<void> => {
    const file = req.file;
    if (!file) {
      res.status(400).json({ error: "No query image provided" });
      return;
    }

    const threshold = parseFloat(String(req.body.threshold ?? 50));
    const topK = parseInt(String(req.body.topK ?? 20), 10);

    const filename = file.originalname || path.basename(file.path);

    try {
      const result = await runPythonCommand({
        cmd: "search",
        query_path: file.path,
        threshold: isNaN(threshold) ? 50 : threshold,
        top_k: isNaN(topK) ? 20 : topK,
      }) as {
        success: boolean;
        results: Array<{
          id: number;
          path: string;
          filename: string;
          score: number;
          imageUrl: string;
        }>;
        error?: string;
      };

      fs.unlink(file.path, () => {});

      if (!result.success) {
        res.status(500).json({ error: result.error || "Search failed" });
        return;
      }

      res.json({
        results: result.results || [],
        totalFound: (result.results || []).length,
        query: {
          threshold: isNaN(threshold) ? 50 : threshold,
          topK: isNaN(topK) ? 20 : topK,
          filename,
        },
      });
    } catch (err) {
      fs.unlink(file.path, () => {});
      req.log.error({ err }, "Search failed");
      res.status(500).json({ error: String(err) });
    }
  },
);

export default router;
