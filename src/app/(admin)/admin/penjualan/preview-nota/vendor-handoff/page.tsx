import {
  Download,
  ExternalLink,
  FileText,
  Printer,
  Ruler,
} from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import {
  getConfiguredReceiptDocumentProfile,
  receiptDocumentProfiles,
} from "@/features/sales/documents/receipt-document-profiles";
import {
  RECEIPT_CERTIFICATE_RENDER_MODE_FULL_DESIGN,
  RECEIPT_CERTIFICATE_RENDER_MODE_PREPRINTED_OVERLAY,
  RECEIPT_CERTIFICATE_RENDER_MODE_VENDOR_STATIC_ARTWORK,
} from "@/features/sales/documents/receipt-certificate-render-modes";
import {
  formatReceiptOverlayCalibration,
  getConfiguredReceiptOverlayCalibration,
} from "@/features/sales/documents/receipt-overlay-calibration";
import { receiptCertificateSampleData } from "@/features/sales/documents/receipt-certificate-sample-data";
import {
  formatReceiptInstagram,
  formatReceiptWhatsapp,
  resolveReceiptVendorStaticOutletCopy,
} from "@/features/sales/documents/receipt-outlet-copy";
import { requirePermission } from "@/lib/auth/session";

export const metadata = {
  title: "Vendor Handoff Nota",
};

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function buildPreviewPdfUrl({
  profileId,
  mode,
}: {
  profileId: string;
  mode: string;
}) {
  return `/api/sales/receipt-certificate-preview?profile=${profileId}&mode=${mode}`;
}

function buildPreviewHtmlUrl({
  profileId,
  mode,
}: {
  profileId: string;
  mode: string;
}) {
  return `/admin/penjualan/preview-nota/html?profile=${profileId}&mode=${mode}`;
}

function HandoffLinkCard({
  title,
  description,
  href,
  icon,
  primary = false,
}: {
  title: string;
  description: string;
  href: string;
  icon: ReactNode;
  primary?: boolean;
}) {
  return (
    <Link
      href={href}
      target="_blank"
      className={`group flex items-start gap-4 rounded-3xl border p-5 transition ${
        primary
          ? "border-[var(--accent)] bg-[var(--accent)] text-white hover:opacity-90"
          : "border-[var(--border)] bg-white text-neutral-900 hover:bg-neutral-50"
      }`}
    >
      <span
        className={`grid size-11 shrink-0 place-items-center rounded-2xl ${
          primary ? "bg-white/15" : "bg-amber-50 text-[var(--accent)]"
        }`}
      >
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold">{title}</span>
        <span
          className={`mt-1 block text-xs leading-5 ${
            primary ? "text-white/80" : "text-[var(--muted)]"
          }`}
        >
          {description}
        </span>
      </span>
    </Link>
  );
}

export default async function ReceiptVendorHandoffPage() {
  await requirePermission("sales.view");

  const configuredProfile = getConfiguredReceiptDocumentProfile();
  const overlayCalibration = getConfiguredReceiptOverlayCalibration();
  const overlayCalibrationLabel =
    formatReceiptOverlayCalibration(overlayCalibration);
  const vendorOutletCopy = resolveReceiptVendorStaticOutletCopy(
    receiptCertificateSampleData,
  );

  const vendorStaticPdfUrl = buildPreviewPdfUrl({
    profileId: configuredProfile.id,
    mode: RECEIPT_CERTIFICATE_RENDER_MODE_VENDOR_STATIC_ARTWORK,
  });
  const fullDesignPdfUrl = buildPreviewPdfUrl({
    profileId: configuredProfile.id,
    mode: RECEIPT_CERTIFICATE_RENDER_MODE_FULL_DESIGN,
  });
  const overlayProofPdfUrl = buildPreviewPdfUrl({
    profileId: configuredProfile.id,
    mode: RECEIPT_CERTIFICATE_RENDER_MODE_PREPRINTED_OVERLAY,
  });
  const vendorStaticHtmlUrl = buildPreviewHtmlUrl({
    profileId: configuredProfile.id,
    mode: RECEIPT_CERTIFICATE_RENDER_MODE_VENDOR_STATIC_ARTWORK,
  });

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="mb-1 text-sm font-medium text-[var(--accent)]">
            P6-F Vendor Handoff Package
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-neutral-950 sm:text-3xl">
            Paket Serah Terima Desain Nota
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--muted)]">
            Halaman ini mengumpulkan link PDF dan checklist yang perlu dipakai
            saat mengirim artwork nota pre-printed ke vendor percetakan.
          </p>
        </div>
        <Link
          href="/admin/penjualan/preview-nota"
          className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-white px-4 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50"
        >
          <FileText className="size-4" />
          Kembali ke Preview Nota
        </Link>
      </header>

      <section className="grid gap-4 lg:grid-cols-3">
        <HandoffLinkCard
          title="Download static artwork"
          description="PDF utama untuk vendor: halaman depan static dan halaman belakang static."
          href={vendorStaticPdfUrl}
          icon={<Download className="size-5" />}
          primary
        />
        <HandoffLinkCard
          title="Preview full design"
          description="Referensi tampilan final lengkap setelah data transaksi dan QR tercetak."
          href={fullDesignPdfUrl}
          icon={<ExternalLink className="size-5" />}
        />
        <HandoffLinkCard
          title="Preview overlay proof"
          description="PDF data overlay untuk test print di atas proof kertas vendor."
          href={overlayProofPdfUrl}
          icon={<Printer className="size-5" />}
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="space-y-4 rounded-3xl border border-[var(--border)] bg-white p-5 shadow-sm">
          <div>
            <h2 className="text-sm font-semibold text-neutral-950">
              Profile aktif
            </h2>
            <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
              Vendor harus mencetak sesuai ukuran profile aktif ini, kecuali
              kamu sengaja memilih profile lain.
            </p>
          </div>
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="text-xs font-medium uppercase tracking-[0.2em] text-neutral-400">
                Profile
              </dt>
              <dd className="mt-1 font-semibold text-neutral-900">
                {configuredProfile.label}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-[0.2em] text-neutral-400">
                Ukuran
              </dt>
              <dd className="mt-1 font-semibold text-neutral-900">
                {configuredProfile.widthMm}mm × {configuredProfile.heightMm}mm
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-[0.2em] text-neutral-400">
                Orientation
              </dt>
              <dd className="mt-1 font-semibold text-neutral-900">
                {configuredProfile.paper} Landscape
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-[0.2em] text-neutral-400">
                Static outlet copy
              </dt>
              <dd className="mt-1 space-y-1 text-xs leading-5 text-neutral-700">
                <strong className="block text-sm text-neutral-950">
                  {vendorOutletCopy.name}
                </strong>
                <span className="block">{vendorOutletCopy.address}</span>
                <span className="block">
                  {formatReceiptWhatsapp(vendorOutletCopy.phone)}
                </span>
                <span className="block">
                  {formatReceiptInstagram(vendorOutletCopy.instagramHandle)}
                </span>
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
          </dl>
          <div className="rounded-2xl bg-amber-50 p-4 text-xs leading-5 text-amber-900">
            Jika alamat, WA, atau Instagram pada artwork belum sesuai, ubah
            RECEIPT_VENDOR_OUTLET_* di .env lalu regenerate PDF vendor.
          </div>
        </aside>

        <section className="space-y-4 rounded-3xl border border-[var(--border)] bg-white p-5 shadow-sm">
          <div className="flex items-start gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-amber-50 text-[var(--accent)]">
              <Ruler className="size-5" />
            </span>
            <div>
              <h2 className="text-sm font-semibold text-neutral-950">
                Checklist untuk vendor
              </h2>
              <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
                Copy bagian ini ke brief vendor atau jadikan acuan saat proof
                print.
              </p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-[var(--border)] p-4">
              <h3 className="text-sm font-semibold text-neutral-950">
                Static artwork vendor
              </h3>
              <ul className="mt-3 space-y-2 text-xs leading-5 text-[var(--muted)]">
                <li>• Cetak sesuai ukuran final profile aktif.</li>
                <li>• Jangan menambahkan margin otomatis.</li>
                <li>• Jaga area foto produk dan QR tetap kosong/bersih.</li>
                <li>• Halaman belakang dicetak static sepenuhnya.</li>
                <li>
                  • Pastikan nama outlet, alamat, WA, dan Instagram sudah final.
                </li>
                <li>• Proof dulu 5–10 lembar sebelum cetak massal.</li>
              </ul>
            </div>

            <div className="rounded-2xl border border-[var(--border)] p-4">
              <h3 className="text-sm font-semibold text-neutral-950">
                Test overlay outlet
              </h3>
              <ul className="mt-3 space-y-2 text-xs leading-5 text-[var(--muted)]">
                <li>• Print overlay di atas proof vendor.</li>
                <li>• Cek posisi No. Order, customer, foto, total, dan QR.</li>
                <li>• Scan QR untuk memastikan masih terbaca.</li>
                <li>• Jika geser, atur offset X/Y di env.</li>
                <li>• Baru approve produksi massal setelah alignment pas.</li>
              </ul>
            </div>
          </div>

          <div className="rounded-2xl border border-dashed border-[var(--border)] bg-neutral-50 p-4 text-xs leading-5 text-neutral-700">
            Dokumentasi teknis tersedia di repo: <strong>docs/receipt-vendor-handoff.md</strong>.
            Gunakan dokumen itu sebagai catatan internal saat menyerahkan file
            static artwork ke vendor.
          </div>
        </section>
      </section>

      <section className="rounded-3xl border border-[var(--border)] bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-neutral-950">
          Link profile alternatif
        </h2>
        <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
          Gunakan link ini hanya jika client minta ukuran kertas berbeda.
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {Object.values(receiptDocumentProfiles).map((profile) => {
            const href = buildPreviewPdfUrl({
              profileId: profile.id,
              mode: RECEIPT_CERTIFICATE_RENDER_MODE_VENDOR_STATIC_ARTWORK,
            });

            return (
              <Link
                key={profile.id}
                href={href}
                target="_blank"
                className="flex items-center justify-between gap-4 rounded-2xl border border-[var(--border)] p-4 text-sm transition hover:bg-neutral-50"
              >
                <span>
                  <span className="block font-semibold text-neutral-950">
                    {profile.label}
                  </span>
                  <span className="mt-1 block text-xs text-[var(--muted)]">
                    {profile.widthMm}mm × {profile.heightMm}mm
                  </span>
                </span>
                <ExternalLink className="size-4 text-neutral-400" />
              </Link>
            );
          })}
        </div>
      </section>

      <section className="rounded-3xl border border-[var(--border)] bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-neutral-950">
          Preview HTML static artwork
        </h2>
        <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
          Link ini membantu cek cepat area static di browser sebelum PDF dibuka.
        </p>
        <Link
          href={vendorStaticHtmlUrl}
          target="_blank"
          className="mt-4 inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-white px-4 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50"
        >
          <ExternalLink className="size-4" />
          Buka HTML Vendor Static
        </Link>
      </section>
    </div>
  );
}
