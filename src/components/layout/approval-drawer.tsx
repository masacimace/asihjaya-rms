"use client";

import { Check, ClipboardCheck, X } from "lucide-react";
import Link from "next/link";

export const runtime = "nodejs";

const MOCK_PENDING_APPROVALS = [
  {
    id: "appr-01",
    date: "2026-06-25T14:30:00Z",
    type: "discount",
    status: "pending",
    requestedBy: "Hanita",
    referenceId: "ORD/06/2026/440",
    requestData: {
      item: "Gelang Keroncong 24K (20g)",
      discountRequested: 500000,
      reason: "Pelanggan VIP lama",
    },
  },
];

const MOCK_RECENT_RESOLVED = [
  {
    id: "appr-02",
    date: "2026-06-25T09:15:00Z",
    type: "void_receipt",
    status: "approved",
    requestedBy: "Rini",
    referenceId: "ORD/06/2026/421",
  },
];

function formatMoney(value: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(isoString: string) {
  const date = new Date(isoString);
  return new Intl.DateTimeFormat("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function ApprovalDrawer({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      {/* Drawer */}
      <aside className="fixed inset-y-0 right-0 z-50 flex w-full max-w-sm flex-col bg-white shadow-md transition-transform">
        <header className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]">
              <ClipboardCheck className="size-5" />
            </div>
            <div>
              <h2 className="font-bold text-neutral-950">
                Kotak Masuk Approval
              </h2>
              <p className="text-xs text-[var(--muted)]">
                Menunggu tindakan Anda
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="grid size-8 place-items-center rounded-lg text-neutral-500 hover:bg-neutral-100"
          >
            <X className="size-5" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-5">
          {/* Pending Section */}
          <section className="mb-8">
            <h3 className="mb-3 text-xs font-bold text-neutral-500">
              Perlu Tindakan ({MOCK_PENDING_APPROVALS.length})
            </h3>
            <div className="space-y-3">
              {MOCK_PENDING_APPROVALS.map((approval) => (
                <div
                  key={approval.id}
                  className="rounded-2xl border border-amber-200 bg-amber-50/30 p-4 ring-1 ring-amber-100"
                >
                  <div className="flex items-start gap-3">
                    <div className="grid size-10 shrink-0 place-items-center rounded-full bg-amber-100 text-amber-600">
                      <ClipboardCheck className="size-5" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h2 className="text-sm font-bold text-neutral-950">
                          Permintaan Diskon Khusus
                        </h2>
                        <span className="inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-700">
                          Menunggu
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-neutral-600">
                        Diminta oleh{" "}
                        <span className="font-semibold text-neutral-900">
                          {approval.requestedBy}
                        </span>{" "}
                        untuk Nota{" "}
                        <span className="font-semibold text-neutral-900">
                          {approval.referenceId}
                        </span>{" "}
                        pada {formatDate(approval.date)}
                      </p>

                      <div className="mt-3 rounded-xl bg-neutral-50/80 p-3 text-xs text-neutral-700">
                        <div className="space-y-1.5">
                          <p>
                            <span className="text-neutral-500">Item:</span>{" "}
                            <span className="font-medium">
                              {approval.requestData.item}
                            </span>
                          </p>
                          <p>
                            <span className="text-neutral-500">
                              Nominal Diskon:
                            </span>{" "}
                            <span className="font-bold text-red-600">
                              {formatMoney(
                                approval.requestData.discountRequested || 0,
                              )}
                            </span>
                          </p>
                          <p>
                            <span className="text-neutral-500">Alasan:</span>{" "}
                            <span className="italic">
                              {approval.requestData.reason}
                            </span>
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 flex gap-2">
                    <button className="flex h-9 flex-1 items-center justify-center gap-2 rounded-lg bg-emerald-600 text-xs font-medium text-white transition hover:bg-emerald-700">
                      <Check className="size-4" /> Setujui
                    </button>
                    <button className="flex h-9 flex-1 items-center justify-center gap-2 rounded-lg border border-red-200 bg-white text-xs font-medium text-red-600 transition hover:bg-red-50">
                      <X className="size-4" /> Tolak
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Recent Resolved Section */}
          <section>
            <h3 className="mb-3 text-xs font-bold text-neutral-500">
              Riwayat Terakhir
            </h3>
            <div className="space-y-3">
              {MOCK_RECENT_RESOLVED.map((approval) => (
                <div
                  key={approval.id}
                  className="rounded-2xl border border-[var(--border)] p-4 bg-neutral-50"
                >
                  <div className="flex items-start gap-3">
                    <div className="grid size-10 shrink-0 place-items-center rounded-full bg-neutral-100 text-neutral-500">
                      <ClipboardCheck className="size-5" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h2 className="text-sm font-bold text-neutral-950">
                          Pembatalan Nota (Void)
                        </h2>
                        <span className="inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-700">
                          Disetujui
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-neutral-600">
                        Diminta oleh{" "}
                        <span className="font-semibold text-neutral-900">
                          {approval.requestedBy}
                        </span>{" "}
                        untuk Nota{" "}
                        <span className="font-semibold text-neutral-900">
                          {approval.referenceId}
                        </span>{" "}
                        pada {formatDate(approval.date)}
                      </p>

                      <div className="mt-3 rounded-xl bg-neutral-50/80 p-3 text-xs text-neutral-700">
                        <p>
                          <span className="text-neutral-500">
                            Alasan Pembatalan:
                          </span>{" "}
                          <span className="italic">
                            Salah input metode pembayaran (harusnya Transfer BCA
                            tapi klik Cash)
                          </span>
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        <footer className="border-t border-[var(--border)] p-4">
          <Link
            href="/admin/operasional/approval"
            onClick={onClose}
            className="block w-full rounded-xl bg-neutral-100 py-2.5 text-center text-sm font-medium text-neutral-700 transition hover:bg-neutral-200"
          >
            Lihat Semua Arsip Riwayat
          </Link>
        </footer>
      </aside>
    </>
  );
}
