import {
  ArrowLeft,
  Mail,
  Pencil,
  Phone,
  Plus,
  ShieldCheck,
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

const STAFF_PAGE_SIZE = 5;

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function normalizeStaffPage(value: string | string[] | undefined) {
  const rawValue = Array.isArray(value) ? value[0] : value;
  const parsed = Number.parseInt(rawValue ?? "1", 10);

  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : 1;
}

function buildStaffListUrl(page: number) {
  return page > 1
    ? `/admin/administrasi/staff?page=${page}`
    : "/admin/administrasi/staff";
}

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

type StaffListItem = Awaited<ReturnType<typeof getStaffList>>[number];

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

function StaffCompactRow({ member }: { member: StaffListItem }) {
  const hasCompleteAccess = member.roles.length > 0 && member.outlets.length > 0;

  return (
    <article
      data-staff-layout="compact-row-card"
      className="min-w-0 overflow-hidden rounded-2xl border border-[var(--border)] bg-white p-4 transition hover:border-[var(--accent)] hover:bg-[var(--accent-soft)]/20 sm:p-5"
    >
      <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <div
            className={cn(
              "flex size-12 shrink-0 items-center justify-center rounded-2xl text-sm font-semibold",
              avatarClasses[member.status],
            )}
          >
            {getInitials(member.fullName)}
          </div>

          <div className="min-w-0">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <p className="min-w-0 truncate text-base font-semibold text-neutral-950">
                {member.fullName}
              </p>
              <span
                className={cn(
                  "inline-flex shrink-0 rounded-full border px-2.5 py-1 text-xs font-semibold",
                  statusClasses[member.status],
                )}
              >
                {statusLabels[member.status]}
              </span>
              {!hasCompleteAccess ? (
                <span className="inline-flex shrink-0 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
                  Akses belum lengkap
                </span>
              ) : null}
            </div>

            <p className="mt-1 truncate text-sm text-[var(--muted)]">
              @{member.username}
            </p>
          </div>
        </div>

        <Link
          href={`/admin/administrasi/staff/${member.id}`}
          className="inline-flex h-10 w-full shrink-0 items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-white px-4 text-xs font-semibold text-neutral-800 transition hover:border-[var(--accent)] hover:bg-[var(--accent-soft)] hover:text-[var(--accent)] sm:w-auto"
        >
          <Pencil className="size-3.5" />
          Edit Staff
        </Link>
      </div>

      <div className="mt-4 grid min-w-0 gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <div className="min-w-0 rounded-xl border border-[var(--border)] bg-neutral-50/70 p-3.5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">
            Kontak
          </p>
          <p className="mt-2 flex min-w-0 items-center gap-2 text-xs font-semibold text-neutral-900">
            <Mail className="size-3.5 shrink-0 text-neutral-400" />
            <span className="min-w-0 truncate">{member.email}</span>
          </p>
          {member.phone ? (
            <p className="mt-1.5 flex min-w-0 items-center gap-2 text-xs text-[var(--muted)]">
              <Phone className="size-3.5 shrink-0 text-neutral-400" />
              <span className="min-w-0 truncate">{member.phone}</span>
            </p>
          ) : (
            <p className="mt-1.5 text-xs text-[var(--muted)]">
              Nomor telepon belum diisi.
            </p>
          )}
        </div>

        <div className="min-w-0 rounded-xl border border-[var(--border)] bg-neutral-50/70 p-3.5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">
            Role
          </p>
          {member.roles.length > 0 ? (
            <div className="mt-2 flex min-w-0 flex-wrap gap-1.5">
              {member.roles.map((role) => (
                <span
                  key={role.id}
                  className="max-w-full truncate rounded-full border border-violet-100 bg-violet-50 px-2.5 py-1 text-xs font-semibold text-violet-700"
                >
                  {role.name}
                </span>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-xs font-semibold text-amber-700">
              Belum memiliki role
            </p>
          )}
        </div>

        <div className="min-w-0 rounded-xl border border-[var(--border)] bg-neutral-50/70 p-3.5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">
            Outlet akses
          </p>
          {member.outlets.length > 0 ? (
            <div className="mt-2 min-w-0 space-y-1.5">
              {member.outlets.slice(0, 2).map((outlet) => (
                <p
                  key={outlet.id}
                  className="min-w-0 truncate text-xs font-semibold text-neutral-900"
                >
                  {outlet.name}
                  {outlet.isPrimary ? " · utama" : ""}
                </p>
              ))}
              {member.outlets.length > 2 ? (
                <p className="text-xs text-[var(--muted)]">
                  +{member.outlets.length - 2} outlet lainnya
                </p>
              ) : null}
            </div>
          ) : (
            <p className="mt-2 text-xs font-semibold text-amber-700">
              Belum memiliki outlet
            </p>
          )}
        </div>

        <div className="min-w-0 rounded-xl border border-[var(--border)] bg-neutral-50/70 p-3.5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">
            Login terakhir
          </p>
          <p className="mt-2 break-words text-xs font-semibold leading-5 text-neutral-900">
            {formatLastLogin(member.lastLoginAt)}
          </p>
          <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
            {hasCompleteAccess
              ? "Role dan outlet sudah siap untuk operasional."
              : "Lengkapi role dan outlet sebelum digunakan di POS."}
          </p>
        </div>
      </div>
    </article>
  );
}

export default async function StaffPage({ searchParams }: PageProps) {
  const [auth, query] = await Promise.all([
    requirePermission("staff.manage"),
    searchParams,
  ]);
  const administrationAccess = getAdministrationAccess(auth);

  const staff = await getStaffList(auth.organization.id);
  const pageCount = Math.max(1, Math.ceil(staff.length / STAFF_PAGE_SIZE));
  const page = Math.min(normalizeStaffPage(query.page), pageCount);
  const pageOffset = (page - 1) * STAFF_PAGE_SIZE;
  const visibleStaff = staff.slice(pageOffset, pageOffset + STAFF_PAGE_SIZE);
  const firstRow = staff.length === 0 ? 0 : pageOffset + 1;
  const lastRow = Math.min(pageOffset + STAFF_PAGE_SIZE, staff.length);

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
            <h1 className="mt-4 text-2xl font-semibold text-neutral-950 sm:text-3xl">
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
            <div className="grid gap-3 p-3 sm:p-4">
              {visibleStaff.map((member) => (
                <StaffCompactRow key={member.id} member={member} />
              ))}
            </div>

            {pageCount > 1 ? (
              <div className="border-t border-[var(--border)] px-4 py-4 sm:px-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-xs text-[var(--muted)]">
                    Menampilkan {firstRow}–{lastRow} dari {staff.length} staff ·
                    Halaman {page} dari {pageCount}
                  </p>

                  <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
                    <Link
                      href={buildStaffListUrl(Math.max(1, page - 1))}
                      aria-disabled={page <= 1}
                      className={cn(
                        "inline-flex h-10 items-center justify-center rounded-xl border border-[var(--border)] bg-white px-3 text-xs font-semibold text-neutral-700 transition",
                        page <= 1
                          ? "pointer-events-none opacity-40"
                          : "hover:border-[var(--accent)] hover:bg-[var(--accent-soft)]/20",
                      )}
                    >
                      ← Sebelumnya
                    </Link>

                    <Link
                      href={buildStaffListUrl(Math.min(pageCount, page + 1))}
                      aria-disabled={page >= pageCount}
                      className={cn(
                        "inline-flex h-10 items-center justify-center rounded-xl border border-[var(--border)] bg-white px-3 text-xs font-semibold text-neutral-700 transition",
                        page >= pageCount
                          ? "pointer-events-none opacity-40"
                          : "hover:border-[var(--accent)] hover:bg-[var(--accent-soft)]/20",
                      )}
                    >
                      Berikutnya →
                    </Link>
                  </div>
                </div>
              </div>
            ) : null}
          </>
        )}
      </section>
    </div>
  );
}
