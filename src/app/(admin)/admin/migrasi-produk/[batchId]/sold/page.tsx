import {
  ArrowLeft,
  ClipboardPaste,
  PackageCheck,
  PackageX,
  RotateCcw,
  ScanBarcode,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import {
  assignLegacySoldRecordSessionAction,
  markLegacySoldDuringMigrationAction,
  revertLegacySoldDuringMigrationAction,
} from "@/app/actions/legacy-migration-sold";
import { getLegacySoldDuringMigrationData } from "@/features/legacy-migration/sold-queries";
import { MAX_SOLD_DURING_MIGRATION_BARCODES } from "@/features/legacy-migration/sold-rules";
import { requirePermission } from "@/lib/auth/session";
import { getBusinessDateKey } from "@/lib/time/business-time";
import { cn } from "@/lib/utils";

export const metadata = { title: "Terjual di Sistem Lama" };
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

function formatDate(value: Date, timeZone: string) {
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone,
  }).format(value);
}

function formatDateTime(value: Date, timeZone: string) {
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone,
  }).format(value);
}

export default async function LegacySoldDuringMigrationPage({
  params,
  searchParams,
}: {
  params: Promise<{ batchId: string }>;
  searchParams: Promise<{ type?: string; message?: string }>;
}) {
  const auth = await requirePermission("migration.sold.manage");
  const [{ batchId }, query] = await Promise.all([params, searchParams]);
  const data = await getLegacySoldDuringMigrationData(auth, batchId);
  if (!data) notFound();

  const today = getBusinessDateKey(new Date(), auth.organization.timezone);

  return (
    <div className="space-y-6">
      {flashMessage(query.type, query.message)}

      <section className="rounded-3xl border border-[var(--border)] bg-white p-6 lg:p-7">
        <Link
          href={`/admin/migrasi-produk/${data.batch.id}`}
          className="inline-flex items-center gap-2 text-sm font-semibold text-neutral-700 hover:text-neutral-950"
        >
          <ArrowLeft className="size-4" /> Kembali ke batch migrasi
        </Link>

        <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_360px] lg:items-end">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-700">
              <PackageX className="size-3.5" /> Milestone 5A
            </p>
            <h1 className="mt-4 text-2xl font-semibold text-neutral-950 sm:text-3xl">
              Terjual di Sistem Lama
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--muted)]">
              Tempel barcode barang yang masih terjual lewat sistem lama selama
              migrasi. Barcode langsung dikecualikan dari scan, approval, dan
              cutover tanpa approval tambahan.
            </p>
          </div>

          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
            <p className="flex items-center gap-2 font-semibold">
              <ShieldCheck className="size-4" /> Flow sederhana dan dapat dibatalkan
            </p>
            <p className="mt-1">
              Salah input dapat dipulihkan melalui tombol Batalkan dengan alasan
              wajib. Tidak ada inventory movement pada tahap ini.
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
          <PackageX className="size-5 text-red-700" />
          <p className="mt-3 text-2xl font-semibold text-red-900">
            {data.summary.totalActive}
          </p>
          <p className="text-xs text-red-800">Total dikecualikan</p>
        </div>
        <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
          <ScanBarcode className="size-5 text-blue-700" />
          <p className="mt-3 text-2xl font-semibold text-blue-900">
            {data.summary.beforeScan}
          </p>
          <p className="text-xs text-blue-800">Terjual sebelum discan</p>
        </div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <ClipboardPaste className="size-5 text-amber-700" />
          <p className="mt-3 text-2xl font-semibold text-amber-900">
            {data.summary.verificationExcluded}
          </p>
          <p className="text-xs text-amber-800">Verification dikecualikan</p>
        </div>
        <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
          <PackageCheck className="size-5 text-neutral-700" />
          <p className="mt-3 text-2xl font-semibold text-neutral-900">
            {data.summary.holdMarkedSold}
          </p>
          <p className="text-xs text-neutral-700">Migration hold ditandai sold</p>
        </div>
      </section>

      {data.summary.unassignedSession > 0 ? (
        <section className="rounded-3xl border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-950">
          <p className="font-semibold">Ada catatan lama tanpa sesi etalase</p>
          <p className="mt-1">
            {data.summary.unassignedSession} catatan aktif belum memiliki sesi dan
            akan memblokir seluruh cutover. Catatan baru selalu mewajibkan sesi.
          </p>
        </section>
      ) : null}

      <section className="rounded-3xl border border-[var(--border)] bg-white p-5 lg:p-6">
        <div>
          <h2 className="font-semibold text-neutral-950">
            Tandai barcode terjual
          </h2>
          <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
            Bisa satu barcode atau tempel satu kolom dari Excel. Maksimal {" "}
            {MAX_SOLD_DURING_MIGRATION_BARCODES} barcode sekali proses; nol di
            depan tetap dipertahankan.
          </p>
        </div>

        <form action={markLegacySoldDuringMigrationAction} className="mt-5 space-y-4">
          <input type="hidden" name="batchId" value={data.batch.id} />
          <label className="block">
            <span className="text-sm font-semibold text-neutral-800">
              Sesi / etalase
            </span>
            <select
              name="sessionId"
              required
              defaultValue=""
              className="mt-2 h-11 w-full rounded-xl border border-[var(--border)] bg-white px-3 text-sm outline-none focus:border-[var(--accent)]"
            >
              <option value="" disabled>
                Pilih sesi asal barang
              </option>
              {data.sessions.map((session) => (
                <option key={session.id} value={session.id}>
                  {session.name}
                  {session.locationCode ? ` · ${session.locationCode}` : ""}
                  {` · ${session.status}`}
                </option>
              ))}
            </select>
            <span className="mt-1 block text-xs leading-5 text-[var(--muted)]">
              Barcode yang sudah discan harus berasal dari sesi yang sama.
            </span>
          </label>

          <label className="block">
            <span className="text-sm font-semibold text-neutral-800">
              Barcode terjual
            </span>
            <textarea
              name="barcodes"
              required
              rows={8}
              placeholder={"003037\n918161\n850427"}
              className="mt-2 w-full rounded-2xl border border-[var(--border)] px-4 py-3 font-mono text-sm outline-none transition focus:border-[var(--accent)]"
            />
          </label>

          <div className="grid gap-4 lg:grid-cols-3">
            <label className="block">
              <span className="text-sm font-semibold text-neutral-800">
                Tanggal terjual
              </span>
              <input
                type="date"
                name="soldDate"
                required
                defaultValue={today}
                className="mt-2 h-11 w-full rounded-xl border border-[var(--border)] px-3 text-sm outline-none focus:border-[var(--accent)]"
              />
            </label>
            <label className="block">
              <span className="text-sm font-semibold text-neutral-800">
                Referensi legacy <span className="font-normal text-[var(--muted)]">(opsional)</span>
              </span>
              <input
                name="legacyReference"
                maxLength={160}
                placeholder="Nomor transaksi / laporan"
                className="mt-2 h-11 w-full rounded-xl border border-[var(--border)] px-3 text-sm outline-none focus:border-[var(--accent)]"
              />
            </label>
            <label className="block">
              <span className="text-sm font-semibold text-neutral-800">
                Catatan <span className="font-normal text-[var(--muted)]">(opsional)</span>
              </span>
              <input
                name="notes"
                maxLength={2000}
                placeholder="Contoh: laporan penjualan sore"
                className="mt-2 h-11 w-full rounded-xl border border-[var(--border)] px-3 text-sm outline-none focus:border-[var(--accent)]"
              />
            </label>
          </div>

          <button className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-red-700 px-5 text-sm font-semibold text-white transition hover:bg-red-800">
            <PackageX className="size-4" /> Tandai terjual dan kecualikan
          </button>
        </form>
      </section>

      <section className="rounded-3xl border border-[var(--border)] bg-white p-5 lg:p-6">
        <div>
          <h2 className="font-semibold text-neutral-950">Penandaan aktif terbaru</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Menampilkan maksimal 100 catatan terbaru untuk batch {data.batch.fileName}.
          </p>
        </div>

        {data.records.length === 0 ? (
          <div className="mt-5 rounded-2xl border border-dashed border-[var(--border)] p-8 text-center text-sm text-[var(--muted)]">
            Belum ada barcode yang ditandai terjual di sistem lama.
          </div>
        ) : (
          <div className="mt-5 space-y-3">
            {data.records.map((record) => (
              <article
                key={record.id}
                className="rounded-2xl border border-[var(--border)] p-4"
              >
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-sm font-semibold text-red-700">
                        {record.barcodeValue}
                      </span>
                      <span className="rounded-full bg-red-50 px-2.5 py-1 text-[11px] font-semibold text-red-700">
                        Dikecualikan
                      </span>
                      <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-[11px] font-semibold text-neutral-700">
                        {record.productItemId
                          ? "Migration hold → sold"
                          : record.verificationId
                            ? "Verification"
                            : "Belum discan"}
                      </span>
                    </div>
                    <p className="mt-2 text-sm font-semibold text-neutral-900">
                      {record.itemName ?? "Barang legacy belum menjadi Product Item"}
                      {record.itemSku ? ` · ${record.itemSku}` : ""}
                    </p>
                    <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
                      Sesi {record.sessionName ?? "belum ditentukan"} · terjual {formatDate(record.soldAt, auth.organization.timezone)} ·
                      dilaporkan {record.reportedByName} pada {" "}
                      {formatDateTime(record.reportedAt, auth.organization.timezone)}
                    </p>
                    {record.legacyReference || record.notes ? (
                      <p className="mt-2 text-xs leading-5 text-neutral-600">
                        {[record.legacyReference, record.notes]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    ) : null}
                  </div>

                  {record.sessionId ? (
                    <form
                      action={revertLegacySoldDuringMigrationAction}
                      className="flex w-full flex-col gap-2 sm:flex-row xl:w-auto"
                    >
                      <input type="hidden" name="batchId" value={data.batch.id} />
                      <input type="hidden" name="soldRecordId" value={record.id} />
                      <input
                        name="revertReason"
                        required
                        minLength={5}
                        maxLength={2000}
                        placeholder="Alasan pembatalan"
                        className="h-10 min-w-0 flex-1 rounded-xl border border-[var(--border)] px-3 text-sm outline-none focus:border-[var(--accent)] xl:w-56"
                      />
                      <button className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-[var(--border)] px-4 text-sm font-semibold text-neutral-800 transition hover:bg-neutral-50">
                        <RotateCcw className="size-4" /> Batalkan
                      </button>
                    </form>
                  ) : (
                    <form
                      action={assignLegacySoldRecordSessionAction}
                      className="flex w-full flex-col gap-2 sm:flex-row xl:w-auto"
                    >
                      <input type="hidden" name="batchId" value={data.batch.id} />
                      <input type="hidden" name="soldRecordId" value={record.id} />
                      <select
                        name="sessionId"
                        required
                        defaultValue=""
                        className="h-10 min-w-0 rounded-xl border border-amber-300 bg-white px-3 text-sm outline-none xl:w-60"
                      >
                        <option value="" disabled>Pilih sesi etalase</option>
                        {data.sessions.map((session) => (
                          <option key={session.id} value={session.id}>
                            {session.name}{session.locationCode ? ` · ${session.locationCode}` : ""}
                          </option>
                        ))}
                      </select>
                      <button className="inline-flex h-10 items-center justify-center rounded-xl bg-amber-700 px-4 text-sm font-semibold text-white">
                        Simpan sesi
                      </button>
                    </form>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
