import { Router } from "express";
import { wrap } from "../middleware/errors.js";
import { buildLockTx, buildUnlockTx } from "../cardano/txBuilder.js";

const router = Router();

router.post(
  "/tx/build-lock",
  wrap(async (req, res) => {
    const { walletAddress, utxos, price, lockAmount } = req.body ?? {};

    if (!walletAddress || !utxos || !price) {
      res.status(400).json({
        error: "Body must include { walletAddress, utxos, price }",
      });
      return;
    }

    const result = await buildLockTx({
      walletAddress,
      utxos,
      price,
      lockAmount,
    });

    res.json(result);
  }),
);

router.post(
  "/tx/build-unlock",
  wrap(async (req, res) => {
    const { walletAddress, utxos, collateral, scriptUtxo, toAddress } =
      req.body ?? {};

    if (!walletAddress || !utxos || !collateral || !scriptUtxo) {
      res.status(400).json({
        error:
          "Body must include { walletAddress, utxos, collateral, scriptUtxo }",
      });
      return;
    }

    const result = await buildUnlockTx({
      walletAddress,
      utxos,
      collateral,
      scriptUtxo,
      toAddress,
    });

    res.json(result);
  }),
);

export default router;
