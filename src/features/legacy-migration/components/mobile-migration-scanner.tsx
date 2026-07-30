"use client";

import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  ExternalLink,
  Loader2,
  PackageSearch,
  RotateCcw,
  ScanBarcode,
  ShieldAlert,
} from "lucide-react";
import { useRouter } from "next/navigation";
import {
  useMemo,
  useState,
  useTransition,
  type FormEvent,
} from "react";

import {
  lookupLegacyMigrationBarcodeAction,
  submitLegacyMigrationVerificationAction,
} from "@/app/actions/legacy-migration-verification";
import { CameraScannerModal } from "@/components/scanner/camera-scanner-modal";
import type {
  LegacyMigrationLookupResult,
  LegacyMigrationRecentVerification,
  LegacyMigrationScannerProductMaster,
  LegacyMigrationScannerSession,
  LegacyMigrationSubmissionResult,
} from "@/features/legacy-migration/verification-contracts";
import { cn } from "@/lib/utils";

type Props = {
  session: LegacyMigrationScannerSession;
  productMasters: LegacyMigrationScannerProductMaster[];
  recentVerifications: LegacyMigrationRecentVerification[];
  summary: {
    total: number;
    submitted: number;
    needsReview: number;
  };
};

function formatNumber(value: string | null) {
  if (!value) return "—";
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return value;
  return new Intl.NumberFormat("id-ID", { maximumFractionDigits: 3 }).format(
    parsed,
  );
}

function statusLabel(status: string) {
  if (status === "needs_review") return "Perlu review";
  if (status === "submitted") return "Terkirim";
  if (status === "approved") return "Disetujui";
  if (status === "returned") return "Dikembalikan";
  if (status === "rejected") return "Ditolak";
  if (status === "sold_during_migration") return "Terjual saat migrasi";
  if (status === "activated") return "Diaktifkan";
  return status;
}

export function MobileMigrationScanner({
  session,
  productMasters,
  recentVerifications,
  summary,
}: Props) {
  const router = useRouter();
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isLookupPending, startLookupTransition] = useTransition();
  const [isSubmitPending, startSubmitTransition] = useTransition();
  const [lookup, setLookup] = useState<LegacyMigrationLookupResult | null>(null);
  const [submitResult, setSubmitResult] =
    useState<LegacyMigrationSubmissionResult | null>(null);

  const defaultProductMasterId = useMemo(() => {
    if (!lookup?.ok || !lookup.legacy?.mappedProductMasterId) return "";
    return lookup.legacy.mappedProductMasterId;
  }, [lookup]);

  function lookupBarcode(value: string) {
    setSubmitResult(null);
    startLookupTransition(async () => {
      const result = await lookupLegacyMigrationBarcodeAction({
        sessionId: session.id,
        barcode: value,
      });
      setLookup(result);
    });
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    setSubmitResult(null);

    startSubmitTransition(async () => {
      const result = await submitLegacyMigrationVerificationAction(formData);
      setSubmitResult(result);
      if (result.ok) {
        setLookup(null);
        form.reset();
        router.refresh();
      }
    });
  }

  const isActive = session.status === "active";

  return (
    <div className="space-y-5">
      <section className="rounded-3xl border border-[var(--border)] bg-white p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">
              {session.assignmentRole === "lead"
                ? "Migration Lead"
                : session.assignmentRole === "manager_override"
                  ? "Manager Override"
                  : "Migration Operator"}
            </p>
            <h1 className="mt-2 text-2xl font-semibold text-neutral-950">
              {session.name}
            </h1>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
              {session.outletName}
              {session.locationCode ? ` · ${session.locationCode}` : ""}
              {session.expectedItemCount
                ? ` · target ${session.expectedItemCount} item`
                : ""}
            </p>
          </div>

          <span
            className={cn(
              "inline-flex w-fit rounded-full border px-3 py-1.5 text-xs font-semibold",
              isActive
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-amber-200 bg-amber-50 text-amber-700",
            )}
          >
            {isActive ? "Sesi aktif" : `Sesi ${session.status}`}
          </span>
        </div>

        {session.notes ? (
          <div className="mt-4 rounded-2xl bg-neutral-50 px-4 py-3 text-sm leading-6 text-neutral-700">
            {session.notes}
          </div>
        ) : null}
      </section>

      <section className="grid grid-cols-3 gap-3">
        <div className="rounded-2xl border border-[var(--border)] bg-white p-4">
          <p className="text-2xl font-semibold text-neutral-950">{summary.total}</p>
          <p className="mt-1 text-xs text-[var(--muted)]">Total scan</p>
        </div>
        <div className="rounded-2xl border border-[var(--border)] bg-white p-4">
          <p className="text-2xl font-semibold text-emerald-700">
            {summary.submitted}
          </p>
          <p className="mt-1 text-xs text-[var(--muted)]">Terkirim</p>
        </div>
        <div className="rounded-2xl border border-[var(--border)] bg-white p-4">
          <p className="text-2xl font-semibold text-amber-700">
            {summary.needsReview}
          </p>
          <p className="mt-1 text-xs text-[var(--muted)]">Review</p>
        </div>
      </section>

      {!isActive ? (
        <section className="rounded-3xl border border-amber-200 bg-amber-50 p-5 text-amber-900">
          <div className="flex gap-3">
            <ShieldAlert className="mt-0.5 size-5 shrink-0" />
            <div>
              <h2 className="font-semibold">Scanner tidak aktif</h2>
              <p className="mt-1 text-sm leading-6">
                Manager harus membuka kembali atau memulai sesi sebelum barcode
                dapat diproses.
              </p>
            </div>
          </div>
        </section>
      ) : (
        <section className="rounded-3xl border border-[var(--border)] bg-white p-5">
          <div className="flex items-start gap-3">
            <div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent)]">
              <ScanBarcode className="size-5" />
            </div>
            <div>
              <h2 className="font-semibold text-neutral-950">
                Scan barang fisik
              </h2>
              <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
                Hasil scan belum menjadi stok aktif. Barcode lama tetap
                dipertahankan dan data export hanya menjadi referensi.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsScannerOpen(true)}
            disabled={isLookupPending}
            className="mt-5 inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-neutral-950 px-5 text-sm font-semibold text-white transition hover:bg-neutral-800 disabled:cursor-wait disabled:bg-neutral-400"
          >
            {isLookupPending ? (
              <Loader2 className="size-5 animate-spin" />
            ) : (
              <Camera className="size-5" />
            )}
            Buka kamera / input manual
          </button>
        </section>
      )}

      {lookup && !lookup.ok ? (
        <section className="rounded-3xl border border-red-200 bg-red-50 p-5 text-red-800">
          <div className="flex gap-3">
            <AlertTriangle className="mt-0.5 size-5 shrink-0" />
            <div>
              <h2 className="font-semibold">Barcode tidak dapat diproses</h2>
              <p className="mt-1 text-sm leading-6">{lookup.message}</p>
              <button
                type="button"
                onClick={() => setLookup(null)}
                className="mt-3 inline-flex items-center gap-2 text-sm font-semibold"
              >
                <RotateCcw className="size-4" />
                Scan barcode lain
              </button>
            </div>
          </div>
        </section>
      ) : null}

      {lookup?.ok ? (
        <section className="rounded-3xl border border-[var(--border)] bg-white p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
                Barcode fisik
              </p>
              <p className="mt-1 font-mono text-2xl font-semibold text-neutral-950">
                {lookup.barcode}
              </p>
            </div>
            <span
              className={cn(
                "inline-flex w-fit rounded-full px-3 py-1.5 text-xs font-semibold",
                lookup.source === "legacy_match"
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-amber-50 text-amber-700",
              )}
            >
              {lookup.source === "legacy_match"
                ? "Ditemukan di export"
                : "Tidak ada di export"}
            </span>
          </div>

          {lookup.messages.length > 0 ? (
            <div className="mt-4 space-y-2">
              {lookup.messages.map((message) => (
                <p
                  key={message}
                  className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-800"
                >
                  {message}
                </p>
              ))}
            </div>
          ) : null}

          {lookup.legacy ? (
            <div className="mt-5 rounded-2xl bg-neutral-50 p-4">
              <div className="flex items-center gap-2">
                <PackageSearch className="size-4 text-[var(--accent)]" />
                <h3 className="text-sm font-semibold text-neutral-900">
                  Referensi sistem lama — wajib diperiksa
                </h3>
              </div>
              <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-xs text-[var(--muted)]">Master legacy</dt>
                  <dd className="mt-1 font-medium text-neutral-900">
                    {lookup.legacy.masterCode ?? "—"} · {lookup.legacy.masterName ?? "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-[var(--muted)]">Mapping baru</dt>
                  <dd className="mt-1 font-medium text-neutral-900">
                    {lookup.legacy.mappedProductMasterName ?? "Belum dipetakan"}
                  </dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-xs text-[var(--muted)]">Nama SKU lama</dt>
                  <dd className="mt-1 font-medium text-neutral-900">
                    {lookup.legacy.itemName ?? "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-[var(--muted)]">Berat lama</dt>
                  <dd className="mt-1 font-medium text-neutral-900">
                    {formatNumber(lookup.legacy.weightGram)} gram
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-[var(--muted)]">Kadar lama</dt>
                  <dd className="mt-1 font-medium text-neutral-900">
                    {formatNumber(lookup.legacy.purity)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-[var(--muted)]">Warna lama</dt>
                  <dd className="mt-1 font-medium text-neutral-900">
                    {lookup.legacy.color ?? "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-[var(--muted)]">Validasi export</dt>
                  <dd className="mt-1 font-medium text-neutral-900">
                    {lookup.legacy.validationStatus}
                  </dd>
                </div>
              </dl>
            </div>
          ) : null}

          <form
            key={`${lookup.barcode}:${lookup.source}`}
            onSubmit={handleSubmit}
            className="mt-5 space-y-5"
          >
            <input type="hidden" name="sessionId" value={session.id} />
            <input type="hidden" name="barcode" value={lookup.barcode} />
            <input type="hidden" name="source" value={lookup.source} />
            <input
              type="hidden"
              name="legacyRowId"
              value={lookup.legacy?.rowId ?? ""}
            />

            <label className="block text-sm font-medium text-neutral-800">
              Product Master
              <select
                name="targetProductMasterId"
                required
                defaultValue={defaultProductMasterId}
                className="mt-2 h-12 w-full rounded-xl border border-[var(--border)] bg-white px-3 text-sm outline-none focus:border-[var(--accent)]"
              >
                <option value="">Pilih master produk</option>
                {productMasters.map((master) => (
                  <option key={master.id} value={master.id}>
                    {master.categoryName} · {master.code} · {master.name} ({master.status})
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-sm font-medium text-neutral-800">
              Nama/deskripsi item
              <input
                name="verifiedItemName"
                required
                minLength={2}
                maxLength={240}
                defaultValue={lookup.legacy?.itemName ?? ""}
                placeholder="Nama item fisik"
                className="mt-2 h-12 w-full rounded-xl border border-[var(--border)] px-3 text-sm outline-none focus:border-[var(--accent)]"
              />
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm font-medium text-neutral-800">
                Berat aktual (gram)
                <input
                  name="verifiedWeightGram"
                  required
                  inputMode="decimal"
                  defaultValue={lookup.legacy?.weightGram ?? ""}
                  placeholder="0.000"
                  className="mt-2 h-12 w-full rounded-xl border border-[var(--border)] px-3 text-sm outline-none focus:border-[var(--accent)]"
                />
              </label>

              <label className="block text-sm font-medium text-neutral-800">
                Kadar aktual
                <input
                  name="verifiedPurity"
                  required
                  inputMode="decimal"
                  defaultValue={lookup.legacy?.purity ?? ""}
                  placeholder="40"
                  className="mt-2 h-12 w-full rounded-xl border border-[var(--border)] px-3 text-sm outline-none focus:border-[var(--accent)]"
                />
              </label>

              <label className="block text-sm font-medium text-neutral-800">
                Kadar tukaran
                <input
                  name="verifiedExchangePurity"
                  inputMode="decimal"
                  defaultValue={lookup.legacy?.exchangePurity ?? ""}
                  placeholder="Opsional"
                  className="mt-2 h-12 w-full rounded-xl border border-[var(--border)] px-3 text-sm outline-none focus:border-[var(--accent)]"
                />
              </label>

              <label className="block text-sm font-medium text-neutral-800">
                Warna
                <input
                  name="verifiedColor"
                  maxLength={120}
                  defaultValue={lookup.legacy?.color ?? ""}
                  placeholder="Poles / Kuning / Kombinasi"
                  className="mt-2 h-12 w-full rounded-xl border border-[var(--border)] px-3 text-sm outline-none focus:border-[var(--accent)]"
                />
              </label>
            </div>

            <label className="block text-sm font-medium text-neutral-800">
              Kondisi fisik
              <select
                name="condition"
                defaultValue="good"
                className="mt-2 h-12 w-full rounded-xl border border-[var(--border)] bg-white px-3 text-sm outline-none focus:border-[var(--accent)]"
              >
                <option value="good">Baik</option>
                <option value="damaged">Rusak / perlu pemeriksaan</option>
              </select>
            </label>

            {lookup.legacy?.imageUrl ? (
              <div className="rounded-2xl border border-[var(--border)] p-4">
                <label className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    name="useLegacyImage"
                    defaultChecked
                    className="mt-1 size-4 accent-[var(--accent)]"
                  />
                  <span>
                    <span className="block text-sm font-semibold text-neutral-900">
                      Gunakan foto referensi legacy
                    </span>
                    <span className="mt-1 block text-xs leading-5 text-[var(--muted)]">
                      Hilangkan centang dan unggah foto baru bila foto lama tidak
                      sesuai.
                    </span>
                  </span>
                </label>
                <a
                  href={lookup.legacy.imageUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 inline-flex items-center gap-2 text-xs font-semibold text-[var(--accent)]"
                >
                  <ExternalLink className="size-3.5" />
                  Buka foto legacy
                </a>
              </div>
            ) : null}

            <label className="block rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 p-4 text-sm font-medium text-neutral-800">
              <span className="flex items-center gap-2">
                <Camera className="size-4" />
                Foto aktual{
                  lookup.source === "physical_unmatched" ||
                  !lookup.legacy?.imageUrl
                    ? " (wajib)"
                    : " (opsional)"
                }
              </span>
              <input
                name="image"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                capture="environment"
                required={!lookup.legacy?.imageUrl}
                className="mt-3 block w-full text-xs text-neutral-600 file:mr-3 file:rounded-lg file:border-0 file:bg-white file:px-3 file:py-2 file:text-xs file:font-semibold"
              />
            </label>

            <label className="block text-sm font-medium text-neutral-800">
              Catatan staff
              <textarea
                name="staffNotes"
                rows={3}
                maxLength={2000}
                placeholder="Catat perbedaan fisik, label pudar, atau hal yang perlu diperiksa manager."
                className="mt-2 w-full rounded-xl border border-[var(--border)] px-3 py-3 text-sm outline-none focus:border-[var(--accent)]"
              />
            </label>

            {submitResult && !submitResult.ok ? (
              <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
                <p className="font-semibold">{submitResult.message}</p>
                {submitResult.fieldErrors ? (
                  <ul className="mt-2 list-disc space-y-1 pl-5">
                    {Object.values(submitResult.fieldErrors).map((message) => (
                      <li key={message}>{message}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : null}

            <div className="grid gap-3 sm:grid-cols-2">
              <button
                type="submit"
                disabled={isSubmitPending}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-[var(--accent)] px-5 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-wait disabled:bg-neutral-400"
              >
                {isSubmitPending ? (
                  <Loader2 className="size-5 animate-spin" />
                ) : (
                  <CheckCircle2 className="size-5" />
                )}
                Ajukan ke manager
              </button>
              <button
                type="button"
                onClick={() => {
                  setLookup(null);
                  setSubmitResult(null);
                }}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-[var(--border)] bg-white px-5 text-sm font-semibold text-neutral-900"
              >
                <RotateCcw className="size-4" />
                Batalkan
              </button>
            </div>
          </form>
        </section>
      ) : null}

      {submitResult?.ok ? (
        <section className="rounded-3xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-800">
          <div className="flex gap-3">
            <CheckCircle2 className="mt-0.5 size-5 shrink-0" />
            <div>
              <h2 className="font-semibold">Verifikasi tersimpan</h2>
              <p className="mt-1 text-sm leading-6">{submitResult.message}</p>
            </div>
          </div>
        </section>
      ) : null}

      <section className="rounded-3xl border border-[var(--border)] bg-white p-5">
        <h2 className="font-semibold text-neutral-950">Scan terbaru sesi ini</h2>
        {recentVerifications.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--muted)]">
            Belum ada verifikasi pada sesi ini.
          </p>
        ) : (
          <div className="mt-4 space-y-3">
            {recentVerifications.map((verification) => (
              <div
                key={verification.id}
                className="flex items-start justify-between gap-3 rounded-2xl bg-neutral-50 p-4"
              >
                <div className="min-w-0">
                  <p className="font-mono text-sm font-semibold text-neutral-950">
                    {verification.barcodeValue}
                  </p>
                  <p className="mt-1 truncate text-xs text-[var(--muted)]">
                    {verification.verifiedItemName} · {verification.submittedByName}
                  </p>
                </div>
                <span
                  className={cn(
                    "shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold",
                    verification.status === "needs_review"
                      ? "bg-amber-100 text-amber-800"
                      : "bg-emerald-100 text-emerald-800",
                  )}
                >
                  {statusLabel(verification.status)}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      <CameraScannerModal
        isOpen={isScannerOpen}
        isProcessing={isLookupPending}
        onClose={() => setIsScannerOpen(false)}
        onScan={(value) => {
          setIsScannerOpen(false);
          lookupBarcode(value);
        }}
      />
    </div>
  );
}
