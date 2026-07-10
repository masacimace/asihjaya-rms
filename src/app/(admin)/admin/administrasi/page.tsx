import {
  ArrowLeft,
  ArrowRight,
  Building2,
  MonitorSmartphone,
  ShieldCheck,
  Sparkles,
  UserCheck,
  UsersRound,
} from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AdministrationTabs } from "@/components/administration/administration-tabs";
import { getAdministrationAccess } from "@/features/administration/access";
import { getAdministrationOverview } from "@/features/administration/queries";
import { hasPermission, requirePermission } from "@/lib/auth/session";

const summaryCards = [
  {
    key: "activeStaff",
    label: "Staff aktif",
    tone: "emerald",
    icon: UserCheck,
  },
  {
    key: "inactiveStaff",
    label: "Staff nonaktif",
    tone: "neutral",
    icon: UsersRound,
  },
  {
    key: "activeRoles",
    label: "Role aktif",
    tone: "amber",
    icon: ShieldCheck,
  },
  {
    key: "activeOutlets",
    label: "Outlet aktif",
    tone: "blue",
    icon: Building2,
  },
] as const;

const toneClassName = {
  emerald: "bg-emerald-50 text-emerald-700 ring-emerald-100",
  neutral: "bg-neutral-100 text-neutral-700 ring-neutral-200",
  amber: "bg-[var(--accent-soft)] text-[var(--accent)] ring-amber-100",
  blue: "bg-blue-50 text-blue-700 ring-blue-100",
} as const;

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
      helper: "Akun pengguna",
    },
    {
      title: "Role & Permision",
      description: "Atur kelompok hak akses setiap jenis pengguna.",
      href: "/admin/administrasi/peran-akses",
      permission: "roles.manage",
      value: overview.activeRoles,
      valueLabel: "role aktif",
      icon: ShieldCheck,
      helper: "Hak akses modul",
    },
    {
      title: "Outlet",
      description: "Kelola lokasi operasional organisasi.",
      href: "/admin/administrasi/outlet",
      permission: "outlets.manage",
      value: overview.activeOutlets,
      valueLabel: "outlet aktif",
      icon: Building2,
      helper: "Lokasi toko",
    },
    {
      title: "Register",
      description: "Kelola perangkat kasir dan hardware hub.",
      href: "/admin/administrasi/register",
      permission: "outlets.manage",
      value: overview.activeRegisters,
      valueLabel: "register aktif",
      icon: MonitorSmartphone,
      helper: "POS & hardware hub",
    },
  ].filter((module) => hasPermission(auth, module.permission));

  const summaryValues = {
    activeStaff: overview.activeUsers,
    inactiveStaff: overview.inactiveUsers,
    activeRoles: overview.activeRoles,
    activeOutlets: overview.activeOutlets,
  } as const;

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-3xl border border-[var(--border)] bg-white">
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
              Staff dan Hak Akses
            </h1>

            <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--muted)]">
              Kelola pengguna, role, outlet, dan register yang dapat mengakses
              sistem. Halaman ini menjadi pusat kontrol akses operasional admin
              dan POS.
            </p>
          </div>

          <div className="rounded-2xl border border-[var(--border)] bg-neutral-50 p-4">
            <p className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-semibold text-neutral-700 ring-1 ring-[var(--border)]">
              <Sparkles className="size-3.5 text-[var(--accent)]" />
              Status role akses
            </p>
            <p className="mt-2 text-2xl font-semibold text-neutral-950">
              {overview.activeUsers} staff aktif
            </p>
            <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
              {overview.activeRoles} role, {overview.activeOutlets} outlet, dan{" "}
              {overview.activeRegisters} register aktif dalam organisasi ini.
            </p>
          </div>
        </div>
      </section>

      <AdministrationTabs active="overview" access={administrationAccess} />

      <section className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        {summaryCards.map(({ key, label, tone, icon: Icon }) => (
          <article
            key={key}
            className="rounded-2xl border border-[var(--border)] bg-white p-4 sm:p-5"
          >
            <div className="flex items-start justify-between gap-4">
              <div
                className={`grid size-10 place-items-center rounded-2xl ring-1 sm:size-11 ${toneClassName[tone]}`}
              >
                <Icon className="size-5" />
              </div>

              {key === "activeStaff" ? (
                <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold sm:px-2.5 sm:py-1 sm:text-xs text-emerald-700 ring-1 ring-emerald-100">
                  Aktif
                </span>
              ) : null}
            </div>

            <p className="mt-4 text-2xl font-semibold text-neutral-950 sm:mt-5 sm:text-3xl">
              {summaryValues[key]}
            </p>

            <p className="mt-1 text-xs leading-5 text-[var(--muted)] sm:text-sm">
              {label}
            </p>
          </article>
        ))}
      </section>

      <section className="rounded-2xl border border-[var(--border)] bg-white p-5 sm:p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-neutral-100 px-3 py-1 text-xs font-semibold text-neutral-700">
              <ShieldCheck className="size-3.5" />
              Modul administrasi
            </div>
            <h2 className="mt-3 text-xl font-semibold text-neutral-950">
              Kelola akses sistem
            </h2>
            <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
              Pilih modul administrasi yang ingin kamu kelola. Setiap modul
              mengikuti permission role akun yang sedang login.
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          {modules.map(
            ({
              title,
              description,
              href,
              value,
              valueLabel,
              helper,
              icon: Icon,
            }) => (
              <Link
                key={title}
                href={href}
                className="group rounded-3xl border border-[var(--border)] bg-white p-5 transition hover:border-[var(--accent)] hover:bg-[var(--accent-soft)]/30"
              >
                <div className="flex items-start gap-4">
                  <div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent)] ring-1 ring-amber-100">
                    <Icon className="size-5" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold uppercase text-[var(--muted)]">
                          {helper}
                        </p>
                        <h3 className="mt-1 font-semibold text-neutral-950">
                          {title}
                        </h3>
                        <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                          {description}
                        </p>
                      </div>

                      <ArrowRight className="mt-1 size-4 shrink-0 text-neutral-300 transition group-hover:translate-x-0.5 group-hover:text-[var(--accent)]" />
                    </div>

                    <div className="mt-5 flex items-end justify-between gap-3 rounded-2xl border border-[var(--border)] bg-neutral-50 px-4 py-3">
                      <div>
                        <p className="text-2xl font-semibold text-neutral-950">
                          {value}
                        </p>
                        <p className="text-xs text-[var(--muted)]">
                          {valueLabel}
                        </p>
                      </div>
                      <span className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-neutral-600 ring-1 ring-[var(--border)]">
                        Buka modul
                      </span>
                    </div>
                  </div>
                </div>
              </Link>
            ),
          )}
        </div>
      </section>
    </div>
  );
}
