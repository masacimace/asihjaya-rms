"use client";

import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  Clock3,
  ExternalLink,
  FileWarning,
  Loader2,
  MapPinned,
  PackageCheck,
  PackageSearch,
  RotateCcw,
  ScanBarcode,
  ShieldAlert,
  Target,
  UserRound,
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
    approved: number;
    returned: number;
    rejected: number;
    soldDuringMigration: number;
    activated: number;
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

function formatSubmittedAt(value: string) {
  const submittedAt = new Date(value);

  if (Number.isNaN(submittedAt.getTime())) {
    return "Waktu tidak diketahui";
  }

  return new Intl.DateTimeFormat("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jakarta",
  }).format(submittedAt);
}

function verificationStatusTone(status: string) {
  if (status === "needs_review" || status === "returned") {
    return "border-amber-200 bg-amber-50 text-amber-800";
  }

  if (status === "rejected" || status === "sold_during_migration") {
    return "border-red-200 bg-red-50 text-red-700";
  }

  if (status === "approved" || status === "activated") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  return "border-neutral-200 bg-neutral-100 text-neutral-700";
}

type LastSubmission = {
  barcode: string;
  itemName: string;
  status: "submitted" | "needs_review";
  message: string;
};

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
  const [manualBarcode, setManualBarcode] = useState("");
  const [lastSubmission, setLastSubmission] =
    useState<LastSubmission | null>(null);

  const defaultProductMasterId = useMemo(() => {
    if (!lookup?.ok) return "";
    return (
      lookup.existingVerification?.targetProductMasterId ??
      lookup.legacy?.mappedProductMasterId ??
      ""
    );
  }, [lookup]);

  function lookupBarcode(value: string) {
    const normalizedValue = value.trim();

    if (!normalizedValue) {
      return;
    }

    setSubmitResult(null);
    setLastSubmission(null);
    startLookupTransition(async () => {
      const result = await lookupLegacyMigrationBarcodeAction({
        sessionId: session.id,
        barcode: normalizedValue,
      });
      setLookup(result);
    });
  }

  function handleManualLookup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = manualBarcode;
    setManualBarcode("");
    lookupBarcode(value);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    setSubmitResult(null);

    const submissionContext = lookup?.ok
      ? {
          barcode: lookup.barcode,
          itemName:
            String(formData.get("verifiedItemName") ?? "").trim() ||
            lookup.legacy?.itemName ||
            "Item migrasi",
        }
      : null;

    startSubmitTransition(async () => {
      const result = await submitLegacyMigrationVerificationAction(formData);
      setSubmitResult(result);
      if (result.ok) {
        if (submissionContext) {
          setLastSubmission({
            ...submissionContext,
            status: result.status,
            message: result.message,
          });
        }
        setLookup(null);
        form.reset();
        router.refresh();
      }
    });
  }

  const isActive = session.status === "active";
  const waitingManagerCount = summary.submitted + summary.needsReview;
  const completedCount = summary.approved + summary.activated;
  const attentionCount =
    summary.needsReview + summary.returned + summary.rejected;
  const targetDifference = session.expectedItemCount
    ? summary.total - session.expectedItemCount
    : null;

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-[var(--border)] bg-white p-4 sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={cn(
                  "inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold",
                  isActive
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : session.status === "locked"
                      ? "border-amber-200 bg-amber-50 text-amber-700"
                      : session.status === "completed"
                        ? "border-blue-200 bg-blue-50 text-blue-700"
                        : "border-neutral-200 bg-neutral-100 text-neutral-700",
                )}
              >
                {isActive
                  ? "Sesi aktif"
                  : session.status === "locked"
                    ? "Sesi dikunci"
                    : session.status === "completed"
                      ? "Sesi selesai"
                      : `Sesi ${session.status}`}
              </span>
              <span className="rounded-full bg-[var(--accent-soft)] px-2.5 py-1 text-xs font-semibold text-[var(--accent)]">
                {session.assignmentRole === "lead"
                  ? "Migration Lead"
                  : session.assignmentRole === "manager_override"
                    ? "Manager Override"
                    : "Operator"}
              </span>
            </div>

            <h1 className="mt-3 text-xl font-semibold text-neutral-950 sm:text-2xl">
              {session.name}
            </h1>

            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-sm text-[var(--muted)]">
              <span className="inline-flex items-center gap-2">
                <MapPinned className="size-4 text-[var(--accent)]" />
                {session.outletName}
                {session.locationCode ? ` · ${session.locationCode}` : ""}
              </span>
              <span className="inline-flex items-center gap-2">
                <UserRound className="size-4 text-[var(--accent)]" />
                {session.assignmentRole === "lead"
                  ? "Penanggung jawab sesi"
                  : "Ditugaskan untuk scan"}
              </span>
            </div>
          </div>

          <div className="w-full rounded-2xl border border-[var(--border)] bg-neutral-50 p-3 lg:max-w-xs">
            <div className="flex items-center justify-between gap-3">
              <span className="inline-flex items-center gap-2 text-xs font-semibold text-neutral-700">
                <Target className="size-4 text-[var(--accent)]" />
                Target opsional
              </span>
              <span className="text-sm font-semibold text-neutral-950">
                {session.expectedItemCount ?? "Tidak diisi"}
              </span>
            </div>
            <p className="mt-2 text-xs leading-5 text-[var(--muted)]">
              {session.expectedItemCount === null
                ? `${summary.total} item sudah terproses. Target tidak memblokir penyelesaian sesi.`
                : targetDifference === 0
                  ? `${summary.total} item terproses dan sesuai pembanding target.`
                  : targetDifference && targetDifference > 0
                    ? `${summary.total} item terproses · lebih ${targetDifference} dari target.`
                    : `${summary.total} item terproses · kurang ${Math.abs(targetDifference ?? 0)} dari target.`}
            </p>
          </div>
        </div>

        {session.notes ? (
          <div className="mt-4 rounded-xl border border-[var(--border)] bg-neutral-50 px-4 py-3 text-sm leading-6 text-neutral-700">
            {session.notes}
          </div>
        ) : null}
      </section>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-2xl border border-[var(--border)] bg-white p-4">
          <div className="flex items-center justify-between gap-3">
            <span className="grid size-9 place-items-center rounded-xl bg-neutral-100 text-neutral-700">
              <ScanBarcode className="size-4" />
            </span>
            <span className="text-2xl font-semibold text-neutral-950">
              {summary.total}
            </span>
          </div>
          <p className="mt-3 text-xs font-medium text-[var(--muted)]">Terproses</p>
        </div>

        <div className="rounded-2xl border border-[var(--border)] bg-white p-4">
          <div className="flex items-center justify-between gap-3">
            <span className="grid size-9 place-items-center rounded-xl bg-blue-50 text-blue-700">
              <Clock3 className="size-4" />
            </span>
            <span className="text-2xl font-semibold text-blue-700">
              {waitingManagerCount}
            </span>
          </div>
          <p className="mt-3 text-xs font-medium text-[var(--muted)]">Menunggu manager</p>
        </div>

        <div className="rounded-2xl border border-[var(--border)] bg-white p-4">
          <div className="flex items-center justify-between gap-3">
            <span className="grid size-9 place-items-center rounded-xl bg-emerald-50 text-emerald-700">
              <PackageCheck className="size-4" />
            </span>
            <span className="text-2xl font-semibold text-emerald-700">
              {completedCount}
            </span>
          </div>
          <p className="mt-3 text-xs font-medium text-[var(--muted)]">Disetujui / aktif</p>
        </div>

        <div className="rounded-2xl border border-[var(--border)] bg-white p-4">
          <div className="flex items-center justify-between gap-3">
            <span className="grid size-9 place-items-center rounded-xl bg-amber-50 text-amber-700">
              <FileWarning className="size-4" />
            </span>
            <span className="text-2xl font-semibold text-amber-700">
              {attentionCount}
            </span>
          </div>
          <p className="mt-3 text-xs font-medium text-[var(--muted)]">Perlu perhatian</p>
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
        <main className="space-y-5">
          {!isActive ? (
            <section
              className={cn(
                "rounded-2xl border p-5",
                session.status === "completed"
                  ? "border-blue-200 bg-blue-50 text-blue-900"
                  : "border-amber-200 bg-amber-50 text-amber-900",
              )}
            >
              <div className="flex gap-3">
                <ShieldAlert className="mt-0.5 size-5 shrink-0" />
                <div>
                  <h2 className="font-semibold">
                    {session.status === "completed"
                      ? "Sesi sudah selesai"
                      : session.status === "locked"
                        ? "Sesi sudah dikunci"
                        : "Scanner tidak aktif"}
                  </h2>
                  <p className="mt-1 text-sm leading-6">
                    {session.status === "completed"
                      ? `${summary.total} item telah diproses pada sesi ini. Scan baru tidak dapat ditambahkan.`
                      : session.status === "locked"
                        ? `Manager sudah mengunci sesi dengan ${summary.total} item terproses. Hubungi manager bila sesi perlu dibuka kembali.`
                        : "Manager harus memulai atau membuka kembali sesi sebelum barcode dapat diproses."}
                  </p>
                </div>
              </div>
            </section>
          ) : (
            <section className="rounded-2xl border border-[var(--border)] bg-white p-4 sm:p-5">
              <div className="flex items-start gap-3">
                <div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent)]">
                  <ScanBarcode className="size-5" />
                </div>
                <div>
                  <h2 className="font-semibold text-neutral-950">
                    Scan barang berikutnya
                  </h2>
                  <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
                    Gunakan kamera, scanner hardware, atau masukkan barcode secara manual. Leading zero tetap dipertahankan.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsScannerOpen(true)}
                disabled={isLookupPending}
                className="mt-5 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-neutral-950 px-5 text-sm font-semibold text-white transition hover:bg-neutral-800 disabled:cursor-wait disabled:bg-neutral-400"
              >
                {isLookupPending ? (
                  <Loader2 className="size-5 animate-spin" />
                ) : (
                  <Camera className="size-5" />
                )}
                Buka kamera scanner
              </button>

              <div className="my-4 flex items-center gap-3">
                <span className="h-px flex-1 bg-[var(--border)]" />
                <span className="text-[11px] font-medium text-[var(--muted)]">
                  ATAU INPUT MANUAL
                </span>
                <span className="h-px flex-1 bg-[var(--border)]" />
              </div>

              <form onSubmit={handleManualLookup} className="flex gap-2">
                <label className="flex h-12 min-w-0 flex-1 items-center gap-3 rounded-xl border border-[var(--border)] bg-white px-3 focus-within:border-[var(--accent)] focus-within:ring-4 focus-within:ring-[var(--accent-soft)]">
                  <ScanBarcode className="size-4 shrink-0 text-neutral-400" />
                  <input
                    value={manualBarcode}
                    onChange={(event) => setManualBarcode(event.target.value)}
                    inputMode="text"
                    autoComplete="off"
                    placeholder="Masukkan barcode fisik"
                    className="min-w-0 flex-1 bg-transparent font-mono text-sm outline-none placeholder:font-sans placeholder:text-neutral-400"
                  />
                </label>
                <button
                  type="submit"
                  disabled={!manualBarcode.trim() || isLookupPending}
                  className="h-12 shrink-0 rounded-xl bg-[var(--accent)] px-4 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:bg-neutral-300"
                >
                  Proses
                </button>
              </form>
            </section>
          )}

          {lookup && !lookup.ok ? (
            <section className="rounded-2xl border border-red-200 bg-red-50 p-5 text-red-800">
              <div className="flex gap-3">
                <AlertTriangle className="mt-0.5 size-5 shrink-0" />
                <div>
                  <p className="text-xs font-semibold">HASIL SCAN TERBARU</p>
                  <h2 className="mt-1 font-semibold">Barcode tidak dapat diproses</h2>
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
        <section className="rounded-2xl border border-[var(--border)] bg-white p-4 sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase text-[var(--muted)]">
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
              name="existingVerificationId"
              value={lookup.existingVerification?.id ?? ""}
            />
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
                defaultValue={
                  lookup.existingVerification?.verifiedItemName ??
                  lookup.legacy?.itemName ??
                  ""
                }
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
                  defaultValue={
                    lookup.existingVerification?.verifiedWeightGram ??
                    lookup.legacy?.weightGram ??
                    ""
                  }
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
                  defaultValue={
                    lookup.existingVerification?.verifiedPurity ??
                    lookup.legacy?.purity ??
                    ""
                  }
                  placeholder="40"
                  className="mt-2 h-12 w-full rounded-xl border border-[var(--border)] px-3 text-sm outline-none focus:border-[var(--accent)]"
                />
              </label>

              <label className="block text-sm font-medium text-neutral-800">
                Kadar tukaran
                <input
                  name="verifiedExchangePurity"
                  inputMode="decimal"
                  defaultValue={
                    lookup.existingVerification?.verifiedExchangePurity ??
                    lookup.legacy?.exchangePurity ??
                    ""
                  }
                  placeholder="Opsional"
                  className="mt-2 h-12 w-full rounded-xl border border-[var(--border)] px-3 text-sm outline-none focus:border-[var(--accent)]"
                />
              </label>

              <label className="block text-sm font-medium text-neutral-800">
                Warna
                <input
                  name="verifiedColor"
                  maxLength={120}
                  defaultValue={
                    lookup.existingVerification?.verifiedColor ??
                    lookup.legacy?.color ??
                    ""
                  }
                  placeholder="Poles / Kuning / Kombinasi"
                  className="mt-2 h-12 w-full rounded-xl border border-[var(--border)] px-3 text-sm outline-none focus:border-[var(--accent)]"
                />
              </label>
            </div>

            <label className="block text-sm font-medium text-neutral-800">
              Kondisi fisik
              <select
                name="condition"
                defaultValue={lookup.existingVerification?.condition ?? "good"}
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
                    defaultChecked={
                      lookup.existingVerification?.useLegacyImage ?? true
                    }
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
                required={
                  !lookup.legacy?.imageUrl &&
                  !lookup.existingVerification?.hasActualImage
                }
                className="mt-3 block w-full text-xs text-neutral-600 file:mr-3 file:rounded-lg file:border-0 file:bg-white file:px-3 file:py-2 file:text-xs file:font-semibold"
              />
            </label>

            <label className="block text-sm font-medium text-neutral-800">
              Catatan staff
              <textarea
                name="staffNotes"
                rows={3}
                maxLength={2000}
                defaultValue={lookup.existingVerification?.staffNotes ?? ""}
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

            <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              <ShieldAlert className="mt-0.5 size-5 shrink-0" />
              <div>
                <p className="font-semibold">Belum menjadi stok aktif</p>
                <p className="mt-1 leading-6 text-amber-800">
                  Hasil scan dikirim ke antrean manager dan belum menjadi stok aktif
                  sampai proses review serta aktivasi transactional selesai.
                </p>
              </div>
            </div>

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
                {lookup.existingVerification
                  ? "Kirim ulang ke manager"
                  : "Ajukan ke manager"}
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

          {lastSubmission ? (
            <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-900">
              <div className="flex gap-3">
                <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-700" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-emerald-700">HASIL SCAN TERBARU</p>
                  <h2 className="mt-1 font-semibold">Verifikasi berhasil disimpan</h2>
                  <p className="mt-2 font-mono text-lg font-semibold text-neutral-950">
                    {lastSubmission.barcode}
                  </p>
                  <p className="mt-1 text-sm font-medium text-neutral-900">
                    {lastSubmission.itemName}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-emerald-800">
                    {lastSubmission.message}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setLastSubmission(null);
                      setIsScannerOpen(true);
                    }}
                    className="mt-4 inline-flex h-10 items-center gap-2 rounded-xl border border-emerald-300 bg-white px-4 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-100"
                  >
                    <ScanBarcode className="size-4" />
                    Scan barang berikutnya
                  </button>
                </div>
              </div>
            </section>
          ) : null}
        </main>

        <aside className="space-y-5">
          <section className="rounded-2xl border border-[var(--border)] bg-white p-4 sm:p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="font-semibold text-neutral-950">Scan terbaru</h2>
                <p className="mt-1 text-xs text-[var(--muted)]">
                  Maksimal 12 aktivitas terakhir pada sesi ini.
                </p>
              </div>
              <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-semibold text-neutral-700">
                {recentVerifications.length}
              </span>
            </div>

            {recentVerifications.length === 0 ? (
              <div className="mt-4 rounded-xl border border-dashed border-neutral-300 px-4 py-8 text-center">
                <PackageSearch className="mx-auto size-8 text-neutral-300" />
                <p className="mt-3 text-sm font-medium text-neutral-800">
                  Belum ada hasil scan
                </p>
                <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
                  Aktivitas terbaru akan tampil di bagian ini.
                </p>
              </div>
            ) : (
              <div className="mt-4 max-h-[520px] space-y-2 overflow-y-auto pr-1">
                {recentVerifications.map((verification) => (
                  <div
                    key={verification.id}
                    className="rounded-xl border border-[var(--border)] bg-white p-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-mono text-sm font-semibold text-neutral-950">
                          {verification.barcodeValue}
                        </p>
                        <p className="mt-1 line-clamp-2 text-xs font-medium text-neutral-800">
                          {verification.verifiedItemName}
                        </p>
                      </div>
                      <span
                        className={cn(
                          "shrink-0 rounded-full border px-2 py-1 text-[10px] font-semibold",
                          verificationStatusTone(verification.status),
                        )}
                      >
                        {statusLabel(verification.status)}
                      </span>
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-3 text-[11px] text-[var(--muted)]">
                      <span className="truncate">{verification.submittedByName}</span>
                      <span className="shrink-0">{formatSubmittedAt(verification.submittedAt)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section
            className={cn(
              "rounded-2xl border p-4 sm:p-5",
              attentionCount > 0
                ? "border-amber-200 bg-amber-50"
                : "border-emerald-200 bg-emerald-50",
            )}
          >
            <div className="flex items-start gap-3">
              {attentionCount > 0 ? (
                <FileWarning className="mt-0.5 size-5 shrink-0 text-amber-700" />
              ) : (
                <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-700" />
              )}
              <div>
                <h2 className="font-semibold text-neutral-950">
                  {attentionCount > 0 ? "Perlu perhatian" : "Tidak ada masalah aktif"}
                </h2>
                <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
                  {attentionCount > 0
                    ? `${attentionCount} verification perlu diperiksa atau diperbaiki sebelum proses berikutnya.`
                    : "Seluruh verification yang masuk saat ini tidak memiliki exception aktif."}
                </p>
                {summary.soldDuringMigration > 0 ? (
                  <p className="mt-3 rounded-xl border border-red-200 bg-white px-3 py-2 text-xs font-medium text-red-700">
                    {summary.soldDuringMigration} item ditandai terjual selama migrasi.
                  </p>
                ) : null}
              </div>
            </div>
          </section>
        </aside>
      </div>

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
