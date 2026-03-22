import type { PriceQuote, WalletInfo } from "@/types";

function randomHex(bytes: number): string {
  const arr = new Uint8Array(bytes);
  for (let i = 0; i < bytes; i++) {
    arr[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(arr)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function randomBtcPrice(): PriceQuote {
  const basePrice = 65000 + Math.random() * 30000; // 65k–95k
  const rawPrice = Math.round(basePrice * 1e5); // expo = -5
  const conf = Math.round(200000 + Math.random() * 100000);

  return {
    id: "e62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43",
    price: String(rawPrice),
    conf: String(conf),
    expo: -5,
    publishTime: Math.floor(Date.now() / 1000),
    rawPayload: randomHex(256),
  };
}

export function fakePayloadHash(): string {
  return randomHex(32);
}

export function fakeTxHash(): string {
  return randomHex(32);
}

export function fakeWallet(): WalletInfo {
  return {
    address: "addr_test1qr8nk3v5m9fjp7xz5l4v6jsd82mvcwas347s29",
    pkh: "fc3393513a0bc14fba0c0e8a9593a120e2e1456d47729a94c87466b",
    scriptAddress: "addr_test1wr9k5mjr8xqv6zx3hm7pzya5mlr9",
    network: "Preview",
  };
}

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
