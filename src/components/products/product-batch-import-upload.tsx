"use client";

import { AlertCircle, CheckCircle2, FolderArchive, LoaderCircle, XCircle } from "lucide-react";
import { useActionState, useMemo, useRef, useState } from "react";

import {
  cancelProductBatchImportSessionAction,
  type ProductBatchImportCancelActionState,
} from "@/app/actions/product-batch-import";
import { PRODUCT_BATCH_IMPORT_LIMITS } from "@/features/product-batch-import/contracts";

const initialCancelState: ProductBatchImportCancelActionState = {
  status: "idle",
};

type UploadSession = {
  id: string;
  status: "ready" | "invalid";
  fileName: string;
  fileSha256: string;
  totalMasterRows: number;
  totalItemRows: number;
  validMasterRows: number;
  validItemRows: number;
  invalidRows: number;
  warningCount: number;
  expiresAt: string;
};

type UploadResult =
  | { kind: "success"; message: string; session: UploadSession }
  | {
      kind: "error";
      code: string;
      message: string;
      existingSessionId?: string;
      existingStatus?: string;
    };

function formatMegabytes(bytes: number) {
  return `${Math.round(bytes / 1024 / 1024)} MB`;
}

export function ProductBatchImportUpload() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [cancelState, cancelAction, isCancelling] = useActionState(
    cancelProductBatchImportSessionAction,
    initialCancelState,
  );

  const canUpload = useMemo(
    () => Boolean(file && !isUploading && !isCancelling),
    [file, isUploading, isCancelling],
  );

  async function upload() {
    if (!file || isUploading) return;
    setResult(null);

    if (!file.name.toLocaleLowerCase("en-US").endsWith(".zip")) {
      setResult({
        kind: "error",
        code: "UPLOAD_FILE_TYPE_INVALID",
        message: "Pilih satu file ZIP Product Batch Import.",
      });
      return;
    }
    if (
      file.size <= 0 ||
      file.size > PRODUCT_BATCH_IMPORT_LIMITS.zipUploadBytes
    ) {
      setResult({
        kind: "error",
        code: "UPLOAD_SIZE_INVALID",
        message: `Ukuran ZIP harus lebih dari 0 dan maksimal ${formatMegabytes(PRODUCT_BATCH_IMPORT_LIMITS.zipUploadBytes)}.`,
      });
      return;
    }

    setIsUploading(true);
    try {
      const response = await fetch("/api/admin/product-batch-import/upload", {
        method: "POST",
        body: file,
        credentials: "same-origin",
        cache: "no-store",
        headers: {
          "Content-Type": "application/zip",
          "X-Product-Batch-File-Name": encodeURIComponent(file.name),
        },
      });
      const payload = (await response.json().catch(() => null)) as
        | {
            code?: string;
            message?: string;
            session?: UploadSession;
            existingSessionId?: string;
            existingStatus?: string;
          }
        | null;

      if (!response.ok || !payload?.session) {
        setResult({
          kind: "error",
          code: payload?.code ?? "UPLOAD_FAILED",
          message:
            payload?.message ?? "Upload gagal. Periksa file ZIP dan coba lagi.",
          existingSessionId: payload?.existingSessionId,
          existingStatus: payload?.existingStatus,
        });
        return;
      }

      setResult({
        kind: "success",
        message: payload.message ?? "Upload staging selesai.",
        session: payload.session,
      });
    } catch (error) {
      setResult({
        kind: "error",
        code: "UPLOAD_NETWORK_ERROR",
        message:
          error instanceof Error
            ? error.message
            : "Upload gagal karena koneksi/request tidak dapat diselesaikan.",
      });
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <section className="rounded-3xl border border-[var(--border)] bg-white p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent)]">
          <FolderArchive className="size-5" />
        </div>
        <div className="min-w-0">
          <h2 className="font-semibold text-neutral-950">Upload ZIP ke staging</h2>
          <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
            File akan diperiksa keamanan ZIP/XLSX, image, category, outlet,
            permission, dan business rule. Tahap ini belum membuat Product Master
            atau Product Item nyata.
          </p>
        </div>
      </div>

      <div className="mt-5 rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 p-4 sm:p-5">
        <input
          ref={inputRef}
          type="file"
          accept=".zip,application/zip,application/x-zip-compressed"
          className="block w-full min-w-0 text-sm text-neutral-700 file:mr-4 file:rounded-xl file:border-0 file:bg-white file:px-4 file:py-2.5 file:text-sm file:font-semibold file:text-neutral-900 file:shadow-sm"
          onChange={(event) => {
            setFile(event.currentTarget.files?.[0] ?? null);
            setResult(null);
          }}
        />
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-[var(--muted)]">
          <span>Maksimal {formatMegabytes(PRODUCT_BATCH_IMPORT_LIMITS.zipUploadBytes)}</span>
          {file ? (
            <span className="break-all font-medium text-neutral-700">
              {file.name} · {(file.size / 1024 / 1024).toFixed(2)} MB
            </span>
          ) : null}
        </div>
      </div>

      <button
        type="button"
        disabled={!canUpload}
        onClick={() => void upload()}
        className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-neutral-950 px-4 text-sm font-semibold text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
      >
        {isUploading ? (
          <LoaderCircle className="size-4 animate-spin" />
        ) : (
          <FolderArchive className="size-4" />
        )}
        {isUploading ? "Memvalidasi dan staging..." : "Upload & validasi ZIP"}
      </button>

      {result?.kind === "error" ? (
        <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">
          <div className="flex items-start gap-2">
            <XCircle className="mt-0.5 size-4 shrink-0" />
            <div className="min-w-0">
              <p className="font-semibold">Upload belum dapat diproses</p>
              <p className="mt-1 leading-6">{result.message}</p>
              <p className="mt-2 text-xs font-medium">Kode: {result.code}</p>
              {result.existingSessionId ? (
                <p className="mt-1 break-all text-xs">
                  Existing session: {result.existingSessionId} ({result.existingStatus ?? "unknown"})
                </p>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {result?.kind === "success" ? (
        <div
          className={`mt-5 rounded-2xl border p-4 text-sm ${
            result.session.status === "ready"
              ? "border-emerald-200 bg-emerald-50 text-emerald-950"
              : "border-amber-200 bg-amber-50 text-amber-950"
          }`}
        >
          <div className="flex items-start gap-2">
            {result.session.status === "ready" ? (
              <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
            ) : (
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
            )}
            <div className="min-w-0 flex-1">
              <p className="font-semibold">
                Session {result.session.status === "ready" ? "siap" : "invalid"}
              </p>
              <p className="mt-1 leading-6">{result.message}</p>
              <dl className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                <div><dt className="text-xs opacity-70">Master</dt><dd className="font-semibold">{result.session.validMasterRows}/{result.session.totalMasterRows} valid</dd></div>
                <div><dt className="text-xs opacity-70">Item</dt><dd className="font-semibold">{result.session.validItemRows}/{result.session.totalItemRows} valid</dd></div>
                <div><dt className="text-xs opacity-70">Invalid rows</dt><dd className="font-semibold">{result.session.invalidRows}</dd></div>
                <div><dt className="text-xs opacity-70">Warnings</dt><dd className="font-semibold">{result.session.warningCount}</dd></div>
              </dl>
              <p className="mt-3 break-all text-xs opacity-75">
                Session ID: {result.session.id}
              </p>
              <p className="mt-1 text-xs opacity-75">
                Preview detail akan diaktifkan pada 2B.5. Staging ini otomatis
                kedaluwarsa setelah masa staging berakhir bila belum diproses.
              </p>

              <form action={cancelAction} className="mt-4">
                <input type="hidden" name="sessionId" value={result.session.id} />
                <button
                  type="submit"
                  disabled={
                    isCancelling ||
                    (cancelState.status === "success" &&
                      cancelState.sessionId === result.session.id)
                  }
                  className="inline-flex h-9 items-center justify-center rounded-xl border border-current/20 bg-white/70 px-3 text-xs font-semibold transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isCancelling ? "Membatalkan..." : "Batalkan staging ini"}
                </button>
              </form>
              {cancelState.message &&
              cancelState.sessionId === result.session.id ? (
                <p className="mt-2 text-xs font-medium">{cancelState.message}</p>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
