import {
  ArrowLeft,
  ArrowRight,
  KeyRound,
  LockKeyhole,
  Plus,
  ShieldCheck,
  Sparkles,
  UsersRound,
} from "lucide-react";
import Link from "next/link";

import { AdministrationTabs } from "@/components/administration/administration-tabs";
import { getAdministrationAccess } from "@/features/administration/access";
import { getRolesWithPermissions } from "@/features/administration/queries";
import { requirePermission } from "@/lib/auth/session";

const summaryToneClassName = {
  amber: "bg-[var(--accent-soft)] text-[var(--accent)] ring-amber-100",
  emerald: "bg-emerald-50 text-emerald-700 ring-emerald-100",
  blue: "bg-blue-50 text-blue-700 ring-blue-100",
  violet: "bg-violet-50 text-violet-700 ring-violet-100",
} as const;

function formatNumber(value: number) {
  return new Intl.NumberFormat("id-ID").format(value);
}

export default async function RolesPage({
  searchParams,
}: {
  searchParams: Promise<{
    deleted?: string;
  }>;
}) {
  const query = await searchParams;
  const auth = await requirePermission("roles.manage");
  const administrationAccess = getAdministrationAccess(auth);

  const roleList = await getRolesWithPermissions(auth.organization.id);

  const activeRoles = roleList.filter((role) => role.isActive).length;
  const systemRoles = roleList.filter((role) => role.isSystem).length;
  const customRoles = roleList.filter((role) => !role.isSystem).length;
  const assignedUsers = roleList.reduce(
    (total, role) => total + role.userCount,
    0,
  );
  const permissionAssignments = roleList.reduce(
    (total, role) => total + role.permissions.length,
    0,
  );
  const permissionModules = new Set(
    roleList.flatMap((role) =>
      role.permissions.map((permission) => permission.module),
    ),
  ).size;

  const summaryCards = [
    {
      label: "Role aktif",
      value: activeRoles,
      helper: `${roleList.length} role terdaftar`,
      tone: "amber",
      icon: ShieldCheck,
    },
    {
      label: "Pengguna terhubung",
      value: assignedUsers,
      helper: "assignment role aktif",
      tone: "emerald",
      icon: UsersRound,
    },
    {
      label: "Permission terpasang",
      value: permissionAssignments,
      helper: `${permissionModules} modul akses`,
      tone: "blue",
      icon: LockKeyhole,
    },
    {
      label: "Role custom",
      value: customRoles,
      helper: `${systemRoles} role sistem`,
      tone: "violet",
      icon: KeyRound,
    },
  ] as const;

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-[2rem] border border-[var(--border)] bg-white">
        <div className="grid gap-6 p-6 lg:grid-cols-[1fr_22rem] lg:items-end lg:p-7">
          <div>
            <Link
              href="/admin"
              className="inline-flex items-center gap-2 bg-white px-3 py-2 text-sm font-semibold text-neutral-900 transition hover:border-[var(--accent)] hover:bg-[var(--accent-soft)]/40"
            >
              <ArrowLeft className="size-4" />
              Kembali ke Dashboard
            </Link>

            <h1 className="mt-4 text-2xl font-semibold text-neutral-950 sm:text-3xl">
              Role dan Hak Akses
            </h1>

            <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--muted)]">
              Atur kelompok role, permission modul, dan pengguna yang memakai
              akses tersebut. Halaman ini membantu menjaga pembagian akses admin
              dan POS tetap aman.
            </p>
          </div>

          <div className="rounded-2xl border border-[var(--border)] bg-neutral-50 p-4">
            <div className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-semibold text-neutral-700 ring-1 ring-[var(--border)]">
              <Sparkles className="size-3.5 text-[var(--accent)]" />
              Kontrol akses
            </div>
            <p className="mt-3 text-2xl font-semibold text-neutral-950">
              {formatNumber(activeRoles)} role aktif
            </p>
            <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
              {formatNumber(permissionAssignments)} permission assignment untuk{" "}
              {formatNumber(assignedUsers)} pengguna role dalam organisasi ini.
            </p>
          </div>
        </div>
      </section>

      <AdministrationTabs active="roles" access={administrationAccess} />

      {query.deleted === "1" ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
          Role custom berhasil dihapus.
        </div>
      ) : null}

      <section className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        {summaryCards.map(({ label, value, helper, tone, icon: Icon }) => (
          <article
            key={label}
            className="rounded-3xl border border-[var(--border)] bg-white p-4 sm:p-5"
          >
            <div
              className={`grid size-10 place-items-center rounded-2xl ring-1 sm:size-11 ${summaryToneClassName[tone]}`}
            >
              <Icon className="size-5" />
            </div>

            <p className="mt-4 text-2xl font-semibold text-neutral-950 sm:mt-5 sm:text-3xl">
              {formatNumber(value)}
            </p>

            <p className="mt-1 text-xs font-semibold text-neutral-900 sm:text-sm">
              {label}
            </p>
            <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
              {helper}
            </p>
          </article>
        ))}
      </section>

      <section className="rounded-[2rem] border border-[var(--border)] bg-white p-5 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-neutral-100 px-3 py-1 text-xs font-semibold text-neutral-700">
              <LockKeyhole className="size-3.5" />
              Daftar Role Permission
            </div>
            <h2 className="mt-3 text-xl font-semibold text-neutral-950">
              Kelola role dan permission
            </h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-[var(--muted)]">
              Tinjau role sistem dan role custom yang digunakan staff. Role
              custom bisa dikelola sesuai kebutuhan operasional toko.
            </p>
          </div>

          <Link
            href="/admin/administrasi/peran-akses/tambah"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-neutral-950 px-4 text-sm font-semibold !text-white transition hover:bg-neutral-800 [&_svg]:!text-white"
          >
            <Plus className="size-4" />
            Tambah Role
          </Link>
        </div>

        <div className="mt-5 grid gap-4 xl:grid-cols-2">
          {roleList.map((role) => {
            const shownPermissions = role.permissions.slice(0, 6);
            const hiddenPermissionCount = Math.max(
              role.permissions.length - shownPermissions.length,
              0,
            );

            return (
              <article
                key={role.id}
                className="group rounded-3xl border border-[var(--border)] bg-white p-5 transition hover:border-[var(--accent)] hover:bg-[var(--accent-soft)]/25"
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                  <div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent)] ring-1 ring-amber-100">
                    <ShieldCheck className="size-5" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-semibold text-neutral-950">
                            {role.name}
                          </h3>

                          <span
                            className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ${
                              role.isSystem
                                ? "bg-blue-50 text-blue-700 ring-blue-100"
                                : "bg-violet-50 text-violet-700 ring-violet-100"
                            }`}
                          >
                            {role.isSystem ? "Role sistem" : "Role custom"}
                          </span>

                          {!role.isActive ? (
                            <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-[11px] font-semibold text-neutral-600 ring-1 ring-neutral-200">
                              Nonaktif
                            </span>
                          ) : null}
                        </div>

                        <p className="mt-1 text-xs font-medium text-[var(--muted)]">
                          {role.code}
                        </p>
                      </div>

                      <Link
                        href={`/admin/administrasi/peran-akses/${role.id}`}
                        className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-white px-3 py-2 text-xs font-semibold text-neutral-900 transition hover:border-[var(--accent)] hover:bg-[var(--accent-soft)]/40"
                      >
                        {role.isSystem ? "Lihat detail" : "Kelola"}
                        <ArrowRight className="size-3.5" />
                      </Link>
                    </div>

                    <p className="mt-4 text-sm leading-6 text-[var(--muted)]">
                      {role.description ?? "Tidak ada deskripsi role."}
                    </p>

                    <div className="mt-5 grid grid-cols-2 gap-3">
                      <div className="rounded-2xl border border-[var(--border)] bg-neutral-50 p-3">
                        <div className="flex items-center gap-2 text-xs font-medium text-[var(--muted)]">
                          <UsersRound className="size-4" />
                          Pengguna
                        </div>
                        <p className="mt-2 text-xl font-semibold text-neutral-950">
                          {formatNumber(role.userCount)}
                        </p>
                      </div>

                      <div className="rounded-2xl border border-[var(--border)] bg-neutral-50 p-3">
                        <div className="flex items-center gap-2 text-xs font-medium text-[var(--muted)]">
                          <LockKeyhole className="size-4" />
                          Permission
                        </div>
                        <p className="mt-2 text-xl font-semibold text-neutral-950">
                          {formatNumber(role.permissions.length)}
                        </p>
                      </div>
                    </div>

                    <div className="mt-5 rounded-2xl border border-[var(--border)] bg-neutral-50 p-4">
                      <p className="text-xs font-semibold text-neutral-600">
                        Hak akses utama
                      </p>

                      <div className="mt-3 flex flex-wrap gap-2">
                        {shownPermissions.map((permission) => (
                          <span
                            key={permission.id}
                            title={permission.name}
                            className="rounded-full border border-[var(--border)] bg-white px-2.5 py-1.5 text-[11px] font-medium text-neutral-600"
                          >
                            {permission.code}
                          </span>
                        ))}

                        {hiddenPermissionCount > 0 ? (
                          <span className="rounded-full bg-white px-2.5 py-1.5 text-[11px] font-semibold text-neutral-600 ring-1 ring-[var(--border)]">
                            +{formatNumber(hiddenPermissionCount)} lainnya
                          </span>
                        ) : null}

                        {role.permissions.length === 0 ? (
                          <span className="text-xs text-[var(--muted)]">
                            Belum ada permission terpasang.
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}
