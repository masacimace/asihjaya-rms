import { ArrowLeft, CheckCircle2, Clock3, FileSpreadsheet } from "lucide-react";
import Link from "next/link";

import { getProductBatchImportHistory } from "@/features/product-batch-import/result-queries";
import { requirePermission } from "@/lib/auth/session";

export const metadata = { title: "History Product Batch Import" };
export const dynamic = "force-dynamic";

function formatDateTime(value: Date | null, timeZone: string) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone,
  }).format(value);
}

export default async function ProductBatchImportHistoryPage() {
  const auth = await requirePermission("products.batch_import");
  const sessions = await getProductBatchImportHistory(auth);

  return (
    <div className="mx-auto flex w-full max-w-7xl min-w-0 flex-col gap-6 overflow-x-clip pb-8">
      <section className="rounded-3xl border border-[var(--border)] bg-white p-5 sm:p-6">
        <Link
          href="/admin/produk/import"
          className="inline-flex h-10 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-neutral-700 hover:bg-neutral-100"
        >
          <ArrowLeft className="size-4" />
          Kembali ke Import
        </Link>
        <div className="mt-5 flex items-start gap-3">
          <div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent)]">
            <Clock3 className="size-5" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-neutral-950 sm:text-3xl">
              History Product Batch Import
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--muted)]">
              Session tetap dapat dibuka ulang untuk melihat operator, file hash,
              result identifier, warning, dan status label yang pernah dibuat.
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-[var(--border)] bg-white p-5 sm:p-6">
        {sessions.length ? (
          <div className="grid min-w-0 gap-3 lg:grid-cols-2">
            {sessions.map((session) => (
              <Link
                key={session.id}
                href={`/admin/produk/import/${session.id}`}
                className="min-w-0 rounded-2xl border border-neutral-200 p-4 transition hover:border-neutral-300 hover:bg-neutral-50"
              >
                <div className="flex min-w-0 items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <FileSpreadsheet className="size-4 shrink-0 text-neutral-500" />
                      <p className="break-words text-sm font-semibold text-neutral-950">
                        {session.fileName}
                      </p>
                    </div>
                    <p className="mt-2 text-xs text-[var(--muted)]">
                      {session.totalMasterRows} master · {session.totalItemRows} item · {session.invalidRows} invalid · {session.warningCount} warning
                    </p>
                    <p className="mt-1 text-xs text-[var(--muted)]">
                      Operator {session.createdByName} · dibuat {formatDateTime(session.createdAt, auth.organization.timezone)}
                    </p>
                    {session.status === "completed" ? (
                      <p className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
                        <CheckCircle2 className="size-3.5" />
                        {session.committedMasterCount} master / {session.committedItemCount} item committed · {formatDateTime(session.committedAt, auth.organization.timezone)}
                      </p>
                    ) : null}
                  </div>
                  <span className="shrink-0 rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-semibold text-neutral-700">
                    {session.status}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <p className="rounded-2xl bg-neutral-50 p-4 text-sm text-[var(--muted)]">
            Belum ada history Product Batch Import.
          </p>
        )}
      </section>
    </div>
  );
}
