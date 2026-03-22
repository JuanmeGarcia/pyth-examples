export interface PriceQuote {
  id: string;
  price: string;
  conf: string;
  expo: number;
  publishTime: number;
  rawPayload?: string;
}

export interface NormalizedPrice {
  feedId: string;
  value: number;
  valueScaled: string;
  confidence: number;
  timestamp: number;
  payloadHash: string;
}

export interface ActionDecision {
  action: "deposit" | "unlock" | "block";
  reason: string;
}

export interface ScriptDatum {
  owner: string;
  price: string;
  timestamp: number;
  payloadHash: string;
}

export interface ScriptRedeemer {
  action: "unlock";
}

export interface TxBuildResult {
  txHash: string;
  kind: "lock" | "unlock";
  status: "dry-run" | "submitted" | "confirmed";
  scriptAddress: string;
  datum: ScriptDatum;
  lovelace?: string;
  network?: string;
  explorerUrl?: string;
}

export interface WalletInfo {
  address: string;
  pkh: string;
  scriptAddress: string;
  network: string;
}

export interface DecisionConfig {
  priceThreshold: number;
  maxAgeSeconds: number;
}

export interface UtxoInfo {
  txHash: string;
  outputIndex: number;
  lovelace: string;
  datum?: ScriptDatum;
  isOurs?: boolean;
}

export interface HealthResponse {
  status: string;
  wallet?: string;
  network?: string;
}
