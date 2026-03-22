"use client";

import BaseNode from "./BaseNode";
import { usePipelineStore } from "@/store/usePipelineStore";
import { Check } from "lucide-react";

export default function AikenValidatorNode() {
  const walletInfo = usePipelineStore((s) => s.walletInfo);

  return (
    <BaseNode
      nodeId="aiken-validator"
      title="Aiken Validator"
      subtitle="PlutusV3 on-chain"
      showSourceHandle={false}
      showTargetHandle={false}
      showTopHandle
    >
      <div className="space-y-1.5">
        <div className="flex justify-between text-muted">
          <span>script</span>
          <span className="font-mono text-secondary text-[10px]">
            pythathon_lock.spend
          </span>
        </div>
        <div className="flex justify-between text-muted">
          <span>address</span>
          <span className="font-mono text-secondary truncate max-w-[120px] text-[10px]">
            {walletInfo?.scriptAddress
              ? `${walletInfo.scriptAddress.slice(0, 18)}…`
              : "addr_test1wr…"}
          </span>
        </div>
        <div className="mt-2 border-t pt-2 text-[10px]" style={{ borderColor: "var(--border-default)" }}>
          <div className="font-semibold text-secondary mb-1">DATUM</div>
          <div className="space-y-0.5 text-muted pl-2">
            <div>owner: ByteArray</div>
            <div>price: Int</div>
            <div>timestamp: Int</div>
            <div>payload_hash: ByteArray</div>
          </div>
        </div>
        <div className="border-t pt-2 text-[10px]" style={{ borderColor: "var(--border-default)" }}>
          <div className="font-semibold text-secondary mb-1">RULES</div>
          <div className="space-y-0.5 text-muted pl-2">
            <div className="flex items-center gap-1">
              <Check className="h-3 w-3 shrink-0 text-[var(--accent-green)]" />
              signed by datum.owner
            </div>
            <div className="flex items-center gap-1">
              <Check className="h-3 w-3 shrink-0 text-[var(--accent-green)]" />
              redeemer = Unlock
            </div>
          </div>
        </div>
      </div>
    </BaseNode>
  );
}
