"use client";

import { FolderArchive, LoaderCircle, XCircle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";

import {
  PRODUCT_BATCH_IMPORT_ARCHIVE_LAYOUT,
  PRODUCT_BATCH_IMPORT_LIMITS,
} from "@/features/product-batch-import/contracts";

type UploadSession = {
  id: string;
  status: "ready" | "invalid";
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

function getUploadErrorGuidance(error: UploadError): string[] {
  switch (error.code) {
    case "ARCHIVE_PATH_UNSUPPORTED":
    case "ARCHIVE_WORKBOOK_MISSING":
    case "ARCHIVE_WORKBOOK_DUPLICATE":
      return [
        `Buka folder batch Anda, lalu pilih ${PRODUCT_BATCH_IMPORT_ARCHIVE_LAYOUT.workbookPath}, ${PRODUCT_BATCH_IMPORT_ARCHIVE_LAYOUT.masterDirectory}, dan ${PRODUCT_BATCH_IMPORT_ARCHIVE_LAYOUT.physicalDirectory} untuk dibuat menjadi ZIP.`,
        "Jangan compress folder induk batch. Ketiga entry tersebut harus langsung terlihat saat ZIP dibuka.",
      ];
    case "WORKBOOK_MACRO_REJECTED":
      return [
        "Pastikan workbook berformat Microsoft Excel (.xlsx), bukan .xls, .xlsm, .ods, atau format lain.",
        "Jika memakai Google Sheets, pilih File > Download > Microsoft Excel (.xlsx), lalu beri nama file products.xlsx.",
      ];
    case "WORKBOOK_ACTIVE_CONTENT_REJECTED":
      return [
        "Hapus gambar yang ditempel langsung ke workbook, object embedded, atau external content dari spreadsheet.",
        `Foto produk harus disimpan sebagai file terpisah di folder ${PRODUCT_BATCH_IMPORT_ARCHIVE_LAYOUT.masterDirectory} atau ${PRODUCT_BATCH_IMPORT_ARCHIVE_LAYOUT.physicalDirectory} di dalam ZIP.`,
      ];
    case "WORKBOOK_FORMULA_REJECTED":
      return [
        "Ganti cell formula dengan nilai biasa. Bila perlu copy hasilnya lalu Paste special > Values only.",
      ];
    case "WORKBOOK_HYPERLINK_REJECTED":
      return [
        "Hapus hyperlink dari cell data. Kolom image hanya berisi nama file seperti MASTER-001.jpg atau ITEM-001.jpg.",
      ];
    case "IMAGE_REFERENCE_MISSING":
      return [
        `Cocokkan nama pada primary_image dengan file di ${PRODUCT_BATCH_IMPORT_ARCHIVE_LAYOUT.masterDirectory} dan physical_image dengan file di ${PRODUCT_BATCH_IMPORT_ARCHIVE_LAYOUT.physicalDirectory}.`,
        "Nama file dibandingkan case-insensitive, tetapi extension dan nama file tetap harus menunjuk file yang benar.",
      ];
    case "IMAGE_MIME_MISMATCH":
    case "IMAGE_DECODE_FAILED":
      return [
        "Gunakan file JPG/JPEG, PNG, atau WebP yang dapat dibuka normal sebagai gambar.",
        "Jangan hanya mengganti extension file; bytes gambar harus sesuai dengan formatnya.",
      ];
    case "ARCHIVE_IMAGE_DUPLICATE_NORMALIZED":
      return [
        "Pastikan setiap nama image unik. Contoh MASTER-001.JPG dan master-001.jpg dianggap nama yang sama.",
      ];
    case "DUPLICATE_FILE":
      return [
        "File yang sama sudah pernah di-upload untuk organization ini. Buka session existing untuk melanjutkan review.",
      ];
    default:
      if (error.code.startsWith("ZIP_") || error.code.startsWith("ARCHIVE_")) {
        return [
          `Buat ulang ZIP dari ${PRODUCT_BATCH_IMPORT_ARCHIVE_LAYOUT.workbookPath}, ${PRODUCT_BATCH_IMPORT_ARCHIVE_LAYOUT.masterDirectory}, dan ${PRODUCT_BATCH_IMPORT_ARCHIVE_LAYOUT.physicalDirectory} yang berada langsung di root paket.`,
          "Jika error tetap muncul, buat ZIP baru daripada mengedit archive yang lama.",
        ];
      }
      if (error.code.startsWith("WORKBOOK_")) {
        return [
          "Mulai dari template resmi terbaru dan simpan/download sebagai Microsoft Excel (.xlsx).",
          "Gunakan nilai biasa tanpa formula, hyperlink, gambar embedded, macro, atau worksheet tambahan.",
        ];
      }
      if (error.code.startsWith("IMAGE_")) {
        return [
          "Periksa nama file image pada workbook dan pastikan file JPG/JPEG, PNG, atau WebP tersedia di folder yang sesuai.",
        ];
      }
      return [];
  }
}

export function ProductBatchImportUpload() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
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

    if (!file.name.toLocaleLowerCase("en-US").endsWith(".zip")) {
      setError({
        code: "UPLOAD_FILE_TYPE_INVALID",
        message: "Pilih satu file ZIP Product Batch Import.",
      });
      return;
    }
    if (file.size <= 0 || file.size > PRODUCT_BATCH_IMPORT_LIMITS.zipUploadBytes) {
      setError({
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
        setError({
          code: payload?.code ?? "UPLOAD_FAILED",
          message: payload?.message ?? "Upload gagal. Periksa file ZIP dan coba lagi.",
          existingSessionId: payload?.existingSessionId,
          existingStatus: payload?.existingStatus,
        });
        return;
      }

      router.push(`/admin/produk/import/${payload.session.id}`);
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
        <div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent)]">
          <FolderArchive className="size-5" />
        </div>
        <div className="min-w-0">
          <h2 className="font-semibold text-neutral-950">Upload ZIP ke staging</h2>
          <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
            Setelah validasi selesai Anda langsung diarahkan ke preview session. Preview disimpan di database staging, sehingga refresh browser tidak menghilangkan hasil review.
          </p>
        </div>
      </div>

      <div className="mt-5 grid min-w-0 gap-4 lg:grid-cols-2">
        <div className="min-w-0 rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
          <p className="text-sm font-semibold text-neutral-950">Struktur ZIP yang benar</p>
          <pre className="mt-3 overflow-x-auto rounded-xl bg-white p-3 text-xs leading-6 text-neutral-700">{`produk.zip
├── ${PRODUCT_BATCH_IMPORT_ARCHIVE_LAYOUT.workbookPath}
├── ${PRODUCT_BATCH_IMPORT_ARCHIVE_LAYOUT.masterDirectory}
│   ├── MASTER-001.jpg
│   └── MASTER-002.webp
└── ${PRODUCT_BATCH_IMPORT_ARCHIVE_LAYOUT.physicalDirectory}
    └── ITEM-001.jpg`}</pre>
          <p className="mt-3 text-xs leading-5 text-[var(--muted)]">
            Compress isi folder batch, bukan folder induknya. Folder {PRODUCT_BATCH_IMPORT_ARCHIVE_LAYOUT.physicalDirectory} boleh kosong atau tidak ada bila semua item memakai foto master.
          </p>
        </div>

        <div className="min-w-0 rounded-2xl border border-sky-200 bg-sky-50 p-4">
          <p className="text-sm font-semibold text-sky-950">Boleh mengisi lewat Google Sheets</p>
          <ol className="mt-3 space-y-2 pl-5 text-xs leading-5 text-sky-900 marker:font-semibold">
            <li>Upload atau buka template resmi di Google Sheets, lalu isi data bisnisnya.</li>
            <li>Download kembali melalui File &gt; Download &gt; Microsoft Excel (.xlsx).</li>
            <li>Pastikan nama workbook menjadi {PRODUCT_BATCH_IMPORT_ARCHIVE_LAYOUT.workbookPath} sebelum membuat ZIP.</li>
            <li>Foto tetap berupa file di {PRODUCT_BATCH_IMPORT_ARCHIVE_LAYOUT.masterDirectory} atau {PRODUCT_BATCH_IMPORT_ARCHIVE_LAYOUT.physicalDirectory}; jangan ditempel ke cell.</li>
          </ol>
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
            setError(null);
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
        {isUploading ? <LoaderCircle className="size-4 animate-spin" /> : <FolderArchive className="size-4" />}
        {isUploading ? "Memvalidasi dan staging..." : "Upload & validasi ZIP"}
      </button>

      {error ? (
        <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">
          <div className="flex items-start gap-2">
            <XCircle className="mt-0.5 size-4 shrink-0" />
            <div className="min-w-0">
              <p className="font-semibold">Upload belum dapat diproses</p>
              <p className="mt-1 leading-6">{error.message}</p>
              {errorGuidance.length ? (
                <div className="mt-3 rounded-xl border border-red-200 bg-white/70 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-red-800">Cara memperbaiki</p>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-xs leading-5 text-red-900">
                    {errorGuidance.map((guidance) => (
                      <li key={guidance}>{guidance}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {error.existingSessionId ? (
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <span className="break-all text-xs">
                    Session existing: {error.existingSessionId} ({error.existingStatus ?? "unknown"})
                  </span>
                  <Link
                    href={`/admin/produk/import/${error.existingSessionId}`}
                    className="inline-flex h-8 items-center rounded-lg border border-red-200 bg-white px-3 text-xs font-semibold text-red-800"
                  >
                    Buka session existing
                  </Link>
                </div>
              ) : null}
              <details className="mt-3 text-xs text-red-800">
                <summary className="cursor-pointer font-medium">Detail teknis</summary>
                <p className="mt-1 break-all">Kode: {error.code}</p>
              </details>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
