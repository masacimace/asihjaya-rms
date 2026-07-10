"use client";

import {
  AlertCircle,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  ExternalLink,
  Inbox,
  X,
  XCircle,
} from "lucide-react";
import Link from "next/link";

import { ApprovalResolutionForm } from "@/components/approvals/approval-resolution-form";
import type {
  AdminApprovalDrawerData,
  AdminApprovalRow,
} from "@/features/approvals/contracts";
import { cn } from "@/lib/utils";

export const runtime = "nodejs";

function formatMoney(value: number | null) {
  if (value === null) return null;

  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDateTime(isoString: string | null) {
  if (!isoString) return "-";

  const date = new Date(isoString);

  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jakarta",
  }).format(date);
}

function getStatusMeta(status: AdminApprovalRow["status"]) {
  if (status === "approved") {
    return {
      label: "Disetujui",
      icon: CheckCircle2,
      className: "bg-emerald-50 text-emerald-700",
    };
  }

  if (status === "rejected") {
    return {
      label: "Ditolak",
      icon: XCircle,
      className: "bg-red-50 text-red-700",
    };
  }

  return {
    label: "Menunggu",
    icon: Clock3,
    className: "bg-amber-50 text-amber-700",
  };
}

function ApprovalMiniCard({ approval }: { approval: AdminApprovalRow }) {
  const statusMeta = getStatusMeta(approval.status);
  const StatusIcon = statusMeta.icon;
  const impact = formatMoney(approval.summary.impactValue);

  return (
    <article
      className={cn(
        "rounded-3xl border bg-white p-4",
        approval.status === "pending"
          ? "border-amber-200 ring-1 ring-amber-100"
          : "border-[var(--border)]",
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "grid size-10 shrink-0 place-items-center rounded-2xl",
            approval.status === "pending"
              ? "bg-amber-100 text-amber-700"
              : "bg-neutral-100 text-neutral-600",
          )}
        >
          <ClipboardCheck className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="min-w-0 flex-1 text-sm font-bold text-neutral-950">
              {approval.summary.title}
            </h3>
            <span
              className={cn(
                "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold",
                statusMeta.className,
              )}
            >
              <StatusIcon className="size-3" />
              {statusMeta.label}
            </span>
          </div>
          <p className="mt-1 text-xs leading-5 text-neutral-600">
            {approval.summary.description}
          </p>
          <div className="mt-3 grid gap-1.5 text-xs text-neutral-600">
            <div className="flex justify-between gap-3">
              <span>Requester</span>
              <span className="truncate font-semibold text-neutral-900">
                {approval.requestedByName}
              </span>
            </div>
            <div className="flex justify-between gap-3">
              <span>Outlet</span>
              <span className="truncate font-semibold text-neutral-900">
                {approval.outletCode ?? "Semua outlet"}
              </span>
            </div>
            <div className="flex justify-between gap-3">
              <span>Waktu</span>
              <span className="font-semibold text-neutral-900">
                {formatDateTime(approval.createdAtIso)}
              </span>
            </div>
            {impact ? (
              <div className="flex justify-between gap-3">
                <span>{approval.summary.impactLabel ?? "Impact"}</span>
                <span className="font-bold text-red-700">{impact}</span>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {approval.status === "pending" ? (
        <div className="mt-4 rounded-2xl border border-amber-100 bg-amber-50/40 p-3">
          <ApprovalResolutionForm approval={approval} mode="compact" />
        </div>
      ) : approval.responseNotes ? (
        <p className="mt-4 rounded-2xl bg-neutral-50 p-3 text-xs leading-5 text-neutral-600">
          {approval.responseNotes}
        </p>
      ) : null}
    </article>
  );
}

export function ApprovalDrawer({
  isOpen,
  onClose,
  data,
}: {
  isOpen: boolean;
  onClose: () => void;
  data: AdminApprovalDrawerData;
}) {
  if (!isOpen) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-50 bg-neutral-950/10 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      <aside className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col bg-white shadow-2xl shadow-neutral-950/10 transition-transform">
        <header className="border-b border-[var(--border)] px-5 py-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="grid size-11 place-items-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent)]">
                <ClipboardCheck className="size-5" />
              </div>
              <div>
                <h2 className="font-bold text-neutral-950">
                  Kotak Masuk Approval
                </h2>
                <p className="text-xs text-[var(--muted)]">
                  {data.pendingCount > 0
                    ? `${data.pendingCount} request menunggu tindakan`
                    : "Tidak ada request pending saat ini"}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="grid size-9 place-items-center rounded-xl text-neutral-500 transition hover:bg-neutral-100"
            >
              <X className="size-5" />
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-5">
          <section className="mb-8">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 className="text-xs font-bold uppercase tracking-wide text-neutral-500">
                Perlu Tindakan
              </h3>
              <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-700">
                {data.pendingCount}
              </span>
            </div>

            {data.pending.length > 0 ? (
              <div className="space-y-3">
                {data.pending.map((approval) => (
                  <ApprovalMiniCard key={approval.id} approval={approval} />
                ))}
              </div>
            ) : (
              <div className="rounded-3xl border border-dashed border-[var(--border)] bg-neutral-50 p-6 text-center">
                <div className="mx-auto grid size-12 place-items-center rounded-2xl bg-white text-neutral-500 shadow-sm">
                  <Inbox className="size-6" />
                </div>
                <p className="mt-3 text-sm font-semibold text-neutral-950">
                  Tidak ada approval pending
                </p>
                <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
                  Request baru dari POS atau operasional akan muncul di sini.
                </p>
              </div>
            )}
          </section>

          <section>
            <h3 className="mb-3 text-xs font-bold uppercase tracking-wide text-neutral-500">
              Riwayat Terakhir
            </h3>
            {data.recentResolved.length > 0 ? (
              <div className="space-y-3">
                {data.recentResolved.map((approval) => (
                  <ApprovalMiniCard key={approval.id} approval={approval} />
                ))}
              </div>
            ) : (
              <div className="rounded-3xl border border-[var(--border)] bg-white p-5 text-sm text-[var(--muted)]">
                Belum ada approval yang selesai diproses.
              </div>
            )}
          </section>
        </div>

        <footer className="border-t border-[var(--border)] p-4">
          <Link
            href="/admin/operasional/approval"
            onClick={onClose}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-neutral-950 px-4 py-3 text-sm font-semibold !text-white transition hover:bg-neutral-800"
          >
            <ExternalLink className="size-4" />
            Lihat Dashboard Approval
          </Link>
          {data.pendingCount > data.pending.length ? (
            <p className="mt-2 flex items-center justify-center gap-1 text-xs text-amber-700">
              <AlertCircle className="size-3.5" />
              {data.pendingCount - data.pending.length} request pending lain
              tersedia di dashboard.
            </p>
          ) : null}
        </footer>
      </aside>
    </>
  );
}
