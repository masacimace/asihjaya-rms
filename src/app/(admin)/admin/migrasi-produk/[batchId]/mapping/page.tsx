import {
  ArrowLeft,
  CheckCircle2,
  CircleOff,
  FolderTree,
  Link2,
  PackagePlus,
  RotateCcw,
  ShieldAlert,
} from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import {
  autoCreateLegacyDraftMastersAction,
  ignoreLegacyMasterMappingAction,
  mapLegacyMasterToExistingAction,
  resetLegacyMasterMappingAction,
} from "@/app/actions/legacy-migration-management";
import { getLegacyMasterMappingData } from "@/features/legacy-migration/management-queries";
import {
  hasPermission,
  requireAnyPermission,
} from "@/lib/auth/session";
import { cn } from "@/lib/utils";

export const metadata = { title: "Mapping Master Produk Legacy" };
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function formatNumber(value: number) {
  return new Intl.NumberFormat("id-ID").format(value);
}

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

function MappingBadge({ status }: { status: "pending" | "mapped" | "ignored" }) {
  const config = {
    pending: {
      label: "Pending",
      className: "border-amber-200 bg-amber-50 text-amber-700",
    },
    mapped: {
      label: "Terpetakan",
      className: "border-emerald-200 bg-emerald-50 text-emerald-700",
    },
    ignored: {
      label: "Diabaikan",
      className: "border-neutral-300 bg-neutral-100 text-neutral-700",
    },
  }[status];

  return (
    <span
      className={cn(
        "inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold",
        config.className,
      )}
    >
      {config.label}
    </span>
  );
}

export default async function LegacyMasterMappingPage({
  params,
  searchParams,
}: {
  params: Promise<{ batchId: string }>;
  searchParams: Promise<{ type?: string; message?: string }>;
}) {
  const auth = await requireAnyPermission([
    "migration.view",
    "migration.mapping.manage",
  ]);
  const [{ batchId }, query] = await Promise.all([params, searchParams]);
  const data = await getLegacyMasterMappingData(auth, batchId);
  if (!data) notFound();

  const canManage = hasPermission(auth, "migration.mapping.manage");
  const totalMappings =
    data.totals.pending + data.totals.mapped + data.totals.ignored;

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
              <FolderTree className="size-3.5" />
              Milestone 2 · Master Mapping
            </p>
            <h1 className="mt-4 text-2xl font-semibold text-neutral-950 sm:text-3xl">
              Mapping master produk legacy
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--muted)]">
              {data.batch.fileName} · {data.batch.outletName}. Satu mapping berlaku
              untuk seluruh item dengan kode master legacy yang sama, sehingga
              manager tidak perlu mengatur master per barang.
            </p>
          </div>

          <Link
            href={`/admin/migrasi-produk/${data.batch.id}/sesi`}
            className="inline-flex h-11 items-center justify-center rounded-xl border border-[var(--border)] bg-white px-4 text-sm font-semibold text-neutral-900 transition hover:bg-neutral-50"
          >
            Kelola sesi per etalase
          </Link>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["Total master", totalMappings, "neutral"],
          ["Terpetakan", data.totals.mapped, "emerald"],
          ["Pending", data.totals.pending, "amber"],
          ["Item tercakup mapping", data.totals.mappedItemCount, "accent"],
        ].map(([label, value, tone]) => (
          <div
            key={String(label)}
            className={cn(
              "rounded-3xl border p-5",
              tone === "emerald"
                ? "border-emerald-200 bg-emerald-50"
                : tone === "amber"
                  ? "border-amber-200 bg-amber-50"
                  : "border-[var(--border)] bg-white",
            )}
          >
            <p className="text-2xl font-semibold text-neutral-950">
              {formatNumber(Number(value))}
            </p>
            <p className="mt-1 text-sm text-[var(--muted)]">{String(label)}</p>
          </div>
        ))}
      </section>

      <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="rounded-3xl border border-[var(--border)] bg-white p-5 lg:p-6">
          <h2 className="font-semibold text-neutral-950">Jalur cepat yang aman</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
            Sistem dapat membuat draft Product Master dari seluruh mapping pending.
            Kategori dinormalisasi otomatis, termasuk Giwang ke kategori Anting.
            Semua hasil tetap berstatus Draft dan belum dapat mengaktifkan stok.
          </p>
          {canManage && data.totals.pending > 0 ? (
            <form action={autoCreateLegacyDraftMastersAction} className="mt-5">
              <input type="hidden" name="batchId" value={data.batch.id} />
              <button
                type="submit"
                className="inline-flex h-11 items-center gap-2 rounded-xl bg-neutral-950 px-4 text-sm font-semibold text-white transition hover:bg-neutral-800"
              >
                <PackagePlus className="size-4" />
                Buat draft untuk mapping pending
              </button>
            </form>
          ) : null}
        </div>

        <div className="rounded-3xl border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-900">
          <p className="flex items-center gap-2 font-semibold">
            <ShieldAlert className="size-4" />
            Tidak mengatur harga per item
          </p>
          <p className="mt-2">
            Harga legacy tetap referensi. Mapping hanya menetapkan kategori dan
            Product Master tujuan. Pricing aktif tetap dikelola melalui aturan
            sistem baru.
          </p>
        </div>
      </section>

      <section className="rounded-3xl border border-[var(--border)] bg-white p-5 lg:p-6">
        <div>
          <h2 className="font-semibold text-neutral-950">Daftar master legacy</h2>
          <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
            Review per master, bukan per item. Mapping bersih dapat dibuat massal;
            manager cukup menangani pengecualian.
          </p>
        </div>

        <div className="mt-6 space-y-4">
          {data.mappings.map((mapping) => (
            <article
              key={mapping.id}
              className="rounded-2xl border border-[var(--border)] p-4 lg:p-5"
            >
              <div className="grid gap-5 xl:grid-cols-[minmax(260px,0.8fr)_minmax(340px,1.2fr)]">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <MappingBadge status={mapping.status} />
                    <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-semibold text-neutral-700">
                      {formatNumber(mapping.itemCount)} item
                    </span>
                  </div>
                  <p className="mt-3 font-mono text-sm font-semibold text-neutral-950">
                    {mapping.legacyMasterCode}
                  </p>
                  <h3 className="mt-1 font-semibold text-neutral-950">
                    {mapping.legacyMasterName}
                  </h3>
                  <p className="mt-1 text-sm text-[var(--muted)]">
                    Kategori legacy: {mapping.legacyCategory ?? "-"}
                  </p>
                  {mapping.normalizedCategoryName ? (
                    <p className="mt-1 text-xs text-neutral-500">
                      Normalisasi: {mapping.normalizedCategoryName}
                    </p>
                  ) : null}
                </div>

                <div>
                  {mapping.status === "mapped" ? (
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                      <p className="flex items-center gap-2 text-sm font-semibold text-emerald-900">
                        <CheckCircle2 className="size-4" />
                        {mapping.targetProductMasterName}
                      </p>
                      <p className="mt-1 text-xs leading-5 text-emerald-800">
                        {mapping.targetProductMasterCode} · {mapping.targetCategoryName}
                        {mapping.targetProductMasterStatus
                          ? ` · ${mapping.targetProductMasterStatus}`
                          : ""}
                      </p>
                      <p className="mt-2 text-xs leading-5 text-emerald-800">
                        {mapping.reviewNotes ?? "Mapping sudah direview."}
                      </p>
                    </div>
                  ) : mapping.status === "ignored" ? (
                    <div className="rounded-2xl border border-neutral-300 bg-neutral-50 p-4">
                      <p className="flex items-center gap-2 text-sm font-semibold text-neutral-900">
                        <CircleOff className="size-4" />
                        Master diabaikan
                      </p>
                      <p className="mt-2 text-xs leading-5 text-neutral-600">
                        {mapping.reviewNotes}
                      </p>
                    </div>
                  ) : canManage ? (
                    <div className="grid gap-3">
                      <form
                        action={mapLegacyMasterToExistingAction}
                        className="grid gap-3 rounded-2xl bg-neutral-50 p-4"
                      >
                        <input type="hidden" name="batchId" value={data.batch.id} />
                        <input type="hidden" name="mappingId" value={mapping.id} />
                        <label className="text-xs font-semibold text-neutral-700">
                          Petakan ke Product Master yang sudah ada
                          <select
                            name="targetProductMasterId"
                            required
                            defaultValue=""
                            className="mt-2 h-11 w-full rounded-xl border border-[var(--border)] bg-white px-3 text-sm outline-none focus:border-[var(--accent)]"
                          >
                            <option value="" disabled>
                              Pilih Product Master
                            </option>
                            {data.productMasters.map((master) => (
                              <option key={master.id} value={master.id}>
                                {master.name} · {master.code} · {master.categoryName}
                              </option>
                            ))}
                          </select>
                        </label>
                        <input
                          name="notes"
                          placeholder="Catatan mapping (opsional)"
                          className="h-11 rounded-xl border border-[var(--border)] bg-white px-3 text-sm outline-none focus:border-[var(--accent)]"
                        />
                        <button
                          type="submit"
                          className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-neutral-950 px-4 text-sm font-semibold text-white"
                        >
                          <Link2 className="size-4" />
                          Simpan mapping
                        </button>
                      </form>

                      <form
                        action={ignoreLegacyMasterMappingAction}
                        className="grid gap-3 rounded-2xl border border-neutral-200 p-4"
                      >
                        <input type="hidden" name="batchId" value={data.batch.id} />
                        <input type="hidden" name="mappingId" value={mapping.id} />
                        <input
                          name="reason"
                          required
                          minLength={5}
                          placeholder="Alasan master tidak digunakan"
                          className="h-11 rounded-xl border border-[var(--border)] px-3 text-sm outline-none focus:border-[var(--accent)]"
                        />
                        <button
                          type="submit"
                          className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-[var(--border)] px-4 text-sm font-semibold text-neutral-800"
                        >
                          <CircleOff className="size-4" />
                          Abaikan master
                        </button>
                      </form>
                    </div>
                  ) : (
                    <p className="rounded-2xl bg-neutral-50 p-4 text-sm text-[var(--muted)]">
                      Mapping ini belum direview manager.
                    </p>
                  )}

                  {canManage && mapping.status !== "pending" ? (
                    <form action={resetLegacyMasterMappingAction} className="mt-3">
                      <input type="hidden" name="batchId" value={data.batch.id} />
                      <input type="hidden" name="mappingId" value={mapping.id} />
                      <button
                        type="submit"
                        className="inline-flex h-9 items-center gap-2 rounded-xl px-3 text-xs font-semibold text-neutral-600 transition hover:bg-neutral-100"
                      >
                        <RotateCcw className="size-3.5" />
                        Reset ke pending
                      </button>
                    </form>
                  ) : null}
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
