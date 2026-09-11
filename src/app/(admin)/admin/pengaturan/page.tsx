import {
  ArrowRight,
  BadgeDollarSign,
  CreditCard,
  Palette,
  Send,
  Settings2,
  SlidersHorizontal,
} from "lucide-react";
import Link from "next/link";

import { requirePermission } from "@/lib/auth/session";

export const metadata = {
  title: "Pengaturan",
};

const settingsGroups = [
  {
    title: "Pembayaran",
    description:
      "Konfigurasi metode pembayaran dan perangkat pembayaran manual yang digunakan outlet.",
    items: [
      {
        title: "Metode & Akun Pembayaran",
        description:
          "Kelola terminal EDC dan rekening transfer yang tersedia di POS.",
        href: "/admin/pengaturan/pembayaran/manual-edc",
        icon: CreditCard,
        badge: "Pembayaran",
      },
    ],
  },
  {
    title: "Master Produk",
    description:
      "Kelola pilihan master yang digunakan ulang pada form produk dan Buyback.",
    items: [
      {
        title: "Varian Warna Produk",
        description:
          "Kelola preset warna aktif agar input warna konsisten pada produk, Buyback, dan pemrosesan.",
        href: "/admin/pengaturan/warna-produk",
        icon: Palette,
        badge: "Preset Warna",
      },
    ],
  },
  {
    title: "Harga Jewelry",
    description:
      "Kelola Harga/Gram aktif yang menjadi sumber harga jual berdasarkan Kadar Persen.",
    items: [
      {
        title: "Harga / Gram Aktif",
        description:
          "Satu rate berlaku untuk seluruh item dengan Kadar Persen yang sama dan histori harga tetap tersimpan.",
        href: "/admin/pengaturan/harga-gram",
        icon: BadgeDollarSign,
        badge: "Dynamic Pricing",
      },
    ],
  },
  {
    title: "Integrasi",
    description:
      "Kelola koneksi sistem eksternal tanpa menambah menu baru pada navigation utama.",
    items: [
      {
        title: "Telegram Reporting",
        description:
          "Atur private group outlet, report opening/daily/weekly/monthly, test message, delivery history, dan manual retry.",
        href: "/admin/pengaturan/integrasi/telegram",
        icon: Send,
        badge: "Outbound-only",
      },
    ],
  },
] as const;

export default async function SettingsHubPage() {
  await requirePermission("settings.manage");

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-[var(--border)] bg-white p-6 lg:p-7">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-[var(--accent-soft)] px-3 py-1 text-xs font-semibold text-[var(--accent)]">
              <Settings2 className="size-3.5" />
              Settings Hub
            </div>
            <h1 className="mt-4 text-2xl font-semibold text-neutral-950 sm:text-3xl">
              Pengaturan
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--muted)]">
              Satu tempat untuk konfigurasi sistem ASIHJAYA RMS. Pengaturan yang
              kompleks tetap memiliki halaman khusus agar halaman ini tetap
              ringkas dan navigation sidebar tidak terus bertambah panjang.
            </p>
          </div>

          <div className="rounded-2xl border border-[var(--border)] bg-neutral-50 p-4 text-sm text-neutral-700">
            <p className="flex items-center gap-2 font-semibold text-neutral-950">
              <SlidersHorizontal className="size-4 text-[var(--accent)]" />
              Permission: settings.manage
            </p>
            <p className="mt-1 max-w-sm text-xs leading-5 text-[var(--muted)]">
              Hanya user dengan akses pengaturan yang dapat membuka dan
              mengubah konfigurasi di bawah ini.
            </p>
          </div>
        </div>
      </section>

      <div className="grid items-start gap-5 lg:grid-cols-2 2xl:grid-cols-3">
        {settingsGroups.map((group) => (
          <section
            key={group.title}
            className="flex h-full min-w-0 flex-col rounded-3xl border border-[var(--border)] bg-neutral-50/60 p-4 sm:p-5"
          >
            <div className="min-h-[88px]">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="text-lg font-semibold text-neutral-950">
                    {group.title}
                  </h2>
                  <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
                    {group.description}
                  </p>
                </div>

                <span className="shrink-0 rounded-full border border-[var(--border)] bg-white px-2.5 py-1 text-[11px] font-semibold text-neutral-500">
                  {group.items.length} menu
                </span>
              </div>
            </div>

            <div className="mt-4 grid flex-1 gap-3">
              {group.items.map((item) => {
                const Icon = item.icon;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="group flex min-h-[178px] flex-col rounded-2xl border border-[var(--border)] bg-white p-5 transition duration-200 hover:-translate-y-0.5 hover:border-[var(--accent)] hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2"
                  >
                    <div className="flex items-start gap-4">
                      <div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent)]">
                        <Icon className="size-5" />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-semibold text-neutral-950">
                            {item.title}
                          </h3>
                          <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-[11px] font-semibold text-neutral-600">
                            {item.badge}
                          </span>
                        </div>
                        <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                          {item.description}
                        </p>
                      </div>
                    </div>

                    <div className="mt-auto flex items-center justify-between gap-3 pt-5">
                      <span className="text-sm font-semibold text-[var(--accent)]">
                        Kelola
                      </span>
                      <span className="grid size-8 place-items-center rounded-full bg-[var(--accent-soft)] text-[var(--accent)] transition-transform group-hover:translate-x-0.5">
                        <ArrowRight className="size-4" />
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
