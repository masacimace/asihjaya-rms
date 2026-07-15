import {
  ArrowLeft,
  CheckCircle2,
  KeyRound,
  ShieldCheck,
  Store,
  UserPlus,
  UsersRound,
} from "lucide-react";
import Link from "next/link";

import { CreateStaffForm } from "@/components/administration/staff-forms";
import { getStaffManagementOptions } from "@/features/administration/queries";
import { requirePermission } from "@/lib/auth/session";

export const metadata = {
  title: "Tambah Staff",
};

export default async function CreateStaffPage() {
  const auth = await requirePermission("staff.manage");

  const options = await getStaffManagementOptions(auth.organization.id);

  return (
    <div className="mx-auto flex w-full max-w-7xl min-w-0 flex-col gap-5 overflow-x-clip pb-6">
      <section className="rounded-3xl border border-[var(--border)] bg-white p-4 sm:p-5">
        <Link
          href="/admin/administrasi/staff"
          className="inline-flex h-10 w-fit items-center gap-2 bg-white px-3 text-sm font-medium text-neutral-700 transition hover:text-neutral-950"
        >
          <ArrowLeft className="size-4" />
          Kembali ke daftar staff
        </Link>

        <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_330px] xl:items-start">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-[var(--accent-soft)] px-3 py-1 text-xs font-semibold text-[var(--accent)]">
                <UserPlus className="size-3.5" />
                Staff baru
              </span>

              <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                <CheckCircle2 className="size-3.5" />
                Siap dibuat
              </span>
            </div>

            <h1 className="mt-3 text-2xl font-semibold text-neutral-950 sm:text-3xl">
              Tambah Staff
            </h1>

            <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--muted)]">
              Buat akun baru, tentukan role, dan atur akses outlet sejak awal agar
              staff dapat langsung menggunakan Admin atau POS sesuai tanggung
              jawabnya.
            </p>

            <div className="mt-4 flex flex-wrap gap-2 text-xs text-neutral-700">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-1.5">
                <UsersRound className="size-3.5 text-[var(--accent)]" />
                {options.roles.length} role aktif tersedia
              </span>

              <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-1.5">
                <Store className="size-3.5 text-[var(--accent)]" />
                {options.outlets.length} outlet aktif tersedia
              </span>
            </div>
          </div>

          <aside className="rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] p-4">
            <div className="flex items-start gap-3">
              <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-white text-[var(--accent)]">
                <ShieldCheck className="size-5" />
              </div>

              <div className="min-w-0">
                <p className="text-sm font-semibold text-neutral-950">
                  Alur pembuatan akun
                </p>
                <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
                  Lengkapi identitas, keamanan akun, lalu tentukan akses
                  operasional staff.
                </p>
              </div>
            </div>

            <div className="mt-4 space-y-2 text-xs text-neutral-700">
              {[
                "Isi identitas dan informasi login staff.",
                "Pilih minimal satu role dengan akses Admin atau POS.",
                "Pilih outlet dan tentukan satu outlet utama.",
              ].map((item) => (
                <div key={item} className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" />
                  <span className="leading-5">{item}</span>
                </div>
              ))}
            </div>

            <Link
              href="/admin/administrasi/peran-akses"
              className="mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-white px-4 text-sm font-semibold text-neutral-800 transition hover:border-[var(--accent)] hover:bg-[var(--accent-soft)] hover:text-[var(--accent)]"
            >
              <KeyRound className="size-4" />
              Kelola Role &amp; Akses
            </Link>
          </aside>
        </div>
      </section>

      <CreateStaffForm roles={options.roles} outlets={options.outlets} />
    </div>
  );
}
