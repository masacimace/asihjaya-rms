import {
  ArrowDownRight,
  ArrowUpRight,
  CalendarDays,
  Filter,
  Receipt,
  Search,
} from "lucide-react";
import Link from "next/link";
import { ExportExcelButton } from "@/components/penjualan/export-excel-button";

export const runtime = "nodejs";

const MOCK_TRANSACTIONS = [
  {
    id: "trx-001",
    receiptNo: "ORD/06/2026/440",
    date: "2026-06-25T14:30:00Z",
    type: "purchase",
    customerName: "Kiki",
    staffName: "Hanita",
    totalItems: 1,
    totalValue: 3685000,
  },
  {
    id: "trx-002",
    receiptNo: "ORD/06/2026/441",
    date: "2026-06-25T14:45:00Z",
    type: "buyback",
    customerName: "Ibu Siti",
    staffName: "Hanita",
    totalItems: 2,
    totalValue: -2150000,
  },
  {
    id: "trx-003",
    receiptNo: "ORD/06/2026/442",
    date: "2026-06-25T15:10:00Z",
    type: "purchase",
    customerName: "Agus Santoso",
    staffName: "Rini",
    totalItems: 3,
    totalValue: 12400000,
  },
  {
    id: "trx-004",
    receiptNo: "ORD/06/2026/443",
    date: "2026-06-25T15:50:00Z",
    type: "purchase",
    customerName: "NN (Umum)",
    staffName: "Danang",
    totalItems: 1,
    totalValue: 850000,
  },
  {
    id: "trx-005",
    receiptNo: "ORD/06/2026/444",
    date: "2026-06-25T16:05:00Z",
    type: "buyback",
    customerName: "Nita Larasati",
    staffName: "Hanita",
    totalItems: 1,
    totalValue: -8900000,
  },
];

function formatMoney(value: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Math.abs(value));
}

function formatDate(isoString: string) {
  const date = new Date(isoString);
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export default function PenjualanListPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-1 text-sm font-medium text-[var(--accent)]">
            Kas & Transaksi
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-neutral-950 sm:text-3xl">
            Riwayat Penjualan
          </h1>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
            Pantau seluruh nota transaksi harian, lacak penjualan, dan buyback.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-white px-4 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50">
            <CalendarDays className="size-4 text-neutral-500" />
            Hari Ini (25 Juni 2026)
          </button>
        </div>
      </header>

      {/* Analytics Dashboard */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <article className="rounded-2xl border border-[var(--border)] bg-white p-5">
          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm font-medium text-neutral-500">
              Total Uang Masuk (Kotor)
            </p>
            <div className="rounded-lg bg-emerald-50 p-2 text-emerald-600">
              <ArrowUpRight className="size-5" />
            </div>
          </div>
          <p className="text-3xl font-bold text-neutral-950">Rp 16.935.000</p>
          <p className="mt-2 text-xs font-medium text-emerald-600">
            Dari 3 Transaksi Penjualan
          </p>
        </article>

        <article className="rounded-2xl border border-[var(--border)] bg-white p-5">
          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm font-medium text-neutral-500">
              Total Uang Keluar (Buyback)
            </p>
            <div className="rounded-lg bg-red-50 p-2 text-red-600">
              <ArrowDownRight className="size-5" />
            </div>
          </div>
          <p className="text-3xl font-bold text-neutral-950">Rp 11.050.000</p>
          <p className="mt-2 text-xs font-medium text-red-600">
            Dari 2 Transaksi Pembelian/Buyback
          </p>
        </article>

        <article className="rounded-2xl border border-[var(--border)] bg-[var(--accent)] p-5 text-white">
          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm font-medium text-white/80">
              Total Saldo Bersih
            </p>
            <div className="rounded-lg bg-white/20 p-2 text-white">
              <Receipt className="size-5" />
            </div>
          </div>
          <p className="text-3xl font-bold text-white">Rp 5.885.000</p>
          <p className="mt-2 text-xs font-medium text-white/80">
            Total Masuk dikurangi Total Keluar
          </p>
        </article>
      </section>

      {/* Filter Bar */}
      <section className="flex flex-col gap-3 rounded-2xl border border-[var(--border)] bg-white p-4 sm:flex-row sm:items-center">
        <label className="flex h-10 flex-1 items-center gap-3 rounded-xl border border-[var(--border)] px-3 focus-within:border-[var(--accent)] focus-within:ring-1 focus-within:ring-[var(--accent)]">
          <Search className="size-4 shrink-0 text-neutral-400" />
          <input
            name="q"
            type="search"
            placeholder="Cari No. Nota, Pelanggan, atau Kasir..."
            className="min-w-0 flex-1 bg-transparent text-sm text-neutral-950 outline-none placeholder:text-neutral-400"
          />
        </label>
        <div className="flex shrink-0 items-center gap-2">
          <button className="inline-flex h-10 items-center gap-2 rounded-xl border border-[var(--border)] px-4 text-sm font-medium text-neutral-700 hover:bg-neutral-50">
            <Filter className="size-4" />
            Filter Jenis
          </button>
          <ExportExcelButton data={MOCK_TRANSACTIONS} />
        </div>
      </section>

      {/* Transaction List */}
      <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-neutral-600">
            <thead className="border-b border-[var(--border)] bg-neutral-50/50 text-xs text-neutral-500">
              <tr>
                <th className="whitespace-nowrap px-5 py-4 font-medium">
                  Waktu & Kasir
                </th>
                <th className="whitespace-nowrap px-5 py-4 font-medium">
                  Nomor Nota
                </th>
                <th className="whitespace-nowrap px-5 py-4 font-medium">
                  Jenis
                </th>
                <th className="whitespace-nowrap px-5 py-4 font-medium">
                  Pelanggan
                </th>
                <th className="whitespace-nowrap px-5 py-4 font-medium text-right">
                  Total Nilai
                </th>
                <th className="px-5 py-4"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {MOCK_TRANSACTIONS.map((trx) => (
                <tr
                  key={trx.id}
                  className="transition-colors hover:bg-neutral-50/50"
                >
                  <td className="whitespace-nowrap px-5 py-4">
                    <p className="font-medium text-neutral-950">
                      {formatDate(trx.date)}
                    </p>
                    <p className="mt-0.5 flex items-center gap-1.5 text-xs text-neutral-500">
                      Kasir:{" "}
                      <span className="rounded bg-neutral-100 px-1.5 py-0.5 font-medium text-neutral-700">
                        {trx.staffName}
                      </span>
                    </p>
                  </td>
                  <td className="whitespace-nowrap px-5 py-4">
                    <span className="font-mono text-sm text-neutral-950">
                      {trx.receiptNo}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    {trx.type === "purchase" ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                        <ArrowUpRight className="size-3" />
                        Penjualan
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700">
                        <ArrowDownRight className="size-3" />
                        Buyback
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-4">
                    <p className="font-medium text-neutral-950">
                      {trx.customerName}
                    </p>
                    <p className="text-xs text-neutral-500">
                      {trx.totalItems} barang
                    </p>
                  </td>
                  <td className="whitespace-nowrap px-5 py-4 text-right">
                    <p
                      className={`font-semibold ${
                        trx.type === "buyback"
                          ? "text-red-600"
                          : "text-emerald-600"
                      }`}
                    >
                      {trx.type === "buyback" ? "-" : "+"}
                      {formatMoney(trx.totalValue)}
                    </p>
                  </td>
                  <td className="px-5 py-4 text-right">
                    <Link
                      href={`/admin/penjualan/${trx.id}`}
                      className="inline-flex h-8 items-center justify-center rounded-lg border border-[var(--border)] px-3 text-xs font-medium text-neutral-700 transition hover:bg-neutral-100"
                    >
                      Lihat Nota
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
