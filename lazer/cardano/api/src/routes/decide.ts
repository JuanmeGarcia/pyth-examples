import { Router } from "express";
import { wrap } from "../middleware/errors.js";
import { decide } from "../services/decisionEngine.js";

const router = Router();

router.post(
  "/decide",
  wrap(async (req, res) => {
    const { price, config } = req.body ?? {};
    if (!price?.value || !price?.timestamp) {
      res.status(400).json({ error: "Body must include { price: NormalizedPrice }" });
      return;
    }
    const decision = decide(price, config);
    res.json(decision);
  }),
);

export default router;
