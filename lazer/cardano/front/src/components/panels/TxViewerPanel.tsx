"use client";

import { usePipelineStore } from "@/store/usePipelineStore";
import CopyButton from "@/components/shared/CopyButton";

export default function TxViewerPanel() {
  const txBuild = usePipelineStore((s) => s.txBuild);
  const walletInfo = usePipelineStore((s) => s.walletInfo);

  if (!txBuild) {
    return (
      <div className="flex h-full items-center justify-center text-xs text-muted italic">
        No transaction built yet
      </div>
    );
  }

  const isLock = txBuild.kind === "lock";

  return (
    <div className="space-y-3 overflow-y-auto">
      {/* TX Hash */}
      <div>
        <div className="text-[10px] text-muted uppercase mb-1">TX Hash</div>
        <div className="flex items-center gap-1 rounded border p-2 font-mono text-xs text-secondary" style={{ borderColor: "var(--border-default)", backgroundColor: "var(--bg-primary)" }}>
          <span className="truncate">{txBuild.txHash}</span>
          <CopyButton text={txBuild.txHash} />
        </div>
      </div>

      {/* Explorer Link */}
      {txBuild.explorerUrl && (
        <a
          href={txBuild.explorerUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="block text-xs text-accent-cyan hover:underline"
        >
          View on CardanoScan →
        </a>
      )}

      {/* UTxO Flow Diagram */}
      <div>
        <div className="text-[10px] text-muted uppercase mb-2">UTxO Flow</div>
        <div className="flex items-center justify-center gap-2 text-xs">
          <div
            className="rounded border px-3 py-2 text-center"
            style={{
              borderColor: isLock ? "var(--accent-cyan)" : "var(--accent-purple)",
              backgroundColor: isLock ? "var(--accent-cyan)" : "var(--accent-purple)",
              color: "#000",
              opacity: 0.9,
            }}
          >
            <div className="text-[10px] font-semibold">
              {isLock ? "Wallet" : "Script"}
            </div>
          </div>

          <div className="flex items-center text-muted">
            <span className="text-lg">→</span>
            <span className="text-[10px] mx-1">
              {txBuild.lovelace
                ? `${(parseInt(txBuild.lovelace) / 1e6).toFixed(1)} ADA`
                : "5 ADA"}
            </span>
            <span className="text-lg">→</span>
          </div>

          <div
            className="rounded border px-3 py-2 text-center"
            style={{
              borderColor: isLock ? "var(--accent-purple)" : "var(--accent-cyan)",
              backgroundColor: isLock ? "var(--accent-purple)" : "var(--accent-cyan)",
              color: "#000",
              opacity: 0.9,
            }}
          >
            <div className="text-[10px] font-semibold">
              {isLock ? "Script" : "Wallet"}
            </div>
          </div>
        </div>
      </div>

      {/* Datum Summary */}
      <div className="rounded border p-2 text-[11px] font-mono" style={{ borderColor: "var(--border-default)", backgroundColor: "var(--bg-primary)" }}>
        <div className="text-muted mb-1">datum:</div>
        <div className="pl-2 space-y-0.5 text-secondary">
          <div>owner: {txBuild.datum.owner.slice(0, 16)}…</div>
          <div>price: {txBuild.datum.price}</div>
          <div>timestamp: {txBuild.datum.timestamp}</div>
          <div>hash: {txBuild.datum.payloadHash.slice(0, 16)}…</div>
        </div>
      </div>
    </div>
  );
}
