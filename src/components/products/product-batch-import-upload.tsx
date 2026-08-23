"use client";

import {
  FileSpreadsheet,
  FolderArchive,
  LoaderCircle,
  Upload,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { PRODUCT_BATCH_IMPORT_LIMITS } from "@/features/product-batch-import/contracts";

type UploadSession = {
  id: string;
  status: "ready" | "invalid" | "completed" | "failed";
};

type UploadError = {
  code: string;
  message: string;
  existingSessionId?: string;
  existingStatus?: string;
};

function formatMegabytes(bytes: number) {
  return `${Math.round(bytes / 1024 / 1024)} MB`;
}

function isXlsx(file: File) {
  return file.name.toLocaleLowerCase("en-US").endsWith(".xlsx");
}

function getUploadErrorGuidance(error: UploadError): string[] {
  switch (error.code) {
    case "ARCHIVE_WORKBOOK_MISSING":
    case "ARCHIVE_WORKBOOK_DUPLICATE":
    case "ARCHIVE_PATH_UNSUPPORTED":
      return [
        "ZIP compatibility harus mempunyai tepat satu file .xlsx di root.",
        "Folder physical/ opsional dan hanya dipakai bila foto disimpan terpisah dari workbook.",
      ];
    case "WORKBOOK_EMBEDDED_IMAGE_LOCATION_INVALID":
    case "WORKBOOK_EMBEDDED_IMAGE_ROW_INVALID":
      return [
        "Letakkan gambar hanya pada kolom physical_image di worksheet PRODUCTS.",
        "Gunakan Image in Cell/Place in Cell atau embedded picture biasa pada row yang sama.",
      ];
    case "WORKBOOK_RICH_VALUE_IMAGE_UNSUPPORTED":
    case "WORKBOOK_RICH_VALUE_METADATA_INVALID":
    case "WORKBOOK_RICH_VALUE_STRUCTURE_INVALID":
    case "WORKBOOK_RICH_VALUE_RELATIONSHIP_INVALID":
    case "WORKBOOK_RICH_VALUE_INVALID":
    case "WORKBOOK_RICH_VALUE_UNREFERENCED":
      return [
        "Google Sheets: gunakan Insert > Image > Image in cell lalu download sebagai Microsoft Excel (.xlsx).",
        "Excel: gunakan Place in Cell atau embedded picture. Jangan gunakan IMAGE(url) atau linked image.",
      ];
    case "WORKBOOK_FORMULA_REJECTED":
      return ["Ganti formula dengan nilai biasa sebelum upload."];
    case "WORKBOOK_HYPERLINK_REJECTED":
      return ["Hapus hyperlink dari cell data dan gunakan text biasa."];
    case "DUPLICATE_FILE":
      return [
        "File dengan isi yang sama sudah pernah di-upload. Rename file tidak mengubah duplicate protection karena sistem memakai SHA-256 isi file.",
      ];
    default:
      if (error.code.startsWith("WORKBOOK_")) {
        return [
          "Gunakan template products.xlsx terbaru dengan satu worksheet PRODUCTS.",
          "Nama file boleh diubah, tetapi format harus tetap .xlsx.",
        ];
      }
      if (error.code.startsWith("IMAGE_")) {
        return ["Gunakan JPG/JPEG, PNG, atau WebP valid maksimal 5 MB per foto."];
      }
      return [];
  }
}

export function ProductBatchImportUpload() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<UploadError | null>(null);

  const canUpload = useMemo(
    () => Boolean(file && !isUploading),
    [file, isUploading],
  );
  const errorGuidance = error ? getUploadErrorGuidance(error) : [];

  async function upload() {
    if (!file || isUploading) return;
    setError(null);

    const lowerName = file.name.toLocaleLowerCase("en-US");
    if (!lowerName.endsWith(".xlsx") && !lowerName.endsWith(".zip")) {
      setError({
        code: "UPLOAD_FILE_TYPE_INVALID",
        message: "Pilih file .xlsx atau .zip.",
      });
      return;
    }

    const limit = isXlsx(file)
      ? PRODUCT_BATCH_IMPORT_LIMITS.xlsxUploadBytes
      : PRODUCT_BATCH_IMPORT_LIMITS.zipUploadBytes;
    if (file.size <= 0 || file.size > limit) {
      setError({
        code: "UPLOAD_SIZE_INVALID",
        message: `Ukuran file harus lebih dari 0 dan maksimal ${formatMegabytes(limit)}.`,
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
          "Content-Type": isXlsx(file)
            ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            : "application/zip",
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
        setError({
          code: payload?.code ?? "UPLOAD_FAILED",
          message: payload?.message ?? "Upload gagal. Periksa file dan coba lagi.",
          existingSessionId: payload?.existingSessionId,
          existingStatus: payload?.existingStatus,
        });
        return;
      }

      router.push(`/admin/produk/import/${payload.session.id}`);
      router.refresh();
    } catch (caught) {
      setError({
        code: "UPLOAD_NETWORK_ERROR",
        message:
          caught instanceof Error
            ? caught.message
            : "Upload gagal karena koneksi/request tidak dapat diselesaikan.",
      });
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <section className="rounded-3xl border border-[var(--border)] bg-white p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-emerald-50 text-emerald-700">
          <FileSpreadsheet className="size-5" />
        </div>
        <div className="min-w-0">
          <h2 className="font-semibold text-neutral-950">Upload products.xlsx</h2>
          <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
            Workflow utama cukup satu file XLSX dan satu worksheet PRODUCTS. Nama file boleh diubah, misalnya Gelang Rantai Kaki.xlsx.
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-3">
        {[
          "Isi satu row untuk satu item fisik.",
          "Foto boleh memakai Image in Cell/Place in Cell.",
          "File valid langsung diimport secara atomic dan item menjadi AVAILABLE.",
        ].map((text, index) => (
          <div
            key={text}
            className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4 text-sm leading-6 text-emerald-950"
          >
            <span className="mr-2 font-semibold">{index + 1}.</span>
            {text}
          </div>
        ))}
      </div>

      <div className="mt-4 rounded-2xl border border-sky-200 bg-sky-50 p-4">
        <p className="text-sm font-semibold text-sky-950">Google Sheets & Excel tetap didukung</p>
        <p className="mt-1 text-xs leading-5 text-sky-900">
          Google Sheets: Insert &gt; Image &gt; Image in cell, lalu File &gt; Download &gt; Microsoft Excel (.xlsx). Excel modern dapat memakai Place in Cell.
        </p>
      </div>

      <details className="mt-4 rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
        <summary className="cursor-pointer text-sm font-semibold text-neutral-900">
          Compatibility ZIP
        </summary>
        <div className="mt-3 flex items-start gap-2 text-xs leading-5 text-[var(--muted)]">
          <FolderArchive className="mt-0.5 size-4 shrink-0" />
          <p>
            ZIP tetap didukung untuk foto terpisah. Taruh tepat satu file .xlsx dengan nama bebas di root ZIP dan folder physical/ bila diperlukan.
          </p>
        </div>
      </details>

      <div className="mt-5 rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 p-4 sm:p-5">
        <input
          type="file"
          accept=".xlsx,.zip,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/zip,application/x-zip-compressed"
          className="block w-full min-w-0 text-sm text-neutral-700 file:mr-4 file:rounded-xl file:border-0 file:bg-white file:px-4 file:py-2.5 file:text-sm file:font-semibold file:text-neutral-900 file:shadow-sm"
          onChange={(event) => {
            setFile(event.currentTarget.files?.[0] ?? null);
            setError(null);
          }}
        />
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-[var(--muted)]">
          <span>Maksimal {formatMegabytes(PRODUCT_BATCH_IMPORT_LIMITS.xlsxUploadBytes)}</span>
          {file ? (
            <span className="break-all font-medium text-neutral-700">{file.name}</span>
          ) : null}
        </div>
      </div>

      <button
        type="button"
        onClick={upload}
        disabled={!canUpload}
        className="mt-4 inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-neutral-950 px-4 text-sm font-semibold text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isUploading ? (
          <LoaderCircle className="size-4 animate-spin" />
        ) : (
          <Upload className="size-4" />
        )}
        {isUploading ? "Memvalidasi & mengimport..." : "Upload & Import"}
      </button>

      {error ? (
        <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">
          <div className="flex items-start gap-2">
            <XCircle className="mt-0.5 size-4 shrink-0" />
            <div className="min-w-0">
              <p className="font-semibold">Import belum dapat diproses</p>
              <p className="mt-1 leading-6">{error.message}</p>
              {errorGuidance.length ? (
                <ul className="mt-3 list-disc space-y-1 pl-5 text-xs leading-5">
                  {errorGuidance.map((guidance) => (
                    <li key={guidance}>{guidance}</li>
                  ))}
                </ul>
              ) : null}
              {error.existingSessionId ? (
                <Link
                  href={`/admin/produk/import/${error.existingSessionId}`}
                  className="mt-3 inline-flex font-semibold underline underline-offset-4"
                >
                  Buka import existing{error.existingStatus ? ` (${error.existingStatus})` : ""}
                </Link>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
