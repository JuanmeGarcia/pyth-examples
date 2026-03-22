import type {
  PriceQuote,
  NormalizedPrice,
  ActionDecision,
  TxBuildResult,
  WalletInfo,
  DecisionConfig,
  UtxoInfo,
  HealthResponse,
} from "@/types";

export interface PipelineApiClient {
  getHealth(): Promise<HealthResponse>;
  getWallet(): Promise<WalletInfo>;
  getUtxos(): Promise<UtxoInfo[]>;
  getPrice(feedId: string): Promise<PriceQuote>;
  normalize(quote: PriceQuote): Promise<NormalizedPrice>;
  decide(
    price: NormalizedPrice,
    config: DecisionConfig
  ): Promise<ActionDecision>;
  buildLockTx(
    price: NormalizedPrice,
    dryRun: boolean
  ): Promise<TxBuildResult>;
  buildUnlockTx(dryRun: boolean, toAddress?: string): Promise<TxBuildResult>;
}

async function fetchJson<T>(
  url: string,
  options?: RequestInit
): Promise<T> {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(
      (body as { error?: string }).error || `HTTP ${res.status}: ${res.statusText}`
    );
  }
  return res.json() as Promise<T>;
}

export const realApiClient: PipelineApiClient = {
  getHealth: () => fetchJson("/api/health"),

  getWallet: () => fetchJson("/api/wallet"),

  getUtxos: async () => {
    const result = await fetchJson<{ utxos: UtxoInfo[] }>("/api/utxos");
    return result.utxos;
  },

  getPrice: (feedId) => fetchJson(`/api/price?feedId=${feedId}`),

  normalize: (quote) =>
    fetchJson("/api/normalize", {
      method: "POST",
      body: JSON.stringify(quote),
    }),

  decide: (price, config) =>
    fetchJson("/api/decide", {
      method: "POST",
      body: JSON.stringify({ price, config }),
    }),

  buildLockTx: (price, dryRun) =>
    fetchJson("/api/tx/build-lock", {
      method: "POST",
      body: JSON.stringify({ price, dryRun }),
    }),

  buildUnlockTx: (dryRun, toAddress) =>
    fetchJson("/api/tx/build-unlock", {
      method: "POST",
      body: JSON.stringify({ dryRun, toAddress }),
    }),
};
