import "server-only";

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  BlockfrostProvider,
  MeshWallet,
  Transaction,
  type PlutusScript,
  type Data,
  resolveScriptHash,
  serializePlutusScript,
  applyCborEncoding,
  unixTimeToEnclosingSlot,
  SLOT_CONFIG_NETWORK,
} from "@meshsdk/core";
import type { OracleDatum } from "@/types";

interface Blueprint {
  validators: { title: string; compiledCode: string; hash: string }[];
}

const NETWORK = (process.env.CARDANO_NETWORK ?? "preprod") as
  | "mainnet"
  | "preprod"
  | "preview";

const BLOCKFROST_API_KEY = process.env.BLOCKFROST_API_KEY ?? "";

// Lazy singletons
let _provider: BlockfrostProvider | null = null;
let _script: { script: PlutusScript; address: string; hash: string } | null =
  null;

function getProvider(): BlockfrostProvider {
  if (!_provider) {
    _provider = new BlockfrostProvider(BLOCKFROST_API_KEY);
  }
  return _provider;
}

export async function createWalletFromMnemonic(
  words: string[],
): Promise<MeshWallet> {
  const wallet = new MeshWallet({
    networkId: NETWORK === "mainnet" ? 1 : 0,
    fetcher: getProvider(),
    submitter: getProvider(),
    key: { type: "mnemonic", words },
  });
  await wallet.init();
  return wallet;
}

export function loadScript() {
  if (_script) return _script;

  const plutusPath = resolve(process.cwd(), "../on-chain/plutus.json");
  const raw = readFileSync(plutusPath, "utf-8");
  const blueprint: Blueprint = JSON.parse(raw);
  const validator = blueprint.validators[0];
  if (!validator) throw new Error(`No validators found in ${plutusPath}`);

  const scriptCbor = applyCborEncoding(validator.compiledCode);
  const script: PlutusScript = { code: scriptCbor, version: "V3" };
  const hash = resolveScriptHash(script.code, "V3");
  const networkId = NETWORK === "mainnet" ? 1 : 0;
  const { address } = serializePlutusScript(script, undefined, networkId);

  _script = { script, address, hash };
  return _script;
}

export function getScriptAddress(): string {
  return loadScript().address;
}

export function getNetwork(): string {
  return NETWORK.charAt(0).toUpperCase() + NETWORK.slice(1);
}

function encodeDatum(datum: OracleDatum): Data {
  switch (datum.kind) {
    case "AnyPrice":
      return { alternative: 0, fields: [] };
    case "MinPrice":
      return {
        alternative: 1,
        fields: [datum.minPriceUsdCents],
      };
    case "MaxPrice":
      return {
        alternative: 2,
        fields: [datum.maxPriceUsdCents],
      };
    case "PriceRange":
      return {
        alternative: 3,
        fields: [datum.loCents, datum.hiCents],
      };
  }
}

export async function lockOracleUtxo(
  mnemonic: string[],
  datum: OracleDatum,
  lovelace = 2_000_000,
): Promise<string> {
  const wallet = await createWalletFromMnemonic(mnemonic);
  const { address: scriptAddress } = loadScript();

  const encodedDatum: Data = encodeDatum(datum);
  const tx = new Transaction({ initiator: wallet }).sendLovelace(
    {
      address: scriptAddress,
      datum: { value: encodedDatum, inline: true },
    },
    lovelace.toString(),
  );

  const unsignedTx = await tx.build();
  const signedTx = await wallet.signTx(unsignedTx);
  return wallet.submitTx(signedTx);
}

export async function spendOracleUtxo(
  mnemonic: string[],
  datum: OracleDatum,
  payload: Uint8Array,
): Promise<string> {
  const wallet = await createWalletFromMnemonic(mnemonic);
  const { script, address: scriptAddress } = loadScript();

  const utxos = await getProvider().fetchAddressUTxOs(scriptAddress);
  if (utxos.length === 0) throw new Error("No UTxOs at oracle script address");

  const redeemerHex = Buffer.from(payload).toString("hex");
  const redeemerData: Data = { alternative: 0, fields: [redeemerHex] };

  const networkKey = NETWORK === "mainnet" ? "mainnet" : NETWORK;
  const slotConfig = SLOT_CONFIG_NETWORK[networkKey];
  const ttlSlot = unixTimeToEnclosingSlot(Date.now() + 60_000, slotConfig);

  const tx = new Transaction({ initiator: wallet })
    .redeemValue({
      value: utxos[0],
      script,
      redeemer: { data: redeemerData },
    })
    .setTimeToExpire(String(ttlSlot));

  const unsignedTx = await tx.build();
  const signedTx = await wallet.signTx(unsignedTx);
  return wallet.submitTx(signedTx);
}

export async function fetchScriptUtxos() {
  const scriptAddress = getScriptAddress();
  return getProvider().fetchAddressUTxOs(scriptAddress);
}

export function isBlockfrostConfigured(): boolean {
  return !!BLOCKFROST_API_KEY;
}

export async function getWalletBalance(address: string): Promise<string> {
  const utxos = await getProvider().fetchAddressUTxOs(address);
  const total = utxos.reduce((sum, u) => {
    const lovelace = u.output.amount.find(
      (a: { unit: string; quantity: string }) => a.unit === "lovelace",
    );
    return sum + BigInt(lovelace?.quantity ?? "0");
  }, 0n);
  return total.toString();
}
