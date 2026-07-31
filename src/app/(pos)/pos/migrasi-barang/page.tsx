import {
  ArrowRight,
  LockKeyhole,
  MapPinned,
  PackageSearch,
  ScanBarcode,
} from "lucide-react";
import Link from "next/link";

import { getLegacyMigrationScannerSessions } from "@/features/legacy-migration/verification-queries";
import { requirePermission } from "@/lib/auth/session";
import { cn } from "@/lib/utils";

export const metadata = { title: "Migrasi Barang" };
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function LegacyMigrationScannerSessionsPage() {
  const auth = await requirePermission("migration.scan");
  const sessions = await getLegacyMigrationScannerSessions(auth);

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 p-4 sm:p-6 lg:p-8">
      <section className="rounded-3xl border border-[var(--border)] bg-white p-5 sm:p-6">
        <div className="flex items-start gap-4">
          <div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent)]">
            <ScanBarcode className="size-6" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">
              Milestone 3 · Physical Verification
            </p>
            <h1 className="mt-2 text-2xl font-semibold text-neutral-950 sm:text-3xl">
              Migrasi barang fisik
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--muted)]">
              Pilih sesi etalase yang ditugaskan. Hasil scan hanya masuk antrean
              manager dan belum menjadi stok aktif atau item yang dapat dijual
              di POS.
            </p>
          </div>
        </div>
      </section>

      {sessions.length === 0 ? (
        <section className="rounded-3xl border border-dashed border-neutral-300 bg-white px-6 py-14 text-center">
          <PackageSearch className="mx-auto size-10 text-neutral-300" />
          <h2 className="mt-4 font-semibold text-neutral-950">
            Belum ada sesi yang ditugaskan
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[var(--muted)]">
            Manager perlu menugaskanmu sebagai Operator atau Migration Lead pada
            sesi etalase.
          </p>
        </section>
      ) : (
        <section className="grid gap-4 lg:grid-cols-2">
          {sessions.map((session) => {
            const canOpen =
              session.status === "active" || session.status === "locked";
            return (
              <article
                key={session.id}
                className="rounded-3xl border border-[var(--border)] bg-white p-5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-[0.15em] text-[var(--muted)]">
                      {session.assignmentRole === "lead"
                        ? "Migration Lead"
                        : session.assignmentRole === "manager_override"
                          ? "Manager Override"
                          : "Operator"}
                    </p>
                    <h2 className="mt-2 truncate text-lg font-semibold text-neutral-950">
                      {session.name}
                    </h2>
                    <p className="mt-1 flex items-center gap-2 text-sm text-[var(--muted)]">
                      <MapPinned className="size-4 shrink-0" />
                      {session.outletName}
                      {session.locationCode ? ` · ${session.locationCode}` : ""}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "shrink-0 rounded-full border px-2.5 py-1 text-xs font-semibold",
                      session.status === "active"
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                        : session.status === "locked"
                          ? "border-amber-200 bg-amber-50 text-amber-700"
                          : "border-neutral-200 bg-neutral-100 text-neutral-700",
                    )}
                  >
                    {session.status === "active"
                      ? "Aktif"
                      : session.status === "locked"
                        ? "Dikunci"
                        : session.status}
                  </span>
                </div>

                <div className="mt-5 grid grid-cols-3 gap-3">
                  <div className="rounded-2xl bg-neutral-50 p-3">
                    <p className="text-lg font-semibold text-neutral-950">
                      {session.submittedCount}
                    </p>
                    <p className="text-[11px] text-[var(--muted)]">Scan</p>
                  </div>
                  <div className="rounded-2xl bg-neutral-50 p-3">
                    <p className="text-lg font-semibold text-amber-700">
                      {session.needsReviewCount}
                    </p>
                    <p className="text-[11px] text-[var(--muted)]">Review</p>
                  </div>
                  <div className="rounded-2xl bg-neutral-50 p-3">
                    <p className="text-lg font-semibold text-neutral-950">
                      {session.expectedItemCount ?? "—"}
                    </p>
                    <p className="text-[11px] text-[var(--muted)]">Target opsional</p>
                  </div>
                </div>

                {canOpen ? (
                  <Link
                    href={`/pos/migrasi-barang/${session.id}`}
                    className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-neutral-950 px-4 text-sm font-semibold !text-white transition hover:bg-neutral-800"
                  >
                    {session.status === "active" ? (
                      <ScanBarcode className="size-4" />
                    ) : (
                      <LockKeyhole className="size-4" />
                    )}
                    {session.status === "active"
                      ? "Mulai scan"
                      : "Lihat sesi terkunci"}
                    <ArrowRight className="size-4" />
                  </Link>
                ) : (
                  <div className="mt-5 rounded-2xl bg-neutral-100 px-4 py-3 text-center text-sm font-medium text-neutral-600">
                    Sesi belum aktif atau sudah selesai.
                  </div>
                )}
              </article>
            );
          })}
        </section>
      )}
    </div>
  );
}
