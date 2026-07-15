import { ExternalLink, FileText, RefreshCw } from "lucide-react";
import Link from "next/link";

import { requirePermission } from "@/lib/auth/session";

export const metadata = {
  title: "Preview Nota",
};

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const previewPdfUrl = "/api/sales/receipt-certificate-preview";

export default async function PreviewNotaCertificatePage() {
  await requirePermission("sales.view");

  const livePreviewPdfUrl = `${previewPdfUrl}#toolbar=1&navpanes=0&scrollbar=1&view=FitH`;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="mb-1 text-sm font-medium text-[var(--accent)]">
            Preview Sandbox
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-neutral-950 sm:text-3xl">
            Nota & Certificate A5 Landscape
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--muted)]">
            Halaman ini memakai sample data agar redesign UI PDF bisa dicek cepat
            tanpa membuat transaksi POS baru.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/admin/penjualan/preview-nota/html"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-white px-4 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50"
          >
            <FileText className="size-4" />
            Preview HTML/CSS
          </Link>
          <Link
            href={previewPdfUrl}
            target="_blank"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-white px-4 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50"
          >
            <ExternalLink className="size-4" />
            Buka PDF
          </Link>
          <Link
            href={previewPdfUrl}
            target="_blank"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-4 text-sm font-semibold text-white transition hover:opacity-90"
          >
            <FileText className="size-4" />
            Preview A5
          </Link>
        </div>
      </header>

      <section className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="space-y-4 rounded-3xl border border-[var(--border)] bg-white p-5 shadow-sm">
          <div>
            <h2 className="text-sm font-semibold text-neutral-950">
              Sample data
            </h2>
            <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
              Data preview dibuat tetap agar proses redesign lebih cepat dan
              konsisten.
            </p>
          </div>
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="text-xs font-medium uppercase tracking-[0.2em] text-neutral-400">
                Customer
              </dt>
              <dd className="mt-1 font-semibold text-neutral-900">Kiki</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-[0.2em] text-neutral-400">
                Item
              </dt>
              <dd className="mt-1 font-semibold text-neutral-900">3 item</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-[0.2em] text-neutral-400">
                Total
              </dt>
              <dd className="mt-1 font-semibold text-neutral-900">
                Rp 7.185.000
              </dd>
            </div>
          </dl>
          <div className="rounded-2xl bg-amber-50 p-4 text-xs leading-5 text-amber-900">
            Untuk proses redesign berikutnya, gunakan Preview HTML/CSS agar
            iterasi desain lebih cepat. Setelah final, HTML tersebut akan
            dirender menjadi PDF transaksi real.
          </div>
          <Link
            href="/admin/penjualan"
            className="inline-flex w-full items-center justify-center rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50"
          >
            Kembali ke Penjualan
          </Link>
        </aside>

        <section className="overflow-hidden rounded-3xl border border-[var(--border)] bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-3">
            <div>
              <h2 className="text-sm font-semibold text-neutral-950">
                Live PDF Preview
              </h2>
              <p className="text-xs text-[var(--muted)]">
                Refresh halaman setelah file template PDF diubah. Jika viewer
                browser tidak muncul, gunakan tombol Buka PDF.
              </p>
            </div>
            <Link
              href="/admin/penjualan/preview-nota"
              className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)] px-3 py-2 text-xs font-medium text-neutral-700 transition hover:bg-neutral-50"
            >
              <RefreshCw className="size-3.5" />
              Refresh
            </Link>
          </div>
          <div className="h-[calc(100vh-260px)] min-h-[560px] bg-neutral-100 p-3">
            <object
              data={livePreviewPdfUrl}
              type="application/pdf"
              title="Preview Nota Certificate A5"
              className="h-full w-full rounded-2xl border border-neutral-200 bg-white"
            >
              <div className="flex h-full flex-col items-center justify-center rounded-2xl border border-neutral-200 bg-white p-8 text-center">
                <p className="text-sm font-semibold text-neutral-950">
                  Preview PDF tidak bisa dimuat di halaman ini.
                </p>
                <p className="mt-2 max-w-md text-sm leading-6 text-[var(--muted)]">
                  Browser kamu mungkin memblokir PDF embed. Buka PDF di tab baru
                  untuk melihat hasil desain.
                </p>
                <Link
                  href={previewPdfUrl}
                  target="_blank"
                  className="mt-5 inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-4 text-sm font-semibold text-white transition hover:opacity-90"
                >
                  <ExternalLink className="size-4" />
                  Buka PDF di Tab Baru
                </Link>
              </div>
            </object>
          </div>
        </section>
      </section>
    </div>
  );
}
