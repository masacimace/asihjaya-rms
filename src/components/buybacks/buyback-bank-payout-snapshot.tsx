"use client";

import { Landmark } from "lucide-react";
import { useEffect, useState } from "react";

import {
  getBuybackBankPayoutSnapshotAction,
  type BuybackBankPayoutSnapshot,
} from "@/app/actions/buyback-bank-payouts";
import { formatCurrency } from "@/features/pos/payment-draft";

export function BuybackBankPayoutSnapshotCard({
  buybackId,
}: {
  buybackId: string;
}) {
  const [snapshot, setSnapshot] = useState<BuybackBankPayoutSnapshot | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    void getBuybackBankPayoutSnapshotAction(buybackId)
      .then((result) => {
        if (cancelled) return;
        setSnapshot(result.status === "success" ? result.payout : null);
      })
      .catch(() => {
        if (!cancelled) setSnapshot(null);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [buybackId]);

  if (isLoading) {
    return (
      <section className="rounded-2xl border border-[var(--border)] bg-white p-4 sm:p-5">
        <p className="text-xs text-[var(--muted)]">Memuat rekening payout Transfer...</p>
      </section>
    );
  }

  if (!snapshot) return null;

  return (
    <section className="rounded-2xl border border-[var(--border)] bg-white p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]">
          <Landmark className="size-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
            Snapshot payout Transfer Bank
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-xl bg-neutral-50 px-3 py-2.5">
              <p className="text-[11px] text-[var(--muted)]">Nominal Transfer</p>
              <p className="mt-1 text-sm font-semibold text-neutral-950">
                {formatCurrency(Number(snapshot.amount))}
              </p>
            </div>
            <div className="rounded-xl bg-neutral-50 px-3 py-2.5">
              <p className="text-[11px] text-[var(--muted)]">Bank / Rekening</p>
              <p className="mt-1 text-sm font-semibold text-neutral-950">
                {snapshot.provider} · {snapshot.name}
              </p>
              <p className="mt-1 text-[11px] text-neutral-500">{snapshot.code}</p>
            </div>
            <div className="rounded-xl bg-neutral-50 px-3 py-2.5">
              <p className="text-[11px] text-[var(--muted)]">Nomor Rekening</p>
              <p className="mt-1 text-sm font-semibold text-neutral-950">
                {snapshot.accountNumber}
              </p>
            </div>
            <div className="rounded-xl bg-neutral-50 px-3 py-2.5">
              <p className="text-[11px] text-[var(--muted)]">Referensi Transfer</p>
              <p className="mt-1 text-sm font-semibold text-neutral-950">
                {snapshot.reference ?? "—"}
              </p>
            </div>
          </div>
          <p className="mt-3 text-[11px] leading-5 text-[var(--muted)]">
            Data rekening di atas adalah snapshot saat transaksi Buyback diselesaikan dan tidak mengikuti perubahan master rekening berikutnya.
          </p>
        </div>
      </div>
    </section>
  );
}
