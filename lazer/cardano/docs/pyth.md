# Pyth — Integración de precios

## ¿Qué es Pyth?

Pyth Network es un oráculo de precios que agrega datos de market makers institucionales y los publica on-chain en múltiples blockchains. Para Cardano se usa a través de Wormhole.

Para obtener precios sin autenticación se usa **Hermes**, el endpoint HTTP público de Pyth.

## Hermes — endpoint HTTP

Base URL: `https://hermes.pyth.network`

### Obtener el precio más reciente

```
GET /v2/updates/price/latest?ids[]=<feedId>
```

**Ejemplo:**
```bash
curl "https://hermes.pyth.network/v2/updates/price/latest?ids[]=e62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43"
```

**Respuesta:**
```json
{
  "parsed": [{
    "id": "e62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43",
    "price": {
      "price": "7073011000",
      "conf": "250000",
      "expo": -5,
      "publish_time": 1774063917
    },
    "ema_price": { "..." }
  }],
  "binary": {
    "encoding": "base64",
    "data": ["..."]
  }
}
```

## Formato del precio

Pyth usa una representación de precio fijo-punto:

```
precio_real = price × 10^expo
```

**Ejemplo BTC/USD:**
```
price = "7073011000"
expo  = -5
valor = 7073011000 × 10^(-5) = $70,730.11
```

El campo `conf` es el intervalo de confianza (mismo formato y expo).

## Feed IDs

Los feed IDs son únicos por asset y son los mismos en todas las redes:

| Asset | Feed ID |
|---|---|
| BTC/USD | `e62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43` |
| ETH/USD | `ff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace` |
| ADA/USD | `2a01deaec9e51a579277b34b122399984d0bbf57e2458a7e42fecd2829867a0d` |

Referencia completa: [pyth.network/price-feeds](https://pyth.network/price-feeds)

## Payload hash

El campo `binary.data[0]` contiene el VAA (Verified Action Approval) firmado por los guardianes de Wormhole. Para la versión actual del sistema se usa el hash SHA-256 del JSON completo de la respuesta como referencia:

```typescript
// api/src/providers/pythHermes.ts
rawPayload: JSON.stringify(data)  // JSON completo de la respuesta

// api/src/services/normalizePrice.ts
const payloadHash = createHash("sha256").update(quote.rawPayload).digest("hex");
```

**Diseño futuro (Pyth Pro):** el `payload_hash` en el datum puede contener el hash del VAA binario firmado, habilitando verificación criptográfica on-chain mediante Wormhole guardian signatures. Para migrar solo se necesita:
1. Crear un nuevo provider que use la API autenticada
2. Setear `rawPayload = vaa_binary_hex`
3. El resto del sistema no cambia

## Implementación en el proyecto

```
api/src/providers/
  pythHermes.ts     ← implementación HTTP pública (getPrice)
```

La función `getPrice(feedId)` retorna un `PriceQuote` normalizado. Para reemplazar Hermes por Pyth Pro (autenticado, WS, VAA verificado) basta con crear un nuevo provider que exporte la misma firma.

## Normalización del precio

El pipeline normaliza el precio a dos representaciones:

| Campo | Tipo | Descripción |
|---|---|---|
| `value` | `number` | Float human-readable (`70730.11`) |
| `valueScaled` | `string` | Entero con 6 decimales para on-chain (`"70730110000"`) |

**Fórmula:**
```
effectiveExp = SCALE(6) + expo
valueScaled  = rawPrice × 10^effectiveExp   (si effectiveExp ≥ 0)
             = rawPrice / 10^(-effectiveExp) (si effectiveExp < 0)
```

**Ejemplo con expo = -5:**
```
effectiveExp = 6 + (-5) = 1
valueScaled  = 7073011000 × 10^1 = 70730110000
```

## Staleness check

El `publish_time` es un unix timestamp en segundos. El decision engine rechaza precios con más de `maxAgeSeconds` (default: 60s):

```typescript
const age = Math.floor(Date.now() / 1000) - price.timestamp;
if (age > config.maxAgeSeconds) {
  return { action: "block", reason: `Stale: ${age}s` };
}
```
