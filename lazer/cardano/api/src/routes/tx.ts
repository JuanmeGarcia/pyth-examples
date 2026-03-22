import { Router } from "express";
import { wrap } from "../middleware/errors.js";
import { getProvider } from "../cardano/txBuilder.js";
import { buildLockTx, buildUnlockTx } from "../cardano/txBuilder.js";
import { getScript } from "../cardano/script.js";
import {
  getWalletInfo,
  getWalletUtxos,
  signAndSubmit,
} from "../cardano/wallet.js";
import { NETWORK } from "../config.js";
import type { Asset } from "@meshsdk/core";

const router = Router();

function capitalize(value: string) {
  return value[0].toUpperCase() + value.slice(1);
}

function toDatumView(plutusData: unknown) {
  const data = plutusData as { fields?: unknown[] } | null | undefined;
  const fields = Array.isArray(data?.fields) ? data.fields : [];

  return {
    owner: typeof fields[0] === "string" ? fields[0] : "",
    price:
      typeof fields[1] === "string" || typeof fields[1] === "number"
        ? String(fields[1])
        : "",
    timestamp:
      typeof fields[2] === "number"
        ? fields[2]
        : typeof fields[2] === "string"
          ? Number(fields[2])
          : 0,
    payloadHash: typeof fields[3] === "string" ? fields[3] : "",
  };
}

router.post(
  "/tx/build-lock",
  wrap(async (req, res) => {
    const { walletAddress, utxos, price, lockAmount, dryRun } = req.body ?? {};

    if (!price) {
      res.status(400).json({
        error: "Body must include { price }",
      });
      return;
    }

    const wallet = await getWalletInfo();
    const walletUtxos = utxos ?? (await getWalletUtxos());

    const result = await buildLockTx({
      walletAddress: walletAddress ?? wallet.address,
      utxos: walletUtxos,
      price,
      lockAmount,
    });

    const txHash = dryRun ? "(dry-run)" : await signAndSubmit(result.unsignedTx);
    res.json({
      txHash,
      kind: "lock",
      status: dryRun ? "dry-run" : "submitted",
      scriptAddress: result.scriptAddress,
      datum: result.datum,
      lovelace: lockAmount ?? "5000000",
      network: capitalize(NETWORK),
      unsignedTx: result.unsignedTx,
    });
  }),
);

router.post(
  "/tx/build-unlock",
  wrap(async (req, res) => {
    const { walletAddress, utxos, collateral, scriptUtxo, toAddress, dryRun } =
      req.body ?? {};
    const wallet = await getWalletInfo();
    const walletUtxos = utxos ?? (await getWalletUtxos());
    const collateralUtxos = collateral ?? walletUtxos.slice(0, 1);

    if (collateralUtxos.length === 0) {
      throw new Error("No collateral UTxO available in wallet");
    }

    let oracleUtxo = scriptUtxo;
    if (!oracleUtxo) {
      const provider = getProvider();
      const { scriptAddress } = getScript();
      const scriptUtxos = await provider.fetchAddressUTxOs(scriptAddress);
      oracleUtxo = scriptUtxos[0];
    }

    if (!oracleUtxo) {
      throw new Error("No UTxO available at script address");
    }

    const result = await buildUnlockTx({
      walletAddress: walletAddress ?? wallet.address,
      utxos: walletUtxos,
      collateral: collateralUtxos,
      scriptUtxo: oracleUtxo,
      toAddress,
    });

    const txHash = dryRun ? "(dry-run)" : await signAndSubmit(result.unsignedTx);
    res.json({
      txHash,
      kind: "unlock",
      status: dryRun ? "dry-run" : "submitted",
      scriptAddress: result.scriptAddress,
      datum: toDatumView(oracleUtxo.output.plutusData),
      lovelace:
        oracleUtxo.output.amount.find((asset: Asset) => asset.unit === "lovelace")?.quantity ??
        undefined,
      network: capitalize(NETWORK),
      unsignedTx: result.unsignedTx,
      utxoSpent: result.utxoSpent,
    });
  }),
);

export default router;
