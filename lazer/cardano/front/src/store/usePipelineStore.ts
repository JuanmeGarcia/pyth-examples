import { create } from "zustand";
import type {
  PriceQuote,
  NormalizedPrice,
  ActionDecision,
  ScriptDatum,
  ScriptRedeemer,
  TxBuildResult,
  WalletInfo,
  DecisionConfig,
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
import { BTC_USD_FEED_ID, DEFAULT_PRICE_THRESHOLD, DEFAULT_MAX_AGE_SECONDS } from "@/lib/constants";

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
  rawPrice: PriceQuote | null;
  normalizedPrice: NormalizedPrice | null;
  decision: ActionDecision | null;
  datum: ScriptDatum | null;
  redeemer: ScriptRedeemer | null;
  txBuild: TxBuildResult | null;
  walletInfo: WalletInfo | null;

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
    unlockMode: boolean;
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
  normalizePrice: () => Promise<void>;
  decide: () => Promise<void>;
  buildTx: () => Promise<void>;
  fetchWalletInfo: () => Promise<void>;
  runAll: () => Promise<void>;
  reset: () => void;
}

export const usePipelineStore = create<PipelineState>((set, get) => {
  const getApi = () => (get().config.mockMode ? mockApiClient : realApiClient);

  return {
    // Initial state
    rawPrice: null,
    normalizedPrice: null,
    decision: null,
    datum: null,
    redeemer: null,
    txBuild: null,
    walletInfo: null,
    nodeStates: makeInitialNodeStates(),
    nodeConfigs: makeInitialNodeConfigs(),
    configModalNodeId: null,
    logs: [],
    selectedNodeId: null,
    config: {
      dryRun: true,
      mockMode: true,
      unlockMode: false,
      decisionConfig: {
        priceThreshold: DEFAULT_PRICE_THRESHOLD,
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
      const { setNodeState, addLog, nodeConfigs } = get();
      const api = getApi();
      const feedId = nodeConfigs["pyth-source"]?.feedId || BTC_USD_FEED_ID;
      const input = { feedId };

      setNodeState("pyth-source", { state: "running", input, error: null });
      addLog("info", "Fetching price from Pyth…", "pyth-source");

      try {
        const quote = await api.getPrice(feedId);
        const priceReal = parseInt(quote.price, 10) * Math.pow(10, quote.expo);
        set({ rawPrice: quote });
        setNodeState("pyth-source", {
          state: "success",
          output: quote,
          lastRun: Date.now(),
        });
        addLog(
          "success",
          `Price fetched: $${priceReal.toLocaleString(undefined, { maximumFractionDigits: 2 })}`,
          "pyth-source"
        );
      } catch (err) {
        setNodeState("pyth-source", {
          state: "error",
          error: String(err),
          lastRun: Date.now(),
        });
        addLog("error", `Fetch failed: ${err}`, "pyth-source");
      }
    },

    normalizePrice: async () => {
      const { rawPrice, setNodeState, addLog } = get();
      const api = getApi();

      if (!rawPrice) {
        addLog("warn", "No raw price to normalize", "normalize");
        return;
      }

      setNodeState("normalize", { state: "running", input: rawPrice, error: null });
      addLog("info", "Normalizing price…", "normalize");

      try {
        const normalized = await api.normalize(rawPrice);
        set({ normalizedPrice: normalized });
        setNodeState("normalize", {
          state: "success",
          output: normalized,
          lastRun: Date.now(),
        });
        addLog(
          "success",
          `Normalized: valueScaled=${normalized.valueScaled}`,
          "normalize"
        );
      } catch (err) {
        setNodeState("normalize", {
          state: "error",
          error: String(err),
          lastRun: Date.now(),
        });
        addLog("error", `Normalize failed: ${err}`, "normalize");
      }
    },

    decide: async () => {
      const { normalizedPrice, config, nodeConfigs, setNodeState, addLog } = get();
      const api = getApi();

      if (!normalizedPrice) {
        addLog("warn", "No normalized price for decision", "decision");
        return;
      }

      const decisionCfg: DecisionConfig = {
        priceThreshold: nodeConfigs.decision?.priceThreshold ?? config.decisionConfig.priceThreshold,
        maxAgeSeconds: nodeConfigs.decision?.maxAgeSeconds ?? config.decisionConfig.maxAgeSeconds,
      };

      setNodeState("decision", {
        state: "running",
        input: { price: normalizedPrice, config: decisionCfg },
        error: null,
      });
      addLog("info", "Running decision engine…", "decision");

      try {
        const decision = await api.decide(normalizedPrice, decisionCfg);
        set({ decision });
        setNodeState("decision", {
          state: "success",
          output: decision,
          lastRun: Date.now(),
        });

        const level = decision.action === "block" ? "warn" : "success";
        addLog(
          level,
          `Decision: ${decision.action.toUpperCase()} — ${decision.reason}`,
          "decision"
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
      const { normalizedPrice, decision, config, setNodeState, addLog } = get();
      const api = getApi();

      const shouldUnlock =
        config.unlockMode || (decision && decision.action === "unlock");
      const kind = shouldUnlock ? "unlock" : "lock";

      setNodeState("tx-builder", {
        state: "running",
        input: { kind, dryRun: config.dryRun },
        error: null,
      });
      addLog(
        "info",
        `Building ${kind} TX${config.dryRun ? " (dry-run)" : ""}…`,
        "tx-builder"
      );

      try {
        let result: TxBuildResult;
        if (shouldUnlock) {
          result = await api.buildUnlockTx(config.dryRun);
        } else {
          if (!normalizedPrice) {
            throw new Error("No normalized price for lock TX");
          }
          result = await api.buildLockTx(normalizedPrice, config.dryRun);
        }

        const datum = result.datum;
        const redeemer: ScriptRedeemer | null = shouldUnlock
          ? { action: "unlock" }
          : null;

        set({ txBuild: result, datum, redeemer });
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
        addLog(
          "success",
          `${kind.charAt(0).toUpperCase() + kind.slice(1)} TX built (${result.status}): ${result.txHash}`,
          "tx-builder"
        );
      } catch (err) {
        setNodeState("tx-builder", {
          state: "error",
          error: String(err),
          lastRun: Date.now(),
        });
        addLog("error", `TX build failed: ${err}`, "tx-builder");
      }
    },

    fetchWalletInfo: async () => {
      const api = getApi();
      try {
        const wallet = await api.getWallet();
        set({ walletInfo: wallet });
      } catch {
        // silently fail — wallet panel will show placeholder
      }
    },

    runAll: async () => {
      const { fetchPrice, normalizePrice, decide, buildTx, addLog } = get();

      addLog("info", "Running full pipeline…");

      await fetchPrice();
      if (get().nodeStates["pyth-source"].state === "error") return;

      await normalizePrice();
      if (get().nodeStates["normalize"].state === "error") return;

      await decide();
      const decision = get().decision;
      if (get().nodeStates["decision"].state === "error") return;

      if (decision?.action === "block" && !get().config.unlockMode) {
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
        rawPrice: null,
        normalizedPrice: null,
        decision: null,
        datum: null,
        redeemer: null,
        txBuild: null,
        nodeStates: makeInitialNodeStates(),
        logs: [],
        selectedNodeId: null,
      });
    },
  };
});
