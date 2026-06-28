import { CircleUserRound, Pencil, Plus } from "lucide-react";
import Link from "next/link";

import { AdministrationTabs } from "@/components/administration/administration-tabs";
import { getAdministrationAccess } from "@/features/administration/access";
import { getStaffList } from "@/features/administration/queries";
import { requirePermission } from "@/lib/auth/session";
import { cn } from "@/lib/utils";

const statusLabels = {
  active: "Aktif",
  inactive: "Nonaktif",
  suspended: "Ditangguhkan",
} as const;

const statusClasses = {
  active: "bg-emerald-50 text-emerald-700",
  inactive: "bg-neutral-100 text-neutral-600",
  suspended: "bg-red-50 text-red-700",
} as const;

const dateTimeFormatter = new Intl.DateTimeFormat("id-ID", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Jakarta",
});

export default async function StaffPage() {
  const auth = await requirePermission("staff.manage");
  const administrationAccess = getAdministrationAccess(auth);

  const staff = await getStaffList(auth.organization.id);

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-[var(--accent)]">
            Administrasi
          </p>

          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-neutral-950">
            Staff
          </h1>

          <p className="mt-2 text-sm text-[var(--muted)]">
            Daftar seluruh pengguna yang terdaftar dalam organisasi.
          </p>
        </div>

        <Link
          href="/admin/administrasi/staff/tambah"
          className="flex h-11 items-center justify-center gap-2 rounded-xl bg-neutral-950 px-4 text-sm font-semibold !text-white transition hover:bg-neutral-800 [&_svg]:!text-white"
        >
          <Plus className="size-4" />
          Tambah Staff
        </Link>
      </header>

      <AdministrationTabs active="staff" access={administrationAccess} />

      <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-white">
        <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4">
          <div>
            <h2 className="font-semibold text-neutral-950">Daftar Staff</h2>

            <p className="mt-1 text-xs text-[var(--muted)]">
              {staff.length} pengguna terdaftar
            </p>
          </div>

          <span className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-medium text-neutral-600">
            Mode baca
          </span>
        </div>

        {staff.length === 0 ? (
          <div className="p-10 text-center">
            <CircleUserRound className="mx-auto size-10 text-neutral-300" />

            <p className="mt-3 font-medium text-neutral-800">Belum ada staff</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1020px] text-left">
              <thead>
                <tr className="border-b border-[var(--border)] bg-[var(--surface-muted)] text-xs text-[var(--muted)]">
                  <th className="px-5 py-3 font-medium">Staff</th>
                  <th className="px-4 py-3 font-medium">Role</th>
                  <th className="px-4 py-3 font-medium">Outlet</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium">Login terakhir</th>
                  <th className="px-5 py-3 text-right font-medium">Aksi</th>
                </tr>
              </thead>

              <tbody>
                {staff.map((member) => (
                  <tr
                    key={member.id}
                    className="border-b border-[var(--border)] last:border-b-0"
                  >
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <CircleUserRound className="size-9 shrink-0 text-neutral-400" />

                        <div className="min-w-0">
                          <p className="font-medium text-neutral-950">
                            {member.fullName}
                          </p>

                          <p className="mt-0.5 text-xs text-[var(--muted)]">
                            @{member.username} · {member.email}
                          </p>
                        </div>
                      </div>
                    </td>

                    <td className="px-4 py-4">
                      <div className="flex max-w-56 flex-wrap gap-1.5">
                        {member.roles.length > 0 ? (
                          member.roles.map((role) => (
                            <span
                              key={role.id}
                              className="rounded-full bg-violet-50 px-2.5 py-1 text-xs font-medium text-violet-700"
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
                    </td>

                    <td className="px-4 py-4">
                      <div className="max-w-56 text-sm text-neutral-700">
                        {member.outlets.length > 0
                          ? member.outlets
                              .map((outlet) =>
                                outlet.isPrimary
                                  ? `${outlet.name} (utama)`
                                  : outlet.name,
                              )
                              .join(", ")
                          : "Belum memiliki outlet"}
                      </div>
                    </td>

                    <td className="px-4 py-4">
                      <span
                        className={cn(
                          "inline-flex rounded-full px-2.5 py-1 text-xs font-medium",
                          statusClasses[member.status],
                        )}
                      >
                        {statusLabels[member.status]}
                      </span>
                    </td>

                    <td className="px-5 py-4 text-sm text-[var(--muted)]">
                      {member.lastLoginAt
                        ? dateTimeFormatter.format(member.lastLoginAt)
                        : "Belum pernah"}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <Link
                        href={`/admin/administrasi/staff/${member.id}`}
                        className="inline-flex items-center gap-2 text-sm font-medium text-[var(--accent)] hover:text-[var(--accent-hover)]"
                      >
                        <Pencil className="size-4" />
                        Edit
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
