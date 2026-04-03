import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { pythonReady } from "./lib/python-bridge";

const app: Express = express();

app.set("etag", false);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Return 503 for AI-dependent routes while the Python server is warming up
app.use("/api", (req: Request, res: Response, next: NextFunction) => {
  if (req.path === "/healthz" || req.path === "/ready") {
    return next();
  }
  if (!pythonReady) {
    res.status(503).json({
      error: "AI server is starting up — please wait a moment and try again.",
      ready: false,
    });
    return;
  }
  next();
});

app.use("/api", router);

export default app;
