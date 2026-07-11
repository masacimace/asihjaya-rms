import type { ReactNode } from "react";

import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  PlayCircle,
  RotateCcw,
  ShieldAlert,
  Undo2,
  XCircle,
} from "lucide-react";

import {
  executeApprovedSaleRefundAction,
  executeApprovedSaleVoidAction,
  requestSaleVoidRefundApprovalAction,
} from "@/features/sales/admin-actions";
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
    description: "Refund penuh setelah manager/owner menyetujui request.",
    helper:
      "Gunakan untuk pengembalian penuh. Semua item transaksi akan kembali tersedia dan kas cash direversal jika ada.",
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

const executionStatusLabels: Record<
  NonNullable<AdminSaleSensitiveApproval["executionStatus"]>,
  string
> = {
  awaiting_r3c_2: "Menunggu eksekusi",
  void_executed: "Void sudah dieksekusi",
  refund_executed: "Refund sudah dieksekusi",
  cancelled: "Eksekusi dibatalkan",
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
          {approval.executionStatus ? (
            <div className="mt-2 rounded-xl border border-white/80 bg-white/70 px-3 py-2 leading-5 text-neutral-700">
              <p className="font-semibold">
                {executionStatusLabels[approval.executionStatus]}
              </p>
              {approval.executedAt ? (
                <p className="mt-1 text-xs">
                  Dieksekusi oleh {approval.executedByName ?? "staff"} pada {formatDateTime(approval.executedAt)}.
                </p>
              ) : null}
            </div>
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

function ExecuteVoidForm({
  saleId,
  returnTo,
  approval,
  disabled,
}: {
  saleId: string;
  returnTo: string;
  approval: AdminSaleSensitiveApproval;
  disabled: boolean;
}) {
  const alreadyExecuted = approval.executionStatus === "void_executed";

  return (
    <form
      action={executeApprovedSaleVoidAction}
      className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4"
    >
      <input type="hidden" name="saleId" value={saleId} />
      <input type="hidden" name="approvalId" value={approval.id} />
      <input type="hidden" name="returnTo" value={returnTo} />

      <div className="flex items-start gap-3">
        <div className="grid size-10 shrink-0 place-items-center rounded-2xl bg-white text-emerald-700 ring-1 ring-emerald-100">
          <PlayCircle className="size-5" />
        </div>
        <div className="min-w-0">
          <h4 className="text-sm font-semibold text-emerald-950">
            Eksekusi Void Disetujui
          </h4>
          <p className="mt-1 text-xs leading-5 text-emerald-800">
            Approval void sudah disetujui. Eksekusi akan membatalkan transaksi penuh, mengembalikan item ke stok outlet, dan mencatat reversal kas cash bila ada.
          </p>
        </div>
      </div>

      <label className="mt-4 block text-xs font-semibold uppercase tracking-wide text-emerald-800">
        Catatan eksekusi opsional
      </label>
      <textarea
        name="executionNote"
        maxLength={1000}
        disabled={disabled || alreadyExecuted}
        placeholder="Contoh: void dieksekusi setelah approval owner karena customer batal penuh."
        className="mt-2 min-h-20 w-full resize-y rounded-2xl border border-emerald-200 bg-white px-4 py-3 text-sm text-neutral-900 outline-none transition placeholder:text-neutral-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 disabled:cursor-not-allowed disabled:bg-emerald-50 disabled:text-emerald-500"
      />
      <button
        type="submit"
        disabled={disabled || alreadyExecuted}
        className="mt-3 inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-emerald-700 px-4 text-sm font-semibold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-emerald-200 disabled:text-emerald-700"
      >
        <PlayCircle className="size-4" />
        {alreadyExecuted ? "Void sudah dieksekusi" : "Eksekusi void sekarang"}
      </button>
    </form>
  );
}

function ExecuteRefundForm({
  saleId,
  returnTo,
  approval,
  disabled,
}: {
  saleId: string;
  returnTo: string;
  approval: AdminSaleSensitiveApproval;
  disabled: boolean;
}) {
  const alreadyExecuted = approval.executionStatus === "refund_executed";

  return (
    <form
      action={executeApprovedSaleRefundAction}
      className="mt-4 rounded-2xl border border-orange-200 bg-orange-50 p-4"
    >
      <input type="hidden" name="saleId" value={saleId} />
      <input type="hidden" name="approvalId" value={approval.id} />
      <input type="hidden" name="returnTo" value={returnTo} />

      <div className="flex items-start gap-3">
        <div className="grid size-10 shrink-0 place-items-center rounded-2xl bg-white text-orange-700 ring-1 ring-orange-100">
          <PlayCircle className="size-5" />
        </div>
        <div className="min-w-0">
          <h4 className="text-sm font-semibold text-orange-950">
            Eksekusi Refund Penuh Disetujui
          </h4>
          <p className="mt-1 text-xs leading-5 text-orange-800">
            Approval refund sudah disetujui. Eksekusi akan mengubah transaksi menjadi refunded, mengembalikan semua item ke stok outlet, dan mencatat refund kas cash bila ada.
          </p>
        </div>
      </div>

      <label className="mt-4 block text-xs font-semibold uppercase tracking-wide text-orange-800">
        Catatan eksekusi opsional
      </label>
      <textarea
        name="executionNote"
        maxLength={1000}
        disabled={disabled || alreadyExecuted}
        placeholder="Contoh: refund penuh dieksekusi setelah barang diterima kembali dari customer."
        className="mt-2 min-h-20 w-full resize-y rounded-2xl border border-orange-200 bg-white px-4 py-3 text-sm text-neutral-900 outline-none transition placeholder:text-neutral-400 focus:border-orange-500 focus:ring-2 focus:ring-orange-100 disabled:cursor-not-allowed disabled:bg-orange-50 disabled:text-orange-500"
      />
      <button
        type="submit"
        disabled={disabled || alreadyExecuted}
        className="mt-3 inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-orange-600 px-4 text-sm font-semibold text-white transition hover:bg-orange-700 disabled:cursor-not-allowed disabled:bg-orange-200 disabled:text-orange-700"
      >
        <PlayCircle className="size-4" />
        {alreadyExecuted ? "Refund sudah dieksekusi" : "Eksekusi refund penuh sekarang"}
      </button>
    </form>
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
  const hasExecutableVoidApproval =
    meta.type === "void" &&
    latestApproval?.status === "approved" &&
    latestApproval.executionStatus !== "void_executed" &&
    isCompleted;
  const hasExecutableRefundApproval =
    meta.type === "refund" &&
    latestApproval?.status === "approved" &&
    latestApproval.executionStatus !== "refund_executed" &&
    isCompleted;
  const disabled = !isCompleted || Boolean(blockingApproval);
  const requestFormDisabled =
    disabled || hasExecutableVoidApproval || hasExecutableRefundApproval;

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
        {blockingApproval?.status === "approved" && meta.type === "void"
          ? latestApproval?.executionStatus === "void_executed"
            ? "Void sudah dieksekusi. Transaksi, stok, kas cash, dan audit sudah diperbarui."
            : "Approval void sudah disetujui. Gunakan tombol eksekusi di bawah untuk membatalkan transaksi penuh."
          : blockingApproval?.status === "approved" && meta.type === "refund"
            ? latestApproval?.executionStatus === "refund_executed"
              ? "Refund penuh sudah dieksekusi. Transaksi, stok, kas cash, dan audit sudah diperbarui."
              : "Approval refund sudah disetujui. Gunakan tombol eksekusi di bawah untuk memproses refund penuh."
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
          disabled={requestFormDisabled}
          placeholder="Contoh: customer batal membeli karena salah item / perlu refund karena kesalahan nominal."
          className="min-h-24 w-full resize-y rounded-2xl border border-[var(--border)] bg-white px-4 py-3 text-sm text-neutral-900 outline-none transition placeholder:text-neutral-400 focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-soft)] disabled:cursor-not-allowed disabled:bg-neutral-50 disabled:text-neutral-400"
        />
        <button
          type="submit"
          disabled={requestFormDisabled}
          className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-neutral-950 px-4 text-sm font-semibold text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:bg-neutral-200 disabled:text-neutral-500"
        >
          {meta.icon}
          {meta.buttonLabel}
        </button>
      </form>

      {hasExecutableVoidApproval && latestApproval ? (
        <ExecuteVoidForm
          saleId={saleId}
          returnTo={returnTo}
          approval={latestApproval}
          disabled={!isCompleted}
        />
      ) : null}

      {hasExecutableRefundApproval && latestApproval ? (
        <ExecuteRefundForm
          saleId={saleId}
          returnTo={returnTo}
          approval={latestApproval}
          disabled={!isCompleted}
        />
      ) : null}
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
            Request dan eksekusi void/refund untuk {invoiceNumber}. Eksekusi hanya tersedia setelah approval manager/owner disetujui.
          </p>
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-800">
        <div className="flex items-start gap-2">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <p>
            Aksi void dan refund penuh hanya dapat dijalankan setelah approval disetujui. Gunakan fitur ini untuk nota bermasalah, transaksi batal penuh, atau pengembalian penuh customer.
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
