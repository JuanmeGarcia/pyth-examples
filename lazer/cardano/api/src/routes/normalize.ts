import { Router } from "express";
import { wrap } from "../middleware/errors.js";
import { normalizePrice } from "../services/normalizePrice.js";

const router = Router();

router.post(
  "/normalize",
  wrap(async (req, res) => {
    const quote = req.body;
    if (!quote?.price || quote.expo === undefined) {
      res.status(400).json({ error: "Body must be a PriceQuote (price, expo, …)" });
      return;
    }
    const normalized = normalizePrice(quote);
    res.json(normalized);
  }),
);

export default router;
