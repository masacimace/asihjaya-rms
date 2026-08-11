"use client";

import {
  AlertTriangle,
  CheckCircle2,
  LoaderCircle,
  ShieldCheck,
  X,
  XCircle,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";

import {
  cancelProductBatchImportSessionAction,
  commitProductBatchImportSessionAction,
  type ProductBatchImportCancelActionState,
  type ProductBatchImportCommitActionState,
} from "@/app/actions/product-batch-import";

const initialCancelState: ProductBatchImportCancelActionState = {
  status: "idle",
};
const initialCommitState: ProductBatchImportCommitActionState = {
  status: "idle",
};

export function ProductBatchImportSessionActions({
  sessionId,
  status,
  invalidRows,
  totalMasterRows,
  totalItemRows,
  availableItemCount,
  draftItemCount,
}: {
  sessionId: string;
  status: string;
  invalidRows: number;
  totalMasterRows: number;
  totalItemRows: number;
  availableItemCount: number;
  draftItemCount: number;
}) {
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);
  const [commitState, commitAction, isCommitting] = useActionState(
    commitProductBatchImportSessionAction,
    initialCommitState,
  );
  const [cancelState, cancelAction, isCancelling] = useActionState(
    cancelProductBatchImportSessionAction,
    initialCancelState,
  );

  const cancellable = [
    "uploaded",
    "validating",
    "invalid",
    "ready",
    "failed",
  ].includes(status);
  const readyForCommit = status === "ready" && invalidRows === 0;
  const completed = status === "completed";

  useEffect(() => {
    if (commitState.status === "success") {
      router.refresh();
    }
  }, [commitState.status, router]);

  return (
    <div className="space-y-3">
      {completed ? (
        <div className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs leading-5 text-emerald-900">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
          <span>
            Session sudah selesai di-commit. Data bisnis tidak akan dibuat ulang
            dari session ini.
          </span>
        </div>
      ) : (
        <button
          type="button"
          disabled={!readyForCommit || isCommitting}
          onClick={() => setConfirmOpen(true)}
          title={
            readyForCommit
              ? "Review konfirmasi sebelum atomic commit."
              : "Commit hanya tersedia untuk session ready tanpa validation error."
          }
          className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-neutral-950 px-4 text-sm font-semibold text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isCommitting ? (
            <LoaderCircle className="size-4 animate-spin" />
          ) : (
            <ShieldCheck className="size-4" />
          )}
          {isCommitting
            ? "Meng-commit batch..."
            : readyForCommit
              ? "Commit import"
              : "Commit import belum tersedia"}
        </button>
      )}

      {!completed && !readyForCommit ? (
        <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <span>
            Session harus berstatus <strong>ready</strong> dan tidak mempunyai
            invalid row sebelum commit dapat dijalankan.
          </span>
        </div>
      ) : null}

      {cancellable ? (
        <form action={cancelAction}>
          <input type="hidden" name="sessionId" value={sessionId} />
          <button
            type="submit"
            disabled={isCancelling || cancelState.status === "success" || isCommitting}
            className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-red-200 bg-white px-4 text-sm font-semibold text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isCancelling ? (
              <LoaderCircle className="size-4 animate-spin" />
            ) : (
              <XCircle className="size-4" />
            )}
            {isCancelling ? "Membatalkan..." : "Batalkan staging"}
          </button>
        </form>
      ) : null}

      {commitState.message ? (
        <p
          className={`rounded-xl border p-3 text-xs font-medium leading-5 ${
            commitState.status === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-red-200 bg-red-50 text-red-800"
          }`}
        >
          {commitState.message}
        </p>
      ) : null}

      {cancelState.message ? (
        <p
          className={`rounded-xl border p-3 text-xs font-medium leading-5 ${
            cancelState.status === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-red-200 bg-red-50 text-red-800"
          }`}
        >
          {cancelState.message}
        </p>
      ) : null}

      {confirmOpen && readyForCommit ? (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/45 p-4"
          role="presentation"
          onMouseDown={(event) => {
            if (event.currentTarget === event.target && !isCommitting) {
              setConfirmOpen(false);
              setAcknowledged(false);
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="product-batch-commit-title"
            className="w-full max-w-lg rounded-3xl bg-white p-5 shadow-2xl sm:p-6"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
                  Konfirmasi final
                </p>
                <h2
                  id="product-batch-commit-title"
                  className="mt-1 text-xl font-semibold text-neutral-950"
                >
                  Commit Product Batch Import?
                </h2>
              </div>
              <button
                type="button"
                onClick={() => {
                  setConfirmOpen(false);
                  setAcknowledged(false);
                }}
                disabled={isCommitting}
                aria-label="Tutup konfirmasi"
                className="grid size-9 shrink-0 place-items-center rounded-xl text-neutral-500 transition hover:bg-neutral-100 disabled:opacity-50"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-2 text-sm">
              <div className="rounded-xl bg-neutral-50 p-3">
                <p className="text-xs text-[var(--muted)]">Product Master</p>
                <p className="mt-1 font-semibold">{totalMasterRows}</p>
              </div>
              <div className="rounded-xl bg-neutral-50 p-3">
                <p className="text-xs text-[var(--muted)]">Product Item / barcode</p>
                <p className="mt-1 font-semibold">{totalItemRows}</p>
              </div>
              <div className="rounded-xl bg-neutral-50 p-3">
                <p className="text-xs text-[var(--muted)]">Available</p>
                <p className="mt-1 font-semibold">{availableItemCount}</p>
              </div>
              <div className="rounded-xl bg-neutral-50 p-3">
                <p className="text-xs text-[var(--muted)]">Draft</p>
                <p className="mt-1 font-semibold">{draftItemCount}</p>
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs leading-5 text-amber-950">
              <p>
                Server akan mengalokasikan Product Master code, SKU, barcode,
                dan QR baru hanya saat commit ini. Commit menggunakan transaksi
                database all-or-nothing.
              </p>
              <p className="mt-2">
                Data yang sudah berhasil di-commit adalah data bisnis nyata.
                Rollback aplikasi tidak otomatis menghapus produk hasil import.
              </p>
            </div>

            {commitState.status === "error" && commitState.message ? (
              <p className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-medium leading-5 text-red-800">
                {commitState.message}
              </p>
            ) : null}

            <form action={commitAction} className="mt-5 space-y-4">
              <input type="hidden" name="sessionId" value={sessionId} />
              <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-neutral-200 p-3 text-sm leading-5 text-neutral-800">
                <input
                  type="checkbox"
                  name="confirmCommit"
                  value="yes"
                  checked={acknowledged}
                  onChange={(event) => setAcknowledged(event.target.checked)}
                  className="mt-1 size-4"
                />
                <span>
                  Saya sudah memeriksa preview dan memahami bahwa commit ini
                  membuat Product Master/Product Item nyata beserta identifier
                  dan inventory movement yang diperlukan.
                </span>
              </label>

              <div className="grid gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  disabled={isCommitting}
                  onClick={() => {
                    setConfirmOpen(false);
                    setAcknowledged(false);
                  }}
                  className="h-11 rounded-xl border border-neutral-200 bg-white px-4 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-50 disabled:opacity-50"
                >
                  Kembali review
                </button>
                <button
                  type="submit"
                  disabled={!acknowledged || isCommitting}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-neutral-950 px-4 text-sm font-semibold text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isCommitting ? (
                    <LoaderCircle className="size-4 animate-spin" />
                  ) : (
                    <ShieldCheck className="size-4" />
                  )}
                  {isCommitting ? "Meng-commit..." : "Ya, commit sekarang"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
