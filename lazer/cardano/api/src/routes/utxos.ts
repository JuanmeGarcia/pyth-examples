import { Router } from "express";
import { wrap } from "../middleware/errors.js";
import { getProvider } from "../cardano/txBuilder.js";
import { getScript } from "../cardano/script.js";
import { getWalletInfo } from "../cardano/wallet.js";

const router = Router();

router.get(
  "/utxos",
  wrap(async (req, res) => {
    const scope = (req.query.scope as string | undefined) ?? "script";
    const addressParam = req.query.address as string | undefined;
    const { scriptAddress } = getScript();
    const wallet = await getWalletInfo();
    const address =
      addressParam ?? (scope === "wallet" ? wallet.address : scriptAddress);

    const provider = getProvider();
    const utxos = await provider.fetchAddressUTxOs(address);
    res.json({ utxos, address, scope });
  }),
);

export default router;
