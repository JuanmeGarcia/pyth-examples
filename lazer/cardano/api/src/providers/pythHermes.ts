const HERMES_BASE = "https://hermes.pyth.network";

export interface PriceQuote {
  id: string;
  price: string;
  conf: string;
  expo: number;
  publishTime: number;
  rawPayload: string;
}

export async function getPrice(feedId: string): Promise<PriceQuote> {
  const url = `${HERMES_BASE}/v2/updates/price/latest?ids[]=${feedId}`;
  const res = await fetch(url);

  if (!res.ok) {
    throw Object.assign(
      new Error(`Hermes returned ${res.status}: ${res.statusText}`),
      { status: 502 },
    );
  }

  const data = await res.json();
  const parsed = data.parsed?.[0];

  if (!parsed) {
    throw Object.assign(
      new Error(`No price data returned for feed ${feedId}`),
      { status: 404 },
    );
  }

  return {
    id: parsed.id,
    price: parsed.price.price,
    conf: parsed.price.conf,
    expo: parsed.price.expo,
    publishTime: parsed.price.publish_time,
    rawPayload: JSON.stringify(data),
  };
}
