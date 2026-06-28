import {
  ArrowDownRight,
  ArrowLeft,
  ArrowUpRight,
  Plus,
} from "lucide-react";
import Link from "next/link";

export const runtime = "nodejs";

const MOCK_CASH_MOVEMENTS = [
  {
    id: "cm-001",
    date: "2026-06-25T10:30:00Z",
    type: "cash_out",
    amount: 50000,
    reason: "Beli galon air minum",
    createdBy: "Hanita",
  },
  {
    id: "cm-002",
    date: "2026-06-25T11:15:00Z",
    type: "cash_in",
    amount: 10000000,
    reason: "Suntikan dana dari brankas untuk modal buyback",
    createdBy: "Pemilik",
  },
  {
    id: "cm-003",
    date: "2026-06-25T13:45:00Z",
    type: "cash_out",
    amount: 150000,
    reason: "Bayar uang keamanan & kebersihan pasar",
    createdBy: "Hanita",
  },
];

function formatMoney(value: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(isoString: string) {
  const date = new Date(isoString);
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export default function KasPage() {
  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-2">
            <Link
              href="/admin"
              className="inline-flex items-center gap-2 text-sm font-medium text-neutral-500 hover:text-[var(--accent)]"
            >
              <ArrowLeft className="size-4" />
              Kembali
            </Link>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-neutral-950 sm:text-3xl">
            Pergerakan Kas (Petty Cash)
          </h1>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
            Catat semua uang fisik yang masuk atau keluar laci di luar transaksi perhiasan.
          </p>
        </div>
        <button className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-4 text-sm font-medium text-white transition hover:bg-[#8c5f1d]">
          <Plus className="size-4" />
          Catat Kas Baru
        </button>
      </header>

      {/* Stats Cards */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <article className="rounded-2xl border border-[var(--border)] bg-white p-5">
          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm font-medium text-neutral-500">
              Total Kas Keluar Hari Ini
            </p>
            <div className="rounded-lg bg-red-50 p-2 text-red-600">
              <ArrowDownRight className="size-5" />
            </div>
          </div>
          <p className="text-3xl font-bold text-neutral-950">Rp 200.000</p>
          <p className="mt-2 text-xs font-medium text-red-600">
            Dari 2 Transaksi
          </p>
        </article>

        <article className="rounded-2xl border border-[var(--border)] bg-white p-5">
          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm font-medium text-neutral-500">
              Total Kas Masuk (Setoran)
            </p>
            <div className="rounded-lg bg-emerald-50 p-2 text-emerald-600">
              <ArrowUpRight className="size-5" />
            </div>
          </div>
          <p className="text-3xl font-bold text-neutral-950">Rp 10.000.000</p>
          <p className="mt-2 text-xs font-medium text-emerald-600">
            Dari 1 Transaksi
          </p>
        </article>
      </section>

      {/* Movement List */}
      <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-white">
        <div className="border-b border-[var(--border)] px-5 py-4">
          <h3 className="font-semibold text-neutral-950">Buku Kas Harian</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-neutral-600">
            <thead className="bg-neutral-50/50 text-xs text-neutral-500">
              <tr>
                <th className="px-5 py-4 font-medium">Waktu</th>
                <th className="px-5 py-4 font-medium">Tipe</th>
                <th className="px-5 py-4 font-medium">Dicatat Oleh</th>
                <th className="px-5 py-4 font-medium">Keterangan</th>
                <th className="px-5 py-4 font-medium text-right">Nominal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {MOCK_CASH_MOVEMENTS.map((mov) => (
                <tr key={mov.id} className="transition-colors hover:bg-neutral-50/50">
                  <td className="px-5 py-4 whitespace-nowrap">{formatDate(mov.date)}</td>
                  <td className="px-5 py-4">
                    {mov.type === "cash_in" ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                        <ArrowUpRight className="size-3" />
                        Kas Masuk
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700">
                        <ArrowDownRight className="size-3" />
                        Kas Keluar
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-4 font-medium text-neutral-900">{mov.createdBy}</td>
                  <td className="px-5 py-4">{mov.reason}</td>
                  <td className="px-5 py-4 text-right font-medium text-neutral-900">
                    <span className={mov.type === "cash_out" ? "text-red-600" : "text-emerald-600"}>
                      {mov.type === "cash_out" ? "-" : "+"}
                      {formatMoney(mov.amount)}
                    </span>
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
