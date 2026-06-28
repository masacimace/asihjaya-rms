import {
  ArrowRight,
  Building2,
  MonitorSmartphone,
  ShieldCheck,
  UserCheck,
  UsersRound,
} from "lucide-react";
import Link from "next/link";

import { AdministrationTabs } from "@/components/administration/administration-tabs";
import { getAdministrationAccess } from "@/features/administration/access";
import { getAdministrationOverview } from "@/features/administration/queries";
import { hasPermission, requirePermission } from "@/lib/auth/session";
import { redirect } from "next/navigation";

export default async function AdministrationPage() {
  const auth = await requirePermission("admin.access");
  const administrationAccess = getAdministrationAccess(auth);
  if (!administrationAccess.canAccessAdministration) {
    redirect("/akses-ditolak");
  }
  const overview = await getAdministrationOverview(auth.organization.id);
  const modules = [
    {
      title: "Staff",
      description: "Kelola akun, status, role, dan akses outlet staff.",
      href: "/admin/administrasi/staff",
      permission: "staff.manage",
      value: overview.totalUsers,
      valueLabel: `${overview.activeUsers} aktif`,
      icon: UsersRound,
    },
    {
      title: "Role & Permission",
      description: "Atur kelompok hak akses setiap jenis pengguna.",
      href: "/admin/administrasi/peran-akses",
      permission: "roles.manage",
      value: overview.activeRoles,
      valueLabel: "role aktif",
      icon: ShieldCheck,
    },
    {
      title: "Outlet",
      description: "Kelola lokasi operasional organisasi.",
      href: "/admin/administrasi/outlet",
      permission: "outlets.manage",
      value: overview.activeOutlets,
      valueLabel: "outlet aktif",
      icon: Building2,
    },
    {
      title: "Register",
      description: "Kelola perangkat kasir dan hardware hub.",
      href: "/admin/administrasi/register",
      permission: "outlets.manage",
      value: overview.activeRegisters,
      valueLabel: "register aktif",
      icon: MonitorSmartphone,
    },
  ].filter((module) => hasPermission(auth, module.permission));

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-medium text-[var(--accent)]">
          Administrasi Sistem
        </p>

        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-neutral-950 sm:text-3xl">
          Staff dan Hak Akses
        </h1>

        <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">
          Kelola pengguna, role, outlet, dan perangkat register yang dapat
          mengakses sistem.
        </p>
      </header>

      <AdministrationTabs active="overview" access={administrationAccess} />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-2xl border border-[var(--border)] bg-white p-5">
          <div className="flex items-center justify-between">
            <div className="grid size-11 place-items-center rounded-xl bg-emerald-50 text-emerald-700">
              <UserCheck className="size-5" />
            </div>

            <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
              Aktif
            </span>
          </div>

          <p className="mt-5 text-2xl font-semibold text-neutral-950">
            {overview.activeUsers}
          </p>

          <p className="mt-1 text-sm text-[var(--muted)]">Staff aktif</p>
        </article>

        <article className="rounded-2xl border border-[var(--border)] bg-white p-5">
          <div className="grid size-11 place-items-center rounded-xl bg-neutral-100 text-neutral-600">
            <UsersRound className="size-5" />
          </div>

          <p className="mt-5 text-2xl font-semibold text-neutral-950">
            {overview.inactiveUsers}
          </p>

          <p className="mt-1 text-sm text-[var(--muted)]">Staff nonaktif</p>
        </article>

        <article className="rounded-2xl border border-[var(--border)] bg-white p-5">
          <div className="grid size-11 place-items-center rounded-xl bg-amber-50 text-amber-700">
            <ShieldCheck className="size-5" />
          </div>

          <p className="mt-5 text-2xl font-semibold text-neutral-950">
            {overview.activeRoles}
          </p>

          <p className="mt-1 text-sm text-[var(--muted)]">Role aktif</p>
        </article>

        <article className="rounded-2xl border border-[var(--border)] bg-white p-5">
          <div className="grid size-11 place-items-center rounded-xl bg-blue-50 text-blue-700">
            <Building2 className="size-5" />
          </div>

          <p className="mt-5 text-2xl font-semibold text-neutral-950">
            {overview.activeOutlets}
          </p>

          <p className="mt-1 text-sm text-[var(--muted)]">Outlet aktif</p>
        </article>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        {modules.map(
          ({ title, description, href, value, valueLabel, icon: Icon }) => (
            <Link
              key={title}
              href={href}
              className="group rounded-2xl border border-[var(--border)] bg-white p-5 transition hover:border-[var(--accent)] hover:shadow-sm"
            >
              <div className="flex items-start gap-4">
                <div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent)]">
                  <Icon className="size-5" />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h2 className="font-semibold text-neutral-950">
                        {title}
                      </h2>

                      <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
                        {description}
                      </p>
                    </div>

                    <ArrowRight className="mt-1 size-4 shrink-0 text-neutral-300 transition group-hover:translate-x-0.5 group-hover:text-[var(--accent)]" />
                  </div>

                  <div className="mt-4 flex items-baseline gap-2">
                    <span className="text-xl font-semibold text-neutral-950">
                      {value}
                    </span>

                    <span className="text-xs text-[var(--muted)]">
                      {valueLabel}
                    </span>
                  </div>
                </div>
              </div>
            </Link>
          ),
        )}
      </section>
    </div>
  );
}
