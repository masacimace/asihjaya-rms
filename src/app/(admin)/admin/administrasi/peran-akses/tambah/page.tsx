import { ArrowLeft, ShieldCheck } from "lucide-react";
import Link from "next/link";

import { RoleForm } from "@/components/administration/role-form";
import { getPermissionCatalog } from "@/features/administration/queries";
import { requirePermission } from "@/lib/auth/session";

export default async function CreateRolePage() {
  await requirePermission("roles.manage");

  const permissionCatalog = await getPermissionCatalog();

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header>
        <Link
          href="/admin/administrasi/peran-akses"
          className="inline-flex items-center gap-2 text-sm font-medium text-[var(--muted)] hover:text-neutral-950"
        >
          <ArrowLeft className="size-4" />
          Kembali ke daftar role
        </Link>

        <div className="mt-5 flex items-center gap-4">
          <div className="grid size-12 place-items-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent)]">
            <ShieldCheck className="size-5" />
          </div>

          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-neutral-950">
              Tambah Role
            </h1>

            <p className="mt-1 text-sm text-[var(--muted)]">
              Buat kelompok hak akses baru untuk staff.
            </p>
          </div>
        </div>
      </header>

      <RoleForm mode="create" permissions={permissionCatalog} />
    </div>
  );
}
