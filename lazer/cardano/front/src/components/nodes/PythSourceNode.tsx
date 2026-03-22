"use client";

import BaseNode from "./BaseNode";
import { usePipelineStore } from "@/store/usePipelineStore";

export default function PythSourceNode() {
  const rawPrice = usePipelineStore((s) => s.rawPrice);
  const fetchPrice = usePipelineStore((s) => s.fetchPrice);

  const priceDisplay = rawPrice
    ? (parseInt(rawPrice.price, 10) * Math.pow(10, rawPrice.expo)).toLocaleString(
        undefined,
        { style: "currency", currency: "USD", maximumFractionDigits: 2 }
      )
    : null;

  return (
    <BaseNode
      nodeId="pyth-source"
      title="Pyth Source"
      subtitle="BTC / USD"
      showTargetHandle={false}
      onRun={fetchPrice}
      runLabel="Fetch Price"
    >
      {rawPrice ? (
        <div className="space-y-1.5">
          <div className="text-xl font-bold text-foreground">{priceDisplay}</div>
          <div className="flex justify-between text-muted">
            <span>conf</span>
            <span className="text-secondary">±{parseInt(rawPrice.conf, 10) * Math.pow(10, rawPrice.expo)}</span>
          </div>
          <div className="flex justify-between text-muted">
            <span>expo</span>
            <span className="text-secondary">{rawPrice.expo}</span>
          </div>
          <div className="truncate text-muted">
            {rawPrice.rawPayload?.slice(0, 16)}…
          </div>
        </div>
      ) : (
        <div className="text-muted italic py-2">No price data</div>
      )}
    </BaseNode>
  );
}
