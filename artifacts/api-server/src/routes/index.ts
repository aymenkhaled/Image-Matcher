import { Router, type IRouter } from "express";
import healthRouter from "./health";
import imagesRouter from "./images";
import searchRouter from "./search";

const router: IRouter = Router();

router.use(healthRouter);
router.use(imagesRouter);
router.use(searchRouter);

export default router;
