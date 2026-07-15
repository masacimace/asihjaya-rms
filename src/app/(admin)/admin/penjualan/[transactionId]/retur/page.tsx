import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ClipboardCheck,
  ExternalLink,
  PackageCheck,
  ScanLine,
  ShieldCheck,
  Wrench,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import {
  inspectSaleReturnItemAction,
  receiveSaleReturnItemAction,
} from "@/features/returns/actions";
import {
  getReturnCapabilities,
  RETURN_VIEW_PERMISSION,
} from "@/features/returns/authorization";
import type {
  ReturnInspectionDecision,
  SaleReturnCaseStatus,
  SaleReturnItemStatus,
} from "@/features/returns/contracts";
import { getSaleReturnWorkflowData } from "@/features/returns/queries";
import { requirePermission } from "@/lib/auth/session";
import { getReturnInspectionPhotoUrl } from "@/lib/storage/return-inspection-storage";
import { cn } from "@/lib/utils";

export const metadata = {
  title: "Retur Transaksi",
};

export const runtime = "nodejs";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const caseStatusLabels: Record<SaleReturnCaseStatus, string> = {
  awaiting_receipt: "Menunggu barang",
  pending_inspection: "Menunggu pemeriksaan",
  partially_inspected: "Sebagian diperiksa",
  completed: "Selesai",
  rejected: "Seluruh item ditolak",
  cancelled: "Dibatalkan",
};

const itemStatusLabels: Record<SaleReturnItemStatus, string> = {
  awaiting_receipt: "Menunggu diterima",
  pending_inspection: "Karantina pemeriksaan",
  restocked: "Layak jual kembali",
  repair: "Masuk perbaikan",
  damaged: "Rusak",
  rejected: "Ditolak",
};

const decisionLabels: Record<ReturnInspectionDecision, string> = {
  restock: "Layak jual kembali",
  repair: "Perlu perbaikan",
  damaged: "Rusak / tidak layak jual",
  reject: "Tolak barang retur",
};

function formatDateTime(value: Date | null) {
  if (!value) return "-";

  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jakarta",
  }).format(value);
}

function formatMoney(value: string) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);
}

function formatWeight(value: string | null) {
  if (!value) return "-";
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return "-";

  return `${new Intl.NumberFormat("id-ID", {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  }).format(parsed)} gram`;
}

function getStatusClass(status: SaleReturnCaseStatus | SaleReturnItemStatus) {
  if (["completed", "restocked"].includes(status)) {
    return "bg-emerald-50 text-emerald-700";
  }

  if (["rejected", "damaged"].includes(status)) {
    return "bg-red-50 text-red-700";
  }

  if (status === "repair") {
    return "bg-blue-50 text-blue-700";
  }

  return "bg-amber-50 text-amber-700";
}

function FeedbackNotice({
  type,
  message,
}: {
  type: string;
  message: string;
}) {
  const isSuccess = type === "success";
  const isError = type === "error";

  return (
    <section
      className={cn(
        "flex items-start gap-3 rounded-2xl border p-4 text-sm leading-6",
        isSuccess
          ? "border-emerald-200 bg-emerald-50 text-emerald-800"
          : isError
            ? "border-red-200 bg-red-50 text-red-700"
            : "border-amber-200 bg-amber-50 text-amber-800",
      )}
    >
      {isSuccess ? (
        <CheckCircle2 className="mt-1 size-4 shrink-0" />
      ) : isError ? (
        <XCircle className="mt-1 size-4 shrink-0" />
      ) : (
        <AlertTriangle className="mt-1 size-4 shrink-0" />
      )}
      <p>{message}</p>
    </section>
  );
}

export default async function SaleReturnWorkflowPage({
  params,
  searchParams,
}: {
  params: Promise<{ transactionId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { transactionId } = await params;
  const resolvedSearchParams = await searchParams;

  if (!UUID_PATTERN.test(transactionId)) notFound();

  const auth = await requirePermission(RETURN_VIEW_PERMISSION);
  const data = await getSaleReturnWorkflowData({ auth, saleId: transactionId });

  if (!data) notFound();

  const capabilities = getReturnCapabilities(auth);
  const feedbackMessageValue = resolvedSearchParams.feedbackMessage;
  const feedbackTypeValue = resolvedSearchParams.feedbackType;
  const feedbackMessage = Array.isArray(feedbackMessageValue)
    ? feedbackMessageValue[0]
    : feedbackMessageValue;
  const feedbackType = Array.isArray(feedbackTypeValue)
    ? feedbackTypeValue[0]
    : feedbackTypeValue;

  return (
    <div className="mx-auto w-full max-w-[1200px] space-y-5 sm:space-y-6">
      <header className="rounded-2xl border border-[var(--border)] bg-white p-4 sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <Link
              href={`/admin/penjualan/${data.saleId}`}
              className="inline-flex items-center gap-2 text-sm font-medium text-neutral-500 transition hover:text-[var(--accent)]"
            >
              <ArrowLeft className="size-4" />
              Kembali ke detail penjualan
            </Link>
            <div className="mt-4 flex items-start gap-3">
              <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-amber-50 text-amber-700 ring-1 ring-amber-100">
                <ClipboardCheck className="size-5" />
              </span>
              <div className="min-w-0">
                <h1 className="text-xl font-bold text-neutral-950 sm:text-2xl">
                  Pemeriksaan Retur
                </h1>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  {data.invoiceNumber} · {data.outletCode} — {data.outletName}
                </p>
              </div>
            </div>
          </div>

          <span
            className={cn(
              "inline-flex w-fit rounded-full px-3 py-1 text-xs font-semibold",
              getStatusClass(data.status),
            )}
          >
            {caseStatusLabels[data.status]}
          </span>
        </div>
      </header>

      {feedbackMessage ? (
        <FeedbackNotice type={feedbackType ?? "info"} message={feedbackMessage} />
      ) : null}

      <section className="grid gap-3 sm:grid-cols-3">
        <article className="rounded-2xl border border-[var(--border)] bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
            Item retur
          </p>
          <p className="mt-2 text-2xl font-bold text-neutral-950">
            {data.expectedItemCount}
          </p>
        </article>
        <article className="rounded-2xl border border-[var(--border)] bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
            Sudah diterima
          </p>
          <p className="mt-2 text-2xl font-bold text-amber-700">
            {data.receivedItemCount}/{data.expectedItemCount}
          </p>
        </article>
        <article className="rounded-2xl border border-[var(--border)] bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
            Sudah diperiksa
          </p>
          <p className="mt-2 text-2xl font-bold text-emerald-700">
            {data.inspectedItemCount}/{data.expectedItemCount}
          </p>
        </article>
      </section>

      <section className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm leading-6 text-blue-900">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 size-5 shrink-0" />
          <div>
            <p className="font-semibold">Inventory retur dikarantina</p>
            <p className="mt-1 text-blue-800">
              Barang yang baru diterima tidak langsung tersedia di POS. Statusnya
              menjadi inspection sampai pemeriksa memilih restock, repair, rusak,
              atau ditolak.
            </p>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        {data.items.map((item) => {
          const photoUrl = getReturnInspectionPhotoUrl(item.photoKey);

          return (
            <article
              key={item.id}
              className="overflow-hidden rounded-2xl border border-[var(--border)] bg-white"
            >
              <div className="flex flex-col gap-4 border-b border-[var(--border)] p-4 sm:flex-row sm:items-start sm:justify-between sm:p-5">
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                    Item #{item.lineNumber}
                  </p>
                  <h2 className="mt-1 text-base font-semibold text-neutral-950">
                    {item.productName}
                  </h2>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-neutral-500">
                    <span>SKU: {item.sku}</span>
                    <span>Barcode: {item.barcode}</span>
                    <span>Serial: {item.serialNumber ?? "-"}</span>
                    <span>Harga: {formatMoney(item.finalPriceAmount)}</span>
                  </div>
                </div>
                <span
                  className={cn(
                    "inline-flex w-fit shrink-0 rounded-full px-3 py-1 text-xs font-semibold",
                    getStatusClass(item.status),
                  )}
                >
                  {itemStatusLabels[item.status]}
                </span>
              </div>

              <div className="grid gap-5 p-4 sm:p-5 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.85fr)]">
                <div className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl bg-neutral-50 p-3 text-sm">
                      <p className="text-xs text-neutral-500">Berat transaksi</p>
                      <p className="mt-1 font-semibold text-neutral-900">
                        {formatWeight(item.expectedWeightGram)}
                      </p>
                    </div>
                    <div className="rounded-xl bg-neutral-50 p-3 text-sm">
                      <p className="text-xs text-neutral-500">Berat pemeriksaan</p>
                      <p className="mt-1 font-semibold text-neutral-900">
                        {formatWeight(item.actualWeightGram)}
                      </p>
                    </div>
                  </div>

                  <div className="rounded-xl border border-[var(--border)] p-3 text-xs leading-5 text-neutral-600">
                    <div className="grid gap-1 sm:grid-cols-2">
                      <p>Inventory: {item.currentAvailability}</p>
                      <p>Lokasi: {item.currentLocationState}</p>
                      <p>Diterima: {formatDateTime(item.receivedAt)}</p>
                      <p>Pemeriksa: {item.inspectedByName ?? "-"}</p>
                    </div>
                  </div>

                  {item.decision ? (
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
                      <div className="flex items-center gap-2 font-semibold">
                        {item.decision === "repair" ? (
                          <Wrench className="size-4" />
                        ) : (
                          <PackageCheck className="size-4" />
                        )}
                        {decisionLabels[item.decision]}
                      </div>
                      <p className="mt-2 text-xs leading-5 text-emerald-800">
                        Diputuskan oleh {item.decidedByName ?? "-"} pada {formatDateTime(item.decidedAt)}.
                      </p>
                      {item.inspectionNotes ? (
                        <p className="mt-2 whitespace-pre-wrap text-xs leading-5">
                          {item.inspectionNotes}
                        </p>
                      ) : null}
                      {photoUrl ? (
                        <a
                          href={photoUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-3 inline-flex items-center gap-1 text-xs font-semibold underline"
                        >
                          Lihat foto pemeriksaan
                          <ExternalLink className="size-3" />
                        </a>
                      ) : null}
                    </div>
                  ) : null}
                </div>

                <div>
                  {item.status === "awaiting_receipt" && capabilities.canReceive ? (
                    <form
                      action={receiveSaleReturnItemAction}
                      className="rounded-2xl border border-amber-200 bg-amber-50 p-4"
                    >
                      <input type="hidden" name="saleId" value={data.saleId} />
                      <input type="hidden" name="returnItemId" value={item.id} />
                      <div className="flex items-center gap-2 text-sm font-semibold text-amber-900">
                        <ScanLine className="size-4" />
                        Terima barang fisik
                      </div>
                      <p className="mt-2 text-xs leading-5 text-amber-800">
                        Scan barcode/serial atau ketik kode yang tercetak pada barang.
                      </p>
                      <input
                        name="scannedCode"
                        required
                        minLength={3}
                        maxLength={160}
                        autoComplete="off"
                        autoCapitalize="characters"
                        placeholder="Scan barcode, SKU, atau serial"
                        className="mt-3 h-11 w-full rounded-xl border border-amber-200 bg-white px-3 text-sm font-semibold uppercase outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
                      />
                      <button
                        type="submit"
                        className="mt-3 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-amber-600 px-4 text-sm font-semibold text-white transition hover:bg-amber-700"
                      >
                        <ScanLine className="size-4" />
                        Konfirmasi penerimaan
                      </button>
                    </form>
                  ) : null}

                  {item.status === "awaiting_receipt" && !capabilities.canReceive ? (
                    <p className="rounded-xl border border-dashed border-neutral-300 bg-neutral-50 p-4 text-xs leading-5 text-neutral-600">
                      Barang belum diterima. Minta user dengan permission penerimaan retur untuk melakukan scan.
                    </p>
                  ) : null}

                  {item.status === "pending_inspection" && capabilities.canInspect ? (
                    <form
                      action={inspectSaleReturnItemAction}
                      className="space-y-4 rounded-2xl border border-blue-200 bg-blue-50 p-4"
                    >
                      <input type="hidden" name="saleId" value={data.saleId} />
                      <input type="hidden" name="returnItemId" value={item.id} />

                      <div>
                        <div className="flex items-center gap-2 text-sm font-semibold text-blue-950">
                          <ClipboardCheck className="size-4" />
                          Pemeriksaan fisik
                        </div>
                        <p className="mt-1 text-xs leading-5 text-blue-800">
                          Timbang barang dan tentukan status inventory berikutnya.
                        </p>
                      </div>

                      <label className="block text-xs font-semibold text-neutral-700">
                        Berat aktual (gram)
                        <input
                          type="number"
                          name="actualWeightGram"
                          required
                          min="0.001"
                          step="0.001"
                          inputMode="decimal"
                          defaultValue={item.expectedWeightGram ?? ""}
                          className="mt-1 h-11 w-full rounded-xl border border-blue-200 bg-white px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                        />
                      </label>

                      <div className="space-y-2 rounded-xl bg-white p-3 text-xs text-neutral-700">
                        <label className="flex items-start gap-2">
                          <input type="checkbox" name="identityConfirmed" className="mt-0.5 size-4" />
                          <span>Barcode/serial dan identitas barang sesuai.</span>
                        </label>
                        <label className="flex items-start gap-2">
                          <input type="checkbox" name="conditionGood" className="mt-0.5 size-4" />
                          <span>Kondisi fisik baik dan tidak ada kerusakan.</span>
                        </label>
                        <label className="flex items-start gap-2">
                          <input type="checkbox" name="certificateComplete" className="mt-0.5 size-4" />
                          <span>Sertifikat/kelengkapan utama tersedia.</span>
                        </label>
                        <label className="flex items-start gap-2">
                          <input type="checkbox" name="packagingComplete" className="mt-0.5 size-4" />
                          <span>Kemasan lengkap.</span>
                        </label>
                      </div>

                      <label className="block text-xs font-semibold text-neutral-700">
                        Keputusan
                        <select
                          name="decision"
                          required
                          defaultValue="restock"
                          className="mt-1 h-11 w-full rounded-xl border border-blue-200 bg-white px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                        >
                          <option value="restock">Layak jual kembali</option>
                          <option value="repair">Perlu perbaikan</option>
                          <option value="damaged">Rusak / tidak layak jual</option>
                          <option value="reject">Tolak barang retur</option>
                        </select>
                      </label>

                      <label className="block text-xs font-semibold text-neutral-700">
                        Catatan pemeriksaan
                        <textarea
                          name="notes"
                          maxLength={2000}
                          placeholder="Wajib untuk repair, rusak, atau ditolak."
                          className="mt-1 min-h-20 w-full resize-y rounded-xl border border-blue-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                        />
                      </label>

                      <label className="block text-xs font-semibold text-neutral-700">
                        Foto kondisi
                        <input
                          type="file"
                          name="photo"
                          accept="image/jpeg,image/png,image/webp"
                          className="mt-1 block w-full rounded-xl border border-blue-200 bg-white p-2 text-xs file:mr-3 file:rounded-lg file:border-0 file:bg-blue-100 file:px-3 file:py-2 file:font-semibold file:text-blue-800"
                        />
                        <span className="mt-1 block font-normal text-neutral-500">
                          Wajib jika keputusan rusak atau ditolak.
                        </span>
                      </label>

                      <button
                        type="submit"
                        className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 text-sm font-semibold text-white transition hover:bg-blue-800"
                      >
                        <ClipboardCheck className="size-4" />
                        Simpan hasil pemeriksaan
                      </button>
                    </form>
                  ) : null}

                  {item.status === "pending_inspection" && !capabilities.canInspect ? (
                    <p className="rounded-xl border border-dashed border-blue-200 bg-blue-50 p-4 text-xs leading-5 text-blue-800">
                      Item sudah diterima dan menunggu pemeriksaan manager/admin stok.
                    </p>
                  ) : null}
                </div>
              </div>
            </article>
          );
        })}
      </section>

      <footer className="rounded-2xl border border-[var(--border)] bg-white p-4 text-xs leading-5 text-neutral-500">
        Kasus dibuat oleh {data.createdByName} pada {formatDateTime(data.createdAt)}.
        {data.customerName ? ` Customer: ${data.customerName}.` : ""}
      </footer>
    </div>
  );
}
