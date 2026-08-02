import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Clock3,
  LockKeyhole,
  MapPinned,
  PackageSearch,
  ScanBarcode,
  Target,
  UserRound,
} from "lucide-react";
import Link from "next/link";

import { PosPageContainer, PosPageHeader } from "@/components/layout/pos-page";
import { getLegacyMigrationScannerSessions } from "@/features/legacy-migration/verification-queries";
import { requirePermission } from "@/lib/auth/session";
import { cn } from "@/lib/utils";

export const metadata = { title: "Migrasi Barang" };
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function sessionStatusLabel(status: string) {
  if (status === "active") return "Aktif";
  if (status === "locked") return "Dikunci";
  if (status === "completed") return "Selesai";
  if (status === "cancelled") return "Dibatalkan";
  if (status === "draft") return "Draft";
  return status;
}

export default async function LegacyMigrationScannerSessionsPage() {
  const auth = await requirePermission("migration.scan");
  const sessions = await getLegacyMigrationScannerSessions(auth);
  const activeCount = sessions.filter((session) => session.status === "active").length;
  const lockedCount = sessions.filter((session) => session.status === "locked").length;
  const completedCount = sessions.filter(
    (session) => session.status === "completed",
  ).length;

  return (
    <PosPageContainer>
      <PosPageHeader
        eyebrow="Operasional POS"
        title="Migrasi Barang"
        description="Pilih sesi etalase yang ditugaskan, scan barcode fisik, lalu kirim verification ke antrean manager."
        icon={<ScanBarcode className="size-5 sm:size-6" />}
        actions={
          <Link
            href="/pos"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-white px-4 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-50"
          >
            <ArrowLeft className="size-4" />
            Kembali ke POS
          </Link>
        }
      />

      {sessions.length > 0 ? (
        <section className="grid grid-cols-3 gap-3">
          <div className="rounded-2xl border border-[var(--border)] bg-white p-4">
            <div className="flex items-center justify-between gap-2">
              <Clock3 className="size-4 text-emerald-700" />
              <span className="text-xl font-semibold text-neutral-950">
                {activeCount}
              </span>
            </div>
            <p className="mt-2 text-xs text-[var(--muted)]">Sesi aktif</p>
          </div>
          <div className="rounded-2xl border border-[var(--border)] bg-white p-4">
            <div className="flex items-center justify-between gap-2">
              <LockKeyhole className="size-4 text-amber-700" />
              <span className="text-xl font-semibold text-neutral-950">
                {lockedCount}
              </span>
            </div>
            <p className="mt-2 text-xs text-[var(--muted)]">Dikunci</p>
          </div>
          <div className="rounded-2xl border border-[var(--border)] bg-white p-4">
            <div className="flex items-center justify-between gap-2">
              <CheckCircle2 className="size-4 text-blue-700" />
              <span className="text-xl font-semibold text-neutral-950">
                {completedCount}
              </span>
            </div>
            <p className="mt-2 text-xs text-[var(--muted)]">Selesai</p>
          </div>
        </section>
      ) : null}

      {sessions.length === 0 ? (
        <section className="rounded-2xl border border-dashed border-neutral-300 bg-white px-6 py-14 text-center">
          <PackageSearch className="mx-auto size-10 text-neutral-300" />
          <h2 className="mt-4 font-semibold text-neutral-950">
            Belum ada sesi yang ditugaskan
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[var(--muted)]">
            Manager perlu menugaskanmu sebagai operator atau Migration Lead pada
            sesi etalase sebelum scanner dapat digunakan.
          </p>
          <Link
            href="/pos"
            className="mt-5 inline-flex h-10 items-center gap-2 rounded-xl border border-[var(--border)] px-4 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-50"
          >
            <ArrowLeft className="size-4" />
            Kembali ke POS
          </Link>
        </section>
      ) : (
        <section className="mt-5 grid gap-4 lg:grid-cols-2">
          {sessions.map((session) => {
            const canOpen =
              session.status === "active" ||
              session.status === "locked" ||
              session.status === "completed";
            const targetDifference = session.expectedItemCount
              ? session.submittedCount - session.expectedItemCount
              : null;

            return (
              <article
                key={session.id}
                className="rounded-2xl border border-[var(--border)] bg-white p-4 sm:p-5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={cn(
                          "rounded-full border px-2.5 py-1 text-xs font-semibold",
                          session.status === "active"
                            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                            : session.status === "locked"
                              ? "border-amber-200 bg-amber-50 text-amber-700"
                              : session.status === "completed"
                                ? "border-blue-200 bg-blue-50 text-blue-700"
                                : "border-neutral-200 bg-neutral-100 text-neutral-700",
                        )}
                      >
                        {sessionStatusLabel(session.status)}
                      </span>
                      <span className="rounded-full bg-[var(--accent-soft)] px-2.5 py-1 text-xs font-semibold text-[var(--accent)]">
                        {session.assignmentRole === "lead"
                          ? "Migration Lead"
                          : session.assignmentRole === "manager_override"
                            ? "Manager Override"
                            : "Operator"}
                      </span>
                    </div>

                    <h2 className="mt-3 truncate text-lg font-semibold text-neutral-950">
                      {session.name}
                    </h2>
                    <p className="mt-2 flex items-center gap-2 text-sm text-[var(--muted)]">
                      <MapPinned className="size-4 shrink-0 text-[var(--accent)]" />
                      <span className="truncate">
                        {session.outletName}
                        {session.locationCode
                          ? ` · ${session.locationCode}`
                          : ""}
                      </span>
                    </p>
                  </div>
                </div>

                <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div className="rounded-xl border border-[var(--border)] bg-neutral-50 p-3">
                    <ScanBarcode className="size-4 text-neutral-600" />
                    <p className="mt-2 text-lg font-semibold text-neutral-950">
                      {session.submittedCount}
                    </p>
                    <p className="text-[11px] text-[var(--muted)]">Terproses</p>
                  </div>
                  <div className="rounded-xl border border-[var(--border)] bg-neutral-50 p-3">
                    <PackageSearch className="size-4 text-amber-700" />
                    <p className="mt-2 text-lg font-semibold text-amber-700">
                      {session.needsReviewCount}
                    </p>
                    <p className="text-[11px] text-[var(--muted)]">Review</p>
                  </div>
                  <div className="rounded-xl border border-[var(--border)] bg-neutral-50 p-3 sm:col-span-2">
                    <div className="flex items-center gap-2 text-xs font-medium text-neutral-700">
                      <Target className="size-4 text-[var(--accent)]" />
                      Target opsional
                    </div>
                    <p className="mt-2 text-sm font-semibold text-neutral-950">
                      {session.expectedItemCount ?? "Tidak diisi"}
                    </p>
                    <p className="mt-1 text-[11px] leading-4 text-[var(--muted)]">
                      {session.expectedItemCount === null
                        ? "Hanya sebagai pembanding progress."
                        : targetDifference === 0
                          ? "Sesuai target pembanding."
                          : targetDifference && targetDifference > 0
                            ? `Lebih ${targetDifference} item.`
                            : `Kurang ${Math.abs(targetDifference ?? 0)} item.`}
                    </p>
                  </div>
                </div>

                {session.notes ? (
                  <p className="mt-4 line-clamp-2 rounded-xl border border-[var(--border)] bg-neutral-50 px-3 py-2 text-xs leading-5 text-neutral-700">
                    {session.notes}
                  </p>
                ) : null}

                {canOpen ? (
                  <Link
                    href={`/pos/migrasi-barang/${session.id}`}
                    className={cn(
                      "mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition",
                      session.status === "active"
                        ? "bg-neutral-950 !text-white hover:bg-neutral-800"
                        : "border border-[var(--border)] bg-white !text-neutral-800 hover:bg-neutral-50",
                    )}
                  >
                    {session.status === "active" ? (
                      <ScanBarcode className="size-4" />
                    ) : session.status === "locked" ? (
                      <LockKeyhole className="size-4" />
                    ) : (
                      <CheckCircle2 className="size-4" />
                    )}
                    {session.status === "active"
                      ? "Buka scanner"
                      : session.status === "locked"
                        ? "Lihat sesi terkunci"
                        : "Lihat ringkasan sesi"}
                    <ArrowRight className="size-4" />
                  </Link>
                ) : (
                  <div className="mt-5 flex items-center justify-center gap-2 rounded-xl bg-neutral-100 px-4 py-3 text-sm font-medium text-neutral-600">
                    <UserRound className="size-4" />
                    Sesi belum dapat dibuka.
                  </div>
                )}
              </article>
            );
          })}
        </section>
      )}
    </PosPageContainer>
  );
}
