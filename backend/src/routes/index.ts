import { Router, type IRouter } from "express";
import healthRouter from "./health";
import potholesRouter from "./potholes";
import statsRouter from "./stats";
import routingRouter from "./routing";
import anthropicRouter from "./anthropic/index";
import complaintsRouter from "./complaints";
import { syncLiveData } from "../lib/liveData";

const router: IRouter = Router();

router.use(healthRouter);
router.use(potholesRouter);
router.use(statsRouter);
router.use(routingRouter);
router.use(anthropicRouter);
router.use(complaintsRouter);

router.post("/live-sync", async (_req, res) => {
  try {
    const result = await syncLiveData();
    return res.json({ ok: true, ...result });
  } catch (err: any) {
    return res.status(500).json({ ok: false, error: err.message });
  }
});

export default router;
