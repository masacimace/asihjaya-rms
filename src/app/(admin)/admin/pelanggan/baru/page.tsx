import {
  ArrowLeft,
  BadgeCheck,
  CheckCircle2,
  ContactRound,
  ShoppingBag,
  UserPlus,
} from "lucide-react";
import Link from "next/link";

import { CreateCustomerForm } from "@/components/customers/customer-form";
import { requirePermission } from "@/lib/auth/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function CreateCustomerPage() {
  await requirePermission("admin.access");

  return (
    <div className="mx-auto flex w-full max-w-7xl min-w-0 flex-col gap-5 overflow-x-clip pb-6">
      <section className="rounded-3xl border border-[var(--border)] bg-white p-4 sm:p-5">
        <Link
          href="/admin/pelanggan"
          className="inline-flex h-10 w-fit items-center gap-2 bg-white px-3 text-sm font-medium text-neutral-700 transition hover:text-neutral-950"
        >
          <ArrowLeft className="size-4" />
          Kembali ke daftar pelanggan
        </Link>

        <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_330px] xl:items-start">
          <div className="min-w-0">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
              <div className="grid size-14 shrink-0 place-items-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent)] sm:size-16">
                <UserPlus className="size-6" />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-[var(--accent-soft)] px-3 py-1 text-xs font-semibold text-[var(--accent)]">
                    <ContactRound className="size-3.5" />
                    Pelanggan baru
                  </span>

                  <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                    <CheckCircle2 className="size-3.5" />
                    Siap dibuat
                  </span>
                </div>

                <h1 className="mt-3 text-2xl font-semibold text-neutral-950 sm:text-3xl">
                  Tambah Pelanggan
                </h1>

                <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--muted)]">
                  Buat profil pelanggan agar mudah ditemukan saat checkout POS,
                  terhubung ke histori transaksi, dan siap digunakan untuk
                  pelayanan serta follow-up berikutnya.
                </p>

                <div className="mt-4 flex flex-wrap gap-2 text-xs text-neutral-700">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-1.5">
                    <BadgeCheck className="size-3.5 text-[var(--accent)]" />
                    Kode pelanggan dibuat otomatis
                  </span>

                  <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-1.5">
                    <ShoppingBag className="size-3.5 text-[var(--accent)]" />
                    Siap dipilih melalui POS
                  </span>
                </div>
              </div>
            </div>
          </div>

          <aside className="rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] p-4">
            <p className="text-sm font-semibold text-neutral-950">
              Alur pembuatan profil
            </p>
            <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
              Lengkapi informasi yang tersedia. Data opsional tetap dapat
              ditambahkan atau diperbarui dari detail pelanggan setelah profil
              tersimpan.
            </p>

            <div className="mt-4 space-y-2 text-xs text-neutral-700">
              {[
                "Isi identitas serta kontak utama pelanggan.",
                "Tambahkan alamat dan catatan pelayanan bila tersedia.",
                "Simpan profil agar pelanggan dapat digunakan pada POS.",
              ].map((item) => (
                <div key={item} className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" />
                  <span className="leading-5">{item}</span>
                </div>
              ))}
            </div>
          </aside>
        </div>
      </section>

      <CreateCustomerForm />
    </div>
  );
}
