import {
  ArrowLeft,
  CheckCircle2,
  Layers3,
  LockKeyhole,
  ShieldCheck,
  UsersRound,
} from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import {
  DeleteRoleSection,
  RoleForm,
  SystemRoleView,
} from "@/components/administration/role-form";
import {
  getPermissionCatalog,
  getRoleDetail,
} from "@/features/administration/queries";
import { requirePermission } from "@/lib/auth/session";

export default async function RoleDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{
    roleId: string;
  }>;
  searchParams: Promise<{
    created?: string;
  }>;
}) {
  const auth = await requirePermission("roles.manage");
  const { roleId } = await params;
  const query = await searchParams;

  const [role, permissionCatalog] = await Promise.all([
    getRoleDetail(auth.organization.id, roleId),
    getPermissionCatalog(),
  ]);

  if (!role) {
    notFound();
  }

  const configuredModuleCount = new Set(
    role.permissions.map((permission) => permission.module),
  ).size;
  const permissionCodes = new Set(
    role.permissions.map((permission) => permission.code),
  );
  const hasAdminAccess = permissionCodes.has("admin.access");
  const hasPosAccess = permissionCodes.has("pos.access");

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
            <div className="flex items-start gap-4">
              <div className="grid size-14 shrink-0 place-items-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent)] sm:size-16">
                <ShieldCheck className="size-6" />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="break-words text-2xl font-semibold text-neutral-950 sm:text-3xl">
                    {role.name}
                  </h1>

                  <span
                    className={
                      role.isSystem
                        ? "inline-flex rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700"
                        : "inline-flex rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-700"
                    }
                  >
                    {role.isSystem ? "Role sistem" : "Role custom"}
                  </span>

                  <span
                    className={
                      role.isActive
                        ? "inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700"
                        : "inline-flex rounded-full border border-neutral-200 bg-neutral-100 px-3 py-1 text-xs font-semibold text-neutral-600"
                    }
                  >
                    {role.isActive ? "Aktif" : "Nonaktif"}
                  </span>
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-[var(--muted)]">
                  <code className="rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-2 py-1 font-mono text-xs text-neutral-700">
                    {role.code}
                  </code>
                  <span>
                    {role.isSystem
                      ? "Konfigurasi bawaan sistem yang dilindungi."
                      : "Kelola identitas, status, dan cakupan akses role."}
                  </span>
                </div>

                <div className="mt-4 flex flex-wrap gap-2 text-xs text-neutral-700">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-1.5">
                    <UsersRound className="size-3.5 text-[var(--accent)]" />
                    {role.userCount} pengguna · {role.activeUserCount} aktif
                  </span>

                  <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-1.5">
                    <LockKeyhole className="size-3.5 text-[var(--accent)]" />
                    {role.permissions.length} permission
                  </span>

                  <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-1.5">
                    <Layers3 className="size-3.5 text-[var(--accent)]" />
                    {configuredModuleCount} modul
                  </span>
                </div>
              </div>
            </div>
          </div>

          <aside className="rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] p-4">
            <div className="flex items-start gap-3">
              <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-white text-[var(--accent)]">
                <ShieldCheck className="size-5" />
              </div>

              <div className="min-w-0">
                <p className="text-sm font-semibold text-neutral-950">
                  {role.isSystem
                    ? "Role sistem dilindungi"
                    : "Pengelolaan hak akses"}
                </p>
                <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
                  {role.isSystem
                    ? "Role bawaan dijaga agar alur autentikasi utama tetap aman dan konsisten."
                    : "Perubahan status atau permission dapat memengaruhi seluruh staff yang menggunakan role ini."}
                </p>
              </div>
            </div>

            <div className="mt-4 space-y-2 text-xs text-neutral-700">
              {(role.isSystem
                ? [
                    "Identitas dan permission ditampilkan secara read-only.",
                    "Gunakan role custom untuk kebutuhan akses berbeda.",
                    "Tinjau cakupan Admin dan POS sebelum memberi role ke staff.",
                  ]
                : [
                    "Perbarui identitas dan status melalui form yang sama.",
                    "Tinjau permission per modul sebelum menyimpan.",
                    "Session staff dicabut saat konfigurasi akses berubah.",
                  ]
              ).map((item) => (
                <div key={item} className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" />
                  <span className="leading-5">{item}</span>
                </div>
              ))}
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <div
                className={
                  hasAdminAccess
                    ? "rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5"
                    : "rounded-xl border border-[var(--border)] bg-white px-3 py-2.5"
                }
              >
                <p className="text-[11px] text-[var(--muted)]">Admin</p>
                <p className="mt-0.5 text-xs font-semibold text-neutral-900">
                  {hasAdminAccess ? "Tersedia" : "Tidak tersedia"}
                </p>
              </div>

              <div
                className={
                  hasPosAccess
                    ? "rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5"
                    : "rounded-xl border border-[var(--border)] bg-white px-3 py-2.5"
                }
              >
                <p className="text-[11px] text-[var(--muted)]">POS</p>
                <p className="mt-0.5 text-xs font-semibold text-neutral-900">
                  {hasPosAccess ? "Tersedia" : "Tidak tersedia"}
                </p>
              </div>
            </div>
          </aside>
        </div>
      </section>

      {query.created === "1" ? (
        <div className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          <CheckCircle2 className="mt-0.5 size-5 shrink-0" />
          <div>
            <p className="font-semibold">Role berhasil dibuat</p>
            <p className="mt-0.5 text-xs leading-5 text-emerald-700/90">
              Tinjau kembali permission dan status role sebelum digunakan oleh
              staff untuk operasional.
            </p>
          </div>
        </div>
      ) : null}

      {role.isSystem ? (
        <SystemRoleView role={role} permissions={permissionCatalog} />
      ) : (
        <>
          <RoleForm mode="edit" role={role} permissions={permissionCatalog} />

          <DeleteRoleSection
            role={{
              id: role.id,
              code: role.code,
              name: role.name,
              userCount: role.userCount,
            }}
          />
        </>
      )}
    </div>
  );
}
