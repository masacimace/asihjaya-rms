"use client";

import { AlertTriangle, LoaderCircle, XCircle } from "lucide-react";
import { useActionState } from "react";

import {
  cancelProductBatchImportSessionAction,
  type ProductBatchImportCancelActionState,
} from "@/app/actions/product-batch-import";

const initialState: ProductBatchImportCancelActionState = { status: "idle" };

export function ProductBatchImportSessionActions({
  sessionId,
  status,
  invalidRows,
}: {
  sessionId: string;
  status: string;
  invalidRows: number;
}) {
  const [cancelState, cancelAction, isCancelling] = useActionState(
    cancelProductBatchImportSessionAction,
    initialState,
  );
  const cancellable = ["uploaded", "validating", "invalid", "ready", "failed"].includes(status);
  const readyForCommit = status === "ready" && invalidRows === 0;

  return (
    <div className="space-y-3">
      <button
        type="button"
        disabled
        title={
          readyForCommit
            ? "Atomic commit akan diaktifkan pada tahap 2B.6."
            : "Commit hanya tersedia untuk session ready tanpa validation error."
        }
        className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-neutral-950 px-4 text-sm font-semibold text-white opacity-50 disabled:cursor-not-allowed"
      >
        {readyForCommit ? "Commit import — aktif di 2B.6" : "Commit import belum tersedia"}
      </button>

      {!readyForCommit ? (
        <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <span>
            Session harus berstatus <strong>ready</strong> dan tidak mempunyai invalid row sebelum commit dapat dijalankan.
          </span>
        </div>
      ) : (
        <p className="text-xs leading-5 text-[var(--muted)]">
          Data sudah lolos preview. Tahap 2B.6 akan mengaktifkan atomic commit, identifier allocation, dan compensating media cleanup.
        </p>
      )}

      {cancellable ? (
        <form action={cancelAction}>
          <input type="hidden" name="sessionId" value={sessionId} />
          <button
            type="submit"
            disabled={isCancelling || cancelState.status === "success"}
            className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-red-200 bg-white px-4 text-sm font-semibold text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isCancelling ? <LoaderCircle className="size-4 animate-spin" /> : <XCircle className="size-4" />}
            {isCancelling ? "Membatalkan..." : "Batalkan staging"}
          </button>
        </form>
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
    </div>
  );
}
