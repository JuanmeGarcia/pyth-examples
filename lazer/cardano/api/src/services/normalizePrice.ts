import { createHash } from "node:crypto";
import type { PriceQuote } from "../providers/pythHermes.js";

const SCALE = 6;

export interface NormalizedPrice {
  feedId: string;
  value: number;
  valueScaled: string;
  confidence: number;
  timestamp: number;
  payloadHash: string;
}

export function normalizePrice(quote: PriceQuote): NormalizedPrice {
  const rawPrice = BigInt(quote.price);
  const expo = quote.expo;
  const effectiveExp = SCALE + expo;

  let valueScaled: bigint;
  if (effectiveExp >= 0) {
    valueScaled = rawPrice * 10n ** BigInt(effectiveExp);
  } else {
    valueScaled = rawPrice / 10n ** BigInt(-effectiveExp);
  }

  const value = Number(rawPrice) * Math.pow(10, expo);
  const confidence = Number(BigInt(quote.conf)) * Math.pow(10, expo);
  const payloadHash = createHash("sha256")
    .update(quote.rawPayload)
    .digest("hex");

  return {
    feedId: quote.id,
    value,
    valueScaled: valueScaled.toString(),
    confidence,
    timestamp: quote.publishTime,
    payloadHash,
  };
}
