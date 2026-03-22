# Pipeline UI — Guía

Dashboard visual que representa el pipeline como un grafo interactivo y permite ejecutarlo paso a paso o completo.

## Correr

```bash
cd pipeline-ui
npm install
npm run dev
# → http://localhost:5173
```

Requiere el API server corriendo en `:3001` cuando Mock Mode está desactivado.

## Estructura del código

```
pipeline-ui/src/
  types/index.ts              ← tipos compartidos (espejo de los del backend)
  store/usePipelineStore.ts   ← Zustand — todo el estado + actions
  lib/
    api.ts                    ← interfaz PipelineApiClient + realApiClient
    mockApi.ts                ← implementación mock (sin backend)
  mock/data.ts                ← helpers para datos de prueba
  graph/initialGraph.ts       ← definición de nodos y edges del grafo
  components/
    nodes/                    ← 6 nodos custom de ReactFlow
    panels/                   ← 5 paneles laterales
    PipelineGraph.tsx          ← contenedor ReactFlow
    StatusBar.tsx              ← barra de estado global
  App.tsx                     ← layout principal
```

## Modos de operación

### Mock Mode (default: ON)

Toda la ejecución ocurre in-process. No requiere backend ni Cardano. Los datos son realistas (precio BTC/USD variable, delays simulados, hash calculado correctamente).

Útil para:
- Desarrollar y probar la UI
- Demo sin infraestructura
- Presentaciones

### Live Mode (Mock Mode OFF)

Cada paso llama al API server (`/api/*` via proxy Vite). Requiere `npm run server` corriendo en `test/`.

Las transacciones son reales en Preview testnet.

### Dry Run (default: ON)

Las TXs se construyen pero no se submiten a la red. El hash retornado es `(dry-run)`.

### Unlock Mode

Fuerza que el TX Builder construya una Unlock TX independientemente de lo que diga el Decision Engine. Útil para liberar fondos cuando el precio no supera el threshold.

## El grafo

```
[Pyth Source] → [Normalize] → [Decision] → [TX Builder] → [Execution Result]
                                                ↑
                                       [Aiken Validator]
```

Cada nodo:
- Tiene un badge de estado: `idle | running | success | error | blocked`
- Se puede ejecutar individualmente (botón propio)
- Muestra input/output en el Inspector al hacer clic
- Los edges se vuelven verdes cuando el upstream confirma

## Paneles

### Inspector (tab derecha)

Muestra el estado de ejecución del nodo seleccionado:
- Status actual
- Input recibido (JSON)
- Output producido (JSON)
- Timestamp del último run
- Error si lo hubo

Clic en cualquier nodo del grafo para seleccionarlo.

### TX Viewer (tab derecha)

Muestra la última transacción construida:
- Hash con botón de copy
- Link a CardanoScan (Preview/Preprod/Mainnet según red)
- Diagrama visual del flujo UTxO (wallet → script para lock, script → recipient para unlock)
- Lista de UTxOs activos en el script address (solo en Live Mode)
  - Muestra datum decoded
  - Badge "OURS" para los que pertenecen a la wallet del server

### Datum Panel (debajo del Inspector)

Muestra el datum y redeemer actuales en formato legible:

```
DATUM
  owner      fc3393513a0bc14f…
  price      70730110000
  timestamp  1774063917
  payloadHash  53a23c51…

REDEEMER
  action  unlock
```

### Execution Log (parte inferior)

Cronología de todos los eventos con timestamp, nivel (info/success/error/warn) y nodo de origen. Auto-scroll al último evento.

### Controls Panel (izquierda)

| Control | Descripción |
|---|---|
| Run All | Ejecuta todo el pipeline en orden |
| Reset | Limpia todos los datos y logs |
| Mock Mode | Toggle entre mock y live |
| Dry Run | Toggle entre submit real y dry-run |
| Unlock Mode | Fuerza unlock TX |
| Price threshold | Umbral USD para la decisión |

### Wallet Panel (izquierda, debajo de Controls)

Muestra wallet address, PKH y script address resumidos. Se carga desde `/api/wallet` al iniciar.

## Store (Zustand)

Estado global en `usePipelineStore`:

```typescript
// datos del pipeline
rawPrice: PriceQuote | null
normalizedPrice: NormalizedPrice | null
decision: ActionDecision | null
datum: ScriptDatum | null
redeemer: ScriptRedeemer | null
txBuild: TxBuildResult | null

// estado de ejecución por nodo
nodeStates: Record<nodeId, NodeExecutionState>

// config
dryRun: boolean
mockMode: boolean
unlockMode: boolean
decisionConfig: { priceThreshold, maxAgeSeconds }

// actions
fetchPrice()
normalizePrice()
decide()
buildLockTx()
buildUnlockTx()
runAll()
reset()
```

## Agregar un nodo nuevo

1. Crear `src/components/nodes/MiNodoNuevo.tsx` (copiar estructura de un nodo existente)
2. Registrarlo en `PipelineGraph.tsx`:
   ```typescript
   const nodeTypes = {
     ...
     miNodo: MiNodoNuevo,
   }
   ```
3. Agregarlo a `graph/initialGraph.ts` con posición y edges
4. Agregar el `nodeId` en `store/usePipelineStore.ts → NODE_IDS`
5. Implementar la action correspondiente en el store

## Conectar al backend real

1. Correr `cd test && npm run server`
2. En la UI, desactivar **Mock Mode**
3. El store cambia automáticamente a `realApiClient` que llama a `/api/*`
4. El proxy Vite (`vite.config.ts`) redirige `/api` a `http://localhost:3001`
