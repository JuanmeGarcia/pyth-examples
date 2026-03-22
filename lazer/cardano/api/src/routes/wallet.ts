import { Router } from "express";
import { wrap } from "../middleware/errors.js";
import { getWalletInfo } from "../cardano/wallet.js";

const router = Router();

router.get(
  "/wallet",
  wrap(async (_req, res) => {
    res.json(await getWalletInfo());
  }),
);

export default router;
