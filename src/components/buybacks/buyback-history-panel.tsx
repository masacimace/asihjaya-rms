import { randomUUID } from "node:crypto";

import {
  Banknote,
  CircleDollarSign,
  FileText,
  PackageCheck,
  Printer,
  Sparkles,
  UserRound,
  WalletCards,
  Wrench,
} from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { reprintBuybackReceiptAction } from "@/app/actions/buybacks";
import type {
  BuybackDetail,
  BuybackHistoryData,
  BuybackPayoutMethod,
  BuybackProcessingType,
} from "@/features/buybacks/contracts";
import { formatCurrency } from "@/features/pos/payment-draft";

const payoutLabels: Record<BuybackPayoutMethod, string> = {
  cash: "Cash",
  bank_transfer: "Transfer",
  customer_deposit: "Dana Titip",
};

const processingLabels: Record<BuybackProcessingType, string> = {
  cleaning: "Cuci",
  recondition: "Rongsok",
};

function formatDateTime(value: Date | null, timeZone: string) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone,
  }).format(value);
}

function readSnapshot(snapshot: Record<string, unknown>, key: string) {
  const value = snapshot[key];
  if (value === null || value === undefined) return null;
  const normalized = String(value).trim();
  return normalized || null;
}

function getItemName(item: BuybackDetail["items"][number]) {
  return (
    readSnapshot(item.snapshot, "displayName") ??
    readSnapshot(item.snapshot, "productMasterName") ??
    readSnapshot(item.snapshot, "originalProductMasterName") ??
    item.currentDisplayName ??
    "Produk Buyback"
  );
}

function receiptStatusLabel(status: string) {
  const labels: Record<string, string> = {
    pending: "Menunggu printer",
    claimed: "Diklaim Hardware Hub",
    processing: "Diproses",
    printing: "Sedang dicetak",
    submitted: "Dikirim ke printer",
    completed: "Selesai dicetak",
    failed: "Gagal",
    unknown_outcome: "Status print belum pasti",
    expired: "Kedaluwarsa",
    cancelled: "Dibatalkan",
  };
  return labels[status] ?? status;
}

export function BuybackHistoryPanel({
  data,
  timeZone,
  feedback,
  mode = "preview",
  page = 1,
  pageSize = 10,
  filters,
  detailBackHref,
}: {
  data: BuybackHistoryData;
  timeZone: string;
  feedback?: {
    type: "success" | "error" | "info";
    message: string;
  } | null;
  mode?: "preview" | "history";
  page?: number;
  pageSize?: number;
  filters?: {
    q?: string;
    process?: string;
    payout?: string;
  };
  detailBackHref?: string;
}) {
  function buildHistoryHref({
    targetPage,
    detailId,
  }: {
    targetPage?: number;
    detailId?: string;
  }) {
    const params = new URLSearchParams();

    if (targetPage && targetPage > 1) {
      params.set("page", String(targetPage));
    }
    if (filters?.q) params.set("q", filters.q);
    if (filters?.process && filters.process !== "all") {
      params.set("process", filters.process);
    }
    if (filters?.payout && filters.payout !== "all") {
      params.set("payout", filters.payout);
    }
    if (detailId) params.set("detail", detailId);

    const query = params.toString();
    return query
      ? `/pos/buyback/riwayat?${query}`
      : "/pos/buyback/riwayat";
  }

  if (data.detail) {
    return (
      <BuybackDetailPanel
        detail={data.detail}
        timeZone={timeZone}
        feedback={feedback}
        backHref={detailBackHref ?? "/pos/buyback"}
      />
    );
  }

  const totalPages = Math.max(1, Math.ceil(data.totalCount / pageSize));
  const firstRow = data.totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const lastRow = Math.min(page * pageSize, data.totalCount);

  function detailHref(id: string) {
    return mode === "history"
      ? buildHistoryHref({ targetPage: page, detailId: id })
      : `/pos/buyback?detail=${id}`;
  }

  return (
    <section className="rounded-2xl border border-[var(--border)] bg-white">
      <div className="flex flex-col gap-3 border-b border-[var(--border)] p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div>
          <h2 className="text-base font-semibold text-neutral-950">
            {mode === "history"
              ? "Riwayat transaksi Buyback"
              : "Transaksi Buyback terbaru"}
          </h2>
          <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
            {mode === "history"
              ? "Riwayat lengkap Buyback outlet dengan detail transaksi dan status pemrosesan."
              : "Menampilkan 5 transaksi terakhir. Riwayat lengkap tersedia di halaman khusus."}
          </p>
        </div>
        <div className="rounded-xl bg-neutral-50 px-3 py-2 text-xs font-semibold text-neutral-700">
          {data.totalCount} transaksi
        </div>
      </div>

      {feedback ? (
        <div
          className={`m-4 rounded-xl border px-3 py-2 text-sm sm:m-5 ${
            feedback.type === "error"
              ? "border-red-200 bg-red-50 text-red-700"
              : feedback.type === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-blue-200 bg-blue-50 text-blue-700"
          }`}
        >
          {feedback.message}
        </div>
      ) : null}

      {data.rows.length === 0 ? (
        <div className="p-8 text-center text-sm text-[var(--muted)]">
          {mode === "history"
            ? "Tidak ada transaksi Buyback yang cocok dengan filter."
            : "Belum ada transaksi Buyback pada outlet ini."}
        </div>
      ) : (
        <>
          <div className="divide-y divide-[var(--border)] md:hidden">
            {data.rows.map((row) => (
              <article key={row.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-neutral-950">
                      {row.buybackNumber}
                    </p>
                    <p className="mt-1 text-xs text-[var(--muted)]">
                      {formatDateTime(
                        row.completedAt ?? row.createdAt,
                        timeZone,
                      )}
                    </p>
                  </div>
                  <p className="shrink-0 text-sm font-bold text-neutral-950">
                    {formatCurrency(Number(row.totalAmount))}
                  </p>
                </div>

                <div className="mt-3 rounded-xl bg-neutral-50 p-3">
                  <p className="text-sm font-medium text-neutral-900">
                    {row.customerName}
                  </p>
                  <p className="mt-1 text-xs text-[var(--muted)]">
                    {row.customerCode ?? row.customerPhone ?? "-"}
                  </p>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-semibold text-neutral-700">
                    <PackageCheck className="size-3.5" />
                    {row.itemCount} Item
                  </span>
                  {row.pendingProcessingCount > 0 ? (
                    <span className="whitespace-nowrap rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
                      {row.pendingProcessingCount} menunggu proses
                    </span>
                  ) : (
                    <span className="whitespace-nowrap rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                      Tidak ada antrean
                    </span>
                  )}
                </div>

                {row.payouts.length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {row.payouts.map((payout) => (
                      <span
                        key={payout.method}
                        className="rounded-full border border-[var(--border)] bg-white px-2.5 py-1 text-xs text-neutral-700"
                      >
                        {payoutLabels[payout.method]}
                      </span>
                    ))}
                  </div>
                ) : null}

                <Link
                  href={detailHref(row.id)}
                  className="mt-4 inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-xl border border-[var(--border)] bg-white px-3 text-xs font-semibold text-neutral-800"
                >
                  <FileText className="size-3.5" />
                  Detail
                </Link>
              </article>
            ))}
          </div>

          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[940px] text-left text-sm">
              <thead className="bg-neutral-50 text-xs uppercase text-[var(--muted)]">
                <tr>
                  <th className="px-4 py-3 sm:px-5">No. Buyback</th>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Item</th>
                  <th className="px-4 py-3">Proses</th>
                  <th className="px-4 py-3">Payout</th>
                  <th className="px-4 py-3 text-right">Total</th>
                  <th className="px-4 py-3 sm:px-5">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {data.rows.map((row) => (
                  <tr
                    key={row.id}
                    className="align-top hover:bg-neutral-50/60"
                  >
                    <td className="px-4 py-4 sm:px-5">
                      <p className="font-semibold text-neutral-950">
                        {row.buybackNumber}
                      </p>
                      <p className="mt-1 text-xs text-[var(--muted)]">
                        {formatDateTime(
                          row.completedAt ?? row.createdAt,
                          timeZone,
                        )}
                      </p>
                    </td>
                    <td className="px-4 py-4">
                      <p className="font-medium text-neutral-900">
                        {row.customerName}
                      </p>
                      <p className="mt-1 text-xs text-[var(--muted)]">
                        {row.customerCode ?? row.customerPhone ?? "-"}
                      </p>
                    </td>
                    <td className="px-4 py-4">
                      <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-semibold text-neutral-700">
                        <PackageCheck className="size-3.5" />
                        {row.itemCount} Item
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      {row.pendingProcessingCount > 0 ? (
                        <span className="whitespace-nowrap rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
                          {row.pendingProcessingCount} menunggu proses
                        </span>
                      ) : (
                        <span className="whitespace-nowrap rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                          Tidak ada antrean
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex flex-wrap gap-1.5">
                        {row.payouts.map((payout) => (
                          <span
                            key={payout.method}
                            className="rounded-full border border-[var(--border)] bg-white px-2.5 py-1 text-xs text-neutral-700"
                          >
                            {payoutLabels[payout.method]}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 text-right font-semibold text-neutral-950">
                      {formatCurrency(Number(row.totalAmount))}
                    </td>
                    <td className="px-4 py-4 sm:px-5">
                      <Link
                        href={detailHref(row.id)}
                        className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-xs font-semibold text-neutral-800 transition hover:bg-neutral-50"
                      >
                        <FileText className="size-3.5" />
                        Detail
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {mode === "preview" && data.totalCount > 0 ? (
        <div className="flex flex-col gap-3 border-t border-[var(--border)] p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <p className="text-xs text-[var(--muted)]">
            Menampilkan {data.rows.length} transaksi terbaru dari{" "}
            {data.totalCount} transaksi.
          </p>
          <Link
            href="/pos/buyback/riwayat"
            className="inline-flex h-10 items-center justify-center rounded-xl bg-neutral-950 px-4 text-xs font-semibold !text-white"
          >
            Lihat semua riwayat &rarr;
          </Link>
        </div>
      ) : null}

      {mode === "history" && data.totalCount > 0 ? (
        <div className="flex flex-col gap-3 border-t border-[var(--border)] p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <p className="text-xs text-[var(--muted)]">
            Menampilkan {firstRow}-{lastRow} dari {data.totalCount} transaksi.
          </p>
          <div className="flex items-center justify-between gap-2 sm:justify-end">
            {page > 1 ? (
              <Link
                href={buildHistoryHref({ targetPage: page - 1 })}
                className="inline-flex h-10 items-center rounded-xl border border-[var(--border)] bg-white px-3 text-xs font-semibold text-neutral-700"
              >
                &larr; Sebelumnya
              </Link>
            ) : (
              <span className="inline-flex h-10 items-center rounded-xl border border-[var(--border)] bg-neutral-50 px-3 text-xs font-semibold text-neutral-400">
                &larr; Sebelumnya
              </span>
            )}

            <span className="whitespace-nowrap px-2 text-xs font-semibold text-neutral-700">
              {page} / {totalPages}
            </span>

            {page < totalPages ? (
              <Link
                href={buildHistoryHref({ targetPage: page + 1 })}
                className="inline-flex h-10 items-center rounded-xl border border-[var(--border)] bg-white px-3 text-xs font-semibold text-neutral-700"
              >
                Berikutnya &rarr;
              </Link>
            ) : (
              <span className="inline-flex h-10 items-center rounded-xl border border-[var(--border)] bg-neutral-50 px-3 text-xs font-semibold text-neutral-400">
                Berikutnya &rarr;
              </span>
            )}
          </div>
        </div>
      ) : null}
    </section>
  );
}
function BuybackDetailPanel({
  detail,
  timeZone,
  feedback,
  backHref,
}: {
  detail: BuybackDetail;
  timeZone: string;
  feedback?: {
    type: "success" | "error" | "info";
    message: string;
  } | null;
  backHref: string;
}) {
  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-[var(--border)] bg-white p-4 sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase text-[var(--accent)]">
              Detail Buyback
            </p>
            <h2 className="mt-1 text-xl font-semibold text-neutral-950">
              {detail.buybackNumber}
            </h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              {formatDateTime(detail.completedAt ?? detail.createdAt, timeZone)}{" "}
              · {detail.outletName} · {detail.registerName}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <a
              href={`/api/buybacks/${detail.id}/receipt-certificate`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-xs font-semibold text-neutral-800"
            >
              <FileText className="size-3.5" />
              Buka Nota PDF
            </a>
            <form action={reprintBuybackReceiptAction}>
              <input type="hidden" name="buybackId" value={detail.id} />
              <input type="hidden" name="requestId" value={randomUUID()} />
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 rounded-xl bg-neutral-950 px-3 py-2 text-xs font-semibold text-white"
              >
                <Printer className="size-3.5" />
                Cetak Ulang Nota
              </button>
            </form>
          </div>
        </div>

        {feedback ? (
          <div
            className={`mt-4 rounded-xl border px-3 py-2 text-sm ${
              feedback.type === "error"
                ? "border-red-200 bg-red-50 text-red-700"
                : feedback.type === "success"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-blue-200 bg-blue-50 text-blue-700"
            }`}
          >
            {feedback.message}
          </div>
        ) : null}

        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <InfoCard
            icon={<UserRound className="size-4" />}
            label="Customer penjual"
            value={detail.customerName}
            helper={detail.customerCode ?? detail.customerPhone ?? "-"}
          />
          <InfoCard
            icon={<PackageCheck className="size-4" />}
            label="Jumlah item"
            value={`${detail.itemCount} item`}
            helper={
              detail.pendingProcessingCount > 0
                ? `${detail.pendingProcessingCount} menunggu Cuci/Rongsok`
                : "Tidak ada antrean proses"
            }
          />
          <InfoCard
            icon={<CircleDollarSign className="size-4" />}
            label="Total Buyback"
            value={formatCurrency(Number(detail.totalAmount))}
            helper="Nominal final yang disepakati"
          />
          <InfoCard
            icon={<Printer className="size-4" />}
            label="Status nota"
            value={
              detail.receiptJob
                ? receiptStatusLabel(detail.receiptJob.status)
                : "Belum ada job print"
            }
            helper={
              detail.receiptJob
                ? `Attempt ${detail.receiptJob.attempts}`
                : "Cetak ulang bila diperlukan"
            }
          />
        </div>

        {detail.notes ? (
          <div className="mt-4 rounded-xl bg-neutral-50 p-3 text-sm text-neutral-700">
            <span className="font-semibold">Catatan:</span> {detail.notes}
          </div>
        ) : null}
      </section>

      <section className="rounded-2xl border border-[var(--border)] bg-white">
        <div className="border-b border-[var(--border)] p-4 sm:p-5">
          <h3 className="font-semibold text-neutral-950">Item Buyback</h3>
          <p className="mt-1 text-xs text-[var(--muted)]">
            Snapshot di bawah adalah kondisi barang ketika diterima dari
            customer.
          </p>
        </div>
        <div className="divide-y divide-[var(--border)]">
          {detail.items.map((item) => {
            const processingType = item.processingType;
            const ProcessingIcon =
              processingType === "recondition" ? Wrench : Sparkles;
            const categoryName = readSnapshot(item.snapshot, "categoryName");
            const color = readSnapshot(item.snapshot, "color");
            const snapshotSku = readSnapshot(item.snapshot, "sku");
            const snapshotBarcode = readSnapshot(item.snapshot, "barcode");

            return (
              <div
                key={item.id}
                className="grid gap-4 p-4 sm:p-5 lg:grid-cols-[minmax(0,1fr)_auto]"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-neutral-950">
                      {getItemName(item)}
                    </p>
                    <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-[11px] font-semibold text-neutral-700">
                      {item.source === "asihjaya"
                        ? "Produk ASIHJAYA"
                        : "Barang Luar"}
                    </span>
                    {processingType ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700">
                        <ProcessingIcon className="size-3" />
                        {processingLabels[processingType]} ·{" "}
                        {item.processingStatus === "completed"
                          ? "Selesai"
                          : "Belum diproses"}
                      </span>
                    ) : (
                      <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-[11px] font-semibold text-neutral-600">
                        Transaksi legacy
                      </span>
                    )}
                  </div>

                  {snapshotSku ||
                  item.currentSku ||
                  snapshotBarcode ||
                  item.currentBarcode ? (
                    <p className="mt-1 text-xs text-[var(--muted)]">
                      {snapshotSku ?? item.currentSku ?? "-"} ·{" "}
                      {snapshotBarcode ?? item.currentBarcode ?? "-"}
                    </p>
                  ) : null}

                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-neutral-700">
                    {categoryName ? (
                      <span className="rounded-lg bg-neutral-50 px-2.5 py-1.5">
                        {categoryName}
                      </span>
                    ) : null}
                    <span className="rounded-lg bg-neutral-50 px-2.5 py-1.5">
                      Berat {item.weightGram} gr
                    </span>
                    <span className="rounded-lg bg-neutral-50 px-2.5 py-1.5">
                      Kadar {item.purityPercent}%
                    </span>
                    {color ? (
                      <span className="rounded-lg bg-neutral-50 px-2.5 py-1.5">
                        Warna {color}
                      </span>
                    ) : null}
                  </div>
                </div>

                <div className="text-left lg:text-right">
                  <p className="text-xs text-[var(--muted)]">Total Harga</p>
                  <p className="mt-1 text-lg font-semibold text-neutral-950">
                    {formatCurrency(Number(item.finalAmount))}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="rounded-2xl border border-[var(--border)] bg-white p-4 sm:p-5">
        <h3 className="font-semibold text-neutral-950">Payout</h3>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {detail.payouts.map((payout) => {
            const Icon =
              payout.method === "cash"
                ? Banknote
                : payout.method === "customer_deposit"
                  ? WalletCards
                  : CircleDollarSign;
            return (
              <div
                key={payout.method}
                className="rounded-xl border border-[var(--border)] bg-neutral-50/60 p-3"
              >
                <div className="flex items-center gap-2 text-xs font-semibold text-neutral-700">
                  <Icon className="size-4 text-[var(--accent)]" />
                  {payoutLabels[payout.method]}
                </div>
                <p className="mt-2 text-base font-semibold text-neutral-950">
                  {formatCurrency(Number(payout.amount))}
                </p>
                {payout.reference ? (
                  <p className="mt-1 text-xs text-[var(--muted)]">
                    Ref: {payout.reference}
                  </p>
                ) : null}
              </div>
            );
          })}
        </div>
      </section>

      <Link
        href={backHref}
        className="inline-flex items-center rounded-xl border border-[var(--border)] bg-white px-4 py-2.5 text-sm font-semibold text-neutral-800"
      >
        Kembali ke Buyback
      </Link>
    </div>
  );
}

function InfoCard({
  icon,
  label,
  value,
  helper,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  helper: string;
}) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-neutral-50/60 p-3">
      <div className="flex items-center gap-2 text-xs font-semibold text-neutral-600">
        <span className="text-[var(--accent)]">{icon}</span>
        {label}
      </div>
      <p className="mt-2 font-semibold text-neutral-950">{value}</p>
      <p className="mt-1 text-[11px] leading-4 text-[var(--muted)]">{helper}</p>
    </div>
  );
}
