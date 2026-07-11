import {
  ArrowLeft,
  Building2,
  CheckCircle2,
  MapPinned,
  MonitorSmartphone,
  Plus,
  Store,
} from "lucide-react";
import Link from "next/link";

import { CreateOutletForm } from "@/components/administration/outlet-register-forms";
import { requirePermission } from "@/lib/auth/session";

export default async function CreateOutletPage() {
  await requirePermission("outlets.manage");

  return (
    <div className="mx-auto flex w-full max-w-7xl min-w-0 flex-col gap-5 overflow-x-clip pb-6">
      <section className="rounded-3xl border border-[var(--border)] bg-white p-4 sm:p-5">
        <Link
          href="/admin/administrasi/outlet"
          className="inline-flex h-10 w-fit items-center gap-2 bg-white px-3 text-sm font-medium text-neutral-700 transition hover:text-neutral-950"
        >
          <ArrowLeft className="size-4" />
          Kembali ke daftar outlet
        </Link>

        <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_330px] xl:items-start">
          <div className="min-w-0">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
              <div className="grid size-14 shrink-0 place-items-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent)]">
                <Building2 className="size-6" />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-[var(--accent-soft)] px-3 py-1 text-xs font-semibold text-[var(--accent)]">
                    <Plus className="size-3.5" />
                    Outlet baru
                  </span>

                  <span className="inline-flex w-fit rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                    Siap dikonfigurasi
                  </span>
                </div>

                <h1 className="mt-3 text-2xl font-semibold text-neutral-950 sm:text-3xl">
                  Tambah Outlet
                </h1>

                <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--muted)]">
                  Daftarkan lokasi operasional baru beserta identitas, kontak,
                  alamat, dan titik Google Maps yang akan digunakan oleh staff,
                  register, inventaris, serta transaksi POS.
                </p>

                <div className="mt-4 flex flex-wrap gap-2 text-xs text-neutral-700">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-1.5">
                    <Store className="size-3.5 text-[var(--accent)]" />
                    Lokasi operasional baru
                  </span>

                  <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-1.5">
                    <MapPinned className="size-3.5 text-[var(--accent)]" />
                    Preview Google Maps
                  </span>

                  <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-1.5">
                    <MonitorSmartphone className="size-3.5 text-[var(--accent)]" />
                    Register dibuat setelah outlet tersimpan
                  </span>
                </div>
              </div>
            </div>
          </div>

          <aside className="rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] p-4">
            <p className="text-sm font-semibold text-neutral-950">
              Alur aktivasi outlet
            </p>

            <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
              Outlet menjadi pusat relasi untuk register, staff, inventaris, shift,
              dan transaksi pada satu lokasi operasional.
            </p>

            <div className="mt-4 space-y-2 text-xs text-neutral-700">
              {[
                "Lengkapi identitas, kontak, dan alamat outlet.",
                "Tambahkan Google Maps Embed URL agar lokasi mudah diverifikasi.",
                "Buat register dan tentukan hardware hub setelah outlet tersimpan.",
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

      <CreateOutletForm />
    </div>
  );
}
