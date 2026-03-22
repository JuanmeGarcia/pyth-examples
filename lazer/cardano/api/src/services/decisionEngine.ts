import type { NormalizedPrice } from "./normalizePrice.js";

export interface DecisionConfig {
  priceThreshold: number;
  maxAgeSeconds: number;
}

export interface ActionDecision {
  action: "deposit" | "unlock" | "block";
  reason: string;
}

const DEFAULT_CONFIG: DecisionConfig = {
  priceThreshold: 90_000,
  maxAgeSeconds: 60,
};

export function decide(
  price: NormalizedPrice,
  config?: Partial<DecisionConfig>,
): ActionDecision {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const age = Math.floor(Date.now() / 1000) - price.timestamp;

  if (age > cfg.maxAgeSeconds) {
    return {
      action: "block",
      reason: `Price stale: ${age}s old (max ${cfg.maxAgeSeconds}s)`,
    };
  }

  const fmt = (n: number) =>
    `$${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

  if (price.value >= cfg.priceThreshold) {
    return {
      action: "unlock",
      reason: `${fmt(price.value)} ≥ threshold ${fmt(cfg.priceThreshold)}`,
    };
  }

  return {
    action: "deposit",
    reason: `${fmt(price.value)} < threshold ${fmt(cfg.priceThreshold)}`,
  };
}
