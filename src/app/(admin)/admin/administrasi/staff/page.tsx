import {
  ArrowLeft,
  Mail,
  Pencil,
  Phone,
  Plus,
  ShieldCheck,
  Store,
  UserRoundCheck,
  UsersRound,
} from "lucide-react";
import Link from "next/link";

import { AdministrationTabs } from "@/components/administration/administration-tabs";
import { getAdministrationAccess } from "@/features/administration/access";
import { getStaffList } from "@/features/administration/queries";
import { requirePermission } from "@/lib/auth/session";
import { cn } from "@/lib/utils";

export const metadata = {
  title: "Staff",
};

const statusLabels = {
  active: "Aktif",
  inactive: "Nonaktif",
  suspended: "Ditangguhkan",
} as const;

const statusClasses = {
  active: "border-emerald-200 bg-emerald-50 text-emerald-700",
  inactive: "border-neutral-200 bg-neutral-100 text-neutral-600",
  suspended: "border-red-200 bg-red-50 text-red-700",
} as const;

const avatarClasses = {
  active: "bg-amber-50 text-amber-700",
  inactive: "bg-neutral-100 text-neutral-600",
  suspended: "bg-red-50 text-red-700",
} as const;

const dateTimeFormatter = new Intl.DateTimeFormat("id-ID", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Jakarta",
});

function getInitials(fullName: string) {
  const nameParts = fullName.trim().split(/\s+/).filter(Boolean);
  const firstName = nameParts[0];

  if (!firstName) {
    return "?";
  }

  if (nameParts.length === 1) {
    return firstName.slice(0, 2).toUpperCase();
  }

  const lastName = nameParts.at(-1);

  return `${firstName.charAt(0)}${lastName?.charAt(0) ?? ""}`.toUpperCase();
}

function formatLastLogin(lastLoginAt: Date | null) {
  return lastLoginAt ? dateTimeFormatter.format(lastLoginAt) : "Belum pernah";
}

export default async function StaffPage() {
  const auth = await requirePermission("staff.manage");
  const administrationAccess = getAdministrationAccess(auth);

  const staff = await getStaffList(auth.organization.id);

  const activeStaff = staff.filter((member) => member.status === "active");
  const inactiveStaff = staff.filter((member) => member.status === "inactive");
  const suspendedStaff = staff.filter(
    (member) => member.status === "suspended",
  );
  const assignedStaff = staff.filter(
    (member) => member.roles.length > 0 && member.outlets.length > 0,
  );

  return (
    <div className="space-y-6">
      <header className="rounded-3xl border border-[var(--border)] bg-white p-6 sm:p-7">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <Link
              href="/admin"
              className="inline-flex items-center gap-2 bg-white px-3 py-1.5 text-sm font-semibold text-neutral-700 transition hover:border-amber-200 hover:bg-amber-50 hover:text-amber-700"
            >
              <ArrowLeft className="size-4" />
              Kembali ke Dashboard
            </Link>
            <h1 className="mt-4 text-3xl font-semibold text-neutral-950 sm:text-4xl">
              Management User
            </h1>

            <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--muted)] sm:text-base">
              Kelola akun pengguna, role, outlet akses, dan status operasional
              staff dalam satu daftar yang mudah dipantau.
            </p>
          </div>

          <div className="rounded-2xl border border-amber-100 bg-amber-50/70 p-4 text-sm text-amber-900 lg:w-80">
            <div className="flex items-start gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-white text-amber-700">
                <ShieldCheck className="size-5" />
              </span>

              <div>
                <p className="font-semibold text-amber-950">Akses staff</p>
                <p className="mt-1 leading-5 text-amber-800">
                  Pastikan setiap staff memiliki role dan outlet sebelum dipakai
                  untuk operasional POS.
                </p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <AdministrationTabs active="staff" access={administrationAccess} />

      <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {[
          {
            label: "Staff aktif",
            value: activeStaff.length,
            helper: "siap digunakan",
            icon: UserRoundCheck,
            tone: "bg-emerald-50 text-emerald-700",
          },
          {
            label: "Staff nonaktif",
            value: inactiveStaff.length,
            helper: "akses dinonaktifkan",
            icon: UsersRound,
            tone: "bg-neutral-100 text-neutral-600",
          },
          {
            label: "Ditangguhkan",
            value: suspendedStaff.length,
            helper: "perlu ditinjau",
            icon: ShieldCheck,
            tone: "bg-red-50 text-red-700",
          },
          {
            label: "Akses lengkap",
            value: assignedStaff.length,
            helper: "punya role dan outlet",
            icon: Store,
            tone: "bg-amber-50 text-amber-700",
          },
        ].map((metric) => {
          const Icon = metric.icon;

          return (
            <div
              key={metric.label}
              className="rounded-2xl border border-[var(--border)] bg-white p-4 sm:p-5"
            >
              <div
                className={cn(
                  "flex size-10 items-center justify-center rounded-2xl sm:size-11",
                  metric.tone,
                )}
              >
                <Icon className="size-5" />
              </div>

              <p className="mt-4 text-2xl font-semibold text-neutral-950 sm:mt-5 sm:text-3xl">
                {metric.value}
              </p>

              <div className="mt-1 text-xs text-[var(--muted)] sm:text-sm">
                <span className="font-medium text-neutral-800">
                  {metric.label}
                </span>{" "}
                · {metric.helper}
              </div>
            </div>
          );
        })}
      </section>

      <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-white">
        <div className="flex flex-col gap-4 border-b border-[var(--border)] px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-neutral-100 px-3 py-1 text-xs font-semibold text-neutral-700">
              <UsersRound className="size-4" />
              Management Staff Account
            </div>

            <h2 className="mt-4 text-xl font-semibold text-neutral-950">
              Daftar Staff
            </h2>

            <p className="mt-1 text-sm text-[var(--muted)]">
              {staff.length} pengguna terdaftar dalam organisasi.
            </p>
          </div>

          <Link
            href="/admin/administrasi/staff/tambah"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-neutral-950 px-5 text-sm font-semibold !text-white transition hover:bg-neutral-800 [&_svg]:!text-white"
          >
            <Plus className="size-4" />
            Tambah Staff
          </Link>
        </div>

        {staff.length === 0 ? (
          <div className="p-10 text-center">
            <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-neutral-100 text-neutral-400">
              <UsersRound className="size-6" />
            </div>

            <p className="mt-3 font-semibold text-neutral-900">
              Belum ada staff
            </p>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Tambahkan staff pertama agar akses operasional bisa mulai diatur.
            </p>
          </div>
        ) : (
          <>
            <div className="hidden lg:block">
              <div className="grid grid-cols-[minmax(18rem,1.35fr)_minmax(13rem,0.9fr)_minmax(14rem,1fr)_8rem_11rem_5rem] gap-4 border-b border-[var(--border)] bg-[var(--surface-muted)] px-6 py-3 text-xs font-semibold text-[var(--muted)]">
                <span>Staff</span>
                <span>Role</span>
                <span>Outlet</span>
                <span>Status</span>
                <span>Login terakhir</span>
                <span className="text-right">Aksi</span>
              </div>

              <div className="max-h-[34rem] overflow-y-auto">
                {staff.map((member) => (
                  <div
                    key={member.id}
                    className="grid grid-cols-[minmax(18rem,1.35fr)_minmax(13rem,0.9fr)_minmax(14rem,1fr)_8rem_11rem_5rem] items-center gap-4 border-b border-[var(--border)] px-6 py-4 last:border-b-0"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div
                        className={cn(
                          "flex size-11 shrink-0 items-center justify-center rounded-2xl text-sm font-semibold",
                          avatarClasses[member.status],
                        )}
                      >
                        {getInitials(member.fullName)}
                      </div>

                      <div className="min-w-0">
                        <p className="truncate font-semibold text-neutral-950">
                          {member.fullName}
                        </p>

                        <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--muted)]">
                          <span className="inline-flex min-w-0 items-center gap-1">
                            @{member.username}
                          </span>
                          <span className="inline-flex min-w-0 items-center gap-1">
                            <Mail className="size-3.5" />
                            <span className="truncate">{member.email}</span>
                          </span>
                          {member.phone ? (
                            <span className="inline-flex min-w-0 items-center gap-1">
                              <Phone className="size-3.5" />
                              <span className="truncate">{member.phone}</span>
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </div>

                    <div className="flex min-w-0 flex-wrap gap-1.5">
                      {member.roles.length > 0 ? (
                        member.roles.map((role) => (
                          <span
                            key={role.id}
                            className="rounded-full border border-violet-100 bg-violet-50 px-2.5 py-1 text-xs font-semibold text-violet-700"
                          >
                            {role.name}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-[var(--muted)]">
                          Belum memiliki role
                        </span>
                      )}
                    </div>

                    <div className="min-w-0 text-sm text-neutral-700">
                      {member.outlets.length > 0 ? (
                        <div className="flex flex-col gap-1">
                          {member.outlets.slice(0, 2).map((outlet) => (
                            <span key={outlet.id} className="truncate">
                              {outlet.name}
                              {outlet.isPrimary ? " · utama" : ""}
                            </span>
                          ))}
                          {member.outlets.length > 2 ? (
                            <span className="text-xs text-[var(--muted)]">
                              +{member.outlets.length - 2} outlet lainnya
                            </span>
                          ) : null}
                        </div>
                      ) : (
                        <span className="text-[var(--muted)]">
                          Belum memiliki outlet
                        </span>
                      )}
                    </div>

                    <div>
                      <span
                        className={cn(
                          "inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold",
                          statusClasses[member.status],
                        )}
                      >
                        {statusLabels[member.status]}
                      </span>
                    </div>

                    <div className="text-sm text-[var(--muted)]">
                      {formatLastLogin(member.lastLoginAt)}
                    </div>

                    <div className="text-right">
                      <Link
                        href={`/admin/administrasi/staff/${member.id}`}
                        className="inline-flex items-center justify-center gap-2 rounded-full border border-[var(--border)] bg-white px-3 py-2 text-sm font-semibold text-neutral-700 transition hover:border-amber-200 hover:bg-amber-50 hover:text-amber-700"
                      >
                        <Pencil className="size-4" />
                        Edit
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid gap-3 p-4 lg:hidden">
              {staff.map((member) => (
                <Link
                  key={member.id}
                  href={`/admin/administrasi/staff/${member.id}`}
                  className="rounded-3xl border border-[var(--border)] bg-white p-4 transition hover:border-amber-200 hover:bg-amber-50/40"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <div
                        className={cn(
                          "flex size-12 shrink-0 items-center justify-center rounded-2xl text-sm font-semibold",
                          avatarClasses[member.status],
                        )}
                      >
                        {getInitials(member.fullName)}
                      </div>

                      <div className="min-w-0">
                        <p className="truncate font-semibold text-neutral-950">
                          {member.fullName}
                        </p>
                        <p className="mt-0.5 truncate text-sm text-[var(--muted)]">
                          @{member.username}
                        </p>
                      </div>
                    </div>

                    <span
                      className={cn(
                        "shrink-0 rounded-full border px-2.5 py-1 text-xs font-semibold",
                        statusClasses[member.status],
                      )}
                    >
                      {statusLabels[member.status]}
                    </span>
                  </div>

                  <div className="mt-4 grid gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] p-3 text-sm">
                    <div>
                      <p className="text-xs font-medium text-[var(--muted)]">
                        Kontak
                      </p>
                      <p className="mt-1 break-all font-semibold text-neutral-900">
                        {member.email}
                      </p>
                      {member.phone ? (
                        <p className="mt-1 text-[var(--muted)]">
                          {member.phone}
                        </p>
                      ) : null}
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <p className="text-xs font-medium text-[var(--muted)]">
                          Role
                        </p>
                        <p className="mt-1 font-semibold text-neutral-900">
                          {member.roles.length > 0
                            ? member.roles.map((role) => role.name).join(", ")
                            : "Belum memiliki role"}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs font-medium text-[var(--muted)]">
                          Outlet
                        </p>
                        <p className="mt-1 font-semibold text-neutral-900">
                          {member.outlets.length > 0
                            ? member.outlets
                                .map((outlet) =>
                                  outlet.isPrimary
                                    ? `${outlet.name} · utama`
                                    : outlet.name,
                                )
                                .join(", ")
                            : "Belum memiliki outlet"}
                        </p>
                      </div>
                    </div>

                    <div>
                      <p className="text-xs font-medium text-[var(--muted)]">
                        Login terakhir
                      </p>
                      <p className="mt-1 font-semibold text-neutral-900">
                        {formatLastLogin(member.lastLoginAt)}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-amber-700">
                    Edit staff
                    <Pencil className="size-4" />
                  </div>
                </Link>
              ))}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
