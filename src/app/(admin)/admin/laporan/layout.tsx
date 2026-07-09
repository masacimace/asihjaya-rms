"use client";

import { cn } from "@/lib/utils";
import { BarChart3, Package, TrendingUp } from "lucide-react";
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
      <header className="overflow-hidden rounded-[2rem] border border-neutral-200 bg-white">
        <div className="border-b border-neutral-100 bg-gradient-to-br from-neutral-950 via-neutral-900 to-neutral-800 p-5 text-white sm:p-6">
          <div className="max-w-4xl">
            <p className="inline-flex rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-white/70">
              ADMIN-R11
            </p>
            <h1 className="mt-5 text-2xl font-semibold tracking-tight sm:text-3xl">
              Laporan Outlet
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-white/60">
              Pusat analisa performa bisnis untuk ringkasan outlet, penjualan,
              dan pergerakan stok. Detail operasional kas tetap dikelola dari
              menu Operasional Kas agar laporan tetap fokus dan read-only.
            </p>
          </div>
        </div>

        <div className="overflow-x-auto bg-white px-3 py-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <nav className="flex min-w-max gap-2" aria-label="Tabs laporan">
            {tabs.map((tab) => {
              const isActive = pathname === tab.href;
              const Icon = tab.icon;

              return (
                <Link
                  key={tab.name}
                  href={buildTabHref(tab.href, searchParams)}
                  className={cn(
                    "group inline-flex items-center gap-3 rounded-2xl border px-4 py-3 text-left transition",
                    isActive
                      ? "border-neutral-900 bg-neutral-950 text-white"
                      : "border-neutral-200 bg-white text-neutral-600 hover:border-neutral-300 hover:bg-neutral-50 hover:text-neutral-950",
                  )}
                  aria-current={isActive ? "page" : undefined}
                >
                  <span
                    className={cn(
                      "grid size-10 place-items-center rounded-xl",
                      isActive
                        ? "bg-white/10 text-white"
                        : "bg-neutral-100 text-neutral-500 group-hover:text-neutral-800",
                    )}
                  >
                    <Icon className="size-5" />
                  </span>
                  <span>
                    <span className="block text-sm font-semibold">
                      {tab.name}
                    </span>
                    <span
                      className={cn(
                        "mt-0.5 block text-xs",
                        isActive ? "text-white/55" : "text-neutral-500",
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
