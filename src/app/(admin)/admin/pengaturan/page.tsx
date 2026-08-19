import {
  ArrowRight,
  BadgeDollarSign,
  CreditCard,
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

      {settingsGroups.map((group) => (
        <section key={group.title} className="space-y-3">
          <div>
            <h2 className="text-lg font-semibold text-neutral-950">
              {group.title}
            </h2>
            <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
              {group.description}
            </p>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            {group.items.map((item) => {
              const Icon = item.icon;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="group rounded-3xl border border-[var(--border)] bg-white p-5 transition hover:border-[var(--accent)] hover:shadow-sm sm:p-6"
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

                      <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--accent)]">
                        Kelola
                        <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
