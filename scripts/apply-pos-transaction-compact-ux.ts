import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const pagePath = resolve("src/app/(pos)/pos/transaksi/page.tsx");
const expectedBlobSha = "008e283d4b0c533e5ae42c54be896bff574ab828";
let source = readFileSync(pagePath, "utf8");

function gitBlobSha(value: string) {
  const body = Buffer.from(value, "utf8");
  return createHash("sha1")
    .update(Buffer.from(`blob ${body.length}\0`))
    .update(body)
    .digest("hex");
}

assert.equal(
  gitBlobSha(source),
  expectedBlobSha,
  "page.tsx berbeda dari GitHub main yang diaudit. Re-audit sebelum menerapkan patch.",
);

function replaceOnce(label: string, from: string, to: string) {
  assert.ok(source.includes(from), `${label}: anchor tidak ditemukan.`);
  source = source.replace(from, to);
}

replaceOnce(
  "lucide import",
  `  Clock3,\n  FileText,`,
  `  ChevronDown,\n  Clock3,\n  FileText,`,
);

replaceOnce(
  "query import",
  `import {\n  getPosTransactionDetailData,\n  getPosTransactionListData,\n} from "@/features/pos/queries";`,
  `import { getPosTransactionDetailData } from "@/features/pos/queries";\nimport { getPosTransactionHistoryPageData } from "@/features/pos/transaction-history-pagination";`,
);

replaceOnce(
  "buildTransactionsHref signature",
  `function buildTransactionsHref({\n  query,\n  range,\n  detailId,\n  shiftId,\n}: {\n  query: string;\n  range: PosTransactionRange;\n  detailId?: string | null;\n  shiftId?: string | null;\n}) {`,
  `function buildTransactionsHref({\n  query,\n  range,\n  detailId,\n  shiftId,\n  page,\n}: {\n  query: string;\n  range: PosTransactionRange;\n  detailId?: string | null;\n  shiftId?: string | null;\n  page?: number | null;\n}) {`,
);

replaceOnce(
  "buildTransactionsHref page param",
  `  if (shiftId) {\n    params.set("shift", shiftId);\n  }\n\n  const queryString = params.toString();`,
  `  if (shiftId) {\n    params.set("shift", shiftId);\n  }\n\n  if (page && page > 1) {\n    params.set("page", String(page));\n  }\n\n  const queryString = params.toString();`,
);

const cardStart = source.indexOf("function TransactionCard({");
const cardEnd = source.indexOf("function DetailSection({", cardStart);
assert.ok(cardStart >= 0 && cardEnd > cardStart, "TransactionCard block tidak ditemukan.");

const compactCard = `function TransactionCard({\n  transaction,\n  detailHref,\n  isSelected,\n}: {\n  transaction: PosTransactionListItem;\n  detailHref: string;\n  isSelected: boolean;\n}) {\n  return (\n    <article\n      data-transaction-layout="compact-row-card"\n      className={cn(\n        "min-w-0 overflow-hidden rounded-2xl border bg-white p-4 transition sm:p-5",\n        isSelected\n          ? "border-[var(--accent)] bg-[var(--accent-soft)]/25 ring-2 ring-[var(--accent-soft)]"\n          : "border-[var(--border)] hover:border-[var(--accent)] hover:bg-[var(--accent-soft)]/20",\n      )}\n    >\n      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">\n        <div className="min-w-0">\n          <p className="truncate text-sm font-semibold text-neutral-950 sm:text-base">\n            {transaction.invoiceNumber}\n          </p>\n          <p className="mt-1 text-xs leading-5 text-[var(--muted)]">\n            {formatTransactionDate(\n              transaction.completedAt ?? transaction.createdAt,\n            )} · {transaction.registerName} · {transaction.cashierName}\n          </p>\n        </div>\n        <PaymentStatusPill transaction={transaction} />\n      </div>\n\n      <div className="mt-4 grid min-w-0 gap-3 lg:grid-cols-[180px_minmax(0,1fr)_minmax(240px,0.8fr)]">\n        <div className="min-w-0 rounded-xl border border-[var(--border)] bg-neutral-50/70 p-3">\n          <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">\n            Foto produk\n          </p>\n          <div className="mt-3 min-w-0 overflow-hidden">\n            <TransactionImagesPreview transaction={transaction} />\n          </div>\n          <p className="mt-3 text-xs font-semibold text-neutral-800">\n            {formatInteger(transaction.totalItems)} item\n          </p>\n        </div>\n\n        <div className="min-w-0 space-y-3">\n          <div className="min-w-0 rounded-xl border border-[var(--border)] bg-neutral-50/70 p-3.5">\n            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">\n              <UserRound className="size-3.5" />\n              Customer\n            </div>\n            <p className="mt-2 truncate text-sm font-semibold text-neutral-950">\n              {transaction.customerName ?? "Customer umum"}\n            </p>\n            <p className="mt-1 truncate text-xs text-[var(--muted)]">\n              {transaction.customerCode ??\n                transaction.customerPhone ??\n                "Tanpa data customer"}\n            </p>\n          </div>\n\n          <div className="min-w-0 rounded-xl border border-[var(--border)] bg-neutral-50/70 p-3.5">\n            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">\n              Item transaksi\n            </p>\n            <TransactionItemsPreview transaction={transaction} />\n          </div>\n        </div>\n\n        <div className="min-w-0 rounded-xl border border-[var(--border)] bg-neutral-50/70 p-3.5">\n          <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">\n            Payment & total\n          </p>\n          <div className="mt-2">\n            <PaymentStatusPill transaction={transaction} />\n          </div>\n          <p className="mt-2 break-words text-xs leading-5 text-[var(--muted)]">\n            {getPaymentMethodSummary(transaction)}\n          </p>\n          <p className="mt-1 text-xs font-medium text-neutral-700">\n            Terbayar {formatMoney(transaction.paidAmount)}\n          </p>\n          <div className="mt-3 border-t border-neutral-200 pt-3">\n            <p className="text-lg font-semibold text-neutral-950">\n              {formatMoney(transaction.totalAmount)}\n            </p>\n            {Number(transaction.discountAmount) > 0 ? (\n              <p className="mt-1 text-xs text-red-600">\n                Diskon {formatMoney(transaction.discountAmount)}\n              </p>\n            ) : null}\n          </div>\n        </div>\n      </div>\n\n      <div className="mt-4 flex flex-col gap-2 border-t border-[var(--border)] pt-4 sm:flex-row sm:justify-end">\n        <Link\n          href={detailHref}\n          className={cn(\n            "inline-flex h-10 items-center justify-center gap-2 rounded-xl border px-4 text-xs font-semibold transition",\n            isSelected\n              ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]"\n              : "border-[var(--border)] bg-white text-neutral-700 hover:border-[var(--accent)] hover:bg-[var(--accent-soft)]/20",\n          )}\n        >\n          <Package className="size-3.5" />\n          Detail\n        </Link>\n        <a\n          href={\`/api/sales/\${transaction.id}/receipt-certificate\`}\n          target="_blank"\n          rel="noreferrer"\n          className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-neutral-950 px-4 text-xs font-semibold !text-white transition hover:bg-neutral-800 [&_svg]:!text-white"\n        >\n          <FileText className="size-3.5" />\n          Lihat Invoice\n        </a>\n      </div>\n    </article>\n  );\n}\n\n`;

source = source.slice(0, cardStart) + compactCard + source.slice(cardEnd);

replaceOnce(
  "page param parse",
  `  const shiftId = getSearchParam(resolvedSearchParams, "shift")?.trim() ?? "";\n  const feedbackMessage =`,
  `  const shiftId = getSearchParam(resolvedSearchParams, "shift")?.trim() ?? "";\n  const rawPage = Number.parseInt(\n    getSearchParam(resolvedSearchParams, "page") ?? "1",\n    10,\n  );\n  const page = Number.isSafeInteger(rawPage) && rawPage > 0 ? rawPage : 1;\n  const feedbackMessage =`,
);

replaceOnce(
  "paged query call",
  `    getPosTransactionListData({\n      organizationId: auth.organization.id,\n      outletId: primaryOutlet?.id,\n      query,\n      range,\n      shiftId,\n      timeZone: auth.organization.timezone,\n    }),`,
  `    getPosTransactionHistoryPageData({\n      organizationId: auth.organization.id,\n      outletId: primaryOutlet?.id,\n      query,\n      range,\n      shiftId,\n      timeZone: auth.organization.timezone,\n      page,\n    }),`,
);

replaceOnce(
  "detail close page",
  `  const detailCloseHref = buildTransactionsHref({\n    query: data.query,\n    range: data.range,\n    shiftId: data.shiftId,\n  });`,
  `  const detailCloseHref = buildTransactionsHref({\n    query: data.query,\n    range: data.range,\n    shiftId: data.shiftId,\n    page: data.pagination.page,\n  });`,
);

replaceOnce(
  "detail current page",
  `  const detailCurrentHref = buildTransactionsHref({\n    query: data.query,\n    range: data.range,\n    detailId,\n    shiftId: data.shiftId,\n  });`,
  `  const detailCurrentHref = buildTransactionsHref({\n    query: data.query,\n    range: data.range,\n    detailId,\n    shiftId: data.shiftId,\n    page: data.pagination.page,\n  });\n  const activeFilterCount = [\n    data.query || null,\n    data.range !== "today" ? data.range : null,\n    data.shiftId,\n  ].filter(Boolean).length;\n  const firstRow =\n    data.pagination.total === 0\n      ? 0\n      : (data.pagination.page - 1) * data.pagination.pageSize + 1;\n  const lastRow = Math.min(\n    data.pagination.page * data.pagination.pageSize,\n    data.pagination.total,\n  );`,
);

const filterStart = source.indexOf(
  `      <section className="mt-5 rounded-2xl border border-[var(--border)] bg-white p-4">`,
);
const feedbackAnchor = source.indexOf(`      {feedbackMessage ? (`, filterStart);
assert.ok(filterStart >= 0 && feedbackAnchor > filterStart, "Filter section tidak ditemukan.");

const filterReplacement = `      <details className="group mt-5 overflow-hidden rounded-2xl border border-[var(--border)] bg-white">\n        <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-4 transition hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--accent)] sm:px-5 [&::-webkit-details-marker]:hidden">\n          <div className="grid size-10 shrink-0 place-items-center rounded-xl border border-[var(--border)] bg-neutral-50 text-neutral-600">\n            <Search className="size-4" />\n          </div>\n          <div className="min-w-0 flex-1">\n            <div className="flex flex-wrap items-center gap-2">\n              <p className="text-sm font-semibold text-neutral-950">\n                Filter transaksi\n              </p>\n              {activeFilterCount > 0 ? (\n                <span className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700">\n                  {activeFilterCount} filter aktif\n                </span>\n              ) : (\n                <span className="inline-flex rounded-full border border-[var(--border)] bg-neutral-50 px-2.5 py-1 text-[11px] font-semibold text-neutral-500">\n                  Opsional\n                </span>\n              )}\n              <span className="inline-flex rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-700">\n                {rangeLabels[data.range]}\n              </span>\n              {data.shiftId ? (\n                <span className="inline-flex rounded-full border border-[var(--accent)]/20 bg-[var(--accent-soft)] px-2.5 py-1 text-[11px] font-semibold text-[var(--accent)]">\n                  Shift aktif\n                </span>\n              ) : null}\n            </div>\n            <p className="mt-1 line-clamp-2 text-xs leading-5 text-[var(--muted)]">\n              {data.query\n                ? \`Pencarian “\${data.query}”. Buka untuk mengubah kata kunci atau periode.\`\n                : "Buka untuk mencari invoice, customer, SKU, barcode, nama item, atau mengubah periode."}\n            </p>\n          </div>\n          <div className="ml-auto flex shrink-0 items-center gap-2">\n            <span className="hidden text-xs font-semibold text-neutral-500 sm:inline group-open:hidden">\n              Buka filter\n            </span>\n            <span className="hidden text-xs font-semibold text-neutral-500 sm:group-open:inline">\n              Tutup filter\n            </span>\n            <ChevronDown className="size-4 text-neutral-500 transition-transform duration-200 group-open:rotate-180" />\n          </div>\n        </summary>\n\n        <div className="border-t border-[var(--border)] p-4 sm:p-5">\n          <form className="grid min-w-0 gap-3 lg:grid-cols-[minmax(0,1fr)_220px_auto] lg:items-end">\n            <label className="grid min-w-0 gap-1.5 text-sm font-medium text-neutral-700">\n              <span>Cari transaksi</span>\n              <div className="flex h-11 min-w-0 items-center gap-3 rounded-xl border border-[var(--border)] bg-white px-3 transition focus-within:border-[var(--accent)] focus-within:ring-2 focus-within:ring-[var(--accent-soft)]">\n                <Search className="size-4 shrink-0 text-neutral-400" />\n                <input\n                  type="search"\n                  name="q"\n                  defaultValue={data.query}\n                  placeholder="Invoice, customer, SKU, barcode, nama item..."\n                  className="min-w-0 flex-1 bg-transparent text-sm text-neutral-950 outline-none placeholder:text-neutral-400"\n                />\n              </div>\n            </label>\n\n            <label className="grid gap-1.5 text-sm font-medium text-neutral-700">\n              <span>Periode</span>\n              <select\n                name="range"\n                defaultValue={data.range}\n                className="h-11 min-w-0 rounded-xl border border-[var(--border)] bg-white px-3 text-sm text-neutral-950 outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-soft)]"\n              >\n                {(Object.keys(rangeLabels) as PosTransactionRange[]).map(\n                  (rangeValue) => (\n                    <option key={rangeValue} value={rangeValue}>\n                      {rangeLabels[rangeValue]}\n                    </option>\n                  ),\n                )}\n              </select>\n            </label>\n\n            {data.shiftId ? (\n              <input type="hidden" name="shift" value={data.shiftId} />\n            ) : null}\n\n            <div className="flex gap-2">\n              {activeFilterCount > 0 ? (\n                <Link\n                  href="/pos/transaksi"\n                  className="inline-flex h-11 items-center justify-center rounded-xl border border-[var(--border)] bg-white px-4 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-50"\n                >\n                  Reset\n                </Link>\n              ) : null}\n              <button\n                type="submit"\n                className="inline-flex h-11 flex-1 items-center justify-center rounded-xl bg-neutral-950 px-5 text-sm font-semibold !text-white transition hover:bg-neutral-800 lg:flex-none"\n              >\n                Terapkan\n              </button>\n            </div>\n          </form>\n\n          {data.shiftId ? (\n            <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl bg-neutral-50 px-3 py-2.5 text-xs text-[var(--muted)]">\n              <span>Filter shift aktif sedang digunakan.</span>\n              <Link\n                href={buildTransactionsHref({\n                  query: data.query,\n                  range: data.range,\n                })}\n                className="font-semibold text-[var(--accent)] hover:underline"\n              >\n                Hapus filter shift\n              </Link>\n            </div>\n          ) : null}\n        </div>\n      </details>\n\n`;

source = source.slice(0, filterStart) + filterReplacement + source.slice(feedbackAnchor);

const listStart = source.indexOf(`      {data.transactions.length === 0 ? (`);
const containerClose = source.lastIndexOf(`    </PosPageContainer>`);
assert.ok(listStart >= 0 && containerClose > listStart, "Transaction list block tidak ditemukan.");

const listReplacement = `      <section className="mt-5 overflow-hidden rounded-2xl border border-[var(--border)] bg-white">\n        <div className="flex flex-col gap-3 border-b border-[var(--border)] p-4 sm:flex-row sm:items-end sm:justify-between sm:p-5">\n          <div className="min-w-0">\n            <h2 className="font-semibold text-neutral-950">Riwayat transaksi</h2>\n            <p className="mt-1 text-xs leading-5 text-[var(--muted)]">\n              Invoice, customer, item, payment, dan total dalam compact row-card tanpa horizontal scroll.\n            </p>\n          </div>\n          <span className="inline-flex w-fit rounded-full border border-[var(--border)] bg-neutral-50 px-3 py-1.5 text-xs font-semibold text-neutral-700">\n            {formatInteger(data.pagination.total)} transaksi\n          </span>\n        </div>\n\n        {data.transactions.length === 0 ? (\n          <div className="grid min-h-64 place-items-center p-8 text-center">\n            <div>\n              <div className="mx-auto grid size-16 place-items-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent)]">\n                <ReceiptText className="size-7" />\n              </div>\n              <h3 className="mt-4 font-semibold text-neutral-950">\n                Transaksi belum ditemukan\n              </h3>\n              <p className="mt-2 max-w-md text-sm leading-6 text-[var(--muted)]">\n                Belum ada transaksi completed untuk filter ini. Coba ubah periode atau kata kunci pencarian.\n              </p>\n            </div>\n          </div>\n        ) : (\n          <div className="grid gap-3 p-3 sm:p-4">\n            {data.transactions.map((transaction) => (\n              <TransactionCard\n                key={transaction.id}\n                transaction={transaction}\n                detailHref={buildTransactionsHref({\n                  query: data.query,\n                  range: data.range,\n                  detailId: transaction.id,\n                  shiftId: data.shiftId,\n                  page: data.pagination.page,\n                })}\n                isSelected={transaction.id === detailId}\n              />\n            ))}\n          </div>\n        )}\n\n        {data.pagination.total > 0 ? (\n          <div className="border-t border-[var(--border)] p-4 sm:px-5">\n            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">\n              <p className="text-xs text-[var(--muted)]">\n                Menampilkan {firstRow}–{lastRow} dari {data.pagination.total} transaksi · Halaman {data.pagination.page} dari {data.pagination.pageCount}\n              </p>\n              <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">\n                <Link\n                  href={buildTransactionsHref({\n                    query: data.query,\n                    range: data.range,\n                    shiftId: data.shiftId,\n                    page: Math.max(1, data.pagination.page - 1),\n                  })}\n                  aria-disabled={data.pagination.page <= 1}\n                  className={cn(\n                    "inline-flex h-10 items-center justify-center rounded-xl border border-[var(--border)] bg-white px-3 text-xs font-semibold text-neutral-700 transition",\n                    data.pagination.page <= 1\n                      ? "pointer-events-none opacity-40"\n                      : "hover:border-[var(--accent)] hover:bg-[var(--accent-soft)]/20",\n                  )}\n                >\n                  ← Sebelumnya\n                </Link>\n                <Link\n                  href={buildTransactionsHref({\n                    query: data.query,\n                    range: data.range,\n                    shiftId: data.shiftId,\n                    page: Math.min(\n                      data.pagination.pageCount,\n                      data.pagination.page + 1,\n                    ),\n                  })}\n                  aria-disabled={data.pagination.page >= data.pagination.pageCount}\n                  className={cn(\n                    "inline-flex h-10 items-center justify-center rounded-xl border border-[var(--border)] bg-white px-3 text-xs font-semibold text-neutral-700 transition",\n                    data.pagination.page >= data.pagination.pageCount\n                      ? "pointer-events-none opacity-40"\n                      : "hover:border-[var(--accent)] hover:bg-[var(--accent-soft)]/20",\n                  )}\n                >\n                  Berikutnya →\n                </Link>\n              </div>\n            </div>\n          </div>\n        ) : null}\n      </section>\n`;

source = source.slice(0, listStart) + listReplacement + source.slice(containerClose);

const paginationSource = readFileSync(
  resolve("src/features/pos/transaction-history-pagination.ts"),
  "utf8",
);

assert.match(
  paginationSource,
  /export const POS_TRANSACTION_HISTORY_PAGE_SIZE = 10/,
  "Pagination module harus mendefinisikan page size 10.",
);
assert.match(source, /data-transaction-layout="compact-row-card"/);
assert.doesNotMatch(source, /<table/);
assert.doesNotMatch(source, /overflow-x-auto/);
assert.match(source, /Filter transaksi/);
assert.match(source, /Menampilkan \{firstRow\}–\{lastRow\}/);

writeFileSync(pagePath, source, "utf8");
console.log("POS transaction compact UX patch applied.");
