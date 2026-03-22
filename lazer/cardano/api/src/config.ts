import { config as loadDotenv } from "dotenv";
import { resolve } from "node:path";

loadDotenv({ path: resolve(import.meta.dirname, "../.env"), override: false });
loadDotenv({ path: resolve(import.meta.dirname, "../../off-chain/.env"), override: false });

function pickEnv(...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = process.env[key];
    if (value && value.trim()) {
      return value.trim();
    }
  }
  return undefined;
}

export const NETWORK = pickEnv("CARDANO_NETWORK", "NETWORK") ?? "preview";
export const BLOCKFROST_KEY = pickEnv("BLOCKFROST_KEY", "BLOCKFROST_API_KEY") ?? "";
export const WALLET_MNEMONIC = pickEnv("WALLET_MNEMONIC") ?? "";
export const PORT = Number(process.env.PORT) || 3001;
export const PLUTUS_JSON_PATH =
  process.env.PLUTUS_JSON_PATH ??
  resolve(import.meta.dirname, "../../on-chain/plutus.json");
