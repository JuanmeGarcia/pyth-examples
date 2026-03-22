"use client";

import BaseNode from "./BaseNode";
import { usePipelineStore } from "@/store/usePipelineStore";

export default function NormalizeNode() {
  const normalizedPrice = usePipelineStore((s) => s.normalizedPrice);
  const normalizePrice = usePipelineStore((s) => s.normalizePrice);

  return (
    <BaseNode
      nodeId="normalize"
      title="Normalize"
      subtitle="scale & hash"
      onRun={normalizePrice}
      runLabel="Normalize"
    >
      {normalizedPrice ? (
        <div className="space-y-1.5">
          <div className="flex justify-between text-muted">
            <span>value</span>
            <span className="text-secondary">
              ${normalizedPrice.value.toLocaleString(undefined, { maximumFractionDigits: 2 })}
            </span>
          </div>
          <div className="flex justify-between text-muted">
            <span>scaled</span>
            <span className="font-mono text-secondary">
              {normalizedPrice.valueScaled}
            </span>
          </div>
          <div className="flex justify-between text-muted">
            <span>hash</span>
            <span className="font-mono text-secondary truncate max-w-[120px]">
              {normalizedPrice.payloadHash.slice(0, 12)}…
            </span>
          </div>
        </div>
      ) : (
        <div className="text-muted italic py-2">Awaiting price</div>
      )}
    </BaseNode>
  );
}
