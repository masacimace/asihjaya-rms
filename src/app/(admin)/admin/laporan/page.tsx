"use client";
import {
  ArrowUpRight,
  ArrowDownRight,
  Gem,
  TrendingUp,
  Users,
} from "lucide-react";

export default function LaporanDashboardPage() {
  // Mock data untuk grafik
  const chartData = [
    { label: "20 Jun", value: 65, text: "65Jt" },
    { label: "21 Jun", value: 45, text: "45Jt" },
    { label: "22 Jun", value: 80, text: "80Jt" },
    { label: "23 Jun", value: 50, text: "50Jt" },
    { label: "24 Jun", value: 95, text: "95Jt" },
    { label: "25 Jun", value: 70, text: "70Jt" },
    { label: "Hari Ini", value: 85, text: "85Jt", isToday: true },
  ];

  return (
    <div className="space-y-6">
      {/* Metric Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Omzet Card */}
        <div className="rounded-2xl border border-[var(--border)] bg-white p-5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-[var(--muted)]">
              Total Omzet (Hari Ini)
            </h3>
            <div className="grid size-8 place-items-center rounded-lg bg-emerald-100 text-emerald-600">
              <TrendingUp className="size-4" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight text-neutral-950">
              Rp 128.500.000
            </span>
          </div>
          <div className="mt-2 flex items-center gap-1 text-xs font-medium text-emerald-600">
            <ArrowUpRight className="size-3" />
            <span>+12.5%</span>
            <span className="text-neutral-500 font-normal ml-1">
              vs kemarin
            </span>
          </div>
        </div>

        {/* Transaksi Card */}
        <div className="rounded-2xl border border-[var(--border)] bg-white p-5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-[var(--muted)]">
              Jumlah Transaksi
            </h3>
            <div className="grid size-8 place-items-center rounded-lg bg-blue-100 text-blue-600">
              <Users className="size-4" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight text-neutral-950">
              34
            </span>
            <span className="text-sm font-medium text-neutral-500">Nota</span>
          </div>
          <div className="mt-2 flex items-center gap-1 text-xs font-medium text-red-600">
            <ArrowDownRight className="size-3" />
            <span>-2.4%</span>
            <span className="text-neutral-500 font-normal ml-1">
              vs kemarin
            </span>
          </div>
        </div>

        {/* Emas Terjual Card */}
        <div className="rounded-2xl border border-[var(--border)] bg-white p-5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-[var(--muted)]">
              Berat Emas Terjual
            </h3>
            <div className="grid size-8 place-items-center rounded-lg bg-amber-100 text-amber-600">
              <Gem className="size-4" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight text-neutral-950">
              112.50
            </span>
            <span className="text-sm font-medium text-neutral-500">Gram</span>
          </div>
          <div className="mt-2 flex items-center gap-1 text-xs font-medium text-emerald-600">
            <ArrowUpRight className="size-3" />
            <span>+5.1%</span>
            <span className="text-neutral-500 font-normal ml-1">
              vs kemarin
            </span>
          </div>
        </div>

        {/* Laba Kotor Card */}
        <div className="rounded-2xl border border-[var(--border)] bg-white p-5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-[var(--muted)]">
              Laba Kotor (Estimasi)
            </h3>
            <div className="grid size-8 place-items-center rounded-lg bg-[var(--accent-soft)] text-[var(--accent)]">
              <TrendingUp className="size-4" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight text-neutral-950">
              Rp 18.250.000
            </span>
          </div>
          <div className="mt-2 flex items-center gap-1 text-xs font-medium text-neutral-500">
            <span>Berdasarkan Harga Pokok (Cost)</span>
          </div>
        </div>
      </div>

      {/* Chart Area */}
      <div className="rounded-2xl border border-[var(--border)] bg-white p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="font-semibold text-neutral-950">
              Tren Penjualan (7 Hari Terakhir)
            </h3>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Berdasarkan total omzet penjualan secara realtime
            </p>
          </div>
        </div>

        {/* Chart Container */}
        <div className="relative mt-12 h-64 w-full">
          {/* Y-Axis Grid Lines */}
          <div className="absolute inset-0 flex flex-col justify-between">
            {[100, 75, 50, 25, 0].map((val, i) => (
              <div key={i} className="flex w-full items-center gap-4">
                <span className="w-10 text-right text-xs font-medium text-neutral-400">
                  {val === 0 ? "0" : `${val}Jt`}
                </span>
                <div className="h-px flex-1 border-t border-dashed border-neutral-200"></div>
              </div>
            ))}
          </div>

          {/* Bars */}
          <div className="absolute inset-0 ml-14 flex items-end gap-1 sm:gap-4 pb-[1px]">
            {chartData.map((item, i) => (
              <div
                key={i}
                className="group relative flex h-full flex-1 flex-col items-center justify-end"
              >
                {/* Number Label Above Bar (Only show if 7hari to avoid clutter, or show on hover for 30hari) */}
                <span className="mb-1 text-[10px] font-semibold text-neutral-500 transition-opacity opacity-100">
                  {item.text}
                </span>

                {/* The Bar */}
                <div
                  className={`w-full max-w-[40px] rounded-t-md transition-all duration-300 ${
                    item.isToday
                      ? "bg-[var(--accent)]"
                      : "bg-[var(--accent-soft)] group-hover:bg-[var(--accent)]"
                  }`}
                  style={{ height: `${item.value}%` }}
                ></div>

                {/* X-Axis Label */}
                <span className="mt-3 truncate text-[10px] font-medium text-neutral-500">
                  {item.label}
                </span>

                {/* Tooltip */}
                <div className="pointer-events-none absolute bottom-full z-10 mb-2 w-max -translate-x-1/2 left-1/2 opacity-0 transition-opacity group-hover:opacity-100">
                  <div className="rounded-lg bg-neutral-900 px-3 py-2 text-xs text-white">
                    <p className="font-semibold text-neutral-300">
                      {item.label}
                    </p>
                    <p className="mt-1 font-bold">Rp {item.value}.000.000</p>
                    <div className="absolute -bottom-1 left-1/2 h-2 w-2 -translate-x-1/2 rotate-45 bg-neutral-900"></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
