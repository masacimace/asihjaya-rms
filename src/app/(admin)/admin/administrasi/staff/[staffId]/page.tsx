import {
  ArrowLeft,
  CheckCircle2,
  Mail,
  Phone,
  ShieldCheck,
  Store,
  UsersRound,
} from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import {
  StaffAccessForm,
  StaffPasswordForm,
  StaffProfileForm,
} from "@/components/administration/staff-forms";
import {
  getStaffDetail,
  getStaffManagementOptions,
} from "@/features/administration/queries";
import { requirePermission } from "@/lib/auth/session";

export const metadata = {
  title: "Detail Staff",
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

export default async function StaffDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{
    staffId: string;
  }>;
  searchParams: Promise<{
    created?: string;
  }>;
}) {
  const auth = await requirePermission("staff.manage");

  const { staffId } = await params;
  const query = await searchParams;

  const [staff, options] = await Promise.all([
    getStaffDetail(auth.organization.id, staffId),
    getStaffManagementOptions(auth.organization.id),
  ]);

  if (!staff) {
    notFound();
  }

  const isCurrentUser = staff.id === auth.user.id;
  const primaryOutlet = staff.outlets.find((outlet) => outlet.isPrimary);

  const savedSummary = [
    {
      label: "Status akun",
      value: statusLabels[staff.status],
      helper:
        staff.status === "active"
          ? "Dapat digunakan untuk login"
          : staff.status === "inactive"
            ? "Akses login dinonaktifkan"
            : "Akses login sedang ditangguhkan",
      icon: CheckCircle2,
    },
    {
      label: "Role tersimpan",
      value: `${staff.roles.length} role`,
      helper:
        staff.roles.length > 0
          ? staff.roles.map((role) => role.name).join(", ")
          : "Belum memiliki role",
      icon: ShieldCheck,
    },
    {
      label: "Akses outlet",
      value: `${staff.outlets.length} outlet`,
      helper: primaryOutlet?.name ?? "Outlet utama belum ditentukan",
      icon: Store,
    },
  ];

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
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
              <div className="grid size-72 sm:size-64 shrink-0 place-items-center rounded-2xl bg-[var(--accent-soft)] text-xl font-semibold text-[var(--accent)]">
                {getInitials(staff.fullName)}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                  <h1 className="break-words text-2xl font-semibold text-neutral-950 sm:text-3xl">
                    {staff.fullName}
                  </h1>

                  <span
                    className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${statusClasses[staff.status]}`}
                  >
                    {statusLabels[staff.status]}
                  </span>

                  {isCurrentUser ? (
                    <span className="inline-flex rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                      Akun Anda
                    </span>
                  ) : null}
                </div>

                <p className="mt-1 text-sm font-medium text-[var(--muted)]">
                  @{staff.username}
                </p>

                <div className="mt-4 flex flex-wrap gap-2 text-xs text-neutral-700">
                  <span className="inline-flex min-w-0 items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-1.5">
                    <Mail className="size-3.5 shrink-0 text-[var(--accent)]" />
                    <span className="truncate">{staff.email}</span>
                  </span>

                  <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-1.5">
                    <Phone className="size-3.5 text-[var(--accent)]" />
                    {staff.phone ?? "Nomor telepon belum diisi"}
                  </span>

                  <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-1.5">
                    <UsersRound className="size-3.5 text-[var(--accent)]" />
                    {staff.roles.length} role · {staff.outlets.length} outlet
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
                  Pengelolaan akun
                </p>
                <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
                  Perubahan profil, akses, dan kata sandi disimpan melalui form
                  terpisah agar setiap tindakan tetap jelas.
                </p>
              </div>
            </div>

            <div className="mt-4 space-y-2 text-xs text-neutral-700">
              {[
                "Perbarui identitas dan status operasional akun.",
                "Atur role, outlet, serta outlet utama staff.",
                "Reset kata sandi saat akses login perlu dipulihkan.",
              ].map((item) => (
                <div key={item} className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" />
                  <span className="leading-5">{item}</span>
                </div>
              ))}
            </div>
          </aside>
        </div>
      </section>

      {query.created === "1" ? (
        <div className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          <CheckCircle2 className="mt-0.5 size-5 shrink-0" />
          <div>
            <p className="font-semibold">Staff berhasil dibuat</p>
            <p className="mt-0.5 text-xs leading-5 text-emerald-700/90">
              Periksa kembali profil, role, dan outlet sebelum akun digunakan
              untuk operasional.
            </p>
          </div>
        </div>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px] xl:items-start">
        <div className="min-w-0 space-y-5">
          <StaffProfileForm staff={staff} isCurrentUser={isCurrentUser} />

          <StaffAccessForm
            staff={staff}
            roles={options.roles}
            outlets={options.outlets}
            isCurrentUser={isCurrentUser}
          />
        </div>

        <aside className="min-w-0 space-y-5 xl:sticky xl:top-5">
          <section className="rounded-2xl border border-[var(--border)] bg-white p-4 sm:p-5">
            <div className="flex items-start gap-3">
              <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]">
                <ShieldCheck className="size-5" />
              </div>

              <div className="min-w-0">
                <h2 className="font-semibold text-neutral-950">
                  Ringkasan Tersimpan
                </h2>
                <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
                  Konfigurasi akun yang saat ini tersimpan pada sistem.
                </p>
              </div>
            </div>

            <div className="mt-5 space-y-3">
              {savedSummary.map((item) => {
                const Icon = item.icon;

                return (
                  <div
                    key={item.label}
                    className="flex items-start gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] px-3.5 py-3"
                  >
                    <Icon className="mt-0.5 size-4 shrink-0 text-[var(--accent)]" />

                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-[var(--muted)]">
                        {item.label}
                      </p>
                      <p className="mt-0.5 text-sm font-semibold text-neutral-900">
                        {item.value}
                      </p>
                      <p className="mt-1 break-words text-xs leading-5 text-[var(--muted)]">
                        {item.helper}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <StaffPasswordForm staff={staff} isCurrentUser={isCurrentUser} />
        </aside>
      </div>
    </div>
  );
}
