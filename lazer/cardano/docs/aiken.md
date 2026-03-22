# Aiken — Contrato on-chain

## ¿Qué es Aiken?

Aiken es un lenguaje de programación para contratos inteligentes en Cardano. Compila a Plutus Core (UPLC) que corre en el ledger. La versión actual del sistema usa PlutusV3.

Repositorio: [aiken-lang/aiken](https://github.com/aiken-lang/aiken)

## Instalación

```bash
# macOS / Linux
curl -sSfL https://install.aiken-lang.org | bash

# verificar
aiken --version
# aiken v1.1.21+...
```

## Estructura del proyecto Aiken

```
aiken/
  aiken.toml                    ← configuración del proyecto
  validators/
    pythathon.ak                ← el validator
  build/                        ← cache de compilación (gitignore)
  plutus.json                   ← output compilado (generado por aiken build)
```

## El validator — `pythathon.ak`

### Tipos

```aiken
// Datum almacenado en el UTxO del script
pub type Datum {
  owner: ByteArray,        // Payment Key Hash del dueño (28 bytes)
  price: Int,              // Precio escalado a 6 decimales
  timestamp: Int,          // Unix timestamp del precio de Pyth
  payload_hash: ByteArray, // SHA-256 del payload de Hermes
}

// Redeemer para gastar el UTxO
pub type Redeemer {
  Unlock   // único constructor — índice 0 en CBOR
}
```

### Lógica de validación

```aiken
validator pythathon_lock {
  spend(datum, redeemer, _output_reference, self) -> Bool {
    expect Some(d) = datum          // datum debe estar presente
    expect Unlock = redeemer        // solo se acepta Unlock

    // El owner debe firmar la transacción
    list.has(self.extra_signatories, d.owner)

    // TODO: validar freshness del timestamp
    // TODO: validar payload_hash con firma Wormhole (Pyth Pro)
  }

  else(_ctx) { fail }  // cualquier otro purpose falla
}
```

**Reglas actuales:**
1. Redeemer = `Unlock` (constructor índice 0, sin campos)
2. `datum.owner` ∈ `tx.extra_signatories` — el owner debe ser required signer

**Reglas futuras (comentadas en el código):**
- Freshness: `timestamp` no mayor a N segundos (requiere validity interval)
- Verificación criptográfica del `payload_hash` contra firma de guardianes Wormhole

### Compilar

```bash
cd aiken
aiken build
```

Genera `aiken/plutus.json`. El validator tiene título `pythathon.pythathon_lock.spend`.

```bash
# verificar tests (si los hubiera)
aiken check
```

### Estructura de `plutus.json`

```json
{
  "validators": [{
    "title": "pythathon.pythathon_lock.spend",
    "compiledCode": "5901...",
    "hash": "ec431d86..."
  }]
}
```

## Encoding del Datum con Mesh

El datum se codifica como Plutus Data usando el formato de Mesh SDK:

```typescript
import type { Data } from "@meshsdk/core";

// Aiken Datum { owner, price, timestamp, payload_hash }
// → Constr(0, [ByteArray, Int, Int, ByteArray])
const datum: Data = {
  alternative: 0,
  fields: [
    datum.owner,              // hex string → ByteArray
    Number(datum.price),      // number → Int
    datum.timestamp,          // number → Int
    datum.payloadHash,        // hex string → ByteArray
  ],
};
```

El campo `alternative` corresponde al índice del constructor en Aiken. Para un tipo con un solo constructor, siempre es `0`.

## Encoding del Redeemer con Mesh

```typescript
import type { Data } from "@meshsdk/core";

// Aiken Redeemer.Unlock = constructor índice 0, sin campos
const redeemer: Data = {
  alternative: 0,
  fields: [],
};
```

## Script address

La address del script se deriva del validator compilado usando Mesh:

```typescript
import {
  applyParamsToScript,
  resolvePlutusScriptAddress,
  type PlutusScript,
} from "@meshsdk/core";
import blueprint from "../aiken/plutus.json";

const scriptCbor = applyParamsToScript(
  blueprint.validators[0].compiledCode,
  [],
);

const script: PlutusScript = {
  code: scriptCbor,
  version: "V3",
};

// 0 = testnet, 1 = mainnet
const address = resolvePlutusScriptAddress(script, 0);
// addr_test1wrkyx8vxy7pf6l3pzxgkrkgfaz56zhty3fnml7pvet7r2uqa5mlr9
```

La misma dirección sirve para cualquier wallet que quiera lockear fondos. El datum identifica quién puede desbloquear.

## Flujo completo Lock → Unlock

```
LOCK
  Wallet → 5 ADA → Script address
  Datum inline: { owner: pkh, price, timestamp, payloadHash }

  Cardano evalúa: ningún script, solo UTxO creation

UNLOCK
  Wallet gasta el UTxO del script
  Redeemer: Unlock
  Required signer: pkh

  Cardano evalúa pythathon_lock.spend:
    ✓ datum.owner === extra_signatories[0]
    ✓ redeemer === Unlock
  → UTxO liberado, fondos a destinatario
```

### Lock TX con Mesh

```typescript
import { MeshTxBuilder, resolvePaymentKeyHash } from "@meshsdk/core";

const ownerPkh = resolvePaymentKeyHash(walletAddress);

const datum: Data = {
  alternative: 0,
  fields: [ownerPkh, priceScaled, timestamp, payloadHash],
};

const unsignedTx = await new MeshTxBuilder({ fetcher: provider })
  .txOut(scriptAddress, [{ unit: "lovelace", quantity: "5000000" }])
  .txOutInlineDatumValue(datum)
  .changeAddress(walletAddress)
  .selectUtxosFrom(utxos)
  .complete();

const signedTx = await wallet.signTx(unsignedTx);
const txHash = await wallet.submitTx(signedTx);
```

### Unlock TX con Mesh

```typescript
const redeemer: Data = { alternative: 0, fields: [] };

const unsignedTx = await new MeshTxBuilder({ fetcher: provider })
  .spendingPlutusScriptV3()
  .txIn(scriptUtxo.input.txHash, scriptUtxo.input.outputIndex)
  .txInInlineDatumPresent()
  .txInRedeemerValue(redeemer)
  .txInScript(script.code)
  .txOut(walletAddress, scriptUtxo.output.amount)
  .requiredSignerHash(ownerPkh)
  .txInCollateral(
    collateral[0].input.txHash,
    collateral[0].input.outputIndex,
    collateral[0].output.amount,
    collateral[0].output.address,
  )
  .changeAddress(walletAddress)
  .selectUtxosFrom(utxos)
  .complete();

const signedTx = await wallet.signTx(unsignedTx, true);
const txHash = await wallet.submitTx(signedTx);
```

## Extender el contrato

Para agregar validación del `payload_hash`:

```aiken
// futuro: verificar firma de guardián Wormhole
validator pythathon_lock_v2 {
  spend(datum, redeemer, _ref, self) -> Bool {
    expect Some(d) = datum
    expect Unlock = redeemer

    let signed_by_owner = list.has(self.extra_signatories, d.owner)

    // validar que el hash corresponde a un VAA firmado
    let valid_payload = verify_wormhole_vaa(d.payload_hash, guardian_set)

    // validar freshness
    let max_age = 3600  // 1 hora
    let is_fresh = get_tx_lower_bound(self) - d.timestamp <= max_age

    signed_by_owner && valid_payload && is_fresh
  }
  else(_) { fail }
}
```

Los tipos en TypeScript (`ScriptDatum`, `ScriptRedeemer`) no cambian — solo el campo `payloadHash` recibe distinto input.
