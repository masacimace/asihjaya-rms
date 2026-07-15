"use client";

import {
  Archive,
  Bell,
  ChevronDown,
  CircleDollarSign,
  ClipboardCheck,
  Clock3,
  ExternalLink,
  HardDrive,
  Mail,
  MailOpen,
  PackageCheck,
  ReceiptText,
  ShieldAlert,
  Store,
} from "lucide-react";
import Link from "next/link";

import type { AdminNotificationRow } from "@/features/notifications/contracts";
import { cn } from "@/lib/utils";

type DetailRow = {
  label: string;
  value: string;
};

type PaymentDetail = {
  label: string;
  amount: string | null;
};

const MONEY_KEYS = new Set([
  "actualCash",
  "amount",
  "cashRefundAmount",
  "criticalAmount",
  "differenceAmount",
  "discountAmount",
  "expectedAmount",
  "expectedCash",
  "highValueThreshold",
  "impactAmount",
  "largeCashOutThreshold",
  "settlementGrossAmount",
  "subtotalAmount",
  "totalAmount",
  "variance",
]);

const DETAIL_LABELS: Record<string, string> = {
  actualCash: "Kas aktual",
  agentName: "Hardware agent",
  ambiguousCount: "Ambigu",
  amount: "Nominal",
  appliedCount: "Diterapkan",
  attentionItemCount: "Perlu tindak lanjut",
  cashierName: "Sales",
  cashRefundAmount: "Refund tunai",
  closedByName: "Ditutup oleh",
  completedByName: "Diselesaikan oleh",
  createdByName: "Dibuat oleh",
  deviceType: "Perangkat",
  differenceAmount: "Selisih",
  discountAmount: "Diskon",
  duplicateCount: "Duplikat",
  error: "Error",
  errorMessage: "Keterangan kegagalan",
  expectedAmount: "Payment POS",
  expectedCash: "Kas seharusnya",
  failedCount: "Gagal",
  fileName: "File",
  invoiceNumber: "Invoice",
  itemCount: "Jumlah item",
  jobType: "Jenis job",
  mismatchCount: "Mismatch",
  notFoundCount: "Tidak ditemukan",
  outletName: "Outlet",
  paymentMethodsLabel: "Pembayaran",
  paymentRefundCount: "Payment direfund",
  pendingReturnItemCount: "Item menunggu penerimaan",
  profileName: "Profil pembayaran",
  provider: "Provider",
  reason: "Alasan",
  reasonLabel: "Alasan",
  recoveryReason: "Metode recovery",
  registerCode: "Register",
  registerName: "Register",
  requesterName: "Pemohon",
  settlementReference: "Referensi settlement",
  responseNotes: "Catatan approver",
  rowCount: "Total baris",
  settlementGrossAmount: "Gross settlement",
  source: "Sumber",
  status: "Status",
  totalAmount: "Total",
  totalWeightGram: "Total berat",
  type: "Jenis",
  unresolvedCount: "Belum selesai",
  variance: "Selisih kas",
  varianceReason: "Alasan selisih",
  verificationSource: "Sumber verifikasi",
};

const DETAIL_PRIORITY = [
  "invoiceNumber",
  "fileName",
  "outletName",
  "registerName",
  "registerCode",
  "cashierName",
  "requesterName",
  "totalAmount",
  "amount",
  "expectedAmount",
  "settlementGrossAmount",
  "differenceAmount",
  "variance",
  "expectedCash",
  "actualCash",
  "discountAmount",
  "cashRefundAmount",
  "itemCount",
  "attentionItemCount",
  "pendingReturnItemCount",
  "totalWeightGram",
  "paymentMethodsLabel",
  "provider",
  "profileName",
  "status",
  "reasonLabel",
  "reason",
  "responseNotes",
  "errorMessage",
  "error",
  "recoveryReason",
  "fileName",
  "rowCount",
  "appliedCount",
  "ambiguousCount",
  "mismatchCount",
  "notFoundCount",
  "duplicateCount",
  "failedCount",
  "unresolvedCount",
  "agentName",
  "jobType",
  "deviceType",
  "source",
  "createdByName",
  "closedByName",
] as const;

function formatDateTime(isoString: string) {
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Jakarta",
  }).format(new Date(isoString));
}

function formatRelativeTime(isoString: string) {
  const elapsedSeconds = Math.max(
    0,
    Math.floor((Date.now() - new Date(isoString).getTime()) / 1000),
  );

  if (elapsedSeconds < 60) return "Baru saja";
  if (elapsedSeconds < 3_600)
    return `${Math.floor(elapsedSeconds / 60)} menit lalu`;
  if (elapsedSeconds < 86_400)
    return `${Math.floor(elapsedSeconds / 3_600)} jam lalu`;
  if (elapsedSeconds < 604_800)
    return `${Math.floor(elapsedSeconds / 86_400)} hari lalu`;

  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    timeZone: "Asia/Jakarta",
  }).format(new Date(isoString));
}

function formatIdr(value: unknown) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return null;

  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(amount);
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function formatDetailValue(key: string, value: unknown) {
  if (value == null || value === "") return null;

  if (MONEY_KEYS.has(key)) return formatIdr(value);

  if (key === "totalWeightGram") {
    const weight = Number(value);
    return Number.isFinite(weight)
      ? `${new Intl.NumberFormat("id-ID", { maximumFractionDigits: 3 }).format(weight)} gram`
      : null;
  }

  if (typeof value === "boolean") return value ? "Ya" : "Tidak";
  if (typeof value === "number")
    return new Intl.NumberFormat("id-ID").format(value);
  if (typeof value === "string") return value.trim() || null;
  return null;
}

function getNotificationDetails(
  notification: AdminNotificationRow,
): DetailRow[] {
  const payload = notification.payload ?? {};
  const snapshot = asRecord(payload.requestSnapshot);
  const combined = { ...payload, ...snapshot };
  const seen = new Set<string>();
  const rows: DetailRow[] = [];

  for (const key of DETAIL_PRIORITY) {
    if (seen.has(key)) continue;
    seen.add(key);

    const value = formatDetailValue(key, combined[key]);
    if (!value) continue;

    rows.push({
      label: DETAIL_LABELS[key] ?? key,
      value,
    });

    if (rows.length >= 10) break;
  }

  if (notification.outletName && !rows.some((row) => row.label === "Outlet")) {
    rows.unshift({ label: "Outlet", value: notification.outletName });
  }

  return rows.slice(0, 10);
}

function getPaymentDetails(
  notification: AdminNotificationRow,
): PaymentDetail[] {
  const payments = notification.payload.payments;
  if (!Array.isArray(payments)) return [];

  return payments.flatMap((payment) => {
    const value = asRecord(payment);
    const methodLabel =
      typeof value.methodLabel === "string"
        ? value.methodLabel
        : typeof value.method === "string"
          ? value.method
          : null;

    if (!methodLabel) return [];

    const provider =
      typeof value.provider === "string" && value.provider.trim()
        ? ` · ${value.provider.trim()}`
        : "";

    return [
      {
        label: `${methodLabel}${provider}`,
        amount: formatIdr(value.amount),
      },
    ];
  });
}

function getCategoryMeta(notification: AdminNotificationRow) {
  if (notification.category === "sales") {
    return {
      label: "Transaksi",
      icon: ReceiptText,
      iconClassName: "bg-emerald-50 text-emerald-700",
    };
  }

  if (notification.category === "payment") {
    return {
      label: "Keuangan",
      icon: CircleDollarSign,
      iconClassName: "bg-sky-50 text-sky-700",
    };
  }

  if (notification.category === "cash_shift") {
    return {
      label: notification.eventType.startsWith("shift.") ? "Shift" : "Kas",
      icon: Clock3,
      iconClassName: "bg-amber-50 text-amber-700",
    };
  }

  if (notification.category === "inventory_return") {
    return {
      label: "Retur & Stok",
      icon: PackageCheck,
      iconClassName: "bg-violet-50 text-violet-700",
    };
  }

  if (notification.category === "hardware") {
    return {
      label: "Hardware",
      icon: HardDrive,
      iconClassName: "bg-blue-50 text-blue-700",
    };
  }

  if (notification.category === "approval_result") {
    return {
      label: "Hasil Approval",
      icon: ClipboardCheck,
      iconClassName: "bg-fuchsia-50 text-fuchsia-700",
    };
  }

  if (notification.category === "security") {
    return {
      label: "Keamanan",
      icon: ShieldAlert,
      iconClassName: "bg-red-50 text-red-700",
    };
  }

  return {
    label: "Sistem",
    icon: Bell,
    iconClassName: "bg-neutral-100 text-neutral-700",
  };
}

function getCardClassName(notification: AdminNotificationRow) {
  if (notification.severity === "critical") {
    return "border-red-200 bg-red-50/35";
  }
  if (notification.severity === "warning") {
    return "border-amber-200 bg-amber-50/35";
  }
  if (notification.severity === "success") {
    return "border-emerald-200 bg-emerald-50/25";
  }
  return "border-[var(--border)] bg-white";
}

function getActionLabel(notification: AdminNotificationRow) {
  if (notification.eventType.startsWith("sale.")) return "Buka transaksi";
  if (notification.eventType.startsWith("return.")) return "Buka retur";
  if (
    notification.eventType.startsWith("payment.") ||
    notification.eventType.startsWith("settlement_import.")
  ) {
    return "Buka rekonsiliasi";
  }
  if (notification.eventType.startsWith("hardware."))
    return "Buka Hardware Hub";
  if (notification.eventType.startsWith("shift.")) return "Buka shift";
  if (notification.eventType.startsWith("cash.")) return "Buka pergerakan kas";
  if (notification.eventType.startsWith("approval.")) return "Buka detail";
  return "Lihat detail";
}

function canMarkUnread(notification: AdminNotificationRow) {
  return (
    notification.status !== "unread" &&
    notification.status !== "resolved" &&
    notification.status !== "archived" &&
    notification.resolvedAtIso == null
  );
}

export function NotificationCard({
  notification,
  isExpanded,
  isMutating,
  onToggle,
  onClose,
  onMarkRead,
  onMarkUnread,
  onArchive,
}: {
  notification: AdminNotificationRow;
  isExpanded: boolean;
  isMutating: boolean;
  onToggle: () => void;
  onClose: () => void;
  onMarkRead: () => void;
  onMarkUnread: () => void;
  onArchive?: () => void;
}) {
  const meta = getCategoryMeta(notification);
  const Icon = meta.icon;
  const details = getNotificationDetails(notification);
  const payments = getPaymentDetails(notification);
  const isResolved =
    notification.status === "resolved" || notification.resolvedAtIso != null;

  return (
    <article
      className={cn(
        "overflow-hidden rounded-3xl border transition-shadow",
        getCardClassName(notification),
        notification.status === "unread" &&
          "shadow-sm ring-1 ring-[var(--accent-soft)]",
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isExpanded}
        className="flex w-full items-start gap-3 p-4 text-left transition hover:bg-white/45"
      >
        <span
          className={cn(
            "grid size-10 shrink-0 place-items-center rounded-2xl",
            meta.iconClassName,
          )}
        >
          <Icon className="size-5" />
        </span>

        <span className="min-w-0 flex-1">
          <span className="flex items-start gap-2">
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-bold text-neutral-950">
                  {notification.title}
                </span>
                {notification.status === "unread" ? (
                  <span
                    className="size-2 shrink-0 rounded-full bg-red-600"
                    aria-label="Belum dibaca"
                  />
                ) : null}
              </span>
              <span
                className={cn(
                  "mt-1 block text-xs leading-5 text-neutral-600",
                  !isExpanded && "line-clamp-2",
                )}
              >
                {notification.message}
              </span>
            </span>

            <ChevronDown
              className={cn(
                "mt-0.5 size-4 shrink-0 text-neutral-400 transition-transform",
                isExpanded && "rotate-180",
              )}
            />
          </span>

          <span className="mt-3 flex flex-wrap items-center gap-1.5">
            <span className="rounded-full bg-white/90 px-2 py-1 text-[10px] font-bold text-neutral-600 ring-1 ring-black/5">
              {meta.label}
            </span>
            {notification.isActionable ? (
              <span className="rounded-full bg-amber-100 px-2 py-1 text-[10px] font-bold text-amber-800">
                Perlu tindakan
              </span>
            ) : null}
            {isResolved ? (
              <span className="rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-bold text-emerald-800">
                Selesai
              </span>
            ) : null}
            {notification.status === "archived" ? (
              <span className="rounded-full bg-neutral-200 px-2 py-1 text-[10px] font-bold text-neutral-700">
                Diarsipkan
              </span>
            ) : null}
            <span className="ml-auto shrink-0 text-[11px] font-medium text-neutral-500">
              {formatRelativeTime(notification.createdAtIso)}
            </span>
          </span>
        </span>
      </button>

      {isExpanded ? (
        <div className="border-t border-black/5 bg-white/70 px-4 pb-4 pt-3">
          <div className="flex flex-wrap items-center gap-2 text-[11px] text-neutral-500">
            <span>{formatDateTime(notification.createdAtIso)}</span>
            {notification.outletCode ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-1 font-semibold text-neutral-700 ring-1 ring-[var(--border)]">
                <Store className="size-3" />
                {notification.outletCode}
              </span>
            ) : null}
          </div>

          {details.length > 0 ? (
            <dl className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {details.map((detail) => (
                <div
                  key={`${detail.label}:${detail.value}`}
                  className="rounded-2xl border border-[var(--border)] bg-white px-3 py-2.5"
                >
                  <dt className="text-[10px] font-bold uppercase tracking-wide text-neutral-400">
                    {detail.label}
                  </dt>
                  <dd className="mt-1 break-words text-xs font-semibold leading-5 text-neutral-900">
                    {detail.value}
                  </dd>
                </div>
              ))}
            </dl>
          ) : null}

          {payments.length > 0 ? (
            <div className="mt-3 rounded-2xl border border-[var(--border)] bg-white p-3">
              <p className="text-[10px] font-bold uppercase tracking-wide text-neutral-400">
                Rincian pembayaran
              </p>
              <div className="mt-2 space-y-2">
                {payments.map((payment, index) => (
                  <div
                    key={`${payment.label}:${index}`}
                    className="flex items-center justify-between gap-3 text-xs"
                  >
                    <span className="min-w-0 text-neutral-600">
                      {payment.label}
                    </span>
                    {payment.amount ? (
                      <span className="shrink-0 font-bold text-neutral-950">
                        {payment.amount}
                      </span>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <div className="mt-4 flex flex-wrap items-center gap-2">
            {notification.actionUrl ? (
              <Link
                href={notification.actionUrl}
                onClick={onClose}
                className="inline-flex h-10 items-center gap-2 rounded-xl bg-neutral-950 px-3.5 text-xs font-bold !text-white transition hover:bg-neutral-800"
              >
                {getActionLabel(notification)}
                <ExternalLink className="size-3.5" />
              </Link>
            ) : null}

            {notification.status === "unread" ? (
              <button
                type="button"
                disabled={isMutating}
                onClick={onMarkRead}
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-[var(--border)] bg-white px-3.5 text-xs font-bold text-neutral-800 transition hover:bg-neutral-50 disabled:cursor-wait disabled:opacity-50"
              >
                <MailOpen className="size-3.5" />
                Tandai dibaca
              </button>
            ) : canMarkUnread(notification) ? (
              <button
                type="button"
                disabled={isMutating}
                onClick={onMarkUnread}
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-[var(--border)] bg-white px-3.5 text-xs font-bold text-neutral-800 transition hover:bg-neutral-50 disabled:cursor-wait disabled:opacity-50"
              >
                <Mail className="size-3.5" />
                Tandai belum dibaca
              </button>
            ) : null}

            {onArchive && notification.status !== "archived" ? (
              <button
                type="button"
                disabled={isMutating}
                onClick={onArchive}
                title="Menyembunyikan notifikasi tanpa menghapus audit event"
                className="ml-auto inline-flex h-10 items-center gap-2 rounded-xl px-3 text-xs font-bold text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-900 disabled:cursor-wait disabled:opacity-50"
              >
                <Archive className="size-3.5" />
                Arsipkan
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </article>
  );
}
