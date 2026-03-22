"use client";

import { usePipelineStore } from "@/store/usePipelineStore";

export default function DatumPanel() {
  const datum = usePipelineStore((s) => s.datum);
  const redeemer = usePipelineStore((s) => s.redeemer);

  if (!datum && !redeemer) {
    return null;
  }

  return (
    <div className="border-t pt-3 space-y-3" style={{ borderColor: "var(--border-default)" }}>
      {datum && (
        <div>
          <div className="text-[10px] font-semibold text-muted uppercase mb-1">
            Datum
          </div>
          <div className="space-y-1 pl-2 font-mono text-[11px]">
            <div className="flex gap-4">
              <span className="text-muted w-24">owner</span>
              <span className="text-accent-cyan truncate">
                {datum.owner}
              </span>
            </div>
            <div className="flex gap-4">
              <span className="text-muted w-24">price</span>
              <span className="text-foreground font-semibold">
                {datum.price}
              </span>
            </div>
            <div className="flex gap-4">
              <span className="text-muted w-24">timestamp</span>
              <span className="text-secondary">{datum.timestamp}</span>
            </div>
            <div className="flex gap-4">
              <span className="text-muted w-24">payloadHash</span>
              <span className="text-secondary truncate">
                {datum.payloadHash.slice(0, 20)}…
              </span>
            </div>
          </div>
        </div>
      )}

      {redeemer ? (
        <div>
          <div className="text-[10px] font-semibold text-muted uppercase mb-1">
            Redeemer
          </div>
          <div className="pl-2 font-mono text-[11px]">
            <div className="flex gap-4">
              <span className="text-muted w-24">action</span>
              <span className="text-accent-green">{redeemer.action}</span>
            </div>
          </div>
        </div>
      ) : datum ? (
        <div>
          <div className="text-[10px] font-semibold text-muted uppercase mb-1">
            Redeemer
          </div>
          <div className="pl-2 text-[11px] text-muted italic">
            Lock TX — no redeemer
          </div>
        </div>
      ) : null}
    </div>
  );
}
