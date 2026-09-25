import { FileText, PackageCheck, Store, UserRound } from "lucide-react";
import Link from "next/link";

import { BuybackProcessingQuickActions } from "@/components/buybacks/buyback-processing-quick-actions";
import type { BuybackProcessingQuickActionData } from "@/components/buybacks/buyback-history-panel";
import { ProductImage } from "@/components/media/product-image";
import type {
  BuybackHistoryData,
  BuybackHistoryRow,
  BuybackPayoutMethod,
} from "@/features/buybacks/contracts";
import { formatCurrency } from "@/features/pos/payment-draft";
import { cn } from "@/lib/utils";

const payoutLabels: Record<BuybackPayoutMethod, string> = {
  cash: "Cash",
  bank_transfer: "Transfer",
  customer_deposit: "Dana Titip",
};

function formatDateTime(value: Date | null, timeZone: string) {
  if (!value) return "-";

  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone,
  }).format(value);
}

function getProcessingSummary({
  processingCount,
  pendingProcessingCount,
}: Pick<BuybackHistoryRow, "processingCount" | "pendingProcessingCount">) {
  if (pendingProcessingCount > 0) {
    return {
      label: `${pendingProcessingCount} menunggu proses`,
      className: "border-amber-200 bg-amber-50 text-amber-700",
    };
  }

  if (processingCount > 0) {
    return {
      label: "Selesai diproses",
      className: "border-emerald-200 bg-emerald-50 text-emerald-700",
    };
  }

  return {
    label: "Tidak perlu proses",
    className: "border-neutral-200 bg-neutral-50 text-neutral-600",
  };
}

function getStatusSummary(status: BuybackHistoryRow["status"]) {
  if (status === "cancelled") {
    return {
      label: "Dibatalkan",
      className: "border-red-200 bg-red-50 text-red-700",
    };
  }

  return {
    label: "Selesai",
    className: "border-emerald-200 bg-emerald-50 text-emerald-700",
  };
}

function BuybackImagesPreview({ row }: { row: BuybackHistoryRow }) {
  const previewItems = row.imagePreviews.slice(0, 3);
  const hiddenCount = Math.max(row.itemCount - previewItems.length, 0);

  if (previewItems.length === 0) {
    return (
      <ProductImage
        src={null}
        alt="Foto Buyback belum tersedia"
        className="size-20 shrink-0 rounded-2xl border border-[var(--border)] sm:size-24"
      />
    );
  }

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-2">
      {previewItems.map((item) => (
        <ProductImage
          key={item.buybackItemId}
          src={item.imageUrl}
          alt={`Foto saat diterima ${item.displayName}`}
          className="size-16 shrink-0 rounded-xl border border-[var(--border)] sm:size-20"
        />
      ))}
      {hiddenCount > 0 ? (
        <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-neutral-100 text-xs font-semibold text-neutral-600">
          +{hiddenCount}
        </span>
      ) : null}
    </div>
  );
}

type PaginationToken = number | "ellipsis-left" | "ellipsis-right";

function getPaginationTokens(
  page: number,
  pageCount: number,
): PaginationToken[] {
  if (pageCount <= 7) {
    return Array.from({ length: pageCount }, (_, index) => index + 1);
  }

  const visiblePages = new Set<number>([
    1,
    pageCount,
    page - 1,
    page,
    page + 1,
  ]);

  if (page <= 4) {
    [2, 3, 4, 5].forEach((value) => visiblePages.add(value));
  }

  if (page >= pageCount - 3) {
    [pageCount - 4, pageCount - 3, pageCount - 2, pageCount - 1].forEach(
      (value) => visiblePages.add(value),
    );
  }

  const pages = [...visiblePages]
    .filter((value) => value >= 1 && value <= pageCount)
    .sort((left, right) => left - right);
  const tokens: PaginationToken[] = [];

  pages.forEach((value, index) => {
    const previous = pages[index - 1];
    if (previous && value - previous > 1) {
      tokens.push(index === 1 ? "ellipsis-left" : "ellipsis-right");
    }
    tokens.push(value);
  });

  return tokens;
}

export function BuybackCompactHistoryPanel({
  data,
  timeZone,
  mode = "history",
  page = 1,
  pageSize = 10,
  filters,
  historyBaseHref,
  feedback,
  processingQuickActions,
}: {
  data: BuybackHistoryData;
  timeZone: string;
  mode?: "preview" | "history";
  page?: number;
  pageSize?: number;
  filters?: {
    q?: string;
    process?: string;
    payout?: string;
    range?: string;
  };
  historyBaseHref: string;
  feedback?: {
    type: "success" | "error" | "info";
    message: string;
  } | null;
  processingQuickActions?: BuybackProcessingQuickActionData;
}) {
  const totalPages = Math.max(1, Math.ceil(data.totalCount / pageSize));
  const firstRow = data.totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const lastRow = Math.min(page * pageSize, data.totalCount);
  const paginationTokens = getPaginationTokens(page, totalPages);

  function buildHistoryHref({
    targetPage,
    detailId,
  }: {
    targetPage?: number;
    detailId?: string;
  }) {
    const params = new URLSearchParams();

    if (targetPage && targetPage > 1) params.set("page", String(targetPage));
    if (filters?.q) params.set("q", filters.q);
    if (filters?.process && filters.process !== "all") {
      params.set("process", filters.process);
    }
    if (filters?.payout && filters.payout !== "all") {
      params.set("payout", filters.payout);
    }
    if (filters?.range && filters.range !== "today") {
      params.set("range", filters.range);
    }
    if (detailId) params.set("detail", detailId);

    const query = params.toString();
    return query ? `${historyBaseHref}?${query}` : historyBaseHref;
  }

  return (
    <section
      data-history-layout="compact-row-card"
      className="overflow-hidden rounded-2xl border border-[var(--border)] bg-white"
    >
      <div className="flex flex-col gap-3 border-b border-[var(--border)] p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div>
          <h2 className="text-base font-semibold text-neutral-950">
            {mode === "preview"
              ? "Transaksi Buyback terbaru"
              : "Riwayat transaksi Buyback"}
          </h2>
          <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
            {mode === "preview"
              ? "Menampilkan 5 transaksi terakhir dengan tampilan compact yang sama seperti riwayat lengkap."
              : "Tinjau customer, item, payout, total Buyback, dan status pemrosesan tanpa horizontal scroll."}
          </p>
        </div>
        <div className="w-fit rounded-xl bg-neutral-50 px-3 py-2 text-xs font-semibold text-neutral-700">
          {data.totalCount} transaksi
        </div>
      </div>

      {feedback ? (
        <div
          className={cn(
            "m-3 rounded-xl border px-3 py-2 text-sm sm:m-4",
            feedback.type === "error"
              ? "border-red-200 bg-red-50 text-red-700"
              : feedback.type === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-blue-200 bg-blue-50 text-blue-700",
          )}
        >
          {feedback.message}
        </div>
      ) : null}

      {data.rows.length === 0 ? (
        <div className="p-8 text-center text-sm text-[var(--muted)]">
          {mode === "preview"
            ? "Belum ada transaksi Buyback pada outlet ini."
            : "Tidak ada transaksi Buyback yang cocok dengan filter."}
        </div>
      ) : (
        <div className="grid gap-3 p-3 sm:p-4">
          {data.rows.map((row) => {
            const processing = getProcessingSummary(row);
            const status = getStatusSummary(row.status);
            const firstItem =
              row.imagePreviews[0]?.displayName ?? "Produk Buyback";
            const additionalItems = Math.max(row.itemCount - 1, 0);
            const pendingProcessingRows =
              processingQuickActions?.rows.filter(
                (processingRow) => processingRow.buybackId === row.id,
              ) ?? [];
            const detailHref =
              mode === "preview"
                ? `/pos/buyback?detail=${row.id}`
                : buildHistoryHref({
                    targetPage: page,
                    detailId: row.id,
                  });

            return (
              <article
                key={row.id}
                className="min-w-0 overflow-hidden rounded-2xl border border-[var(--border)] bg-white p-4 transition hover:border-[var(--accent)] hover:bg-[var(--accent-soft)]/20 sm:p-5"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <Link
                      href={detailHref}
                      className="break-all text-sm font-semibold text-neutral-950 transition hover:text-[var(--accent)] sm:break-normal"
                    >
                      {row.buybackNumber}
                    </Link>
                    <p className="mt-1 text-xs text-[var(--muted)]">
                      {formatDateTime(
                        row.completedAt ?? row.createdAt,
                        timeZone,
                      )}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2 sm:justify-end">
                    <span
                      className={cn(
                        "inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold",
                        status.className,
                      )}
                    >
                      {status.label}
                    </span>
                    <span
                      className={cn(
                        "inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold",
                        processing.className,
                      )}
                    >
                      {processing.label}
                    </span>
                  </div>
                </div>

                <div className="mt-4 grid min-w-0 gap-4 lg:grid-cols-[220px_minmax(0,1fr)_minmax(260px,0.9fr)] lg:items-start">
                  <div className="min-w-0 rounded-2xl border border-[var(--border)] bg-neutral-50/60 p-3">
                    <p className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">
                      Foto produk
                    </p>
                    <BuybackImagesPreview row={row} />
                    <p className="mt-3 line-clamp-2 text-xs font-medium leading-5 text-neutral-800">
                      {firstItem}
                      {additionalItems > 0
                        ? ` + ${additionalItems} item lainnya`
                        : ""}
                    </p>
                  </div>

                  <div className="min-w-0 space-y-3">
                    <div className="grid min-w-0 gap-3 sm:grid-cols-2">
                      <div className="min-w-0 rounded-2xl border border-neutral-200 bg-neutral-50 p-3">
                        <div className="flex items-center gap-2 text-xs font-medium text-neutral-500">
                          <UserRound className="size-3.5" />
                          Customer
                        </div>
                        <p className="mt-2 break-words text-sm font-semibold text-neutral-950">
                          {row.customerName}
                        </p>
                        <p className="mt-1 break-words text-xs text-[var(--muted)]">
                          {row.customerCode ??
                            row.customerPhone ??
                            "Tanpa kode customer"}
                        </p>
                      </div>

                      <div className="min-w-0 rounded-2xl border border-neutral-200 bg-neutral-50 p-3">
                        <div className="flex items-center gap-2 text-xs font-medium text-neutral-500">
                          <Store className="size-3.5" />
                          Outlet / Staff
                        </div>
                        <p className="mt-2 break-words text-sm font-semibold text-neutral-950">
                          {row.outletName}
                        </p>
                        <p className="mt-1 break-words text-xs text-[var(--muted)]">
                          {row.outletCode} · {row.processedByName}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-2.5 py-1 text-xs font-semibold text-neutral-700">
                        <PackageCheck className="size-3.5" />
                        {row.itemCount} item
                      </span>
                      {row.processingCount > 0 ? (
                        <span className="inline-flex rounded-full border border-neutral-200 bg-white px-2.5 py-1 text-xs font-medium text-neutral-600">
                          {row.processingCount} item Cuci/Rongsok
                        </span>
                      ) : null}
                    </div>
                  </div>

                  <div className="min-w-0 rounded-2xl border border-neutral-200 bg-neutral-50/70 p-3.5">
                    <p className="text-xs font-medium text-neutral-500">
                      Total Buyback
                    </p>
                    <p className="mt-1 text-lg font-semibold text-neutral-950">
                      {formatCurrency(Number(row.totalAmount))}
                    </p>

                    <div className="mt-3 border-t border-neutral-200 pt-3">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
                        Payout
                      </p>
                      {row.payouts.length > 0 ? (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {row.payouts.map((payout) => (
                            <span
                              key={payout.method}
                              className="inline-flex rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700"
                            >
                              {payoutLabels[payout.method]} ·{" "}
                              {formatCurrency(Number(payout.amount))}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p className="mt-2 text-xs text-[var(--muted)]">
                          Payout belum tercatat.
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex flex-col gap-3 border-t border-[var(--border)] pt-4 lg:flex-row lg:items-end lg:justify-between">
                  <div className="min-w-0">
                    {pendingProcessingRows.length > 0 &&
                    processingQuickActions ? (
                      <div>
                        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">
                          Proses item
                        </p>
                        <BuybackProcessingQuickActions
                          rows={pendingProcessingRows}
                          categories={processingQuickActions.categories}
                          productMasters={processingQuickActions.productMasters}
                          colorPresets={processingQuickActions.colorPresets}
                          priceRates={processingQuickActions.priceRates}
                          canProcess={processingQuickActions.canProcess}
                          canPrintLabel={processingQuickActions.canPrintLabel}
                          canViewInventory={processingQuickActions.canViewInventory}
                        />
                      </div>
                    ) : (
                      <p className="text-xs text-[var(--muted)]">
                        Detail transaksi memuat snapshot item, payout, rekening
                        transfer, nota, dan histori pemrosesan.
                      </p>
                    )}
                  </div>

                  <Link
                    href={detailHref}
                    className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-white px-4 text-xs font-semibold text-neutral-800 transition hover:border-[var(--accent)] hover:bg-[var(--accent-soft)] hover:text-[var(--accent)]"
                  >
                    <FileText className="size-3.5" />
                    Lihat detail
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {mode === "preview" && data.totalCount > 0 ? (
        <div className="flex flex-col gap-3 border-t border-[var(--border)] p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <p className="text-xs text-[var(--muted)]">
            Menampilkan {data.rows.length} transaksi terbaru dari{" "}
            {data.totalCount} transaksi.
          </p>
          <Link
            href="/pos/buyback/riwayat"
            className="inline-flex h-10 items-center justify-center rounded-xl bg-neutral-950 px-4 text-xs font-semibold !text-white transition hover:bg-neutral-800"
          >
            Lihat semua riwayat →
          </Link>
        </div>
      ) : null}

      {mode === "history" && data.totalCount > 0 ? (
        <div className="border-t border-[var(--border)] p-4 sm:px-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <p className="text-center text-xs text-[var(--muted)] lg:text-left">
              Menampilkan {firstRow}-{lastRow} dari {data.totalCount} transaksi
              · Halaman {page} dari {totalPages}
            </p>

            <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center sm:justify-center">
              <Link
                href={buildHistoryHref({ targetPage: Math.max(1, page - 1) })}
                aria-disabled={page <= 1}
                className={cn(
                  "inline-flex h-10 items-center justify-center rounded-xl border border-[var(--border)] bg-white px-3 text-xs font-semibold text-neutral-700 transition",
                  page <= 1
                    ? "pointer-events-none opacity-40"
                    : "hover:bg-neutral-50",
                )}
              >
                ← Sebelumnya
              </Link>

              <div className="hidden items-center gap-1.5 md:flex">
                {paginationTokens.map((token) =>
                  typeof token === "number" ? (
                    <Link
                      key={token}
                      href={buildHistoryHref({ targetPage: token })}
                      aria-current={token === page ? "page" : undefined}
                      className={cn(
                        "inline-flex size-10 items-center justify-center rounded-xl border text-xs font-semibold transition",
                        token === page
                          ? "border-neutral-950 bg-neutral-950 !text-white"
                          : "border-[var(--border)] bg-white text-neutral-700 hover:bg-neutral-50",
                      )}
                    >
                      {token}
                    </Link>
                  ) : (
                    <span
                      key={token}
                      className="inline-flex size-10 items-center justify-center text-xs font-semibold text-neutral-400"
                    >
                      …
                    </span>
                  ),
                )}
              </div>

              <Link
                href={buildHistoryHref({
                  targetPage: Math.min(totalPages, page + 1),
                })}
                aria-disabled={page >= totalPages}
                className={cn(
                  "inline-flex h-10 items-center justify-center rounded-xl border border-[var(--border)] bg-white px-3 text-xs font-semibold text-neutral-700 transition",
                  page >= totalPages
                    ? "pointer-events-none opacity-40"
                    : "hover:bg-neutral-50",
                )}
              >
                Berikutnya →
              </Link>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
