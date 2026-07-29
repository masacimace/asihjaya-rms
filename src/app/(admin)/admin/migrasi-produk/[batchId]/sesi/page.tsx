import {
  ArrowLeft,
  CheckCircle2,
  LockKeyhole,
  MapPinned,
  Play,
  RotateCcw,
  UserRoundCog,
  UsersRound,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import {
  createLegacyMigrationSessionAction,
  transitionLegacyMigrationSessionAction,
  updateLegacyMigrationSessionAssignmentsAction,
} from "@/app/actions/legacy-migration-management";
import { getLegacyMigrationSessionData } from "@/features/legacy-migration/management-queries";
import {
  hasPermission,
  requireAnyPermission,
} from "@/lib/auth/session";
import { cn } from "@/lib/utils";

export const metadata = { title: "Sesi Migrasi Produk" };
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function flashMessage(type?: string, message?: string) {
  if (!message) return null;
  return (
    <div
      role="alert"
      className={cn(
        "rounded-3xl border px-5 py-4 text-sm font-medium",
        type === "success"
          ? "border-emerald-200 bg-emerald-50 text-emerald-800"
          : "border-red-200 bg-red-50 text-red-800",
      )}
    >
      {message}
    </div>
  );
}

function SessionStatusBadge({
  status,
}: {
  status: "draft" | "active" | "locked" | "completed" | "cancelled";
}) {
  const config = {
    draft: ["Draft", "border-neutral-300 bg-neutral-100 text-neutral-700"],
    active: ["Aktif", "border-emerald-200 bg-emerald-50 text-emerald-700"],
    locked: ["Dikunci", "border-amber-200 bg-amber-50 text-amber-700"],
    completed: ["Selesai", "border-blue-200 bg-blue-50 text-blue-700"],
    cancelled: ["Dibatalkan", "border-red-200 bg-red-50 text-red-700"],
  }[status];

  return (
    <span
      className={cn(
        "inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold",
        config[1],
      )}
    >
      {config[0]}
    </span>
  );
}

export default async function LegacyMigrationSessionsPage({
  params,
  searchParams,
}: {
  params: Promise<{ batchId: string }>;
  searchParams: Promise<{ type?: string; message?: string }>;
}) {
  const auth = await requireAnyPermission([
    "migration.view",
    "migration.session.manage",
  ]);
  const [{ batchId }, query] = await Promise.all([params, searchParams]);
  const data = await getLegacyMigrationSessionData(auth, batchId);
  if (!data) notFound();

  const canManage = hasPermission(auth, "migration.session.manage");

  return (
    <div className="space-y-6">
      {flashMessage(query.type, query.message)}

      <section className="rounded-3xl border border-[var(--border)] bg-white p-6 lg:p-7">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <Link
              href={`/admin/migrasi-produk/${data.batch.id}`}
              className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-neutral-900 transition hover:bg-neutral-50"
            >
              <ArrowLeft className="size-4" />
              Kembali ke analisis batch
            </Link>
            <p className="mt-5 inline-flex items-center gap-2 rounded-full bg-[var(--accent-soft)] px-3 py-1 text-xs font-semibold text-[var(--accent)]">
              <MapPinned className="size-3.5" />
              Milestone 2 · Session Management
            </p>
            <h1 className="mt-4 text-2xl font-semibold text-neutral-950 sm:text-3xl">
              Sesi migrasi per etalase
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--muted)]">
              {data.batch.outletName} · bagi pekerjaan berdasarkan etalase atau
              lokasi fisik agar staff tidak memindai item yang sama.
            </p>
          </div>

          <Link
            href={`/admin/migrasi-produk/${data.batch.id}/mapping`}
            className="inline-flex h-11 items-center justify-center rounded-xl border border-[var(--border)] bg-white px-4 text-sm font-semibold text-neutral-900 transition hover:bg-neutral-50"
          >
            Review master mapping
          </Link>
        </div>
      </section>

      {canManage ? (
        <section className="rounded-3xl border border-[var(--border)] bg-white p-5 lg:p-6">
          <h2 className="font-semibold text-neutral-950">Buat sesi baru</h2>
          <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
            Contoh: Etalase Cincin A, Kalung Kanan, atau Logam Mulia. Hak scan
            baru akan aktif pada Milestone 3.
          </p>

          <form
            action={createLegacyMigrationSessionAction}
            className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,0.8fr)_minmax(360px,1.2fr)]"
          >
            <input type="hidden" name="batchId" value={data.batch.id} />
            <div className="grid gap-4">
              <label className="text-sm font-medium text-neutral-800">
                Nama sesi
                <input
                  name="name"
                  required
                  minLength={2}
                  maxLength={160}
                  placeholder="Etalase Cincin A"
                  className="mt-2 h-11 w-full rounded-xl border border-[var(--border)] px-3 text-sm outline-none focus:border-[var(--accent)]"
                />
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="text-sm font-medium text-neutral-800">
                  Kode/lokasi etalase
                  <input
                    name="locationCode"
                    maxLength={80}
                    placeholder="CIN-A"
                    className="mt-2 h-11 w-full rounded-xl border border-[var(--border)] px-3 text-sm outline-none focus:border-[var(--accent)]"
                  />
                </label>
                <label className="text-sm font-medium text-neutral-800">
                  Target jumlah item
                  <input
                    name="expectedItemCount"
                    type="number"
                    min={1}
                    max={50000}
                    placeholder="150"
                    className="mt-2 h-11 w-full rounded-xl border border-[var(--border)] px-3 text-sm outline-none focus:border-[var(--accent)]"
                  />
                </label>
              </div>
              <label className="text-sm font-medium text-neutral-800">
                Catatan
                <textarea
                  name="notes"
                  maxLength={2000}
                  rows={3}
                  placeholder="Mulai dari sisi kiri etalase dan jangan pindah sesi tanpa arahan manager."
                  className="mt-2 w-full rounded-xl border border-[var(--border)] px-3 py-3 text-sm outline-none focus:border-[var(--accent)]"
                />
              </label>
            </div>

            <div className="rounded-2xl bg-neutral-50 p-4">
              <p className="text-sm font-semibold text-neutral-900">
                Staff yang ditugaskan
              </p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {data.staff.map((staff) => (
                  <label
                    key={staff.id}
                    className="flex cursor-pointer items-start gap-3 rounded-xl border border-[var(--border)] bg-white p-3"
                  >
                    <input
                      type="checkbox"
                      name="assignedUserIds"
                      value={staff.id}
                      className="mt-1 size-4 accent-[var(--accent)]"
                    />
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-neutral-900">
                        {staff.fullName}
                      </span>
                      <span className="mt-0.5 block text-xs text-[var(--muted)]">
                        @{staff.username}
                        {staff.roleNames.length > 0
                          ? ` · ${staff.roleNames.join(", ")}`
                          : ""}
                      </span>
                    </span>
                  </label>
                ))}
              </div>

              <label className="mt-4 block text-sm font-medium text-neutral-800">
                Migration Lead (opsional)
                <select
                  name="leadUserId"
                  defaultValue=""
                  className="mt-2 h-11 w-full rounded-xl border border-[var(--border)] bg-white px-3 text-sm outline-none focus:border-[var(--accent)]"
                >
                  <option value="">Tanpa lead khusus</option>
                  {data.staff.map((staff) => (
                    <option key={staff.id} value={staff.id}>
                      {staff.fullName} · @{staff.username}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="xl:col-span-2">
              <button
                type="submit"
                className="inline-flex h-11 items-center gap-2 rounded-xl bg-neutral-950 px-5 text-sm font-semibold text-white transition hover:bg-neutral-800"
              >
                <UsersRound className="size-4" />
                Buat sesi Draft
              </button>
            </div>
          </form>
        </section>
      ) : null}

      <section className="rounded-3xl border border-[var(--border)] bg-white p-5 lg:p-6">
        <div>
          <h2 className="font-semibold text-neutral-950">Sesi yang tersedia</h2>
          <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
            Sesi Draft dapat disiapkan sekarang. Status Aktif menandakan sesi siap
            dipakai ketika mobile scanner Milestone 3 tersedia.
          </p>
        </div>

        {data.sessions.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 px-5 py-10 text-center text-sm text-[var(--muted)]">
            Belum ada sesi migrasi.
          </div>
        ) : (
          <div className="mt-6 grid gap-5 xl:grid-cols-2">
            {data.sessions.map((session) => {
              const assignedIds = new Set(
                session.assignments.map((assignment) => assignment.userId),
              );
              const currentLead = session.assignments.find(
                (assignment) => assignment.assignmentRole === "lead",
              );

              return (
                <article
                  key={session.id}
                  className="rounded-2xl border border-[var(--border)] p-4 lg:p-5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <SessionStatusBadge status={session.status} />
                      <h3 className="mt-3 font-semibold text-neutral-950">
                        {session.name}
                      </h3>
                      <p className="mt-1 text-xs text-[var(--muted)]">
                        {session.locationCode || "Tanpa kode lokasi"}
                        {session.expectedItemCount
                          ? ` · target ${session.expectedItemCount} item`
                          : ""}
                      </p>
                    </div>
                    <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-semibold text-neutral-700">
                      {session.assignments.length} staff
                    </span>
                  </div>

                  {session.notes ? (
                    <p className="mt-4 rounded-xl bg-neutral-50 p-3 text-xs leading-5 text-neutral-600">
                      {session.notes}
                    </p>
                  ) : null}

                  <div className="mt-4 space-y-2">
                    {session.assignments.map((assignment) => (
                      <div
                        key={assignment.userId}
                        className="flex items-center justify-between gap-3 rounded-xl border border-[var(--border)] px-3 py-2"
                      >
                        <span className="min-w-0 text-sm font-medium text-neutral-800">
                          {assignment.fullName}
                        </span>
                        <span className="shrink-0 text-xs font-semibold text-[var(--accent)]">
                          {assignment.assignmentRole === "lead"
                            ? "Migration Lead"
                            : "Operator"}
                        </span>
                      </div>
                    ))}
                  </div>

                  {canManage && ["draft", "active"].includes(session.status) ? (
                    <details className="mt-4 rounded-xl border border-[var(--border)] p-3">
                      <summary className="cursor-pointer text-sm font-semibold text-neutral-800 marker:content-none">
                        <span className="inline-flex items-center gap-2">
                          <UserRoundCog className="size-4" />
                          Ubah penugasan
                        </span>
                      </summary>
                      <form
                        action={updateLegacyMigrationSessionAssignmentsAction}
                        className="mt-4 space-y-3"
                      >
                        <input type="hidden" name="batchId" value={data.batch.id} />
                        <input type="hidden" name="sessionId" value={session.id} />
                        <div className="grid gap-2 sm:grid-cols-2">
                          {data.staff.map((staff) => (
                            <label
                              key={staff.id}
                              className="flex items-center gap-2 rounded-lg bg-neutral-50 px-3 py-2 text-xs font-medium text-neutral-700"
                            >
                              <input
                                type="checkbox"
                                name="assignedUserIds"
                                value={staff.id}
                                defaultChecked={assignedIds.has(staff.id)}
                                className="size-4 accent-[var(--accent)]"
                              />
                              {staff.fullName}
                            </label>
                          ))}
                        </div>
                        <select
                          name="leadUserId"
                          defaultValue={currentLead?.userId ?? ""}
                          className="h-10 w-full rounded-xl border border-[var(--border)] bg-white px-3 text-xs"
                        >
                          <option value="">Tanpa lead khusus</option>
                          {data.staff.map((staff) => (
                            <option key={staff.id} value={staff.id}>
                              {staff.fullName}
                            </option>
                          ))}
                        </select>
                        <button
                          type="submit"
                          className="h-10 rounded-xl bg-neutral-950 px-4 text-xs font-semibold text-white"
                        >
                          Simpan penugasan
                        </button>
                      </form>
                    </details>
                  ) : null}

                  {canManage ? (
                    <div className="mt-4 flex flex-wrap gap-2 border-t border-[var(--border)] pt-4">
                      {session.status === "draft" ? (
                        <form action={transitionLegacyMigrationSessionAction}>
                          <input type="hidden" name="batchId" value={data.batch.id} />
                          <input type="hidden" name="sessionId" value={session.id} />
                          <input type="hidden" name="transition" value="start" />
                          <button className="inline-flex h-9 items-center gap-2 rounded-xl bg-emerald-700 px-3 text-xs font-semibold text-white">
                            <Play className="size-3.5" /> Mulai sesi
                          </button>
                        </form>
                      ) : null}
                      {session.status === "active" ? (
                        <form action={transitionLegacyMigrationSessionAction}>
                          <input type="hidden" name="batchId" value={data.batch.id} />
                          <input type="hidden" name="sessionId" value={session.id} />
                          <input type="hidden" name="transition" value="lock" />
                          <button className="inline-flex h-9 items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3 text-xs font-semibold text-amber-800">
                            <LockKeyhole className="size-3.5" /> Kunci
                          </button>
                        </form>
                      ) : null}
                      {session.status === "locked" ? (
                        <form action={transitionLegacyMigrationSessionAction}>
                          <input type="hidden" name="batchId" value={data.batch.id} />
                          <input type="hidden" name="sessionId" value={session.id} />
                          <input type="hidden" name="transition" value="reopen" />
                          <button className="inline-flex h-9 items-center gap-2 rounded-xl border border-[var(--border)] px-3 text-xs font-semibold text-neutral-700">
                            <RotateCcw className="size-3.5" /> Buka kembali
                          </button>
                        </form>
                      ) : null}
                      {["draft", "active", "locked"].includes(session.status) ? (
                        <form action={transitionLegacyMigrationSessionAction}>
                          <input type="hidden" name="batchId" value={data.batch.id} />
                          <input type="hidden" name="sessionId" value={session.id} />
                          <input type="hidden" name="transition" value="cancel" />
                          <button className="inline-flex h-9 items-center gap-2 rounded-xl px-3 text-xs font-semibold text-red-700 hover:bg-red-50">
                            <XCircle className="size-3.5" /> Batalkan
                          </button>
                        </form>
                      ) : null}
                      {session.status === "completed" ? (
                        <span className="inline-flex h-9 items-center gap-2 rounded-xl bg-blue-50 px-3 text-xs font-semibold text-blue-700">
                          <CheckCircle2 className="size-3.5" /> Selesai
                        </span>
                      ) : null}
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
