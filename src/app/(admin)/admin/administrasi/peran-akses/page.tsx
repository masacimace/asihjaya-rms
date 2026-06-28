import {
  ArrowRight,
  LockKeyhole,
  Plus,
  ShieldCheck,
  UsersRound,
} from "lucide-react";
import Link from "next/link";

import { AdministrationTabs } from "@/components/administration/administration-tabs";
import { getAdministrationAccess } from "@/features/administration/access";
import { getRolesWithPermissions } from "@/features/administration/queries";
import { requirePermission } from "@/lib/auth/session";

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

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-[var(--accent)]">
            Administrasi
          </p>

          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-neutral-950">
            Role & Permission
          </h1>

          <p className="mt-2 text-sm text-[var(--muted)]">
            Kelompokkan hak akses berdasarkan tanggung jawab staff.
          </p>
        </div>

        <Link
          href="/admin/administrasi/peran-akses/tambah"
          className="flex h-11 items-center justify-center gap-2 rounded-xl bg-neutral-950 px-4 text-sm font-semibold !text-white transition hover:bg-neutral-800 [&_svg]:!text-white"
        >
          <Plus className="size-4" />
          Tambah Role
        </Link>
      </header>

      <AdministrationTabs active="roles" access={administrationAccess} />

      {query.deleted === "1" ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          Role custom berhasil dihapus.
        </div>
      ) : null}

      <section className="grid gap-4 xl:grid-cols-2">
        {roleList.map((role) => (
          <article
            key={role.id}
            className="flex flex-col rounded-2xl border border-[var(--border)] bg-white p-5"
          >
            <div className="flex items-start gap-4">
              <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]">
                <ShieldCheck className="size-5" />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-semibold text-neutral-950">
                    {role.name}
                  </h2>

                  {role.isSystem ? (
                    <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-medium text-blue-700">
                      Role sistem
                    </span>
                  ) : (
                    <span className="rounded-full bg-violet-50 px-2.5 py-1 text-[11px] font-medium text-violet-700">
                      Role custom
                    </span>
                  )}

                  {!role.isActive ? (
                    <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-[11px] font-medium text-neutral-600">
                      Nonaktif
                    </span>
                  ) : null}
                </div>

                <p className="mt-1 text-xs font-medium text-[var(--muted)]">
                  {role.code}
                </p>

                <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
                  {role.description ?? "Tidak ada deskripsi role."}
                </p>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-[var(--surface-muted)] p-3">
                <div className="flex items-center gap-2 text-xs text-[var(--muted)]">
                  <UsersRound className="size-4" />
                  Pengguna
                </div>

                <p className="mt-2 text-lg font-semibold text-neutral-950">
                  {role.userCount}
                </p>
              </div>

              <div className="rounded-xl bg-[var(--surface-muted)] p-3">
                <div className="flex items-center gap-2 text-xs text-[var(--muted)]">
                  <LockKeyhole className="size-4" />
                  Permission
                </div>

                <p className="mt-2 text-lg font-semibold text-neutral-950">
                  {role.permissions.length}
                </p>
              </div>
            </div>

            <div className="mt-5 border-t border-[var(--border)] pt-4">
              <p className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
                Hak akses
              </p>

              <div className="mt-3 flex flex-wrap gap-2">
                {role.permissions.slice(0, 8).map((permission) => (
                  <span
                    key={permission.id}
                    title={permission.name}
                    className="rounded-lg border border-[var(--border)] bg-white px-2.5 py-1.5 text-[11px] font-medium text-neutral-600"
                  >
                    {permission.code}
                  </span>
                ))}

                {role.permissions.length > 8 ? (
                  <span className="rounded-lg bg-neutral-100 px-2.5 py-1.5 text-[11px] font-medium text-neutral-600">
                    +{role.permissions.length - 8} lainnya
                  </span>
                ) : null}
              </div>
            </div>

            <Link
              href={`/admin/administrasi/peran-akses/${role.id}`}
              className="group mt-5 flex items-center justify-between border-t border-[var(--border)] pt-4 text-sm font-medium text-[var(--accent)]"
            >
              <span>{role.isSystem ? "Lihat detail role" : "Kelola role"}</span>

              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </article>
        ))}
      </section>
    </div>
  );
}
