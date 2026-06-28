export const runtime = "nodejs";

import { LogOut, ArrowRightLeft, Banknote, CreditCard, ReceiptText } from "lucide-react";

export default function LaporanKasPage() {
  return (
    <div className="space-y-6">
      {/* Metric */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-[var(--border)] bg-white p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-[var(--muted)]">
              Total Uang Fisik (Laci)
            </p>
            <div className="grid size-8 place-items-center rounded-lg bg-emerald-100 text-emerald-600">
              <Banknote className="size-4" />
            </div>
          </div>
          <p className="mt-4 text-3xl font-bold text-neutral-950">
            Rp 45.300.000
          </p>
        </div>
        <div className="rounded-2xl border border-[var(--border)] bg-white p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-[var(--muted)]">
              Total Transfer (Bank)
            </p>
            <div className="grid size-8 place-items-center rounded-lg bg-blue-100 text-blue-600">
              <CreditCard className="size-4" />
            </div>
          </div>
          <p className="mt-4 text-3xl font-bold text-neutral-950">
            Rp 83.200.000
          </p>
        </div>
        <div className="rounded-2xl border border-[var(--border)] bg-white p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-[var(--muted)]">
              Total Pengeluaran Kas (Petty Cash)
            </p>
            <div className="grid size-8 place-items-center rounded-lg bg-red-100 text-red-600">
              <ReceiptText className="size-4" />
            </div>
          </div>
          <p className="mt-4 text-3xl font-bold text-red-600">- Rp 350.000</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Riwayat Tutup Shift */}
        <div className="rounded-2xl border border-[var(--border)] bg-white p-5">
          <div className="mb-4 flex items-center gap-2 border-b border-[var(--border)] pb-4">
            <LogOut className="size-5 text-neutral-500" />
            <h3 className="font-semibold text-neutral-900">
              Riwayat Tutup Shift
            </h3>
          </div>
          <div className="space-y-4">
            {[
              {
                date: "25 Jun, 21:00",
                user: "Rini (Kasir)",
                diff: "+ Rp 0",
                diffColor: "text-neutral-500",
                status: "Sesuai",
              },
              {
                date: "24 Jun, 21:05",
                user: "Hanita (Kasir)",
                diff: "- Rp 5.000",
                diffColor: "text-red-600",
                status: "Kurang",
              },
              {
                date: "23 Jun, 21:00",
                user: "Rini (Kasir)",
                diff: "+ Rp 2.000",
                diffColor: "text-emerald-600",
                status: "Lebih",
              },
            ].map((shift, i) => (
              <div
                key={i}
                className="flex items-center justify-between rounded-xl border border-neutral-100 bg-neutral-50/50 p-3"
              >
                <div>
                  <p className="text-sm font-medium text-neutral-900">
                    {shift.user}
                  </p>
                  <p className="text-xs text-neutral-500">{shift.date}</p>
                </div>
                <div className="text-right">
                  <p className={`text-sm font-bold ${shift.diffColor}`}>
                    {shift.diff}
                  </p>
                  <p className="text-xs text-neutral-500">{shift.status}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Pengeluaran Outlet */}
        <div className="rounded-2xl border border-[var(--border)] bg-white p-5">
          <div className="mb-4 flex items-center gap-2 border-b border-[var(--border)] pb-4">
            <ArrowRightLeft className="size-5 text-neutral-500" />
            <h3 className="font-semibold text-neutral-900">
              Pengeluaran Kas Outlet (Hari Ini)
            </h3>
          </div>
          <div className="space-y-4">
            {[
              {
                time: "09:30",
                note: "Beli Sapu & Pel",
                amount: 85000,
                type: "Operasional",
              },
              {
                time: "12:15",
                note: "Galon Aqua (2x)",
                amount: 40000,
                type: "Konsumsi",
              },
              {
                time: "16:45",
                note: "Beli Tinta Printer",
                amount: 225000,
                type: "ATK",
              },
            ].map((expense, i) => (
              <div
                key={i}
                className="flex items-center justify-between border-b border-neutral-100 pb-3 last:border-0 last:pb-0"
              >
                <div>
                  <p className="text-sm font-medium text-neutral-900">
                    {expense.note}
                  </p>
                  <div className="mt-1 flex items-center gap-2 text-xs">
                    <span className="text-neutral-500">{expense.time}</span>
                    <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-neutral-600">
                      {expense.type}
                    </span>
                  </div>
                </div>
                <div className="text-right text-sm font-bold text-red-600">
                  - {new Intl.NumberFormat("id-ID").format(expense.amount)}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 border-t border-[var(--border)] pt-4 text-right">
            <button className="text-sm font-semibold text-[var(--accent)] hover:underline">
              Lihat Seluruh Riwayat Kas &rarr;
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
