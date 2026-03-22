import { create } from "zustand";
import type {
  PriceUpdate,
  ActionDecision,
  OracleDatum,
  TxBuildResult,
  WalletInfo,
  DecisionConfig,
  ServiceStatus,
} from "@/types";
import type {
  NodeId,
  NodeExecutionState,
  LogEntry,
  LogLevel,
  NodeConfig,
} from "@/types/nodes";
import { NODE_IDS } from "@/types/nodes";
import { realApiClient } from "@/lib/api";
import { mockApiClient } from "@/lib/mockApi";
import { buildDatumFromConfig } from "@/lib/price";
import { getMnemonic, regenerateMnemonic, createBurnerWallet } from "@/lib/burnerWallet";
import {
  DEFAULT_MIN_PRICE_USD_CENTS,
  DEFAULT_MAX_PRICE_USD_CENTS,
  DEFAULT_MAX_AGE_SECONDS,
} from "@/lib/constants";

function makeInitialNodeStates(): Record<NodeId, NodeExecutionState> {
  const states = {} as Record<NodeId, NodeExecutionState>;
  for (const id of NODE_IDS) {
    states[id] = { state: "idle", lastRun: null, error: null, input: null, output: null };
  }
  return states;
}

function makeInitialNodeConfigs(): Record<NodeId, NodeConfig> {
  const configs = {} as Record<NodeId, NodeConfig>;
  for (const id of NODE_IDS) {
    configs[id] = {};
  }
  return configs;
}

let logCounter = 0;

interface PipelineState {
  // Pipeline data
  price: PriceUpdate | null;
  decision: ActionDecision | null;
  datum: OracleDatum | null;
  txBuild: TxBuildResult | null;
  walletInfo: WalletInfo | null;
  burnerAddress: string | null;
  serviceStatus: ServiceStatus | null;

  // Lock confirmation tracking
  lockTxHash: string | null;
  lockConfirmed: boolean;
  lockConfirming: boolean;

  // Execution state
  nodeStates: Record<NodeId, NodeExecutionState>;
  logs: LogEntry[];
  selectedNodeId: NodeId | null;

  // Node customization
  nodeConfigs: Record<NodeId, NodeConfig>;
  configModalNodeId: NodeId | null;

  // Config
  config: {
    dryRun: boolean;
    mockMode: boolean;
    spendMode: boolean;
    decisionConfig: DecisionConfig;
  };

  // Helpers
  setNodeState: (id: NodeId, patch: Partial<NodeExecutionState>) => void;
  addLog: (level: LogLevel, message: string, nodeId?: NodeId) => void;
  selectNode: (id: NodeId | null) => void;
  setConfig: (patch: Partial<PipelineState["config"]>) => void;
  setDecisionConfig: (patch: Partial<DecisionConfig>) => void;
  updateNodeConfig: (id: NodeId, patch: Partial<NodeConfig>) => void;
  openConfigModal: (id: NodeId) => void;
  closeConfigModal: () => void;

  // Actions
  fetchPrice: () => Promise<void>;
  decide: () => Promise<void>;
  buildTx: () => Promise<void>;
  initBurnerWallet: () => Promise<void>;
  regenerateWallet: () => Promise<void>;
  fetchWalletInfo: () => Promise<void>;
  fetchServiceStatus: () => Promise<void>;
  pollLockConfirmation: (txHash: string) => Promise<void>;
  runAll: () => Promise<void>;
  reset: () => void;
}

export const usePipelineStore = create<PipelineState>((set, get) => {
  const getApi = () => (get().config.mockMode ? mockApiClient : realApiClient);

  return {
    // Initial state
    price: null,
    decision: null,
    datum: null,
    txBuild: null,
    walletInfo: null,
    burnerAddress: null,
    serviceStatus: null,
    lockTxHash: null,
    lockConfirmed: false,
    lockConfirming: false,
    nodeStates: makeInitialNodeStates(),
    nodeConfigs: makeInitialNodeConfigs(),
    configModalNodeId: null,
    logs: [],
    selectedNodeId: null,
    config: {
      dryRun: false,
      mockMode: false,
      spendMode: false,
      decisionConfig: {
        datumKind: "MinPrice",
        minPriceUsdCents: DEFAULT_MIN_PRICE_USD_CENTS,
        maxPriceUsdCents: DEFAULT_MAX_PRICE_USD_CENTS,
        maxAgeSeconds: DEFAULT_MAX_AGE_SECONDS,
      },
    },

    // Helpers
    setNodeState: (id, patch) =>
      set((s) => ({
        nodeStates: {
          ...s.nodeStates,
          [id]: { ...s.nodeStates[id], ...patch },
        },
      })),

    addLog: (level, message, nodeId) =>
      set((s) => ({
        logs: [
          ...s.logs,
          {
            id: String(++logCounter),
            timestamp: Date.now(),
            level,
            message,
            nodeId,
          },
        ],
      })),

    selectNode: (id) => set({ selectedNodeId: id }),

    setConfig: (patch) =>
      set((s) => ({ config: { ...s.config, ...patch } })),

    setDecisionConfig: (patch) =>
      set((s) => ({
        config: {
          ...s.config,
          decisionConfig: { ...s.config.decisionConfig, ...patch },
        },
      })),

    updateNodeConfig: (id, patch) =>
      set((s) => ({
        nodeConfigs: {
          ...s.nodeConfigs,
          [id]: { ...s.nodeConfigs[id], ...patch },
        },
      })),

    openConfigModal: (id) => set({ configModalNodeId: id }),
    closeConfigModal: () => set({ configModalNodeId: null }),

    // Actions
    fetchPrice: async () => {
      const { setNodeState, addLog } = get();
      const api = getApi();

      setNodeState("pyth-source", { state: "running", input: null, error: null });
      addLog("info", "Fetching ADA/USD price from Pyth Lazer…", "pyth-source");

      try {
        const price = await api.getPrice();
        const usd = (Number(price.priceUsdCents) / 100).toFixed(4);
        set({ price });
        setNodeState("pyth-source", {
          state: "success",
          output: price,
          lastRun: Date.now(),
        });
        addLog("success", `ADA/USD = $${usd}`, "pyth-source");
      } catch (err) {
        setNodeState("pyth-source", {
          state: "error",
          error: String(err),
          lastRun: Date.now(),
        });
        addLog("error", `Fetch failed: ${err}`, "pyth-source");
      }
    },

    decide: async () => {
      const { price, config, setNodeState, addLog } = get();
      const api = getApi();

      if (!price) {
        addLog("warn", "No price available for decision", "decision");
        return;
      }

      setNodeState("normalize", {
        state: "success",
        input: price,
        output: price,
        lastRun: Date.now(),
      });

      const datumForDecision = buildDatumFromConfig(config.decisionConfig);

      setNodeState("decision", {
        state: "running",
        input: { price, datum: datumForDecision },
        error: null,
      });
      addLog("info", "Running decision engine…", "decision");

      try {
        const decision = await api.decide(price, config.decisionConfig);
        set({ decision, datum: datumForDecision });
        setNodeState("decision", {
          state: "success",
          output: decision,
          lastRun: Date.now(),
        });

        const level = decision.action === "block" ? "warn" : "success";
        addLog(
          level,
          `Decision: ${decision.action.toUpperCase()} — ${decision.reason}`,
          "decision",
        );
      } catch (err) {
        setNodeState("decision", {
          state: "error",
          error: String(err),
          lastRun: Date.now(),
        });
        addLog("error", `Decision failed: ${err}`, "decision");
      }
    },

    buildTx: async () => {
      const { decision, datum, config, setNodeState, addLog } = get();
      const api = getApi();

      const shouldSpend = config.spendMode;
      const kind = shouldSpend ? "spend" : "lock";

      const txDatum = datum ?? buildDatumFromConfig(config.decisionConfig);

      setNodeState("tx-builder", {
        state: "running",
        input: { kind, dryRun: config.dryRun, datum: txDatum },
        error: null,
      });
      if (shouldSpend) {
        setNodeState("aiken-validator", { state: "running", error: null });
      }
      addLog(
        "info",
        `Building ${kind} TX${config.dryRun ? " (dry-run)" : ""}…`,
        "tx-builder",
      );

      try {
        const mnemonic = getMnemonic();
        let result: TxBuildResult;
        if (shouldSpend) {
          result = await api.buildSpendTx(txDatum, config.dryRun, mnemonic, config.decisionConfig.maxAgeSeconds);
        } else {
          result = await api.buildLockTx(txDatum, config.dryRun, mnemonic);
        }

        set({ txBuild: result, datum: result.datum });
        setNodeState("tx-builder", {
          state: "success",
          output: result,
          lastRun: Date.now(),
        });
        setNodeState("execution-result", {
          state: "success",
          input: result,
          output: { txHash: result.txHash, status: result.status },
          lastRun: Date.now(),
        });
        if (shouldSpend) {
          setNodeState("aiken-validator", {
            state: "success",
            output: { script: "price_validator.spend", verified: true },
            lastRun: Date.now(),
          });
        }
        addLog(
          "success",
          `${kind.charAt(0).toUpperCase() + kind.slice(1)} TX built (${result.status}): ${result.txHash}`,
          "tx-builder",
        );

        if (!shouldSpend && result.status === "submitted") {
          get().pollLockConfirmation(result.txHash);
        }
      } catch (err) {
        setNodeState("tx-builder", {
          state: "error",
          error: String(err),
          lastRun: Date.now(),
        });
        if (shouldSpend) {
          setNodeState("aiken-validator", {
            state: "error",
            error: String(err),
            lastRun: Date.now(),
          });
        }
        addLog("error", `TX build failed: ${err}`, "tx-builder");
      }
    },

    initBurnerWallet: async () => {
      try {
        const wallet = await createBurnerWallet();
        const address = await wallet.getChangeAddress();
        set({ burnerAddress: address });
      } catch (err) {
        console.error("Failed to init burner wallet:", err);
      }
    },

    regenerateWallet: async () => {
      regenerateMnemonic();
      const wallet = await createBurnerWallet();
      const address = await wallet.getChangeAddress();
      set({ burnerAddress: address, walletInfo: null });
    },

    fetchWalletInfo: async () => {
      const api = getApi();
      const { burnerAddress } = get();
      if (!burnerAddress) return;

      try {
        const info = await api.getWalletBalance(burnerAddress);
        set({
          walletInfo: {
            address: burnerAddress,
            pkh: "",
            scriptAddress: info.scriptAddress,
            network: info.network,
            balanceLovelace: info.balanceLovelace,
            configured: info.configured,
          },
        });
      } catch {
        // silently fail
      }
    },

    fetchServiceStatus: async () => {
      const api = getApi();
      try {
        const status = await api.getStatus();
        set({ serviceStatus: status });
      } catch {
        // silently fail
      }
    },

    pollLockConfirmation: async (txHash: string) => {
      const { addLog } = get();
      set({ lockTxHash: txHash, lockConfirmed: false, lockConfirming: true });
      addLog("info", "Waiting for lock TX to confirm on-chain…", "tx-builder");

      for (let attempt = 0; attempt < 30; attempt++) {
        await new Promise((r) => setTimeout(r, 5_000));
        try {
          const res = await fetch("/api/tx/confirm", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ txHash }),
          });
          const data = await res.json();
          if (data.confirmed) {
            set({ lockConfirmed: true, lockConfirming: false });
            addLog("success", `Lock TX confirmed in block ${data.block}`, "tx-builder");
            return;
          }
        } catch {
          // retry
        }
      }
      set({ lockConfirming: false });
      addLog("warn", "Lock TX confirmation timed out — check explorer", "tx-builder");
    },

    runAll: async () => {
      const { fetchPrice, decide, buildTx, addLog } = get();
      const { spendMode } = get().config;

      if (spendMode && get().lockTxHash && !get().lockConfirmed) {
        addLog("warn", "Lock TX not yet confirmed — wait before spending", "tx-builder");
        return;
      }

      addLog("info", "Running full pipeline…");

      await fetchPrice();
      if (get().nodeStates["pyth-source"].state === "error") return;

      await decide();
      const decision = get().decision;
      if (get().nodeStates["decision"].state === "error") return;

      if (decision?.action === "block" && spendMode) {
        get().setNodeState("tx-builder", {
          state: "blocked",
          input: null,
          output: null,
          error: decision.reason,
          lastRun: Date.now(),
        });
        addLog("warn", `Pipeline stopped: ${decision.reason}`, "tx-builder");
        return;
      }

      await buildTx();
    },

    reset: () => {
      logCounter = 0;
      set({
        price: null,
        decision: null,
        datum: null,
        txBuild: null,
        lockTxHash: null,
        lockConfirmed: false,
        lockConfirming: false,
        nodeStates: makeInitialNodeStates(),
        logs: [],
        selectedNodeId: null,
      });
    },
  };
});
