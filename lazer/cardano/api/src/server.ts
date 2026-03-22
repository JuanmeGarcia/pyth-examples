import "dotenv/config";
import express from "express";
import cors from "cors";

import { bigintSerializer } from "./middleware/bigint.js";
import { errorHandler } from "./middleware/errors.js";
import { loadScript } from "./cardano/script.js";
import { initProvider } from "./cardano/txBuilder.js";

import healthRoute from "./routes/health.js";
import priceRoute from "./routes/price.js";
import normalizeRoute from "./routes/normalize.js";
import decideRoute from "./routes/decide.js";
import scriptRoute from "./routes/script.js";
import utxosRoute from "./routes/utxos.js";
import txRoute from "./routes/tx.js";

const PORT = Number(process.env.PORT) || 3001;
const BLOCKFROST_KEY = process.env.BLOCKFROST_KEY;

const app = express();

app.use(cors());
app.use(express.json({ limit: "2mb" }));
app.use(bigintSerializer);

// Mount all routes under /api
app.use(
  "/api",
  healthRoute,
  priceRoute,
  normalizeRoute,
  decideRoute,
  scriptRoute,
  utxosRoute,
  txRoute,
);

app.use(errorHandler);

// ── Startup ────────────────────────────────────────────────────

async function boot() {
  console.log("PythFlow API server starting…");

  // 1. Blockfrost provider
  if (BLOCKFROST_KEY) {
    initProvider(BLOCKFROST_KEY);
    console.log("  Blockfrost : connected");
  } else {
    console.warn("  Blockfrost : ⚠ BLOCKFROST_KEY not set — TX endpoints will fail");
  }

  // 2. Aiken script
  try {
    const { scriptAddress, hash } = loadScript(
      process.env.PLUTUS_JSON_PATH || undefined,
    );
    console.log(`  Script     : ${scriptAddress}`);
    console.log(`  Hash       : ${hash}`);
  } catch (err) {
    console.warn(
      `  Script     : ⚠ plutus.json not found — /api/script and TX endpoints will fail`,
    );
    console.warn(`               ${(err as Error).message}`);
  }

  app.listen(PORT, () => {
    console.log(`  Ready on   : http://localhost:${PORT}`);
  });
}

boot();
