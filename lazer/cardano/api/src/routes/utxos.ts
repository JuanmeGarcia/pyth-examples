import { Router } from "express";
import { wrap } from "../middleware/errors.js";
import { getProvider } from "../cardano/txBuilder.js";

const router = Router();

router.get(
  "/utxos",
  wrap(async (req, res) => {
    const address = req.query.address as string | undefined;
    if (!address) {
      res.status(400).json({ error: "address query parameter is required" });
      return;
    }
    const provider = getProvider();
    const utxos = await provider.fetchAddressUTxOs(address);
    res.json({ utxos, address });
  }),
);

export default router;
