import { ArrowLeft, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import {
  DeleteRoleSection,
  RoleForm,
  SystemRoleView,
} from "@/components/administration/role-form";
import {
  getPermissionCatalog,
  getRoleDetail,
} from "@/features/administration/queries";
import { requirePermission } from "@/lib/auth/session";

export default async function RoleDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{
    roleId: string;
  }>;
  searchParams: Promise<{
    created?: string;
  }>;
}) {
  const auth = await requirePermission("roles.manage");

  const { roleId } = await params;

  const query = await searchParams;

  const [role, permissionCatalog] = await Promise.all([
    getRoleDetail(auth.organization.id, roleId),

    getPermissionCatalog(),
  ]);

  if (!role) {
    notFound();
  }

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

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate text-2xl font-semibold tracking-tight text-neutral-950">
                {role.name}
              </h1>

              {role.isSystem ? (
                <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">
                  Role sistem
                </span>
              ) : (
                <span className="rounded-full bg-violet-50 px-2.5 py-1 text-xs font-medium text-violet-700">
                  Role custom
                </span>
              )}
            </div>

            <p className="mt-1 text-sm text-[var(--muted)]">
              {role.code} · {role.userCount} pengguna
            </p>
          </div>
        </div>
      </header>

      {query.created === "1" ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          Role berhasil dibuat.
        </div>
      ) : null}

      {role.isSystem ? (
        <SystemRoleView role={role} permissions={permissionCatalog} />
      ) : (
        <>
          <RoleForm mode="edit" role={role} permissions={permissionCatalog} />

          <DeleteRoleSection
            role={{
              id: role.id,
              code: role.code,
              name: role.name,
              userCount: role.userCount,
            }}
          />
        </>
      )}
    </div>
  );
}
