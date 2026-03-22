# API Server — Referencia

El servidor Express expone el pipeline como endpoints HTTP. Es **stateless** — no almacena claves privadas. Las transacciones se devuelven sin firmar (CBOR hex) para que el cliente las firme con su wallet.

**Base URL:** `http://localhost:3001`

---

## Correr el servidor

```bash
cd api
npm run dev
```

Al iniciar, el servidor carga el script Aiken compilado y conecta a Blockfrost:

```
PythFlow API server starting…
  Blockfrost : connected
  Script     : addr_test1wrkyx8vxy7pf6l3pzxgkrkgfaz56zhty3fnml7pvet7r2uqa5mlr9
  Hash       : ec431d86...
  Ready on   : http://localhost:3001
```

## Variables de entorno requeridas

| Variable           | Descripción                                        |
| ------------------ | -------------------------------------------------- |
| `BLOCKFROST_KEY`   | Project ID de Blockfrost (prefix determina la red) |

**Opcionales:**

| Variable           | Descripción                                        |
| ------------------ | -------------------------------------------------- |
| `PLUTUS_JSON_PATH` | Path al plutus.json compilado (default: `../../aiken/plutus.json`) |
| `PORT`             | Puerto del servidor (default: `3001`)               |

---

## Endpoints

### `GET /api/health`

Verifica que el servidor está operativo y retorna info básica.

**Respuesta:**

```json
{
  "ok": true,
  "network": "Preview",
  "scriptAddress": "addr_test1wrkyx8...",
  "scriptHash": "ec431d86..."
}
```

---

### `GET /api/script`

Retorna información del validator Aiken compilado.

**Respuesta:**

```json
{
  "scriptAddress": "addr_test1wrkyx8vxy7pf6l3pzxgkrkgfaz56zhty3fnml7pvet7r2uqa5mlr9",
  "scriptHash": "ec431d86...",
  "plutusVersion": "V3"
}
```

---

### `GET /api/utxos?address=<addr>`

Lista los UTxOs en una address. Usa Blockfrost para consultar la chain.

**Parámetros:**

| Query     | Requerido | Descripción             |
| --------- | --------- | ----------------------- |
| `address` | sí        | Bech32 Cardano address  |

**Respuesta:**

```json
{
  "utxos": [
    {
      "input": { "txHash": "9c15ac0b...", "outputIndex": 0 },
      "output": {
        "address": "addr_test1wr...",
        "amount": [{ "unit": "lovelace", "quantity": "5000000" }]
      }
    }
  ],
  "address": "addr_test1wr..."
}
```

---

### `GET /api/price?feedId=<id>`

Obtiene el precio más reciente de Pyth Hermes.

**Parámetros:**

| Query    | Requerido | Descripción                   |
| -------- | --------- | ----------------------------- |
| `feedId` | sí        | Pyth price feed ID (sin `0x`) |

**Ejemplo:**

```
GET /api/price?feedId=e62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43
```

**Respuesta:**

```json
{
  "id": "e62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43",
  "price": "7073011000",
  "conf": "250000",
  "expo": -5,
  "publishTime": 1774063917,
  "rawPayload": "{...json completo de hermes...}"
}
```

---

### `POST /api/normalize`

Normaliza un `PriceQuote` a representación de 6 decimales + payloadHash.

**Body:** `PriceQuote` (output de `/api/price`)

**Respuesta:**

```json
{
  "feedId": "e62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43",
  "value": 70730.11,
  "valueScaled": "70730110000",
  "confidence": 2.5,
  "timestamp": 1774063917,
  "payloadHash": "53a23c5198d2a522a61da92c0a8c85242ff3287323c592b1d408bc98adf0e63d"
}
```

Nota: `valueScaled` es `string` (serialización de `bigint`).

---

### `POST /api/decide`

Aplica el decision engine al precio normalizado.

**Body:**

```json
{
  "price": { "...NormalizedPrice..." },
  "config": {
    "priceThreshold": 90000,
    "maxAgeSeconds": 60
  }
}
```

`config` es opcional — usa defaults si se omite.

**Respuestas posibles:**

```json
{ "action": "deposit", "reason": "$70,730.11 < threshold $90,000" }
```

```json
{ "action": "unlock", "reason": "$92,000.00 ≥ threshold $90,000" }
```

```json
{ "action": "block", "reason": "Price stale: 95s old (max 60s)" }
```

---

### `POST /api/tx/build-lock`

Construye una Lock TX **sin firmar**. El cliente firma y submite.

**Body:**

```json
{
  "walletAddress": "addr_test1qr7r8y638g9uzna...",
  "utxos": [ { "input": {...}, "output": {...} } ],
  "price": {
    "valueScaled": "70730110000",
    "timestamp": 1774063917,
    "payloadHash": "53a23c..."
  },
  "lockAmount": "5000000"
}
```

| Campo           | Requerido | Descripción                        |
| --------------- | --------- | ---------------------------------- |
| `walletAddress` | sí        | Bech32 address del cliente         |
| `utxos`         | sí        | UTxOs disponibles (Mesh format)    |
| `price`         | sí        | Precio normalizado                 |
| `lockAmount`    | no        | Lovelace a lockear (default: 5 ADA)|

**Respuesta:**

```json
{
  "unsignedTx": "84a400...",
  "scriptAddress": "addr_test1wrkyx8...",
  "datum": {
    "owner": "fc3393513a0bc14f...",
    "price": "70730110000",
    "timestamp": 1774063917,
    "payloadHash": "53a23c..."
  }
}
```

El cliente firma con `wallet.signTx(unsignedTx)` y submite con `wallet.submitTx(signedTx)`.

---

### `POST /api/tx/build-unlock`

Construye una Unlock TX **sin firmar**.

**Body:**

```json
{
  "walletAddress": "addr_test1qr7r8y638g9uzna...",
  "utxos": [ { "input": {...}, "output": {...} } ],
  "collateral": [ { "input": {...}, "output": {...} } ],
  "scriptUtxo": { "input": {...}, "output": {...} },
  "toAddress": "addr_test1qzes0cp9tqgr33x..."
}
```

| Campo           | Requerido | Descripción                                  |
| --------------- | --------- | -------------------------------------------- |
| `walletAddress` | sí        | Bech32 address del cliente                   |
| `utxos`         | sí        | UTxOs disponibles para fees                  |
| `collateral`    | sí        | UTxO(s) de colateral para Plutus             |
| `scriptUtxo`    | sí        | El UTxO del script a gastar                  |
| `toAddress`     | no        | Destinatario (default: walletAddress)        |

**Respuesta:**

```json
{
  "unsignedTx": "84a400...",
  "scriptAddress": "addr_test1wrkyx8...",
  "utxoSpent": "9c15ac0b...#0"
}
```

---

## Errores

Todos los errores retornan HTTP 4xx/5xx con:

```json
{ "error": "mensaje descriptivo" }
```

## Notas de implementación

- **BigInt:** Express no serializa `bigint` nativamente. El servidor tiene un middleware que los convierte a `string` antes de `res.json()`.
- **Stateless:** No hay wallet en el servidor. Las transacciones se construyen con `MeshTxBuilder` y se retornan como CBOR sin firmar.
- **Mesh SDK:** Usa `@meshsdk/core` para construcción de transacciones, `BlockfrostProvider` para queries, y `applyParamsToScript` + `resolvePlutusScriptAddress` para el validator Aiken.
- **Script singleton:** El validator Aiken se carga una vez al arrancar desde `plutus.json` y se reutiliza.
