# Pipeline — Flujo completo

## Diagrama

```
┌──────────────┐    PriceQuote    ┌───────────────┐    NormalizedPrice   ┌─────────────┐
│ Pyth Hermes  │ ──────────────→  │  normalizer   │  ─────────────────→  │   decision  │
│  HTTP GET    │                  │  expo + hash  │                       │   engine    │
└──────────────┘                  └───────────────┘                       └──────┬──────┘
                                                                                │
                                                                    ┌───────────┴───────────┐
                                                                    │                       │
                                                              deposit/lock            unlock
                                                                    │                       │
                                                             ┌──────▼──────┐        ┌───────▼──────┐
                                                             │ buildLockTx │        │buildUnlockTx │
                                                             │  5 ADA →    │        │  script →    │
                                                             │  script     │        │  wallet      │
                                                             └──────┬──────┘        └───────┬──────┘
                                                                    │                       │
                                                                    ▼                       ▼
                                                             unsigned CBOR           unsigned CBOR
                                                                    │                       │
                                                             ┌──────▼───────────────────────▼──────┐
                                                             │     Client signs + submits           │
                                                             │     Cardano Preview testnet          │
                                                             └─────────────────────────────────────┘
```

## Capas del sistema

```
api/src/
  providers/      ← CAPA 1: obtener datos externos (Pyth Hermes, Blockfrost)
  services/       ← CAPA 2: lógica de dominio pura (sin I/O)
  cardano/        ← CAPA 3: construcción de transacciones (Mesh SDK)
  routes/         ← CAPA 4: exposición HTTP
  server.ts       ← CAPA 5: orquestación Express
```

Cada capa solo conoce la anterior. El contrato Aiken es independiente de todas.

---

## Paso 1 — Fetch precio

**Código:** `providers/pythHermes.ts`

```typescript
import { getPrice } from "./providers/pythHermes.js";

const quote = await getPrice(BTC_USD_FEED_ID);
// PriceQuote { id, price, conf, expo, publishTime, rawPayload }
```

Hace un GET a Hermes y mapea la respuesta a `PriceQuote`. Sin lógica de negocio.

---

## Paso 2 — Normalizar

**Código:** `services/normalizePrice.ts`

```typescript
import { normalizePrice } from "./services/normalizePrice.js";

const price = normalizePrice(quote);
// NormalizedPrice { feedId, value, valueScaled, confidence, timestamp, payloadHash }
```

Convierte:
- `price.price × 10^expo` → `value` (float human-readable)
- `price.price × 10^(6+expo)` → `valueScaled` (bigint con 6 decimales, como string)
- `sha256(rawPayload)` → `payloadHash`

---

## Paso 3 — Decidir

**Código:** `services/decisionEngine.ts`

```typescript
import { decide } from "./services/decisionEngine.js";

const decision = decide(price, { priceThreshold: 90_000, maxAgeSeconds: 60 });
// { action: "deposit" | "unlock" | "block", reason: string }
```

| Condición | Acción |
|---|---|
| `age > maxAgeSeconds` | `block` — precio viejo |
| `price.value < priceThreshold` | `deposit` — lockear fondos |
| `price.value >= priceThreshold` | `unlock` — liberar fondos |

---

## Paso 4a — Lock TX

**Código:** `cardano/txBuilder.ts → buildLockTx`

```typescript
import { buildLockTx } from "./cardano/txBuilder.js";

const result = await buildLockTx({
  walletAddress,
  utxos,
  price: { valueScaled, timestamp, payloadHash },
  lockAmount: "5000000",
});
// { unsignedTx, scriptAddress, datum }
```

Construye usando `MeshTxBuilder`:
1. Datum inline: `{ alternative: 0, fields: [pkh, priceScaled, timestamp, payloadHash] }`
2. Output de 5 ADA al script address con el datum
3. Retorna CBOR sin firmar — el cliente firma y submite

**TX resultante:**
```
Input:   wallet UTxO (paga 5 ADA + fees)
Output:  script address → 5 ADA + datum inline
Change:  wallet (resto)
```

---

## Paso 4b — Unlock TX

**Código:** `cardano/txBuilder.ts → buildUnlockTx`

```typescript
import { buildUnlockTx } from "./cardano/txBuilder.js";

const result = await buildUnlockTx({
  walletAddress,
  utxos,
  collateral,
  scriptUtxo,
  toAddress,
});
// { unsignedTx, scriptAddress, utxoSpent }
```

Construye usando `MeshTxBuilder`:
1. `.spendingPlutusScriptV3()` — indica script Plutus V3
2. `.txIn(hash, index)` + `.txInInlineDatumPresent()` — gasta el UTxO con datum inline
3. `.txInRedeemerValue({ alternative: 0, fields: [] })` — redeemer `Unlock`
4. `.txInScript(script.code)` — adjunta el validator
5. `.requiredSignerHash(ownerPkh)` — required signer
6. `.txInCollateral(...)` — colateral para ejecución Plutus

**TX resultante:**
```
Input:   script UTxO (el que fue lockeado)
         wallet UTxO (colateral para Plutus)
Output:  recipient o wallet → 5 ADA - fees
Signer:  wallet pkh (satisface datum.owner check)
```

---

## Tipos del dominio

```typescript
// Lo que viene de Pyth
interface PriceQuote {
  id: string;
  price: string;
  conf: string;
  expo: number;
  publishTime: number;
  rawPayload: string;
}

// Lo que circula internamente
interface NormalizedPrice {
  feedId: string;
  value: number;
  valueScaled: string;    // bigint como string
  confidence: number;
  timestamp: number;
  payloadHash: string;
}

// Lo que va on-chain (datum)
interface ScriptDatum {
  owner: string;
  price: string;           // valueScaled como string
  timestamp: number;
  payloadHash: string;
}

// Mesh Data format para el datum
const meshDatum: Data = {
  alternative: 0,
  fields: [owner, price, timestamp, payloadHash],
};

// Mesh Data format para el redeemer
const meshRedeemer: Data = {
  alternative: 0,
  fields: [],
};
```

---

## Agregar un nuevo módulo al pipeline

Para insertar un paso nuevo (ej: validar confianza del precio):

1. **Crear la función** en `services/`:
```typescript
// services/validateConfidence.ts
export function validateConfidence(price: NormalizedPrice): boolean {
  return price.confidence / price.value < 0.001; // < 0.1% confianza
}
```

2. **Usarla en `decisionEngine.ts`** antes de decidir:
```typescript
if (!validateConfidence(price)) {
  return { action: "block", reason: "Low confidence interval" };
}
```

3. **Exponerla en el server** si necesita ser llamable desde la UI:
```typescript
// routes/validate.ts
router.post("/validate", wrap(async (req, res) => {
  const { price } = req.body;
  res.json({ valid: validateConfidence(price) });
}));
```

4. **Agregar el nodo en la UI** creando un componente en `front/src/components/nodes/` y registrándolo en `graph/initialGraph.ts`.

La separación por capas garantiza que ningún paso conoce los detalles de implementación del siguiente.

---

## Reemplazar Pyth Hermes por Pyth Pro

Solo requiere cambiar el provider. El resto del pipeline es idéntico:

```typescript
// providers/pythPro.ts
export async function getPricePro(feedId: string, apiKey: string): Promise<PriceQuote> {
  const res = await fetch(`https://benchmarks.pyth.network/v1/...`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  const vaa = await res.json();
  return {
    id: feedId,
    price: vaa.price,
    conf: vaa.conf,
    expo: vaa.expo,
    publishTime: vaa.publishTime,
    rawPayload: JSON.stringify(vaa.binary),
  };
}
```

En `server.ts` o el route de precio, se intercambia el provider sin tocar nada más.
