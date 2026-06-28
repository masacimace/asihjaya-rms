"use client";

import { cn } from "@/lib/utils";
import { BarChart3, TrendingUp, Package, Wallet } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode } from "react";

const tabs = [
  {
    name: "Ringkasan",
    href: "/admin/laporan",
    icon: BarChart3,
  },
  {
    name: "Penjualan",
    href: "/admin/laporan/penjualan",
    icon: TrendingUp,
  },
  {
    name: "Pergerakan Stok",
    href: "/admin/laporan/stok",
    icon: Package,
  },
  {
    name: "Arus Kas",
    href: "/admin/laporan/kas",
    icon: Wallet,
  },
];

export default function LaporanLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-neutral-950 sm:text-3xl">
            Laporan Outlet
          </h1>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
            Pantau performa penjualan, stok, dan arus kas harian secara real-time.
          </p>
        </div>
      </header>

      {/* Tabs Navigation */}
      <div className="border-b border-[var(--border)] overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        <nav className="-mb-px flex space-x-6" aria-label="Tabs">
          {tabs.map((tab) => {
            const isActive = pathname === tab.href;
            return (
              <Link
                key={tab.name}
                href={tab.href}
                className={cn(
                  "group inline-flex items-center gap-2 border-b-2 py-4 px-1 text-sm font-medium transition-colors whitespace-nowrap",
                  isActive
                    ? "border-[var(--accent)] text-[var(--accent)]"
                    : "border-transparent text-neutral-500 hover:border-neutral-300 hover:text-neutral-700",
                )}
                aria-current={isActive ? "page" : undefined}
              >
                <tab.icon
                  className={cn(
                    "size-5",
                    isActive
                      ? "text-[var(--accent)]"
                      : "text-neutral-400 group-hover:text-neutral-500",
                  )}
                  aria-hidden="true"
                />
                {tab.name}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Content Area */}
      <main>{children}</main>
    </div>
  );
}
