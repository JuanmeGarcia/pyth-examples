import type { PipelineApiClient } from "./api";
import type {
  PriceQuote,
  NormalizedPrice,
  ActionDecision,
  TxBuildResult,
  DecisionConfig,
  ScriptDatum,
} from "@/types";
import {
  randomBtcPrice,
  fakePayloadHash,
  fakeTxHash,
  fakeWallet,
  delay,
} from "@/mock/data";
import { DEFAULT_LOCK_LOVELACE, EXPLORER_URLS } from "./constants";

function sha256Hex(input: string): string {
  // Simple deterministic hash for mock — not cryptographic
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  const hex = Math.abs(hash).toString(16).padStart(8, "0");
  return hex.repeat(8).slice(0, 64);
}

export const mockApiClient: PipelineApiClient = {
  async getHealth() {
    await delay(100);
    return { status: "ok", wallet: "mock", network: "Preview" };
  },

  async getWallet() {
    await delay(200);
    return fakeWallet();
  },

  async getUtxos() {
    await delay(300);
    const wallet = fakeWallet();
    return [
      {
        txHash: fakeTxHash(),
        outputIndex: 0,
        lovelace: DEFAULT_LOCK_LOVELACE,
        datum: {
          owner: wallet.pkh,
          price: "70730110000",
          timestamp: Math.floor(Date.now() / 1000) - 30,
          payloadHash: fakePayloadHash(),
        },
        isOurs: true,
      },
    ];
  },

  async getPrice(_feedId: string) {
    await delay(300 + Math.random() * 500);
    return randomBtcPrice();
  },

  async normalize(quote: PriceQuote) {
    await delay(200 + Math.random() * 300);

    const rawPrice = parseInt(quote.price, 10);
    const expo = quote.expo;
    const value = rawPrice * Math.pow(10, expo);
    const effectiveExp = 6 + expo;
    const valueScaled = String(
      BigInt(rawPrice) * BigInt(Math.pow(10, Math.max(0, effectiveExp)))
    );
    const confidence = parseInt(quote.conf, 10) * Math.pow(10, expo);
    const payloadHash = sha256Hex(quote.rawPayload || quote.price);

    return {
      feedId: quote.id,
      value,
      valueScaled,
      confidence,
      timestamp: quote.publishTime,
      payloadHash,
    };
  },

  async decide(
    price: NormalizedPrice,
    config: DecisionConfig
  ): Promise<ActionDecision> {
    await delay(200 + Math.random() * 200);

    const age = Math.floor(Date.now() / 1000) - price.timestamp;

    if (age > config.maxAgeSeconds) {
      return {
        action: "block",
        reason: `Price stale: ${age}s old (max ${config.maxAgeSeconds}s)`,
      };
    }

    if (price.value >= config.priceThreshold) {
      return {
        action: "unlock",
        reason: `Price $${price.value.toLocaleString()} >= threshold $${config.priceThreshold.toLocaleString()}`,
      };
    }

    return {
      action: "deposit",
      reason: `Price $${price.value.toLocaleString()} < threshold $${config.priceThreshold.toLocaleString()}`,
    };
  },

  async buildLockTx(
    price: NormalizedPrice,
    dryRun: boolean
  ): Promise<TxBuildResult> {
    await delay(500 + Math.random() * 500);

    const wallet = fakeWallet();
    const datum: ScriptDatum = {
      owner: wallet.pkh,
      price: price.valueScaled,
      timestamp: price.timestamp,
      payloadHash: price.payloadHash,
    };

    const txHash = dryRun ? "(dry-run)" : fakeTxHash();

    return {
      txHash,
      kind: "lock",
      status: dryRun ? "dry-run" : "submitted",
      scriptAddress: wallet.scriptAddress,
      datum,
      lovelace: DEFAULT_LOCK_LOVELACE,
      network: "Preview",
      explorerUrl: dryRun
        ? undefined
        : `${EXPLORER_URLS.preview}/${txHash}`,
    };
  },

  async buildUnlockTx(dryRun: boolean): Promise<TxBuildResult> {
    await delay(500 + Math.random() * 500);

    const wallet = fakeWallet();
    const datum: ScriptDatum = {
      owner: wallet.pkh,
      price: "70730110000",
      timestamp: Math.floor(Date.now() / 1000) - 30,
      payloadHash: fakePayloadHash(),
    };

    const txHash = dryRun ? "(dry-run)" : fakeTxHash();

    return {
      txHash,
      kind: "unlock",
      status: dryRun ? "dry-run" : "submitted",
      scriptAddress: wallet.scriptAddress,
      datum,
      lovelace: DEFAULT_LOCK_LOVELACE,
      network: "Preview",
      explorerUrl: dryRun
        ? undefined
        : `${EXPLORER_URLS.preview}/${txHash}`,
    };
  },
};
