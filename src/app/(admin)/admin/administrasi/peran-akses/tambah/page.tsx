import {
  ArrowLeft,
  CheckCircle2,
  LockKeyhole,
  Plus,
  ShieldCheck,
  UsersRound,
} from "lucide-react";
import Link from "next/link";

import { CreateRoleForm } from "@/components/administration/role-form";
import { getPermissionCatalog } from "@/features/administration/queries";
import { requirePermission } from "@/lib/auth/session";

export default async function CreateRolePage() {
  await requirePermission("roles.manage");

  const permissionCatalog = await getPermissionCatalog();
  const moduleCount = new Set(
    permissionCatalog.map((permission) => permission.module),
  ).size;

  return (
    <div className="mx-auto flex w-full max-w-7xl min-w-0 flex-col gap-5 overflow-x-clip pb-6">
      <section className="rounded-3xl border border-[var(--border)] bg-white p-4 sm:p-5">
        <Link
          href="/admin/administrasi/peran-akses"
          className="inline-flex h-10 w-fit items-center gap-2 bg-white px-3 text-sm font-medium text-neutral-700 transition hover:text-neutral-950"
        >
          <ArrowLeft className="size-4" />
          Kembali ke daftar role
        </Link>

        <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_330px] xl:items-start">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-[var(--accent-soft)] px-3 py-1 text-xs font-semibold text-[var(--accent)]">
                <Plus className="size-3.5" />
                Role custom baru
              </span>

              <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                <CheckCircle2 className="size-3.5" />
                Siap dikonfigurasi
              </span>
            </div>

            <h1 className="mt-3 text-2xl font-semibold text-neutral-950 sm:text-3xl">
              Tambah Role &amp; Hak Akses
            </h1>

            <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--muted)]">
              Buat kelompok akses baru untuk staff, tentukan fungsi yang dapat
              digunakan, lalu aktifkan role saat konfigurasi sudah siap untuk
              operasional.
            </p>

            <div className="mt-4 flex flex-wrap gap-2 text-xs text-neutral-700">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-1.5">
                <LockKeyhole className="size-3.5 text-[var(--accent)]" />
                {permissionCatalog.length} permission tersedia
              </span>

              <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-1.5">
                <ShieldCheck className="size-3.5 text-[var(--accent)]" />
                {moduleCount} modul akses
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
                  Alur konfigurasi role
                </p>
                <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
                  Susun akses sesuai tanggung jawab staff agar permission tetap
                  mudah dipahami dan diaudit.
                </p>
              </div>
            </div>

            <div className="mt-4 space-y-2 text-xs text-neutral-700">
              {[
                "Isi nama, kode unik, dan tujuan penggunaan role.",
                "Pilih minimal akses Admin atau POS.",
                "Tinjau permission per modul sebelum role disimpan.",
              ].map((item) => (
                <div key={item} className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" />
                  <span className="leading-5">{item}</span>
                </div>
              ))}
            </div>

            <div className="mt-4 flex items-start gap-3 rounded-xl border border-[var(--border)] bg-white px-3.5 py-3">
              <UsersRound className="mt-0.5 size-4 shrink-0 text-[var(--accent)]" />
              <p className="text-xs leading-5 text-[var(--muted)]">
                Role aktif dapat langsung dipasang ke staff dari halaman tambah
                atau edit staff.
              </p>
            </div>
          </aside>
        </div>
      </section>

      <CreateRoleForm permissions={permissionCatalog} />
    </div>
  );
}
