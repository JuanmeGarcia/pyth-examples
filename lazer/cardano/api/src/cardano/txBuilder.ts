import {
  MeshTxBuilder,
  BlockfrostProvider,
  resolvePaymentKeyHash,
  type Data,
  type UTxO,
} from "@meshsdk/core";
import { getScript } from "./script.js";

let provider: BlockfrostProvider | null = null;

export function initProvider(blockfrostKey: string) {
  provider = new BlockfrostProvider(blockfrostKey);
}

export function getProvider(): BlockfrostProvider {
  if (!provider) throw new Error("BlockfrostProvider not initialised");
  return provider;
}

function newTxBuilder() {
  const p = getProvider();
  return new MeshTxBuilder({ fetcher: p, evaluator: p });
}

// ── Datum shape ────────────────────────────────────────────────

export interface ScriptDatum {
  owner: string;
  price: string;
  timestamp: number;
  payloadHash: string;
}

function datumToMesh(d: ScriptDatum): Data {
  return {
    alternative: 0,
    fields: [d.owner, Number(d.price), d.timestamp, d.payloadHash],
  };
}

// Redeemer Unlock = Constr(0, [])
const UNLOCK_REDEEMER: Data = { alternative: 0, fields: [] };

// ── Lock TX ────────────────────────────────────────────────────

export interface BuildLockParams {
  walletAddress: string;
  utxos: UTxO[];
  price: { valueScaled: string; timestamp: number; payloadHash: string };
  lockAmount?: string;
}

export interface BuildLockResult {
  unsignedTx: string;
  scriptAddress: string;
  datum: ScriptDatum;
}

export async function buildLockTx(
  params: BuildLockParams,
): Promise<BuildLockResult> {
  const { script, scriptAddress } = getScript();
  const { walletAddress, utxos, price, lockAmount = "5000000" } = params;

  const ownerPkh = resolvePaymentKeyHash(walletAddress);

  const datum: ScriptDatum = {
    owner: ownerPkh,
    price: price.valueScaled,
    timestamp: price.timestamp,
    payloadHash: price.payloadHash,
  };

  const txBuilder = newTxBuilder();

  const unsignedTx = await txBuilder
    .txOut(scriptAddress, [{ unit: "lovelace", quantity: lockAmount }])
    .txOutInlineDatumValue(datumToMesh(datum))
    .changeAddress(walletAddress)
    .selectUtxosFrom(utxos)
    .complete();

  return { unsignedTx, scriptAddress, datum };
}

// ── Unlock TX ──────────────────────────────────────────────────

export interface BuildUnlockParams {
  walletAddress: string;
  utxos: UTxO[];
  collateral: UTxO[];
  /** The script UTxO to spend */
  scriptUtxo: UTxO;
  toAddress?: string;
}

export interface BuildUnlockResult {
  unsignedTx: string;
  scriptAddress: string;
  utxoSpent: string;
}

export async function buildUnlockTx(
  params: BuildUnlockParams,
): Promise<BuildUnlockResult> {
  const { script, scriptAddress } = getScript();
  const { walletAddress, utxos, collateral, scriptUtxo, toAddress } = params;

  const ownerPkh = resolvePaymentKeyHash(walletAddress);
  const recipient = toAddress ?? walletAddress;

  const txBuilder = newTxBuilder();

  const unsignedTx = await txBuilder
    .spendingPlutusScriptV3()
    .txIn(scriptUtxo.input.txHash, scriptUtxo.input.outputIndex)
    .txInInlineDatumPresent()
    .txInRedeemerValue(UNLOCK_REDEEMER)
    .txInScript(script.code)
    .txOut(recipient, scriptUtxo.output.amount)
    .requiredSignerHash(ownerPkh)
    .txInCollateral(
      collateral[0].input.txHash,
      collateral[0].input.outputIndex,
      collateral[0].output.amount,
      collateral[0].output.address,
    )
    .changeAddress(walletAddress)
    .selectUtxosFrom(utxos)
    .complete();

  const utxoRef = `${scriptUtxo.input.txHash}#${scriptUtxo.input.outputIndex}`;
  return { unsignedTx, scriptAddress, utxoSpent: utxoRef };
}
