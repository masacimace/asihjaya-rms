import { ExternalLink, FileText, Printer, RefreshCw } from "lucide-react";
import Link from "next/link";

import { ReceiptCertificateHtmlDocument } from "@/features/sales/documents/receipt-certificate-html";
import { receiptCertificateSampleData } from "@/features/sales/documents/receipt-certificate-sample-data";
import { requirePermission } from "@/lib/auth/session";

export const metadata = {
  title: "Preview Nota HTML",
};

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function ReceiptCertificateHtmlPreviewPage() {
  await requirePermission("sales.view");

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
            Halaman ini dipakai untuk redesign cepat menggunakan HTML/CSS.
            Setelah desain cocok, template yang sama akan dirender menjadi PDF
            untuk arsip dan silent print.
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
            href="/admin/penjualan/preview-nota/html"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-white px-4 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50"
          >
            <RefreshCw className="size-4" />
            Refresh
          </Link>
          <Link
            href="/api/sales/receipt-certificate-preview"
            target="_blank"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-4 text-sm font-semibold text-white transition hover:opacity-90"
          >
            <ExternalLink className="size-4" />
            Buka PDF
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
              Ubah CSS/HTML, refresh halaman, lalu cek hasil langsung tanpa
              membuat transaksi POS baru.
            </p>
          </div>
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="text-xs font-medium uppercase tracking-[0.2em] text-neutral-400">
                Ukuran
              </dt>
              <dd className="mt-1 font-semibold text-neutral-900">
                A5 Landscape
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-[0.2em] text-neutral-400">
                Source UI
              </dt>
              <dd className="mt-1 font-semibold text-neutral-900">HTML/CSS</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-[0.2em] text-neutral-400">
                Data
              </dt>
              <dd className="mt-1 font-semibold text-neutral-900">
                Sample transaksi 3 item
              </dd>
            </div>
          </dl>
          <div className="rounded-2xl bg-emerald-50 p-4 text-xs leading-5 text-emerald-900">
            Template HTML ini sekarang menjadi source desain. PDF preview akan dirender dari HTML/CSS yang sama.
          </div>
          <div className="rounded-2xl bg-amber-50 p-4 text-xs leading-5 text-amber-900">
            Gunakan tombol Buka PDF untuk mengecek hasil final sebelum nanti dikirim ke Hardware Hub untuk silent print.
          </div>
          <button
            type="button"
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50"
            disabled
          >
            <Printer className="size-4" />
            Print Browser nanti
          </button>
          <Link
            href="/admin/penjualan/preview-nota"
            className="inline-flex w-full items-center justify-center rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50"
          >
            Kembali ke Preview PDF
          </Link>
        </aside>

        <section className="overflow-hidden rounded-3xl border border-[var(--border)] bg-white shadow-sm">
          <div className="border-b border-[var(--border)] px-5 py-3">
            <h2 className="text-sm font-semibold text-neutral-950">
              Live HTML Preview
            </h2>
            <p className="text-xs text-[var(--muted)]">
              Ini adalah layout HTML/CSS yang nanti akan menjadi source untuk
              PDF. Gunakan horizontal scroll jika layar lebih kecil dari ukuran
              A5 preview.
            </p>
          </div>
          <ReceiptCertificateHtmlDocument data={receiptCertificateSampleData} />
        </section>
      </section>
    </div>
  );
}
