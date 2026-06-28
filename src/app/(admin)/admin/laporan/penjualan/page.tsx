export const runtime = "nodejs";

import { Search, Filter, Download } from "lucide-react";

const MOCK_SALES = [
  {
    id: "INV-20260626-001",
    time: "10:15",
    customer: "Ibu Ratna",
    item: "Cincin Emas Kuning 70%",
    weight: "3.50",
    method: "BCA Transfer",
    total: 3500000,
  },
  {
    id: "INV-20260626-002",
    time: "11:30",
    customer: "Bpk. Budi",
    item: "Kalung Emas Putih 75%",
    weight: "12.00",
    method: "Cash",
    total: 13200000,
  },
  {
    id: "INV-20260626-003",
    time: "13:45",
    customer: "Mba Siti",
    item: "Gelang Rantai 70%",
    weight: "5.25",
    method: "Mandiri EDC",
    total: 5150000,
  },
  {
    id: "INV-20260626-004",
    time: "15:20",
    customer: "Ibu Siska",
    item: "Anting Tindik 75%",
    weight: "1.50",
    method: "Cash",
    total: 1650000,
  },
];

export default function LaporanPenjualanPage() {
  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-2xl border border-[var(--border)] bg-white p-4">
        <div className="flex flex-1 items-center gap-3">
          <div className="relative flex-1 sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
            <input
              type="text"
              placeholder="Cari No. Invoice atau Pelanggan..."
              className="w-full rounded-xl border border-neutral-200 bg-neutral-50 py-2 pl-9 pr-4 text-sm outline-none focus:border-[var(--accent)] focus:bg-white focus:ring-1 focus:ring-[var(--accent)]"
            />
          </div>
          <button className="inline-flex h-9 items-center gap-2 rounded-xl border border-neutral-200 px-4 text-sm font-medium text-neutral-700 hover:bg-neutral-50">
            <Filter className="size-4" />
            Filter (Hari Ini)
          </button>
        </div>
        <button className="inline-flex h-9 items-center gap-2 rounded-xl bg-[var(--accent)] px-4 text-sm font-semibold text-white hover:bg-[var(--accent-hover)]">
          <Download className="size-4" />
          Export CSV
        </button>
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-[var(--border)] bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-neutral-600">
            <thead className="border-b border-[var(--border)] bg-neutral-50/50 text-xs uppercase text-neutral-500">
              <tr>
                <th className="px-6 py-4 font-medium">No. Invoice</th>
                <th className="px-6 py-4 font-medium">Waktu</th>
                <th className="px-6 py-4 font-medium">Pelanggan</th>
                <th className="px-6 py-4 font-medium">Barang Terjual</th>
                <th className="px-6 py-4 font-medium text-right">Berat (Gr)</th>
                <th className="px-6 py-4 font-medium">Pembayaran</th>
                <th className="px-6 py-4 font-medium text-right">Total (Rp)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)] bg-white">
              {MOCK_SALES.map((sale) => (
                <tr
                  key={sale.id}
                  className="hover:bg-neutral-50/50 transition-colors"
                >
                  <td className="whitespace-nowrap px-6 py-4 font-medium text-neutral-900">
                    {sale.id}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4">{sale.time}</td>
                  <td className="whitespace-nowrap px-6 py-4">
                    {sale.customer}
                  </td>
                  <td className="px-6 py-4">{sale.item}</td>
                  <td className="whitespace-nowrap px-6 py-4 text-right font-medium text-amber-600">
                    {sale.weight}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        sale.method === "Cash"
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-blue-100 text-blue-800"
                      }`}
                    >
                      {sale.method}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-right font-bold text-neutral-900">
                    {new Intl.NumberFormat("id-ID").format(sale.total)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t-2 border-[var(--border)] bg-neutral-50/50 font-bold text-neutral-900">
              <tr>
                <td colSpan={4} className="px-6 py-4 text-right">
                  Total Hari Ini:
                </td>
                <td className="px-6 py-4 text-right text-amber-600">22.25</td>
                <td></td>
                <td className="px-6 py-4 text-right text-lg">23.500.000</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}
