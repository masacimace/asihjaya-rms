"use client";

import { FileSpreadsheet, FolderArchive, LoaderCircle, XCircle } from "lucide-react";
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

function isXlsx(file: File) {
  return file.name.toLocaleLowerCase("en-US").endsWith(".xlsx");
}

function getUploadErrorGuidance(error: UploadError): string[] {
  switch (error.code) {
    case "ARCHIVE_PATH_UNSUPPORTED":
    case "ARCHIVE_WORKBOOK_MISSING":
    case "ARCHIVE_WORKBOOK_DUPLICATE":
      return [
        `Untuk metode ZIP, pilih ${PRODUCT_BATCH_IMPORT_ARCHIVE_LAYOUT.workbookPath}, ${PRODUCT_BATCH_IMPORT_ARCHIVE_LAYOUT.masterDirectory}, dan ${PRODUCT_BATCH_IMPORT_ARCHIVE_LAYOUT.physicalDirectory} lalu compress isi foldernya.`,
        "Jangan compress folder induk batch. Ketiga entry tersebut harus langsung terlihat saat ZIP dibuka.",
      ];
    case "WORKBOOK_MACRO_REJECTED":
      return [
        "Pastikan workbook berformat Microsoft Excel (.xlsx), bukan .xls, .xlsm, .ods, atau format lain.",
        "Jika memakai Google Sheets, pilih File > Download > Microsoft Excel (.xlsx).",
      ];
    case "WORKBOOK_EMBEDDED_IMAGE_TEXT_CONFLICT":
      return [
        "Untuk metode single XLSX, cell primary_image/physical_image harus kosong bila row memakai gambar embedded.",
        "Jangan menulis nama file sekaligus menempel gambar pada image cell yang sama.",
      ];
    case "WORKBOOK_EMBEDDED_IMAGE_LOCATION_INVALID":
    case "WORKBOOK_EMBEDDED_IMAGE_ROW_INVALID":
      return [
        "Letakkan tepat satu gambar pada cell primary_image di PRODUCT_MASTERS atau physical_image di PHYSICAL_PRODUCTS pada row yang sesuai.",
        "Jangan menaruh gambar di kolom lain, worksheet lain, atau row kosong.",
      ];
    case "WORKBOOK_EMBEDDED_IMAGE_DUPLICATE":
    case "WORKBOOK_EMBEDDED_IMAGE_REUSED":
      return [
        "Setiap image cell hanya boleh mempunyai satu gambar embedded dan satu media tidak boleh dipakai ulang untuk row lain.",
        "Copy/paste gambar sebagai picture baru pada row lain bila memang membutuhkan gambar visual yang sama.",
      ];
    case "WORKBOOK_DRAWING_UNSUPPORTED":
    case "WORKBOOK_EMBEDDED_IMAGE_UNREFERENCED":
      return [
        "Gunakan local Picture in Cell pada image cell yang sesuai (direkomendasikan), atau standard picture over cells yang di-anchor tepat pada cell tersebut.",
        "Jangan gunakan linked image, chart, shape, object, atau IMAGE() formula berbasis URL.",
      ];
    case "WORKBOOK_RICH_VALUE_IMAGE_UNSUPPORTED":
    case "WORKBOOK_RICH_VALUE_METADATA_INVALID":
    case "WORKBOOK_RICH_VALUE_STRUCTURE_INVALID":
    case "WORKBOOK_RICH_VALUE_RELATIONSHIP_INVALID":
    case "WORKBOOK_RICH_VALUE_INVALID":
    case "WORKBOOK_RICH_VALUE_UNREFERENCED":
      return [
        "Gunakan local image yang benar-benar di-embed: Google Sheets > Insert image in cell atau Microsoft Excel modern > Place in Cell.",
        "Jangan gunakan IMAGE(url), web image, linked/external image, data type/rich-data lain, atau copy-paste object non-image.",
      ];
    case "WORKBOOK_EMBEDDED_IMAGE_FORMAT_UNSUPPORTED":
      return ["Gunakan embedded image JPG/JPEG, PNG, atau WebP maksimal 5 MB per gambar."];
    case "WORKBOOK_ACTIVE_CONTENT_REJECTED":
      return [
        "Workbook tidak boleh mengandung macro, ActiveX, OLE, external relationship, linked image, atau active content lain.",
        "Local Picture in Cell atau gambar biasa yang embedded pada kolom primary_image/physical_image diperbolehkan hanya ketika file .xlsx di-upload langsung.",
      ];
    case "WORKBOOK_FORMULA_REJECTED":
      return ["Ganti cell formula dengan nilai biasa. Bila perlu copy hasilnya lalu Paste special > Values only."];
    case "WORKBOOK_HYPERLINK_REJECTED":
      return ["Hapus hyperlink dari cell data. Gunakan nilai text biasa."];
    case "IMAGE_REFERENCE_MISSING":
      return [
        `Metode ZIP: cocokkan primary_image dengan file di ${PRODUCT_BATCH_IMPORT_ARCHIVE_LAYOUT.masterDirectory} dan physical_image dengan file di ${PRODUCT_BATCH_IMPORT_ARCHIVE_LAYOUT.physicalDirectory}.`,
        "Metode single XLSX: kosongkan text pada image cell lalu gunakan Picture in Cell (direkomendasikan) atau embedded picture over cells tepat pada row tersebut.",
      ];
    case "IMAGE_MIME_MISMATCH":
    case "IMAGE_DECODE_FAILED":
      return [
        "Gunakan JPG/JPEG, PNG, atau WebP yang dapat dibuka normal sebagai gambar.",
        "Jangan hanya mengganti extension file; bytes gambar harus sesuai dengan formatnya.",
      ];
    case "ARCHIVE_IMAGE_DUPLICATE_NORMALIZED":
      return ["Pastikan setiap nama image ZIP unik. MASTER-001.JPG dan master-001.jpg dianggap nama yang sama."];
    case "DUPLICATE_FILE":
      return ["File yang sama sudah pernah di-upload untuk organization ini. Buka session existing untuk melanjutkan review."];
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
          "Gunakan nilai biasa tanpa formula, hyperlink, macro, linked/external content, atau worksheet tambahan.",
        ];
      }
      if (error.code.startsWith("IMAGE_")) {
        return ["Periksa image row dan pastikan JPG/JPEG, PNG, atau WebP valid serta tersedia melalui metode import yang dipilih."];
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

  const canUpload = useMemo(() => Boolean(file && !isUploading), [file, isUploading]);
  const errorGuidance = error ? getUploadErrorGuidance(error) : [];

  async function upload() {
    if (!file || isUploading) return;
    setError(null);

    const lowerName = file.name.toLocaleLowerCase("en-US");
    const validExtension = lowerName.endsWith(".zip") || lowerName.endsWith(".xlsx");
    if (!validExtension) {
      setError({
        code: "UPLOAD_FILE_TYPE_INVALID",
        message: "Pilih satu file Product Batch Import berformat .zip atau .xlsx.",
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
          <h2 className="font-semibold text-neutral-950">Pilih salah satu metode upload</h2>
          <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
            Kedua metode masuk ke validation, preview, atomic commit, result, dan label pipeline yang sama.
          </p>
        </div>
      </div>

      <div className="mt-5 grid min-w-0 gap-4 lg:grid-cols-2">
        <div className="min-w-0 rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
          <div className="flex items-center gap-2">
            <FolderArchive className="size-4 text-neutral-700" />
            <p className="text-sm font-semibold text-neutral-950">Metode A — ZIP + folder foto</p>
          </div>
          <pre className="mt-3 overflow-x-auto rounded-xl bg-white p-3 text-xs leading-6 text-neutral-700">{`produk.zip
├── ${PRODUCT_BATCH_IMPORT_ARCHIVE_LAYOUT.workbookPath}
├── ${PRODUCT_BATCH_IMPORT_ARCHIVE_LAYOUT.masterDirectory}
│   ├── MASTER-001.jpg
│   └── MASTER-002.webp
└── ${PRODUCT_BATCH_IMPORT_ARCHIVE_LAYOUT.physicalDirectory}
    └── ITEM-001.jpg`}</pre>
          <p className="mt-3 text-xs leading-5 text-[var(--muted)]">
            primary_image/physical_image berisi nama file. Compress isi folder batch, bukan folder induknya. physical/ boleh kosong atau tidak ada bila semua item memakai foto master.
          </p>
        </div>

        <div className="min-w-0 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="size-4 text-emerald-800" />
            <p className="text-sm font-semibold text-emerald-950">Metode B — Single XLSX + gambar embedded</p>
          </div>
          <ol className="mt-3 space-y-2 pl-5 text-xs leading-5 text-emerald-900 marker:font-semibold">
            <li>Isi data row seperti biasa.</li>
            <li>Kosongkan text cell primary_image/physical_image yang akan memakai gambar embedded.</li>
            <li>Direkomendasikan: gunakan Picture in Cell agar gambar otomatis mengikuti cell. Standard image over cells tetap didukung sebagai fallback.</li>
            <li>Upload file .xlsx langsung tanpa membuat ZIP. primary_image wajib; physical_image tetap opsional.</li>
          </ol>
          <p className="mt-3 text-xs leading-5 text-emerald-900">
            Local Picture in Cell dan standard embedded picture over cells didukung. Jangan gunakan linked image, formula IMAGE() berbasis URL, web image, chart/object, macro, ActiveX, atau OLE.
          </p>
        </div>
      </div>

      <div className="mt-4 min-w-0 rounded-2xl border border-sky-200 bg-sky-50 p-4">
        <p className="text-sm font-semibold text-sky-950">Google Sheets</p>
        <p className="mt-2 text-xs leading-5 text-sky-900">
          Data boleh diisi lewat Google Sheets. Untuk foto, pilih Insert &gt; Image &gt; Insert image in cell (direkomendasikan), lalu File &gt; Download &gt; Microsoft Excel (.xlsx). Image over cells tetap didukung. Microsoft Excel modern dapat memakai Place in Cell atau picture over cells.
        </p>
      </div>

      <div className="mt-5 rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 p-4 sm:p-5">
        <input
          ref={inputRef}
          type="file"
          accept=".zip,.xlsx,application/zip,application/x-zip-compressed,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          className="block w-full min-w-0 text-sm text-neutral-700 file:mr-4 file:rounded-xl file:border-0 file:bg-white file:px-4 file:py-2.5 file:text-sm file:font-semibold file:text-neutral-900 file:shadow-sm"
          onChange={(event) => {
            setFile(event.currentTarget.files?.[0] ?? null);
            setError(null);
          }}
        />
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-[var(--muted)]">
          <span>Maksimal {formatMegabytes(PRODUCT_BATCH_IMPORT_LIMITS.zipUploadBytes)} untuk ZIP maupun single XLSX</span>
          {file ? <span className="break-all font-medium text-neutral-700">{file.name}</span> : null}
        </div>
      </div>

      <button
        type="button"
        onClick={upload}
        disabled={!canUpload}
        className="mt-4 inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-neutral-950 px-4 text-sm font-semibold text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isUploading ? <LoaderCircle className="size-4 animate-spin" /> : <FolderArchive className="size-4" />}
        {isUploading ? "Memvalidasi dan staging..." : "Upload & validasi ZIP/XLSX"}
      </button>

      {error ? (
        <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">
          <div className="flex items-start gap-2">
            <XCircle className="mt-0.5 size-4 shrink-0" />
            <div className="min-w-0">
              <p className="font-semibold">Upload belum dapat diproses</p>
              <p className="mt-1 leading-6">{error.message}</p>
              {errorGuidance.length ? (
                <div className="mt-3 rounded-xl bg-white/70 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-red-800">Cara memperbaiki</p>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-xs leading-5">
                    {errorGuidance.map((guidance) => <li key={guidance}>{guidance}</li>)}
                  </ul>
                </div>
              ) : null}
              {error.existingSessionId ? (
                <Link
                  href={`/admin/produk/import/${error.existingSessionId}`}
                  className="mt-3 inline-flex font-semibold underline underline-offset-4"
                >
                  Buka session existing{error.existingStatus ? ` (${error.existingStatus})` : ""}
                </Link>
              ) : null}
              <details className="mt-3 text-xs">
                <summary className="cursor-pointer font-semibold">Detail teknis</summary>
                <p className="mt-2 break-all font-mono">{error.code}</p>
              </details>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
