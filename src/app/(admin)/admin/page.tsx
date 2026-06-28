import {
  AlertTriangle,
  BadgeDollarSign,
  Boxes,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  PackageCheck,
  ReceiptText,
  ScanBarcode,
  ShoppingBag,
  Store,
  TrendingUp,
  UsersRound,
  WalletCards,
} from "lucide-react";
import Link from "next/link";

const statisticCards = [
  {
    label: "Penjualan Bersih",
    value: "Rp18.750.000",
    comparison: "12,5% dari periode sebelumnya",
    icon: BadgeDollarSign,
    iconClassName: "bg-amber-50 text-amber-700",
  },
  {
    label: "Jumlah Transaksi",
    value: "6",
    comparison: "8,3% dari periode sebelumnya",
    icon: ReceiptText,
    iconClassName: "bg-violet-50 text-violet-700",
  },
  {
    label: "Item Terjual",
    value: "7",
    comparison: "15,7% dari periode sebelumnya",
    icon: ShoppingBag,
    iconClassName: "bg-blue-50 text-blue-700",
  },
  {
    label: "Rata-rata Transaksi",
    value: "Rp3.125.000",
    comparison: "5,2% dari periode sebelumnya",
    icon: WalletCards,
    iconClassName: "bg-emerald-50 text-emerald-700",
  },
] as const;

const quickActions = [
  {
    label: "Tambah Item",
    description: "Registrasi barang baru",
    href: "/admin/inventaris",
    icon: Boxes,
  },
  {
    label: "Penerimaan Barang",
    description: "Catat stok masuk",
    href: "/admin/inventaris",
    icon: PackageCheck,
  },
  {
    label: "Cetak Label",
    description: "Barcode dan QR produk",
    href: "/admin/inventaris",
    icon: ScanBarcode,
  },
  {
    label: "Lihat Laporan",
    description: "Penjualan dan stok",
    href: "/admin/laporan",
    icon: TrendingUp,
  },
] as const;

const operationalAlerts = [
  {
    title: "2 item belum memiliki label",
    description: "Item baru perlu dicetak labelnya.",
    tone: "warning",
  },
  {
    title: "Shift hari ini masih aktif",
    description: "Dibuka pukul 09.02 oleh Hanita.",
    tone: "neutral",
  },
  {
    title: "1 persetujuan menunggu",
    description: "Permintaan perubahan harga item.",
    tone: "danger",
  },
] as const;

const topProducts = [
  {
    rank: 1,
    name: "Gelang Cartier Oval",
    detail: "3 item terjual",
    revenue: "Rp11.055.000",
  },
  {
    rank: 2,
    name: "Kalung Anak 6K",
    detail: "2 item terjual",
    revenue: "Rp7.430.000",
  },
  {
    rank: 3,
    name: "Cincin Mata Berlian",
    detail: "1 item terjual",
    revenue: "Rp5.850.000",
  },
  {
    rank: 4,
    name: "Anting Poles Anak",
    detail: "1 item terjual",
    revenue: "Rp2.750.000",
  },
] as const;

const recentTransactions = [
  {
    invoice: "INV/BG/2026/000126",
    customer: "Kiki",
    total: "Rp3.685.000",
    status: "Selesai",
    statusClassName: "bg-emerald-50 text-emerald-700",
  },
  {
    invoice: "INV/BG/2026/000125",
    customer: "Siti Rahma",
    total: "Rp5.850.000",
    status: "Selesai",
    statusClassName: "bg-emerald-50 text-emerald-700",
  },
  {
    invoice: "INV/BG/2026/000124",
    customer: "Andini",
    total: "Rp2.750.000",
    status: "Menunggu",
    statusClassName: "bg-amber-50 text-amber-700",
  },
  {
    invoice: "INV/BG/2026/000123",
    customer: "Budi Santoso",
    total: "Rp6.465.000",
    status: "Selesai",
    statusClassName: "bg-emerald-50 text-emerald-700",
  },
] as const;

const recentActivities = [
  {
    title: "Transaksi baru berhasil",
    description: "INV/BG/2026/000126 · 10.24",
    value: "Rp3.685.000",
    icon: ReceiptText,
    iconClassName: "bg-emerald-50 text-emerald-700",
  },
  {
    title: "Pelanggan baru ditambahkan",
    description: "Kiki · 09.15",
    value: null,
    icon: UsersRound,
    iconClassName: "bg-blue-50 text-blue-700",
  },
  {
    title: "Item produk diperbarui",
    description: "Barcode 732779 · 08.45",
    value: null,
    icon: Boxes,
    iconClassName: "bg-amber-50 text-amber-700",
  },
  {
    title: "Perubahan harga diajukan",
    description: "Menunggu persetujuan owner",
    value: null,
    icon: ClipboardCheck,
    iconClassName: "bg-violet-50 text-violet-700",
  },
] as const;

function SalesChart() {
  return (
    <div className="mt-6">
      <div className="relative h-[250px] w-full sm:h-[280px]">
        <div className="pointer-events-none absolute left-[48%] top-0 z-10 -translate-x-1/2 rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-xs shadow-lg">
          <p className="text-[var(--muted)]">15 Juni 2026</p>
          <p className="mt-0.5 font-semibold text-neutral-950">Rp18.750.000</p>
        </div>

        <svg
          viewBox="0 0 760 260"
          preserveAspectRatio="none"
          className="h-full w-full overflow-visible"
          role="img"
          aria-label="Grafik ringkasan penjualan"
        >
          <defs>
            <linearGradient id="salesAreaGradient" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.24" />
              <stop
                offset="100%"
                stopColor="var(--accent)"
                stopOpacity="0.02"
              />
            </linearGradient>
          </defs>

          {[35, 85, 135, 185, 235].map((y) => (
            <line
              key={y}
              x1="50"
              x2="750"
              y1={y}
              y2={y}
              stroke="var(--border)"
              strokeWidth="1"
              vectorEffect="non-scaling-stroke"
            />
          ))}

          <path
            d="M50 215
               C105 180 125 165 170 150
               C225 125 250 118 290 115
               C345 108 355 70 420 67
               C470 65 485 92 540 94
               C600 96 630 100 670 105
               C710 112 725 150 750 170
               L750 235
               L50 235
               Z"
            fill="url(#salesAreaGradient)"
          />

          <path
            d="M50 215
               C105 180 125 165 170 150
               C225 125 250 118 290 115
               C345 108 355 70 420 67
               C470 65 485 92 540 94
               C600 96 630 100 670 105
               C710 112 725 150 750 170"
            fill="none"
            stroke="var(--accent)"
            strokeWidth="2.5"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />

          {[
            { x: 50, y: 215 },
            { x: 170, y: 150 },
            { x: 290, y: 115 },
            { x: 420, y: 67 },
            { x: 540, y: 94 },
            { x: 670, y: 105 },
            { x: 750, y: 170 },
          ].map(({ x, y }) => (
            <circle
              key={`${x}-${y}`}
              cx={x}
              cy={y}
              r="4"
              fill="white"
              stroke="var(--accent)"
              strokeWidth="2"
              vectorEffect="non-scaling-stroke"
            />
          ))}
        </svg>

        <div className="pointer-events-none absolute inset-y-0 left-0 flex w-10 flex-col justify-between pb-5 pt-7 text-[10px] text-[var(--muted)] sm:text-xs">
          <span>20Jt</span>
          <span>15Jt</span>
          <span>10Jt</span>
          <span>5Jt</span>
          <span>0</span>
        </div>
      </div>

      <div className="ml-10 grid grid-cols-7 text-center text-[10px] text-[var(--muted)] sm:text-xs">
        <span>12 Jun</span>
        <span>13 Jun</span>
        <span>14 Jun</span>
        <span>15 Jun</span>
        <span>16 Jun</span>
        <span>17 Jun</span>
        <span>18 Jun</span>
      </div>
    </div>
  );
}

export default function AdminDashboardPage() {
  return (
    <div className="space-y-5 lg:space-y-6">
      {/* Header dashboard */}
      <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-neutral-950 sm:text-[28px]">
            Selamat datang kembali, Admin 👋
          </h1>
          <p className="mt-1.5 text-sm text-[var(--muted)]">
            Berikut ringkasan operasional toko hari ini.
          </p>
        </div>

        <button
          type="button"
          className="flex h-11 w-fit items-center gap-3 rounded-xl border border-[var(--border)] bg-white px-4 text-sm font-medium text-neutral-700 shadow-sm transition hover:border-neutral-300 hover:bg-neutral-50"
        >
          <CalendarDays className="size-4" />
          <span>Hari ini</span>
          <ChevronDown className="size-4 text-neutral-400" />
        </button>
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_300px] 2xl:grid-cols-[minmax(0,1fr)_320px]">
        {/* Konten utama */}
        <div className="min-w-0 space-y-5">
          {/* KPI */}
          <section className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-4">
            {statisticCards.map(
              ({ label, value, comparison, icon: Icon, iconClassName }) => (
                <article
                  key={label}
                  className="rounded-2xl border border-[var(--border)] bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.02)] sm:p-5"
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`grid size-11 shrink-0 place-items-center rounded-full ${iconClassName}`}
                    >
                      <Icon className="size-5" />
                    </div>

                    <div className="min-w-0">
                      <p className="text-xs text-[var(--muted)] sm:text-sm">
                        {label}
                      </p>
                      <p className="mt-1 truncate text-xl font-semibold tracking-tight text-neutral-950">
                        {value}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center gap-1.5 text-xs">
                    <TrendingUp className="size-3.5 text-[var(--success)]" />
                    <span className="font-medium text-[var(--success)]">
                      {comparison.split(" ")[0]}
                    </span>
                    <span className="truncate text-[var(--muted)]">
                      {comparison.replace(`${comparison.split(" ")[0]} `, "")}
                    </span>
                  </div>
                </article>
              ),
            )}
          </section>

          {/* Chart */}
          <section className="rounded-2xl border border-[var(--border)] bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.02)] sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-semibold text-neutral-950">
                  Ringkasan Penjualan
                </h2>
                <p className="mt-1 text-xs text-[var(--muted)]">
                  Penjualan bersih selama tujuh hari terakhir.
                </p>
              </div>

              <button
                type="button"
                className="flex h-9 items-center gap-2 rounded-lg border border-[var(--border)] px-3 text-xs font-medium text-neutral-700 transition hover:bg-neutral-50"
              >
                Harian
                <ChevronDown className="size-3.5 text-neutral-400" />
              </button>
            </div>

            <SalesChart />
          </section>

          {/* Bagian bawah */}
          <section className="grid gap-5 2xl:grid-cols-[0.9fr_1.25fr]">
            {/* Produk terlaris */}
            <article className="rounded-2xl border border-[var(--border)] bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.02)] sm:p-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="font-semibold text-neutral-950">
                    Produk Terlaris
                  </h2>
                  <p className="mt-1 text-xs text-[var(--muted)]">
                    Berdasarkan 30 hari terakhir.
                  </p>
                </div>

                <Link
                  href="/admin/laporan"
                  className="text-xs font-medium text-[var(--accent)] hover:underline"
                >
                  Lihat semua
                </Link>
              </div>

              <div className="mt-5 space-y-4">
                {topProducts.map((product) => (
                  <div key={product.rank} className="flex items-center gap-3">
                    <div className="grid size-7 shrink-0 place-items-center rounded-full bg-[var(--accent-soft)] text-xs font-semibold text-[var(--accent)]">
                      {product.rank}
                    </div>

                    <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-[var(--surface-muted)] text-[var(--accent)]">
                      <ShoppingBag className="size-4" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-neutral-900">
                        {product.name}
                      </p>
                      <p className="mt-0.5 text-xs text-[var(--muted)]">
                        {product.detail}
                      </p>
                    </div>

                    <p className="shrink-0 text-xs font-medium text-neutral-700">
                      {product.revenue}
                    </p>
                  </div>
                ))}
              </div>
            </article>

            {/* Transaksi terbaru */}
            <article className="overflow-hidden rounded-2xl border border-[var(--border)] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
              <div className="flex items-center justify-between gap-4 p-4 sm:p-5">
                <div>
                  <h2 className="font-semibold text-neutral-950">
                    Transaksi Terbaru
                  </h2>
                  <p className="mt-1 text-xs text-[var(--muted)]">
                    Aktivitas transaksi outlet terbaru.
                  </p>
                </div>

                <Link
                  href="/admin/penjualan"
                  className="text-xs font-medium text-[var(--accent)] hover:underline"
                >
                  Lihat semua
                </Link>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[620px] text-left">
                  <thead>
                    <tr className="border-y border-[var(--border)] bg-[var(--surface-muted)] text-xs text-[var(--muted)]">
                      <th className="px-5 py-3 font-medium">Invoice</th>
                      <th className="px-4 py-3 font-medium">Pelanggan</th>
                      <th className="px-4 py-3 font-medium">Total</th>
                      <th className="px-5 py-3 font-medium">Status</th>
                    </tr>
                  </thead>

                  <tbody>
                    {recentTransactions.map((transaction) => (
                      <tr
                        key={transaction.invoice}
                        className="border-b border-[var(--border)] last:border-b-0"
                      >
                        <td className="px-5 py-3.5 text-xs font-medium text-neutral-900">
                          {transaction.invoice}
                        </td>
                        <td className="px-4 py-3.5 text-xs text-neutral-700">
                          {transaction.customer}
                        </td>
                        <td className="px-4 py-3.5 text-xs font-medium text-neutral-900">
                          {transaction.total}
                        </td>
                        <td className="px-5 py-3.5">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-medium ${transaction.statusClassName}`}
                          >
                            {transaction.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </article>
          </section>
        </div>

        {/* Panel kanan */}
        <aside className="space-y-5">
          {/* Quick action */}
          <section className="rounded-2xl border border-[var(--border)] bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
            <h2 className="font-semibold text-neutral-950">Aksi Cepat</h2>

            <div className="mt-4 grid grid-cols-2 gap-2.5">
              {quickActions.map(({ label, description, href, icon: Icon }) => (
                <Link
                  key={label}
                  href={href}
                  className="group flex min-h-28 flex-col items-center justify-center rounded-xl border border-[var(--border)] p-3 text-center transition hover:border-[var(--accent)] hover:bg-[var(--accent-soft)]"
                >
                  <Icon className="size-5 text-[var(--accent)] transition-transform group-hover:scale-105" />

                  <p className="mt-2 text-xs font-semibold text-neutral-900">
                    {label}
                  </p>

                  <p className="mt-1 line-clamp-2 text-[10px] leading-4 text-[var(--muted)]">
                    {description}
                  </p>
                </Link>
              ))}
            </div>
          </section>

          {/* Perlu perhatian */}
          <section className="rounded-2xl border border-[var(--border)] bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-semibold text-neutral-950">
                Perlu Perhatian
              </h2>

              <Link
                href="/admin/operasional"
                className="text-xs font-medium text-[var(--accent)] hover:underline"
              >
                Lihat semua
              </Link>
            </div>

            <div className="mt-4 divide-y divide-[var(--border)]">
              {operationalAlerts.map((alert) => (
                <Link
                  key={alert.title}
                  href="/admin/operasional"
                  className="group flex items-start gap-3 py-3 first:pt-0 last:pb-0"
                >
                  <div
                    className={`mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl ${
                      alert.tone === "warning"
                        ? "bg-amber-50 text-amber-700"
                        : alert.tone === "danger"
                          ? "bg-red-50 text-red-600"
                          : "bg-neutral-100 text-neutral-600"
                    }`}
                  >
                    {alert.tone === "neutral" ? (
                      <Store className="size-4" />
                    ) : (
                      <AlertTriangle className="size-4" />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium leading-5 text-neutral-900">
                      {alert.title}
                    </p>
                    <p className="mt-0.5 text-[11px] leading-4 text-[var(--muted)]">
                      {alert.description}
                    </p>
                  </div>

                  <ChevronRight className="mt-2 size-4 shrink-0 text-neutral-300 transition-transform group-hover:translate-x-0.5 group-hover:text-[var(--accent)]" />
                </Link>
              ))}
            </div>
          </section>

          {/* Aktivitas terbaru */}
          <section className="rounded-2xl border border-[var(--border)] bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-semibold text-neutral-950">
                Aktivitas Terbaru
              </h2>
            </div>

            <div className="mt-4 space-y-4">
              {recentActivities.map(
                ({ title, description, value, icon: Icon, iconClassName }) => (
                  <div key={title} className="flex items-start gap-3">
                    <div
                      className={`grid size-9 shrink-0 place-items-center rounded-xl ${iconClassName}`}
                    >
                      <Icon className="size-4" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium leading-5 text-neutral-900">
                        {title}
                      </p>
                      <p className="truncate text-[11px] text-[var(--muted)]">
                        {description}
                      </p>
                    </div>

                    {value ? (
                      <p className="shrink-0 text-[11px] font-semibold text-[var(--success)]">
                        {value}
                      </p>
                    ) : null}
                  </div>
                ),
              )}
            </div>

            <Link
              href="/admin/administrasi"
              className="mt-5 flex items-center justify-center gap-2 border-t border-[var(--border)] pt-4 text-xs font-medium text-[var(--accent)] hover:underline"
            >
              Lihat seluruh aktivitas
              <ChevronRight className="size-3.5" />
            </Link>
          </section>
        </aside>
      </div>
    </div>
  );
}
