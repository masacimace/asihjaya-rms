import { ExternalLink, FileText, Printer, RefreshCw } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ReceiptCertificateHtmlDocument } from "@/features/sales/documents/receipt-certificate-html";
import {
  getConfiguredReceiptDocumentProfileId,
  isReceiptDocumentProfileId,
  RECEIPT_DOCUMENT_PROFILE_A4_LANDSCAPE_V1,
  RECEIPT_DOCUMENT_PROFILE_A5_LANDSCAPE_V1,
  resolveReceiptDocumentProfile,
} from "@/features/sales/documents/receipt-document-profiles";
import { receiptCertificateSampleData } from "@/features/sales/documents/receipt-certificate-sample-data";
import {
  getReceiptCertificateRenderModeLabel,
  isReceiptCertificateRenderMode,
  RECEIPT_CERTIFICATE_RENDER_MODE_FULL_DESIGN,
  RECEIPT_CERTIFICATE_RENDER_MODE_PREPRINTED_OVERLAY,
  RECEIPT_CERTIFICATE_RENDER_MODE_VENDOR_STATIC_ARTWORK,
  resolveReceiptCertificateRenderMode,
} from "@/features/sales/documents/receipt-certificate-render-modes";
import { getConfiguredReceiptOverlayCalibration } from "@/features/sales/documents/receipt-overlay-calibration";
import { requirePermission } from "@/lib/auth/session";

export const metadata = {
  title: "Preview Nota HTML",
};

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{
    profile?: string;
    mode?: string;
  }>;
};

export default async function ReceiptCertificateHtmlPreviewPage({
  searchParams,
}: PageProps) {
  await requirePermission("sales.view");
  const query = await searchParams;
  const documentProfileId = query.profile ?? getConfiguredReceiptDocumentProfileId();

  if (!isReceiptDocumentProfileId(documentProfileId)) {
    notFound();
  }

  if (query.mode && !isReceiptCertificateRenderMode(query.mode)) {
    notFound();
  }

  const renderMode = resolveReceiptCertificateRenderMode(query.mode);
  const overlayCalibration = getConfiguredReceiptOverlayCalibration();
  const overlayCalibrationLabel = [
    `X ${overlayCalibration.offsetXmm}mm`,
    `Y ${overlayCalibration.offsetYmm}mm`,
    `${overlayCalibration.scale}x`,
  ].join(" · ");
  const profile = resolveReceiptDocumentProfile(documentProfileId);
  const currentUrl = `/admin/penjualan/preview-nota/html?profile=${documentProfileId}&mode=${renderMode}`;
  const pdfUrl = `/api/sales/receipt-certificate-preview?profile=${documentProfileId}&mode=${renderMode}`;

  return (
    <div className="mx-auto max-w-none space-y-6">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="mb-1 text-sm font-medium text-[var(--accent)]">
            HTML/CSS Design Sandbox
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-neutral-950 sm:text-3xl">
            Preview Nota & Certificate HTML
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--muted)]">
            Preview full design dan artwork static vendor untuk memastikan
            layout nota tetap presisi sebelum masuk mode pre-printed overlay.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/admin/penjualan/preview-nota"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-white px-4 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50"
          >
            <FileText className="size-4" />
            Preview PDF
          </Link>
          <Link
            href={currentUrl}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-white px-4 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50"
          >
            <RefreshCw className="size-4" />
            Refresh
          </Link>
          <Link
            href={pdfUrl}
            target="_blank"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-4 text-sm font-semibold text-white transition hover:opacity-90"
          >
            <ExternalLink className="size-4" />
            Buka PDF {profile.paper}
          </Link>
        </div>
      </header>

      <section className="grid gap-4 xl:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="space-y-4 rounded-3xl border border-[var(--border)] bg-white p-5 shadow-sm">
          <div>
            <h2 className="text-sm font-semibold text-neutral-950">
              Mode redesign cepat
            </h2>
            <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
              Bandingkan A4 dan A5 menggunakan komponen serta hierarchy visual
              yang sama.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Link
              href={`/admin/penjualan/preview-nota/html?profile=${RECEIPT_DOCUMENT_PROFILE_A4_LANDSCAPE_V1}&mode=${renderMode}`}
              className={`rounded-xl border px-3 py-2 text-center text-xs font-semibold transition ${
                documentProfileId === RECEIPT_DOCUMENT_PROFILE_A4_LANDSCAPE_V1
                  ? "border-[var(--accent)] bg-[var(--accent)] text-white"
                  : "border-[var(--border)] bg-white text-neutral-700 hover:bg-neutral-50"
              }`}
            >
              A4 Target
            </Link>
            <Link
              href={`/admin/penjualan/preview-nota/html?profile=${RECEIPT_DOCUMENT_PROFILE_A5_LANDSCAPE_V1}&mode=${renderMode}`}
              className={`rounded-xl border px-3 py-2 text-center text-xs font-semibold transition ${
                documentProfileId === RECEIPT_DOCUMENT_PROFILE_A5_LANDSCAPE_V1
                  ? "border-[var(--accent)] bg-[var(--accent)] text-white"
                  : "border-[var(--border)] bg-white text-neutral-700 hover:bg-neutral-50"
              }`}
            >
              A5 Legacy
            </Link>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <Link
              href={`/admin/penjualan/preview-nota/html?profile=${documentProfileId}&mode=${RECEIPT_CERTIFICATE_RENDER_MODE_FULL_DESIGN}`}
              className={`rounded-xl border px-3 py-2 text-center text-xs font-semibold transition ${
                renderMode === RECEIPT_CERTIFICATE_RENDER_MODE_FULL_DESIGN
                  ? "border-[var(--accent)] bg-[var(--accent)] text-white"
                  : "border-[var(--border)] bg-white text-neutral-700 hover:bg-neutral-50"
              }`}
            >
              Full Design
            </Link>
            <Link
              href={`/admin/penjualan/preview-nota/html?profile=${documentProfileId}&mode=${RECEIPT_CERTIFICATE_RENDER_MODE_VENDOR_STATIC_ARTWORK}`}
              className={`rounded-xl border px-3 py-2 text-center text-xs font-semibold transition ${
                renderMode ===
                RECEIPT_CERTIFICATE_RENDER_MODE_VENDOR_STATIC_ARTWORK
                  ? "border-[var(--accent)] bg-[var(--accent)] text-white"
                  : "border-[var(--border)] bg-white text-neutral-700 hover:bg-neutral-50"
              }`}
            >
              Vendor Static
            </Link>
            <Link
              href={`/admin/penjualan/preview-nota/html?profile=${documentProfileId}&mode=${RECEIPT_CERTIFICATE_RENDER_MODE_PREPRINTED_OVERLAY}`}
              className={`rounded-xl border px-3 py-2 text-center text-xs font-semibold transition ${
                renderMode === RECEIPT_CERTIFICATE_RENDER_MODE_PREPRINTED_OVERLAY
                  ? "border-[var(--accent)] bg-[var(--accent)] text-white"
                  : "border-[var(--border)] bg-white text-neutral-700 hover:bg-neutral-50"
              }`}
            >
              Overlay
            </Link>
          </div>

          <dl className="space-y-3 text-sm">
            <div>
              <dt className="text-xs font-medium uppercase tracking-[0.2em] text-neutral-400">
                Ukuran
              </dt>
              <dd className="mt-1 font-semibold text-neutral-900">
                {profile.paper} Landscape
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-[0.2em] text-neutral-400">
                Design scale
              </dt>
              <dd className="mt-1 font-semibold text-neutral-900">
                {profile.designScale.toFixed(4)}x
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-[0.2em] text-neutral-400">
                Overlay calibration
              </dt>
              <dd className="mt-1 font-semibold text-neutral-900">
                {overlayCalibrationLabel}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-[0.2em] text-neutral-400">
                Mode
              </dt>
              <dd className="mt-1 font-semibold text-neutral-900">
                {getReceiptCertificateRenderModeLabel(renderMode)}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-[0.2em] text-neutral-400">
                Data
              </dt>
              <dd className="mt-1 font-semibold text-neutral-900">
                {renderMode ===
                RECEIPT_CERTIFICATE_RENDER_MODE_VENDOR_STATIC_ARTWORK
                  ? "Artwork static vendor"
                  : renderMode === RECEIPT_CERTIFICATE_RENDER_MODE_PREPRINTED_OVERLAY
                    ? "Overlay data transaksi"
                    : "Sample transaksi 3 item"}
              </dd>
            </div>
          </dl>

          <div className="rounded-2xl bg-emerald-50 p-4 text-xs leading-5 text-emerald-900">
            Mode Vendor Static menyembunyikan data transaksi dinamis dan
            menyisakan artwork static untuk proof cetak vendor.
          </div>
          <div className="rounded-2xl bg-amber-50 p-4 text-xs leading-5 text-amber-900">
            Mode Overlay hanya mencetak data transaksi dinamis di atas kertas
            nota vendor. Gunakan mode ini untuk test alignment pre-printed.
          </div>
          <button
            type="button"
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50"
            disabled
          >
            <Printer className="size-4" />
            Print Browser nanti
          </button>
        </aside>

        <section className="overflow-hidden rounded-3xl border border-[var(--border)] bg-white shadow-sm">
          <div className="border-b border-[var(--border)] px-5 py-3">
            <h2 className="text-sm font-semibold text-neutral-950">
              Live HTML Preview - {profile.paper} Landscape - {getReceiptCertificateRenderModeLabel(renderMode)}
            </h2>
            <p className="text-xs text-[var(--muted)]">
              Gunakan horizontal scroll bila layar lebih kecil dari ukuran
              halaman preview.
            </p>
          </div>
          <ReceiptCertificateHtmlDocument
            data={receiptCertificateSampleData}
            documentProfileId={documentProfileId}
            overlayCalibration={overlayCalibration}
            renderMode={renderMode}
          />
        </section>
      </section>
    </div>
  );
}
