"use client";

import BaseNode from "./BaseNode";
import { usePipelineStore } from "@/store/usePipelineStore";

export default function PythSourceNode() {
  const price = usePipelineStore((s) => s.price);
  const fetchPrice = usePipelineStore((s) => s.fetchPrice);

  const usdDisplay = price
    ? `$${(Number(price.priceUsdCents) / 100).toFixed(4)}`
    : null;

  return (
    <BaseNode
      nodeId="pyth-source"
      title="Pyth Lazer"
      subtitle="ADA / USD"
      showTargetHandle={false}
      onRun={fetchPrice}
      runLabel="Fetch Price"
    >
      {price ? (
        <div className="space-y-1.5">
          <div className="text-xl font-bold text-foreground">{usdDisplay}</div>
          <div className="flex justify-between text-muted">
            <span>cents</span>
            <span className="text-secondary font-mono">{price.priceUsdCents}</span>
          </div>
          <div className="flex justify-between text-muted">
            <span>feed</span>
            <span className="text-secondary font-mono">{price.feedId}</span>
          </div>
          <div className="flex justify-between text-muted">
            <span>time</span>
            <span className="text-secondary text-[10px]">
              {new Date(price.timestamp).toLocaleTimeString()}
            </span>
          </div>
        </div>
      ) : (
        <div className="text-muted italic py-2">No price data</div>
      )}
    </BaseNode>
  );
}
