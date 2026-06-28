import { ArrowLeft, UserPlus } from "lucide-react";
import Link from "next/link";

import { CreateStaffForm } from "@/components/administration/staff-forms";
import { getStaffManagementOptions } from "@/features/administration/queries";
import { requirePermission } from "@/lib/auth/session";

export default async function CreateStaffPage() {
  const auth = await requirePermission("staff.manage");

  const options = await getStaffManagementOptions(auth.organization.id);

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
          <div className="grid size-12 place-items-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent)]">
            <UserPlus className="size-5" />
          </div>

          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-neutral-950">
              Tambah Staff
            </h1>

            <p className="mt-1 text-sm text-[var(--muted)]">
              Buat akun dan tentukan akses awal staff.
            </p>
          </div>
        </div>
      </header>

      <CreateStaffForm roles={options.roles} outlets={options.outlets} />
    </div>
  );
}
