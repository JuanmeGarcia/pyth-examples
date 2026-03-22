"use client";

import { usePipelineStore } from "@/store/usePipelineStore";
import Toggle from "@/components/shared/Toggle";
import { RotateCcw } from "lucide-react";

export default function ControlsPanel() {
  const config = usePipelineStore((s) => s.config);
  const setConfig = usePipelineStore((s) => s.setConfig);
  const setDecisionConfig = usePipelineStore((s) => s.setDecisionConfig);
  const reset = usePipelineStore((s) => s.reset);

  return (
    <div className="space-y-3">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">
        Controls
      </h2>

      <button
        onClick={reset}
        className="w-full rounded-lg border py-2 text-sm text-secondary transition-colors hover:text-foreground"
        style={{ borderColor: "var(--border-light)" }}
      >
        <RotateCcw className="mr-1.5 inline h-3.5 w-3.5" />
        Reset
      </button>

      <div className="space-y-2 pt-2">
        <Toggle
          label="Mock Mode"
          checked={config.mockMode}
          onChange={(v) => setConfig({ mockMode: v })}
        />
        <Toggle
          label="Dry Run"
          checked={config.dryRun}
          onChange={(v) => setConfig({ dryRun: v })}
          color="var(--accent-amber)"
        />
        <Toggle
          label="Unlock Mode"
          checked={config.unlockMode}
          onChange={(v) => setConfig({ unlockMode: v })}
          color="var(--accent-purple)"
        />
      </div>

      <div className="space-y-2 border-t pt-3" style={{ borderColor: "var(--border-default)" }}>
        <label className="block">
          <span className="text-xs text-muted">Price threshold (USD)</span>
          <input
            type="number"
            value={config.decisionConfig.priceThreshold}
            onChange={(e) =>
              setDecisionConfig({ priceThreshold: Number(e.target.value) || 0 })
            }
            className="mt-1 w-full rounded border bg-[var(--bg-primary)] px-2 py-1.5 text-sm text-foreground"
            style={{ borderColor: "var(--border-default)" }}
          />
        </label>
        <label className="block">
          <span className="text-xs text-muted">Max age (seconds)</span>
          <input
            type="number"
            value={config.decisionConfig.maxAgeSeconds}
            onChange={(e) =>
              setDecisionConfig({ maxAgeSeconds: Number(e.target.value) || 60 })
            }
            className="mt-1 w-full rounded border bg-[var(--bg-primary)] px-2 py-1.5 text-sm text-foreground"
            style={{ borderColor: "var(--border-default)" }}
          />
        </label>
      </div>
    </div>
  );
}
