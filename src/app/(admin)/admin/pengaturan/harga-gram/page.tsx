import { ArrowLeft, BadgeDollarSign, Scale } from "lucide-react";
import Link from "next/link";

import { MetalPriceRateForm } from "@/components/pricing/metal-price-rate-form";
import { getMetalPriceRateSettingsData } from "@/features/pricing/metal-price-rates";
import { requirePermission } from "@/lib/auth/session";

export const metadata = {
  title: "Harga / Gram Aktif",
};

export const runtime = "nodejs";

export default async function MetalPriceSettingsPage() {
  const auth = await requirePermission("pricing.manage");
  const rows = await getMetalPriceRateSettingsData(auth.organization.id);

  return (
    <div className="mx-auto w-full max-w-6xl space-y-5 pb-6">
      <section className="rounded-3xl border border-[var(--border)] bg-white p-5 sm:p-6">
        <Link href="/admin/pengaturan" className="inline-flex items-center gap-2 text-sm font-medium text-[var(--muted)] transition hover:text-neutral-950">
          <ArrowLeft className="size-4" />
          Kembali ke Pengaturan
        </Link>

        <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-[var(--accent-soft)] px-3 py-1 text-xs font-semibold text-[var(--accent)]">
              <BadgeDollarSign className="size-3.5" />
              Dynamic Pricing
            </div>
            <h1 className="mt-3 text-2xl font-semibold text-neutral-950 sm:text-3xl">Harga / Gram Aktif</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--muted)]">
              Harga jual jewelry akan menggunakan Kadar Persen sebagai kunci harga. Admin cukup mengubah satu rate dan seluruh item dengan kadar yang sama akan mengikuti harga aktif tersebut.
            </p>
          </div>

          <div className="flex items-start gap-3 rounded-2xl border border-[var(--border)] bg-neutral-50 p-4 text-sm text-neutral-700">
            <Scale className="mt-0.5 size-4 shrink-0 text-[var(--accent)]" />
            <div>
              <p className="font-semibold text-neutral-950">Formula dasar</p>
              <p className="mt-1 text-xs leading-5 text-[var(--muted)]">Berat × Harga/Gram aktif berdasarkan Kadar Persen.</p>
            </div>
          </div>
        </div>
      </section>

      <MetalPriceRateForm rows={rows} />
    </div>
  );
}
