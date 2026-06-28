import { ArrowLeft, CircleUserRound } from "lucide-react";
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

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header>
        <Link
          href="/admin/administrasi/staff"
          className="inline-flex items-center gap-2 text-sm font-medium text-[var(--muted)] hover:text-neutral-950"
        >
          <ArrowLeft className="size-4" />
          Kembali ke daftar staff
        </Link>

        <div className="mt-5 flex items-center gap-4">
          <CircleUserRound className="size-12 shrink-0 text-neutral-400" />

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate text-2xl font-semibold tracking-tight text-neutral-950">
                {staff.fullName}
              </h1>

              {isCurrentUser ? (
                <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">
                  Akun Anda
                </span>
              ) : null}
            </div>

            <p className="mt-1 text-sm text-[var(--muted)]">
              @{staff.username} · {staff.email}
            </p>
          </div>
        </div>
      </header>

      {query.created === "1" ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          Staff berhasil dibuat.
        </div>
      ) : null}

      <StaffProfileForm staff={staff} isCurrentUser={isCurrentUser} />

      <StaffAccessForm
        staff={staff}
        roles={options.roles}
        outlets={options.outlets}
        isCurrentUser={isCurrentUser}
      />

      <StaffPasswordForm staff={staff} isCurrentUser={isCurrentUser} />
    </div>
  );
}
