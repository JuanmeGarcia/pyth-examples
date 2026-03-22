"use client";

import { useEffect } from "react";
import { usePipelineStore } from "@/store/usePipelineStore";
import CopyButton from "@/components/shared/CopyButton";

function truncateMiddle(s: string, chars = 8): string {
  if (s.length <= chars * 2 + 3) return s;
  return `${s.slice(0, chars)}…${s.slice(-chars)}`;
}

export default function WalletPanel() {
  const walletInfo = usePipelineStore((s) => s.walletInfo);
  const fetchWalletInfo = usePipelineStore((s) => s.fetchWalletInfo);
  const mockMode = usePipelineStore((s) => s.config.mockMode);

  useEffect(() => {
    fetchWalletInfo();
  }, [fetchWalletInfo, mockMode]);

  return (
    <div className="space-y-2 border-t pt-3" style={{ borderColor: "var(--border-default)" }}>
      <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">
        Wallet / Network
      </h2>

      <div className="flex items-center gap-2">
        <span className="h-2 w-2 rounded-full bg-accent-green" />
        <span className="text-sm font-medium text-foreground">
          {walletInfo?.network ?? "Preview"}
        </span>
      </div>

      {walletInfo ? (
        <div className="space-y-1.5 text-[11px]">
          <div>
            <span className="text-muted">WALLET</span>
            <div className="flex items-center font-mono text-secondary">
              {truncateMiddle(walletInfo.address)}
              <CopyButton text={walletInfo.address} />
            </div>
          </div>
          <div>
            <span className="text-muted">PKH</span>
            <div className="flex items-center font-mono text-secondary">
              {truncateMiddle(walletInfo.pkh)}
              <CopyButton text={walletInfo.pkh} />
            </div>
          </div>
          <div>
            <span className="text-muted">SCRIPT</span>
            <div className="flex items-center font-mono text-secondary">
              {truncateMiddle(walletInfo.scriptAddress)}
              <CopyButton text={walletInfo.scriptAddress} />
            </div>
          </div>
        </div>
      ) : (
        <div className="text-xs text-muted italic">Loading wallet…</div>
      )}
    </div>
  );
}
