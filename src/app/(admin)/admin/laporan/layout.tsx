"use client";

import { cn } from "@/lib/utils";
import { ArrowLeft, BarChart3, Package, TrendingUp } from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ReactNode } from "react";

const tabs = [
  {
    name: "Ringkasan",
    href: "/admin/laporan",
    description: "Executive overview",
    icon: BarChart3,
  },
  {
    name: "Penjualan",
    href: "/admin/laporan/penjualan",
    description: "Omzet dan transaksi",
    icon: TrendingUp,
  },
  {
    name: "Pergerakan Stok",
    href: "/admin/laporan/stok",
    description: "Mutasi dan aging",
    icon: Package,
  },
];

function buildTabHref(href: string, searchParams: URLSearchParams) {
  const preservedParams = new URLSearchParams();

  for (const key of ["range", "outletId"]) {
    const value = searchParams.get(key);

    if (value) {
      preservedParams.set(key, value);
    }
  }

  const query = preservedParams.toString();

  return query ? `${href}?${query}` : href;
}

export default function LaporanLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  return (
    <div className="space-y-6">
      <header className="overflow-hidden rounded-3xl border border-neutral-200 bg-white">
        <div className="grid gap-5 border-b border-neutral-100 bg-white p-5 sm:p-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div className="min-w-0">
            <Link
              href="/admin"
              className="inline-flex items-center gap-2 text-sm font-medium text-white/60 transition hover:text-white"
            >
              <ArrowLeft className="size-4" />
              Kembali ke Dashboard
            </Link>
            <h1 className="mt-4 text-2xl font-semibold tracking-tight text-neutral-950 sm:text-3xl">
              Laporan Outlet
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-neutral-600">
              Pusat analisa performa bisnis untuk ringkasan outlet, penjualan,
              dan pergerakan stok. Detail operasional kas tetap dikelola dari
              menu Operasional Kas agar laporan tetap fokus dan read-only.
            </p>
          </div>
        </div>

        <div className="bg-white px-3 py-3 sm:px-4">
          <nav className="grid gap-2 sm:grid-cols-3" aria-label="Tabs laporan">
            {tabs.map((tab) => {
              const isActive = pathname === tab.href;
              const Icon = tab.icon;

              return (
                <Link
                  key={tab.name}
                  href={buildTabHref(tab.href, searchParams)}
                  className={cn(
                    "group flex min-w-0 items-center gap-3 rounded-2xl border px-4 py-3 text-left transition",
                    isActive
                      ? "border-neutral-900 bg-neutral-950 !text-white"
                      : "border-neutral-200 bg-neutral-50 text-neutral-700 hover:border-neutral-300 hover:bg-white hover:text-neutral-950",
                  )}
                  aria-current={isActive ? "page" : undefined}
                >
                  <span
                    className={cn(
                      "grid size-10 shrink-0 place-items-center rounded-xl border",
                      isActive
                        ? "border-white/10 bg-white/10 text-white"
                        : "border-neutral-200 bg-white text-neutral-500 group-hover:text-neutral-800",
                    )}
                  >
                    <Icon className="size-5" />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold">
                      {tab.name}
                    </span>
                    <span
                      className={cn(
                        "mt-0.5 block truncate text-xs",
                        isActive ? "text-white/60" : "text-neutral-500",
                      )}
                    >
                      {tab.description}
                    </span>
                  </span>
                </Link>
              );
            })}
          </nav>
        </div>
      </header>

      <main>{children}</main>
    </div>
  );
}
