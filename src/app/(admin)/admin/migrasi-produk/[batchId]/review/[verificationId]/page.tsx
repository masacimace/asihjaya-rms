import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ExternalLink,
  ImageIcon,
  PackageCheck,
  PackageX,
  RotateCcw,
  ShieldAlert,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import {
  approveLegacyMigrationVerificationAction,
  rejectLegacyMigrationVerificationAction,
  returnLegacyMigrationVerificationAction,
} from "@/app/actions/legacy-migration-review";
import { getLegacyMigrationReviewDetail } from "@/features/legacy-migration/review-queries";
import { hasPermission, requireAnyPermission } from "@/lib/auth/session";
import { getImageUrl } from "@/lib/storage/image-storage";
import { cn } from "@/lib/utils";

export const metadata = { title: "Detail Review Migrasi" };
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

function formatDecimal(value: string | null) {
  if (!value) return "—";
  const number = Number(value);
  return Number.isFinite(number)
    ? new Intl.NumberFormat("id-ID", { maximumFractionDigits: 3 }).format(number)
    : value;
}

function formatMoney(value: string | null) {
  if (value === null) return "—";
  const amount = Number(value);
  return Number.isFinite(amount)
    ? new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        maximumFractionDigits: 0,
      }).format(amount)
    : value;
}

function formatDate(value: Date | null, timeZone: string) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone,
  }).format(value);
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    submitted: "Clean / terkirim",
    needs_review: "Perlu review",
    returned: "Dikembalikan ke staff",
    approved: "Disetujui · migration hold",
    rejected: "Ditolak",
    sold_during_migration: "Terjual saat migrasi",
    activated: "Aktif",
  };
  return labels[status] ?? status;
}

function valueRow(label: string, value: string | null) {
  return (
    <div className="rounded-2xl bg-neutral-50 p-4">
      <dt className="text-xs text-[var(--muted)]">{label}</dt>
      <dd className="mt-1 text-sm font-semibold text-neutral-900">
        {value || "—"}
      </dd>
    </div>
  );
}

export default async function LegacyMigrationReviewDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ batchId: string; verificationId: string }>;
  searchParams: Promise<{ type?: string; message?: string }>;
}) {
  const auth = await requireAnyPermission([
    "migration.verification.review",
    "migration.verification.approve",
  ]);
  const [{ batchId, verificationId }, query] = await Promise.all([
    params,
    searchParams,
  ]);
  const data = await getLegacyMigrationReviewDetail(
    auth,
    batchId,
    verificationId,
  );
  if (!data) notFound();

  const verification = data.verification;
  const canReview = hasPermission(auth, "migration.verification.review");
  const canApprove = hasPermission(auth, "migration.verification.approve");
  const canManageSold = hasPermission(auth, "migration.sold.manage");
  const canManagePricing = hasPermission(auth, "pricing.manage");
  const hasReviewableStatus = ["submitted", "needs_review"].includes(
    verification.status,
  );
  const reviewable =
    hasReviewableStatus && verification.sessionStatus === "active";
  const actualImageUrl = getImageUrl(verification.imageKey);

  return (
    <div className="space-y-6">
      {flashMessage(query.type, query.message)}

      <section className="rounded-3xl border border-[var(--border)] bg-white p-6 lg:p-7">
        <Link
          href={`/admin/migrasi-produk/${data.batch.id}/review`}
          className="inline-flex items-center gap-2 text-sm font-semibold text-neutral-700 hover:text-neutral-950"
        >
          <ArrowLeft className="size-4" /> Kembali ke antrean
        </Link>
        <div className="mt-5 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="font-mono text-sm font-semibold text-[var(--accent)]">
              {verification.barcodeValue}
            </p>
            <h1 className="mt-2 text-2xl font-semibold text-neutral-950 sm:text-3xl">
              {verification.verifiedItemName}
            </h1>
            <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
              {verification.sessionName}
              {verification.sessionLocationCode
                ? ` · ${verification.sessionLocationCode}`
                : ""}
              {` · dikirim oleh ${verification.submittedByName}`}
            </p>
          </div>
          <span className="inline-flex w-fit rounded-full border border-[var(--border)] bg-neutral-50 px-3 py-1.5 text-xs font-semibold text-neutral-700">
            {statusLabel(verification.status)}
          </span>
        </div>
      </section>

      {verification.status === "sold_during_migration" ? (
        <section className="rounded-3xl border border-red-200 bg-red-50 p-5 text-red-900">
          <div className="flex gap-3">
            <PackageX className="mt-0.5 size-5 shrink-0" />
            <div>
              <h2 className="font-semibold">Dikecualikan dari cutover</h2>
              <p className="mt-1 text-sm leading-6">
                Barcode ditandai terjual di sistem lama pada {" "}
                {formatDate(verification.soldAt, auth.organization.timezone)}.
                {verification.soldLegacyReference
                  ? ` Referensi: ${verification.soldLegacyReference}.`
                  : ""}
                {verification.productItemId
                  ? " Product Item hold sudah ditandai sold dan alias barcode dinonaktifkan."
                  : " Verification tidak dapat direview atau disetujui selama penandaan aktif."}
              </p>
              {canManageSold ? (
                <Link
                  href={`/admin/migrasi-produk/${data.batch.id}/sold`}
                  className="mt-3 inline-flex text-sm font-semibold underline"
                >
                  Buka daftar terjual di sistem lama
                </Link>
              ) : null}
            </div>
          </div>
        </section>
      ) : verification.productItemId ? (
        <section className="rounded-3xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-900">
          <div className="flex gap-3">
            <PackageCheck className="mt-0.5 size-5 shrink-0" />
            <div>
              <h2 className="font-semibold">Product Item sudah dibuat</h2>
              <p className="mt-1 text-sm leading-6">
                SKU {verification.itemSku ?? "—"} · status {verification.itemAvailability ?? "—"}.
                Harga label {formatMoney(verification.itemSellingAmount)} · harga per gram {formatMoney(verification.itemPricePerGram)}.
                Item belum tersedia di POS selama statusnya migration hold.
              </p>
              <div className="mt-3 flex flex-wrap gap-4">
                <Link
                  href={`/admin/inventaris/item/${verification.productItemId}`}
                  className="inline-flex text-sm font-semibold underline"
                >
                  Buka detail item inventory
                </Link>
                {canManagePricing && verification.itemAvailability === "migration_hold" ? (
                  <Link
                    href={`/admin/inventaris/item/${verification.productItemId}/edit`}
                    className="inline-flex text-sm font-semibold underline"
                  >
                    Perbaiki pricing item
                  </Link>
                ) : null}
              </div>
            </div>
          </div>
        </section>
      ) : null}

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-6">
          <section className="rounded-3xl border border-[var(--border)] bg-white p-5 lg:p-6">
            <h2 className="font-semibold text-neutral-950">Hasil verifikasi fisik</h2>
            <dl className="mt-4 grid gap-3 sm:grid-cols-2">
              {valueRow(
                "Product Master",
                `${verification.productMasterCode} · ${verification.productMasterName}`,
              )}
              {valueRow("Kategori", verification.categoryName)}
              {valueRow(
                "Berat aktual",
                `${formatDecimal(verification.verifiedWeightGram)} gram`,
              )}
              {valueRow("Kadar aktual", formatDecimal(verification.verifiedPurity))}
              {valueRow(
                "Kadar tukaran",
                formatDecimal(verification.verifiedExchangePurity),
              )}
              {valueRow("Warna", verification.verifiedColor)}
              {valueRow("Kondisi", verification.condition)}
              {valueRow(
                "Sumber",
                verification.source === "legacy_match"
                  ? "Cocok dengan export legacy"
                  : "Barang fisik tanpa data legacy",
              )}
            </dl>

            {verification.staffNotes ? (
              <div className="mt-4 rounded-2xl border border-[var(--border)] p-4">
                <p className="text-xs text-[var(--muted)]">Catatan staff</p>
                <p className="mt-1 text-sm leading-6 text-neutral-800">
                  {verification.staffNotes}
                </p>
              </div>
            ) : null}
          </section>

          {verification.source === "legacy_match" ? (
            <section className="rounded-3xl border border-[var(--border)] bg-white p-5 lg:p-6">
              <h2 className="font-semibold text-neutral-950">Perbandingan data legacy</h2>
              <dl className="mt-4 grid gap-3 sm:grid-cols-2">
                {valueRow(
                  "Master legacy",
                  `${verification.legacyMasterCode ?? "—"} · ${verification.legacyMasterName ?? "—"}`,
                )}
                {valueRow("Kategori legacy", verification.legacyCategory)}
                {valueRow("Nama SKU lama", verification.legacyItemName)}
                {valueRow(
                  "Berat lama",
                  verification.legacyWeightGram
                    ? `${formatDecimal(verification.legacyWeightGram)} gram`
                    : null,
                )}
                {valueRow(
                  "Harga per gram legacy",
                  formatMoney(verification.legacyPricePerGram),
                )}
                {valueRow(
                  "Potongan per gram legacy",
                  formatMoney(verification.legacyDeductionPerGram),
                )}
                {valueRow("Kadar lama", formatDecimal(verification.legacyPurity))}
                {valueRow(
                  "Kadar tukaran lama",
                  formatDecimal(verification.legacyExchangePurity),
                )}
                {valueRow("Warna lama", verification.legacyColor)}
                {valueRow(
                  "Validasi export",
                  verification.legacyValidationStatus,
                )}
              </dl>
            </section>
          ) : null}

          <section className="rounded-3xl border border-[var(--border)] bg-white p-5 lg:p-6">
            <h2 className="font-semibold text-neutral-950">Review flags</h2>
            {verification.reviewFlags.length === 0 ? (
              <p className="mt-3 inline-flex items-center gap-2 text-sm text-emerald-700">
                <CheckCircle2 className="size-4" /> Tidak ada flag. Item eligible untuk bulk approval.
              </p>
            ) : (
              <ul className="mt-4 space-y-2">
                {verification.reviewFlags.map((flag) => (
                  <li
                    key={flag}
                    className="flex gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800"
                  >
                    <AlertTriangle className="mt-0.5 size-4 shrink-0" /> {flag}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <aside className="space-y-6">
          <section className="overflow-hidden rounded-3xl border border-[var(--border)] bg-white">
            <div className="grid aspect-square place-items-center bg-neutral-50">
              {actualImageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={actualImageUrl}
                  alt={verification.verifiedItemName}
                  className="size-full object-cover"
                />
              ) : verification.legacyImageUrl ? (
                <div className="p-6 text-center">
                  <ImageIcon className="mx-auto size-10 text-neutral-300" />
                  <a
                    href={verification.legacyImageUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-[var(--accent)]"
                  >
                    <ExternalLink className="size-4" /> Buka foto legacy
                  </a>
                </div>
              ) : (
                <ImageIcon className="size-10 text-neutral-300" />
              )}
            </div>
            <div className="border-t border-[var(--border)] p-4 text-xs text-[var(--muted)]">
              {actualImageUrl ? "Foto aktual private storage" : "Foto referensi legacy"}
            </div>
          </section>

          {verification.reviewNotes ? (
            <section className="rounded-3xl border border-blue-200 bg-blue-50 p-5 text-blue-900">
              <h2 className="font-semibold">Catatan review terakhir</h2>
              <p className="mt-2 text-sm leading-6">{verification.reviewNotes}</p>
              <p className="mt-2 text-xs">Revision {verification.revision}</p>
            </section>
          ) : null}

          {hasReviewableStatus && verification.sessionStatus !== "active" ? (
            <section className="rounded-3xl border border-amber-200 bg-amber-50 p-5 text-amber-950">
              <div className="flex gap-3">
                <ShieldAlert className="mt-0.5 size-5 shrink-0" />
                <div>
                  <h2 className="font-semibold">Sesi tidak sedang aktif</h2>
                  <p className="mt-1 text-sm leading-6">
                    Review tidak dapat diubah ketika sesi berstatus {verification.sessionStatus}.
                    Buka kembali sesi terlebih dahulu agar approval, return, atau reject
                    tetap tersinkronisasi dengan readiness.
                  </p>
                </div>
              </div>
            </section>
          ) : null}

          {reviewable ? (
            <section className="rounded-3xl border border-[var(--border)] bg-white p-5">
              <h2 className="font-semibold text-neutral-950">Keputusan manager</h2>
              <p className="mt-2 text-xs leading-5 text-[var(--muted)]">
                Approval membuat Product Item berstatus migration hold, menyalin pricing legacy yang valid, dan membuat alias barcode lama. Harga label dihitung dari berat aktual × harga per gram. Tidak ada stok available atau inventory movement.
              </p>

              {canApprove ? (
                <form
                  action={approveLegacyMigrationVerificationAction}
                  className="mt-5 space-y-3"
                >
                  <input type="hidden" name="batchId" value={data.batch.id} />
                  <input type="hidden" name="verificationId" value={verification.id} />
                  <textarea
                    name="reviewNotes"
                    maxLength={2000}
                    rows={3}
                    placeholder="Catatan approval opsional"
                    className="w-full rounded-xl border border-[var(--border)] px-3 py-3 text-sm"
                  />
                  <button className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 text-sm font-semibold text-white">
                    <CheckCircle2 className="size-4" /> Approve sebagai migration hold
                  </button>
                </form>
              ) : null}

              {canReview ? (
                <div className="mt-5 space-y-4 border-t border-[var(--border)] pt-5">
                  <form action={returnLegacyMigrationVerificationAction} className="space-y-3">
                    <input type="hidden" name="batchId" value={data.batch.id} />
                    <input type="hidden" name="verificationId" value={verification.id} />
                    <textarea
                      name="reviewNotes"
                      required
                      minLength={5}
                      maxLength={2000}
                      rows={3}
                      placeholder="Jelaskan data yang harus diperbaiki staff"
                      className="w-full rounded-xl border border-blue-200 px-3 py-3 text-sm"
                    />
                    <button className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-blue-300 bg-blue-50 px-4 text-sm font-semibold text-blue-800">
                      <RotateCcw className="size-4" /> Kembalikan ke staff
                    </button>
                  </form>

                  <form action={rejectLegacyMigrationVerificationAction} className="space-y-3">
                    <input type="hidden" name="batchId" value={data.batch.id} />
                    <input type="hidden" name="verificationId" value={verification.id} />
                    <textarea
                      name="reviewNotes"
                      required
                      minLength={5}
                      maxLength={2000}
                      rows={3}
                      placeholder="Alasan penolakan permanen"
                      className="w-full rounded-xl border border-red-200 px-3 py-3 text-sm"
                    />
                    <button className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-red-300 bg-red-50 px-4 text-sm font-semibold text-red-800">
                      <XCircle className="size-4" /> Tolak verification
                    </button>
                  </form>
                </div>
              ) : null}
            </section>
          ) : verification.status === "returned" ? (
            <section className="rounded-3xl border border-blue-200 bg-blue-50 p-5 text-blue-900">
              <div className="flex gap-3">
                <RotateCcw className="mt-0.5 size-5 shrink-0" />
                <div>
                  <h2 className="font-semibold">Menunggu perbaikan staff</h2>
                  <p className="mt-1 text-sm leading-6">
                    Operator dapat scan barcode yang sama, memperbaiki form, dan mengirim ulang selama sesi masih aktif serta assignment masih berlaku.
                  </p>
                </div>
              </div>
            </section>
          ) : verification.status === "rejected" ? (
            <section className="rounded-3xl border border-red-200 bg-red-50 p-5 text-red-900">
              <div className="flex gap-3">
                <ShieldAlert className="mt-0.5 size-5 shrink-0" />
                <div>
                  <h2 className="font-semibold">Verification ditolak</h2>
                  <p className="mt-1 text-sm leading-6">
                    Tidak ada Product Item atau barcode alias yang dibuat.
                  </p>
                </div>
              </div>
            </section>
          ) : null}
        </aside>
      </section>
    </div>
  );
}
