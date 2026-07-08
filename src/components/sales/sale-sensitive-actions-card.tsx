import type { ReactNode } from "react";

import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  RotateCcw,
  ShieldAlert,
  Undo2,
  XCircle,
} from "lucide-react";

import { requestSaleVoidRefundApprovalAction } from "@/features/sales/admin-actions";
import type {
  AdminSaleSensitiveApproval,
  AdminSaleStatus,
} from "@/features/sales/admin-contracts";
import { cn } from "@/lib/utils";

type SensitiveRequestType = "void" | "refund";

type ActionMeta = {
  type: SensitiveRequestType;
  approvalType: AdminSaleSensitiveApproval["type"];
  title: string;
  description: string;
  helper: string;
  buttonLabel: string;
  icon: ReactNode;
  toneClass: string;
};

const actionMetas: ActionMeta[] = [
  {
    type: "void",
    approvalType: "void_receipt",
    title: "Ajukan Void",
    description: "Batalkan nota penuh setelah manager/owner menyetujui request.",
    helper:
      "Gunakan untuk transaksi salah input, batal penuh, atau nota bermasalah yang perlu dibatalkan.",
    buttonLabel: "Ajukan approval void",
    icon: <RotateCcw className="size-4" />,
    toneClass: "bg-red-50 text-red-700 ring-red-100",
  },
  {
    type: "refund",
    approvalType: "refund_transaction",
    title: "Ajukan Refund",
    description: "Minta persetujuan refund sebelum kas/stok diubah pada tahap eksekusi.",
    helper:
      "Tahap ini baru membuat request approval. Eksekusi refund penuh/parsial masuk R3C-2.",
    buttonLabel: "Ajukan approval refund",
    icon: <Undo2 className="size-4" />,
    toneClass: "bg-orange-50 text-orange-700 ring-orange-100",
  },
];

const approvalStatusLabels: Record<AdminSaleSensitiveApproval["status"], string> = {
  pending: "Menunggu approval",
  approved: "Disetujui",
  rejected: "Ditolak",
};

function formatDateTime(value: Date | null) {
  if (!value) return "-";

  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jakarta",
  }).format(value);
}

function getStatusMeta(status: AdminSaleSensitiveApproval["status"]) {
  if (status === "approved") {
    return {
      icon: CheckCircle2,
      className: "border-emerald-200 bg-emerald-50 text-emerald-700",
    };
  }

  if (status === "rejected") {
    return {
      icon: XCircle,
      className: "border-red-200 bg-red-50 text-red-700",
    };
  }

  return {
    icon: Clock3,
    className: "border-amber-200 bg-amber-50 text-amber-700",
  };
}

function getLatestApproval(
  approvals: AdminSaleSensitiveApproval[],
  type: AdminSaleSensitiveApproval["type"],
) {
  return approvals.find((approval) => approval.type === type) ?? null;
}

function getBlockingApproval(approval: AdminSaleSensitiveApproval | null) {
  if (!approval) return null;

  return approval.status === "pending" || approval.status === "approved"
    ? approval
    : null;
}

function ApprovalStatusPanel({
  approval,
}: {
  approval: AdminSaleSensitiveApproval;
}) {
  const statusMeta = getStatusMeta(approval.status);
  const StatusIcon = statusMeta.icon;

  return (
    <div className={cn("rounded-2xl border p-3 text-sm", statusMeta.className)}>
      <div className="flex items-start gap-2">
        <StatusIcon className="mt-0.5 size-4 shrink-0" />
        <div className="min-w-0">
          <p className="font-semibold">{approvalStatusLabels[approval.status]}</p>
          <p className="mt-1 leading-5 opacity-90">
            Request oleh {approval.requestedByName} pada {formatDateTime(approval.createdAt)}.
          </p>
          {approval.approvedByName ? (
            <p className="mt-1 leading-5 opacity-90">
              Diproses oleh {approval.approvedByName} pada {formatDateTime(approval.resolvedAt)}.
            </p>
          ) : null}
          {approval.responseNotes ? (
            <p className="mt-2 rounded-xl bg-white/70 px-3 py-2 leading-5 text-neutral-700">
              {approval.responseNotes}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function SensitiveActionForm({
  saleId,
  saleStatus,
  returnTo,
  meta,
  latestApproval,
}: {
  saleId: string;
  saleStatus: AdminSaleStatus;
  returnTo: string;
  meta: ActionMeta;
  latestApproval: AdminSaleSensitiveApproval | null;
}) {
  const isCompleted = saleStatus === "completed";
  const blockingApproval = getBlockingApproval(latestApproval);
  const disabled = !isCompleted || Boolean(blockingApproval);

  return (
    <article className="rounded-2xl border border-[var(--border)] bg-white p-4">
      <div className="flex items-start gap-3">
        <div className={cn("grid size-10 shrink-0 place-items-center rounded-2xl ring-1", meta.toneClass)}>
          {meta.icon}
        </div>
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-neutral-950">{meta.title}</h3>
          <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
            {meta.description}
          </p>
        </div>
      </div>

      {latestApproval ? (
        <div className="mt-4">
          <ApprovalStatusPanel approval={latestApproval} />
        </div>
      ) : null}

      <p className="mt-4 rounded-2xl bg-neutral-50 px-4 py-3 text-xs leading-5 text-[var(--muted)]">
        {blockingApproval?.status === "approved"
          ? "Approval sudah disetujui. Eksekusi perubahan transaksi akan diaktifkan pada R3C-2."
          : blockingApproval?.status === "pending"
            ? "Masih ada request yang menunggu approval. Tunggu keputusan manager/owner sebelum membuat request baru."
            : !isCompleted
              ? "Hanya transaksi completed yang bisa diajukan void/refund."
              : meta.helper}
      </p>

      <form action={requestSaleVoidRefundApprovalAction} className="mt-4 space-y-3">
        <input type="hidden" name="saleId" value={saleId} />
        <input type="hidden" name="returnTo" value={returnTo} />
        <input type="hidden" name="requestType" value={meta.type} />
        <label className="block text-xs font-semibold uppercase tracking-wide text-neutral-500">
          Alasan request
        </label>
        <textarea
          name="reason"
          minLength={8}
          maxLength={1000}
          required
          disabled={disabled}
          placeholder="Contoh: customer batal membeli karena salah item / perlu refund karena kesalahan nominal."
          className="min-h-24 w-full resize-y rounded-2xl border border-[var(--border)] bg-white px-4 py-3 text-sm text-neutral-900 outline-none transition placeholder:text-neutral-400 focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-soft)] disabled:cursor-not-allowed disabled:bg-neutral-50 disabled:text-neutral-400"
        />
        <button
          type="submit"
          disabled={disabled}
          className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-neutral-950 px-4 text-sm font-semibold text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:bg-neutral-200 disabled:text-neutral-500"
        >
          {meta.icon}
          {meta.buttonLabel}
        </button>
      </form>
    </article>
  );
}

export function SaleSensitiveActionsCard({
  saleId,
  invoiceNumber,
  saleStatus,
  returnTo,
  approvals,
}: {
  saleId: string;
  invoiceNumber: string;
  saleStatus: AdminSaleStatus;
  returnTo: string;
  approvals: AdminSaleSensitiveApproval[];
}) {
  const latestVoidApproval = getLatestApproval(approvals, "void_receipt");
  const latestRefundApproval = getLatestApproval(approvals, "refund_transaction");

  return (
    <section className="min-w-0 overflow-hidden rounded-2xl border border-[var(--border)] bg-white p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <div className="grid size-10 shrink-0 place-items-center rounded-2xl bg-amber-50 text-amber-700 ring-1 ring-amber-100">
          <ShieldAlert className="size-5" />
        </div>
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-neutral-950">
            Aksi Sensitif
          </h2>
          <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
            Request void/refund untuk {invoiceNumber}. Tahap ini hanya membuat approval, belum mengubah transaksi, stok, atau kas.
          </p>
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-800">
        <div className="flex items-start gap-2">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <p>
            Setelah approval disetujui, eksekusi void/refund tetap menunggu subfase R3C-2 agar reversal stok, kas, dan audit bisa berjalan aman.
          </p>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {actionMetas.map((meta) => (
          <SensitiveActionForm
            key={meta.type}
            saleId={saleId}
            saleStatus={saleStatus}
            returnTo={returnTo}
            meta={meta}
            latestApproval={
              meta.type === "void" ? latestVoidApproval : latestRefundApproval
            }
          />
        ))}
      </div>
    </section>
  );
}
