# Pipeline UI — Guía

Dashboard visual que representa el pipeline como un grafo interactivo y permite ejecutarlo paso a paso o completo.

## Correr

```bash
cd front
npm install
npm run dev
# → http://localhost:3000
```

Requiere el API server corriendo en `:3001` cuando Mock Mode está desactivado. Next.js reescribe `/api/*` a `http://localhost:3001/api/*` vía `next.config.ts`.

## Stack

- **Next.js** (App Router)
- **React 19** + **Zustand** (estado global)
- **@xyflow/react** (grafo interactivo)
- **Lucide React** (iconos)
- **Tailwind CSS v4**

## Estructura del código

```
front/src/
  app/
    page.tsx                    ← entry point (carga PipelineApp con dynamic import, SSR off)
    layout.tsx                  ← fonts + metadata
    globals.css                 ← theme vars, ReactFlow overrides, scrollbar styles
  types/
    index.ts                    ← tipos compartidos (espejo del backend)
    nodes.ts                    ← NodeId, NodeState, layers, colores, NodeConfig
  store/
    usePipelineStore.ts         ← Zustand — todo el estado + actions del pipeline
  lib/
    api.ts                      ← interfaz PipelineApiClient + realApiClient
    mockApi.ts                  ← implementación mock (sin backend)
    constants.ts                ← feed IDs, defaults, explorer URLs
  mock/
    data.ts                     ← helpers para datos de prueba
  graph/
    initialGraph.ts             ← definición de nodos y edges del grafo
  components/
    PipelineApp.tsx             ← layout principal (sidebars, graph, log, modal)
    PipelineGraph.tsx           ← contenedor ReactFlow + edge coloring
    StatusBar.tsx               ← barra de estado global con breadcrumb
    NodeConfigModal.tsx         ← modal de configuración por nodo (doble-clic)
    nodes/
      BaseNode.tsx              ← nodo base reutilizable (header, body, handles, run button)
      PythSourceNode.tsx        ← nodo Pyth Source (naranja, off-chain)
      NormalizeNode.tsx         ← nodo Normalize (azul, off-chain)
      DecisionNode.tsx          ← nodo Decision Engine (azul, off-chain)
      TxBuilderNode.tsx         ← nodo TX Builder (morado, on-chain)
      ExecutionResultNode.tsx   ← nodo Execution Result (cyan, on-chain)
      AikenValidatorNode.tsx    ← nodo Aiken Validator (morado, on-chain)
    panels/
      ControlsPanel.tsx         ← toggles + config inputs
      WalletPanel.tsx           ← wallet address + script address
      InspectorPanel.tsx        ← detalle del nodo seleccionado
      TxViewerPanel.tsx         ← última TX + UTxOs del script
      DatumPanel.tsx            ← datum + redeemer actuales
      ExecutionLog.tsx          ← cronología de eventos
    shared/
      StatusBadge.tsx           ← badge de estado (idle, running, success, error, blocked)
      Toggle.tsx                ← toggle switch
      JsonViewer.tsx            ← JSON colapsable
      CopyButton.tsx            ← botón copiar al clipboard
```

## Modos de operación

### Mock Mode (default: ON)

Toda la ejecución ocurre in-process. No requiere backend ni Cardano. Los datos son realistas (precio BTC/USD variable, delays simulados, hash calculado correctamente).

Útil para:
- Desarrollar y probar la UI
- Demo sin infraestructura
- Presentaciones

### Live Mode (Mock Mode OFF)

Cada paso llama al API server (`/api/*` via Next.js rewrites). Requiere `cd api && npm run dev` corriendo.

Las transacciones se construyen como CBOR sin firmar — el cliente firma con su burner wallet y submite.

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
- Se configura con doble-clic (abre NodeConfigModal)
- Los edges cambian de color según el estado del nodo upstream

### Colores de nodo

| Nodo | Color | Capa |
|---|---|---|
| Pyth Source | Naranja (`--source-primary`) | off-chain |
| Normalize | Azul (`--offchain-primary`) | off-chain |
| Decision Engine | Azul (`--offchain-primary`) | off-chain |
| TX Builder | Morado (`--onchain-primary`) | on-chain |
| Aiken Validator | Morado (`--onchain-primary`) | on-chain |
| Execution Result | Cyan (`--outcome-primary`) | on-chain |

## Paneles

### Inspector (tab derecha)

Muestra el estado de ejecución del nodo seleccionado:
- Status actual
- Input recibido (JSON colapsable)
- Output producido (JSON colapsable)
- Timestamp del último run
- Error si lo hubo

Clic en cualquier nodo del grafo para seleccionarlo.

### TX Viewer (tab derecha)

Muestra la última transacción construida:
- Hash con botón de copy
- Link a CardanoScan (Preview/Preprod/Mainnet según red)
- Diagrama visual del flujo UTxO
- Lista de UTxOs activos en el script address (solo en Live Mode)

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

Cronología de todos los eventos con timestamp, nivel (info/success/error/warn con iconos Lucide) y nodo de origen. Auto-scroll al último evento.

### Controls Panel (izquierda)

| Control | Descripción |
|---|---|
| Reset | Limpia todos los datos y logs |
| Mock Mode | Toggle entre mock y live |
| Dry Run | Toggle entre submit real y dry-run |
| Unlock Mode | Fuerza unlock TX |
| Price threshold | Umbral USD para la decisión |
| Max age | Máximo de segundos de antigüedad del precio |

El botón **Run All** es un FAB (floating action button) circular sobre el grafo. Atajo: `⌘ Enter`.

### Wallet Panel (izquierda, debajo de Controls)

Muestra wallet address, PKH y script address resumidos. Se carga desde `/api/script` al iniciar (en Live Mode) o muestra datos mock.

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
walletInfo: WalletInfo | null

// estado de ejecución por nodo
nodeStates: Record<NodeId, NodeExecutionState>

// node customization
nodeConfigs: Record<NodeId, NodeConfig>
configModalNodeId: NodeId | null

// config
config: {
  dryRun: boolean
  mockMode: boolean
  unlockMode: boolean
  decisionConfig: { priceThreshold, maxAgeSeconds }
}

// actions
fetchPrice()        → pyth-source node
normalizePrice()    → normalize node
decide()            → decision node
buildTx()           → tx-builder + execution-result nodes
fetchWalletInfo()   → wallet panel
runAll()            → ejecuta todo en secuencia
reset()             → limpia estado
```

El store selecciona automáticamente entre `mockApiClient` y `realApiClient` según `config.mockMode`.

## Agregar un nodo nuevo

1. Crear `src/components/nodes/MiNodoNuevo.tsx` usando `BaseNode` como wrapper
2. Registrarlo en `PipelineGraph.tsx`:
   ```typescript
   const nodeTypes = {
     ...
     miNodo: MiNodoNuevo,
   };
   ```
3. Agregarlo a `graph/initialGraph.ts` con posición y edges
4. Agregar el `NodeId` en `types/nodes.ts` → `NodeId`, `NODE_IDS`, `NODE_LABELS`, `NODE_LAYER`
5. Implementar la action correspondiente en el store

## Conectar al backend real

1. Correr `cd api && npm run dev`
2. En la UI, desactivar **Mock Mode**
3. El store cambia automáticamente a `realApiClient` que llama a `/api/*`
4. Next.js rewrites (`next.config.ts`) redirige `/api` a `http://localhost:3001`

## Keyboard shortcuts

| Atajo | Acción |
|---|---|
| `⌘ Enter` / `Ctrl Enter` | Run All |
| `Escape` | Cerrar modal o deseleccionar nodo |
| Doble-clic en nodo | Abrir NodeConfigModal |
