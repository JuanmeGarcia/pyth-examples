import { Router } from "express";
import { wrap } from "../middleware/errors.js";
import { getPrice } from "../providers/pythHermes.js";

const router = Router();

router.get(
  "/price",
  wrap(async (req, res) => {
    const feedId = req.query.feedId as string | undefined;
    if (!feedId) {
      res.status(400).json({ error: "feedId query parameter is required" });
      return;
    }
    const quote = await getPrice(feedId);
    res.json(quote);
  }),
);

export default router;
