export const BTC_USD_FEED_ID =
  "e62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43";

export const ETH_USD_FEED_ID =
  "ff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace";

export const ADA_USD_FEED_ID =
  "2a01deaec9e51a579277b34b122399984d0bbf57e2458a7e42fecd2829867a0d";

export const DEFAULT_PRICE_THRESHOLD = 90000;
export const DEFAULT_MAX_AGE_SECONDS = 60;
export const DEFAULT_LOCK_LOVELACE = "5000000"; // 5 ADA

export const EXPLORER_URLS: Record<string, string> = {
  preview: "https://preview.cardanoscan.io/transaction",
  preprod: "https://preprod.cardanoscan.io/transaction",
  mainnet: "https://cardanoscan.io/transaction",
};

export const FEED_OPTIONS = [
  { label: "BTC / USD", value: BTC_USD_FEED_ID },
  { label: "ETH / USD", value: ETH_USD_FEED_ID },
  { label: "ADA / USD", value: ADA_USD_FEED_ID },
] as const;

export const NETWORK_OPTIONS = ["Preview", "Preprod", "Mainnet"] as const;
