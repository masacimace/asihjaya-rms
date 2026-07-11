"use client";

import {
  AlertTriangle,
  Check,
  CheckCircle2,
  CircleDashed,
  Layers3,
  LoaderCircle,
  LockKeyhole,
  Save,
  ShieldCheck,
  Trash2,
  UsersRound,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";

import {
  createRoleAction,
  deleteRoleAction,
  updateRoleAction,
} from "@/app/actions/roles";
import { FormSubmitButton } from "@/components/forms/form-submit-button";
import {
  initialRoleActionState,
  type RoleActionState,
} from "@/features/administration/role-contracts";
import { cn } from "@/lib/utils";

type PermissionOption = {
  id: string;
  code: string;
  name: string;
  module: string;
  description: string | null;
};

type EditableRole = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  isActive: boolean;
  permissions: PermissionOption[];
  userCount: number;
  activeUserCount: number;
};

type RoleFormProps =
  | {
      mode: "create";
      permissions: PermissionOption[];
    }
  | {
      mode: "edit";
      permissions: PermissionOption[];
      role: EditableRole;
    };

const moduleLabels: Record<string, string> = {
  admin: "Dashboard Admin",
  pos: "Aplikasi POS",
  administration: "Administrasi",
  operations: "Operasional",
  inventory: "Inventaris",
  sales: "Penjualan",
  payments: "Pembayaran",
  reports: "Laporan",
  settings: "Pengaturan",
};

const inputClassName =
  "h-11 w-full rounded-xl border border-[var(--border)] bg-white px-3 text-sm text-neutral-950 outline-none transition placeholder:text-neutral-400 focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent-soft)]";

function ActionMessage({ state }: { state: RoleActionState }) {
  if (state.status === "idle" || !state.message) {
    return null;
  }

  return (
    <div
      role="alert"
      className={
        state.status === "success"
          ? "rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700"
          : "rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
      }
    >
      {state.message}
    </div>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) {
    return null;
  }

  return <p className="mt-1.5 text-xs text-red-600">{message}</p>;
}

function groupPermissions(permissions: PermissionOption[]) {
  const grouped = new Map<string, PermissionOption[]>();

  for (const permission of permissions) {
    const current = grouped.get(permission.module) ?? [];

    current.push(permission);

    grouped.set(permission.module, current);
  }

  return [...grouped.entries()];
}

export function CreateRoleForm({
  permissions,
}: {
  permissions: PermissionOption[];
}) {
  const [state, formAction] = useActionState(
    createRoleAction,
    initialRoleActionState,
  );
  const [roleName, setRoleName] = useState("");
  const [roleCode, setRoleCode] = useState("");
  const [description, setDescription] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [selectedPermissionIds, setSelectedPermissionIds] = useState<string[]>(
    [],
  );

  const groupedPermissions = groupPermissions(permissions);
  const selectedPermissionCodes = permissions
    .filter((permission) => selectedPermissionIds.includes(permission.id))
    .map((permission) => permission.code);
  const hasAdminAccess = selectedPermissionCodes.includes("admin.access");
  const hasPosAccess = selectedPermissionCodes.includes("pos.access");
  const hasApplicationAccess = hasAdminAccess || hasPosAccess;
  const selectedModuleCount = groupedPermissions.filter(
    ([, modulePermissions]) =>
      modulePermissions.some((permission) =>
        selectedPermissionIds.includes(permission.id),
      ),
  ).length;

  function togglePermission(permissionId: string, checked: boolean) {
    setSelectedPermissionIds((current) =>
      checked
        ? [...new Set([...current, permissionId])]
        : current.filter((id) => id !== permissionId),
    );
  }

  function toggleModule(
    modulePermissions: PermissionOption[],
    checked: boolean,
  ) {
    const modulePermissionIds = modulePermissions.map(
      (permission) => permission.id,
    );

    setSelectedPermissionIds((current) =>
      checked
        ? [...new Set([...current, ...modulePermissionIds])]
        : current.filter((id) => !modulePermissionIds.includes(id)),
    );
  }

  const setupSummary = [
    {
      label: "Permission dipilih",
      value: `${selectedPermissionIds.length} dari ${permissions.length}`,
      complete: selectedPermissionIds.length > 0,
    },
    {
      label: "Modul dikonfigurasi",
      value: `${selectedModuleCount} dari ${groupedPermissions.length}`,
      complete: selectedModuleCount > 0,
    },
    {
      label: "Akses aplikasi",
      value: hasApplicationAccess ? "Sudah tersedia" : "Belum tersedia",
      complete: hasApplicationAccess,
    },
  ];

  return (
    <form action={formAction} className="space-y-5">
      <ActionMessage state={state} />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px] xl:items-start">
        <div className="min-w-0 space-y-5">
          <section className="rounded-2xl border border-[var(--border)] bg-white p-4 sm:p-5">
            <div className="flex items-start gap-3">
              <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]">
                <ShieldCheck className="size-5" />
              </div>

              <div className="min-w-0">
                <span className="inline-flex w-fit rounded-full bg-[var(--accent-soft)] px-3 py-1 text-xs font-semibold text-[var(--accent)]">
                  Identitas &amp; tujuan
                </span>
                <h2 className="mt-3 font-semibold text-neutral-950">
                  Identitas Role
                </h2>
                <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
                  Nama dan deskripsi membantu administrator memahami tanggung
                  jawab role saat mengatur akses staff.
                </p>
              </div>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <label className="block text-sm">
                <span className="mb-2 block font-medium text-neutral-800">
                  Nama role
                </span>
                <input
                  name="name"
                  required
                  maxLength={120}
                  value={roleName}
                  onChange={(event) => setRoleName(event.target.value)}
                  className={inputClassName}
                  placeholder="Contoh: Supervisor Kasir"
                />
                <FieldError message={state.fieldErrors?.name} />
              </label>

              <label className="block text-sm">
                <span className="mb-2 block font-medium text-neutral-800">
                  Kode role
                </span>
                <input
                  name="code"
                  required
                  minLength={3}
                  maxLength={64}
                  value={roleCode}
                  onChange={(event) => setRoleCode(event.target.value)}
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  className={inputClassName}
                  placeholder="supervisor_kasir"
                />
                <FieldError message={state.fieldErrors?.code} />
                <p className="mt-1.5 text-xs leading-5 text-[var(--muted)]">
                  Gunakan huruf kecil, angka, dan garis bawah. Kode tidak dapat
                  diubah setelah role dibuat.
                </p>
              </label>

              <label className="block text-sm sm:col-span-2">
                <span className="mb-2 block font-medium text-neutral-800">
                  Deskripsi
                </span>
                <textarea
                  name="description"
                  maxLength={1000}
                  rows={4}
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  className="w-full resize-y rounded-xl border border-[var(--border)] bg-white px-3 py-3 text-sm text-neutral-950 outline-none transition placeholder:text-neutral-400 focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent-soft)]"
                  placeholder="Jelaskan tanggung jawab dan penggunaan role ini."
                />
                <div className="mt-1.5 flex items-start justify-between gap-3">
                  <FieldError message={state.fieldErrors?.description} />
                  <span className="ml-auto shrink-0 text-xs text-[var(--muted)]">
                    {description.length}/1000
                  </span>
                </div>
              </label>
            </div>
          </section>

          <section className="rounded-2xl border border-[var(--border)] bg-white p-4 sm:p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex items-start gap-3">
                <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]">
                  <LockKeyhole className="size-5" />
                </div>
                <div className="min-w-0">
                  <span className="inline-flex w-fit rounded-full bg-[var(--accent-soft)] px-3 py-1 text-xs font-semibold text-[var(--accent)]">
                    Kontrol akses
                  </span>
                  <h2 className="mt-3 font-semibold text-neutral-950">
                    Permission Matrix
                  </h2>
                  <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
                    Pilih fungsi yang dapat digunakan. Role wajib memiliki akses
                    ke Admin atau POS.
                  </p>
                </div>
              </div>

              <span className="inline-flex w-fit shrink-0 rounded-full border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-1.5 text-xs font-semibold text-neutral-700">
                {selectedPermissionIds.length} dipilih
              </span>
            </div>

            {!hasApplicationAccess ? (
              <div className="mt-5 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-800">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                <span>
                  Pilih minimal <strong>admin.access</strong> atau
                  <strong> pos.access</strong> agar role dapat digunakan untuk
                  masuk ke aplikasi.
                </span>
              </div>
            ) : null}

            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] px-3.5 py-3">
              <div className="flex items-center gap-2 text-xs text-neutral-700">
                <Layers3 className="size-4 text-[var(--accent)]" />
                <span>
                  {selectedModuleCount} dari {groupedPermissions.length} modul
                  dikonfigurasi
                </span>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setSelectedPermissionIds(
                      permissions.map((permission) => permission.id),
                    )
                  }
                  disabled={selectedPermissionIds.length === permissions.length}
                  className="inline-flex h-9 items-center justify-center rounded-lg border border-[var(--border)] bg-white px-3 text-xs font-semibold text-neutral-700 transition hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Pilih semua
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedPermissionIds([])}
                  disabled={selectedPermissionIds.length === 0}
                  className="inline-flex h-9 items-center justify-center rounded-lg border border-[var(--border)] bg-white px-3 text-xs font-semibold text-neutral-700 transition hover:border-neutral-400 hover:text-neutral-950 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Kosongkan
                </button>
              </div>
            </div>

            {groupedPermissions.length > 0 ? (
              <div className="mt-5 space-y-4">
                {groupedPermissions.map(([module, modulePermissions]) => {
                  const selectedCount = modulePermissions.filter((permission) =>
                    selectedPermissionIds.includes(permission.id),
                  ).length;
                  const allSelected =
                    selectedCount === modulePermissions.length &&
                    modulePermissions.length > 0;

                  return (
                    <section
                      key={module}
                      className="rounded-2xl border border-[var(--border)] bg-white p-4"
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-sm font-semibold text-neutral-950">
                              {moduleLabels[module] ?? module}
                            </h3>
                            <span className="rounded-full bg-[var(--surface-muted)] px-2.5 py-1 text-[11px] font-semibold text-neutral-600">
                              {selectedCount}/{modulePermissions.length} dipilih
                            </span>
                          </div>
                          <p className="mt-1 text-xs text-[var(--muted)]">
                            Kelola permission untuk modul {moduleLabels[module] ?? module}.
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() =>
                            toggleModule(modulePermissions, !allSelected)
                          }
                          className="inline-flex h-9 w-fit items-center justify-center rounded-lg border border-[var(--border)] bg-white px-3 text-xs font-semibold text-neutral-700 transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
                        >
                          {allSelected ? "Kosongkan modul" : "Pilih semua modul"}
                        </button>
                      </div>

                      <div className="mt-4 grid gap-3 md:grid-cols-2">
                        {modulePermissions.map((permission) => {
                          const checked = selectedPermissionIds.includes(
                            permission.id,
                          );

                          return (
                            <label
                              key={permission.id}
                              className={cn(
                                "flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 transition",
                                checked
                                  ? "border-amber-300 bg-amber-50/70"
                                  : "border-[var(--border)] bg-white hover:border-amber-200 hover:bg-amber-50/30",
                              )}
                            >
                              <input
                                type="checkbox"
                                name="permissionIds"
                                value={permission.id}
                                checked={checked}
                                onChange={(event) =>
                                  togglePermission(
                                    permission.id,
                                    event.target.checked,
                                  )
                                }
                                className="mt-1 size-4 shrink-0 accent-[var(--accent)]"
                              />

                              <span className="min-w-0 flex-1">
                                <span className="flex flex-wrap items-center gap-2">
                                  <span className="text-sm font-semibold text-neutral-900">
                                    {permission.name}
                                  </span>
                                  {checked ? (
                                    <span className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                                      <CheckCircle2 className="size-3" />
                                      Dipilih
                                    </span>
                                  ) : null}
                                </span>

                                <span className="mt-1.5 inline-flex max-w-full rounded-lg border border-[var(--border)] bg-white px-2 py-1 font-mono text-[11px] text-neutral-500">
                                  <span className="break-all">{permission.code}</span>
                                </span>

                                {permission.description ? (
                                  <span className="mt-2 block text-xs leading-5 text-[var(--muted)]">
                                    {permission.description}
                                  </span>
                                ) : null}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    </section>
                  );
                })}
              </div>
            ) : (
              <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-800">
                Permission belum tersedia. Tambahkan katalog permission sebelum
                membuat role baru.
              </div>
            )}

            <FieldError message={state.fieldErrors?.permissionIds} />
          </section>
        </div>

        <aside className="min-w-0 space-y-5 xl:sticky xl:top-5">
          <section className="rounded-2xl border border-[var(--border)] bg-white p-4 sm:p-5">
            <div className="flex items-start gap-3">
              <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-[var(--surface-muted)] text-neutral-600">
                <ShieldCheck className="size-5" />
              </div>
              <div className="min-w-0">
                <h2 className="font-semibold text-neutral-950">Status Role</h2>
                <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
                  Tentukan apakah permission langsung berlaku setelah role
                  disimpan.
                </p>
              </div>
            </div>

            <label
              className={cn(
                "mt-5 flex cursor-pointer items-center gap-3 rounded-xl border p-4 transition",
                isActive
                  ? "border-emerald-200 bg-emerald-50/70"
                  : "border-[var(--border)] bg-[var(--surface-muted)]",
              )}
            >
              <input
                type="checkbox"
                name="isActive"
                checked={isActive}
                onChange={(event) => setIsActive(event.target.checked)}
                className="sr-only"
              />
              <span
                aria-hidden="true"
                className={cn(
                  "relative inline-flex h-6 w-11 shrink-0 rounded-full transition",
                  isActive ? "bg-emerald-600" : "bg-neutral-300",
                )}
              >
                <span
                  className={cn(
                    "absolute left-0.5 top-0.5 size-5 rounded-full bg-white transition",
                    isActive ? "translate-x-5" : "translate-x-0",
                  )}
                />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-neutral-900">
                  {isActive ? "Role aktif" : "Role nonaktif"}
                </span>
                <span className="mt-1 block text-xs leading-5 text-[var(--muted)]">
                  {isActive
                    ? "Permission langsung berlaku saat role diberikan kepada staff."
                    : "Role tersimpan sebagai konfigurasi tanpa memberikan permission aktif."}
                </span>
              </span>
            </label>
          </section>

          <section className="rounded-2xl border border-[var(--border)] bg-white p-4 sm:p-5">
            <div className="flex items-start gap-3">
              <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]">
                <Layers3 className="size-5" />
              </div>
              <div className="min-w-0">
                <h2 className="font-semibold text-neutral-950">
                  Ringkasan Konfigurasi
                </h2>
                <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
                  Periksa cakupan akses sebelum menyimpan role.
                </p>
              </div>
            </div>

            <div className="mt-5 space-y-3">
              {setupSummary.map((item) => (
                <div
                  key={item.label}
                  className="flex items-start gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] px-3.5 py-3"
                >
                  {item.complete ? (
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" />
                  ) : (
                    <CircleDashed className="mt-0.5 size-4 shrink-0 text-neutral-400" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-[var(--muted)]">{item.label}</p>
                    <p className="mt-0.5 text-sm font-semibold text-neutral-900">
                      {item.value}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              {[
                { label: "Admin", available: hasAdminAccess },
                { label: "POS", available: hasPosAccess },
              ].map((access) => (
                <div
                  key={access.label}
                  className={cn(
                    "rounded-xl border px-3 py-3",
                    access.available
                      ? "border-emerald-200 bg-emerald-50"
                      : "border-[var(--border)] bg-[var(--surface-muted)]",
                  )}
                >
                  <div className="flex items-center gap-2">
                    {access.available ? (
                      <CheckCircle2 className="size-4 text-emerald-600" />
                    ) : (
                      <CircleDashed className="size-4 text-neutral-400" />
                    )}
                    <span className="text-xs font-semibold text-neutral-800">
                      {access.label}
                    </span>
                  </div>
                  <p className="mt-2 text-[11px] leading-4 text-[var(--muted)]">
                    {access.available ? "Akses tersedia" : "Belum dipilih"}
                  </p>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] p-4">
            <p className="text-sm font-semibold text-neutral-950">
              Simpan role baru
            </p>
            <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
              Role aktif dapat langsung dipilih saat membuat atau mengelola
              staff.
            </p>
            <FormSubmitButton
              pendingText="Membuat role..."
              className="mt-4 w-full"
            >
              <ShieldCheck className="size-4" />
              Buat Role
            </FormSubmitButton>
          </section>
        </aside>
      </div>
    </form>
  );
}


export function RoleForm(props: RoleFormProps) {
  if (props.mode === "create") {
    return <CreateRoleForm permissions={props.permissions} />;
  }

  return (
    <EditRoleForm
      role={props.role}
      permissions={props.permissions}
    />
  );
}

function EditRoleForm({
  role,
  permissions,
}: {
  role: EditableRole;
  permissions: PermissionOption[];
}) {
  const router = useRouter();
  const [state, formAction] = useActionState(
    updateRoleAction.bind(null, role.id),
    initialRoleActionState,
  );
  const [roleName, setRoleName] = useState(role.name);
  const [description, setDescription] = useState(role.description ?? "");
  const [isActive, setIsActive] = useState(role.isActive);
  const [selectedPermissionIds, setSelectedPermissionIds] = useState<string[]>(
    role.permissions.map((permission) => permission.id),
  );
  const [savedSnapshot, setSavedSnapshot] = useState(() => ({
    name: role.name,
    description: role.description ?? "",
    isActive: role.isActive,
    permissionIds: role.permissions.map((permission) => permission.id),
  }));
  const handledSuccessStateRef = useRef<RoleActionState | null>(null);

  useEffect(() => {
    if (
      state.status !== "success" ||
      handledSuccessStateRef.current === state
    ) {
      return;
    }

    handledSuccessStateRef.current = state;

    const normalizedName = roleName.trim();
    const normalizedDescription = description.trim();

    setRoleName(normalizedName);
    setDescription(normalizedDescription);
    setSavedSnapshot({
      name: normalizedName,
      description: normalizedDescription,
      isActive,
      permissionIds: [...selectedPermissionIds],
    });
    router.refresh();
  }, [
    description,
    isActive,
    roleName,
    router,
    selectedPermissionIds,
    state,
  ]);

  const groupedPermissions = groupPermissions(permissions);
  const initialPermissionIds = savedSnapshot.permissionIds;
  const selectedPermissionCodes = permissions
    .filter((permission) => selectedPermissionIds.includes(permission.id))
    .map((permission) => permission.code);
  const hasAdminAccess = selectedPermissionCodes.includes("admin.access");
  const hasPosAccess = selectedPermissionCodes.includes("pos.access");
  const hasApplicationAccess = hasAdminAccess || hasPosAccess;
  const selectedModuleCount = groupedPermissions.filter(
    ([, modulePermissions]) =>
      modulePermissions.some((permission) =>
        selectedPermissionIds.includes(permission.id),
      ),
  ).length;
  const permissionChanges = new Set([
    ...initialPermissionIds.filter(
      (permissionId) => !selectedPermissionIds.includes(permissionId),
    ),
    ...selectedPermissionIds.filter(
      (permissionId) => !initialPermissionIds.includes(permissionId),
    ),
  ]).size;
  const identityChanged =
    roleName.trim() !== savedSnapshot.name ||
    description.trim() !== savedSnapshot.description.trim();
  const statusChanged = isActive !== savedSnapshot.isActive;
  const accessChanged = permissionChanges > 0 || statusChanged;
  const hasUnsavedChanges = identityChanged || accessChanged;

  function togglePermission(permissionId: string, checked: boolean) {
    setSelectedPermissionIds((current) =>
      checked
        ? [...new Set([...current, permissionId])]
        : current.filter((id) => id !== permissionId),
    );
  }

  function toggleModule(
    modulePermissions: PermissionOption[],
    checked: boolean,
  ) {
    const modulePermissionIds = modulePermissions.map(
      (permission) => permission.id,
    );

    setSelectedPermissionIds((current) =>
      checked
        ? [...new Set([...current, ...modulePermissionIds])]
        : current.filter((id) => !modulePermissionIds.includes(id)),
    );
  }

  const setupSummary = [
    {
      label: "Permission dipilih",
      value: `${selectedPermissionIds.length} dari ${permissions.length}`,
      complete: selectedPermissionIds.length > 0,
    },
    {
      label: "Modul dikonfigurasi",
      value: `${selectedModuleCount} dari ${groupedPermissions.length}`,
      complete: selectedModuleCount > 0,
    },
    {
      label: "Perubahan akses",
      value:
        permissionChanges > 0
          ? `${permissionChanges} permission berubah`
          : statusChanged
            ? "Status role berubah"
            : "Tidak ada perubahan",
      complete: !accessChanged,
    },
  ];

  return (
    <form action={formAction} className="space-y-5">
      <ActionMessage state={state} />

      {role.activeUserCount > 0 ? (
        <section className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3.5 text-amber-800">
          <AlertTriangle className="mt-0.5 size-5 shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-semibold">
              Perubahan akses berdampak pada {role.activeUserCount} staff aktif
            </p>
            <p className="mt-1 text-xs leading-5">
              Session seluruh staff yang memakai role ini akan dicabut ketika
              status atau permission berubah. Mereka perlu login kembali.
            </p>
          </div>
        </section>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px] xl:items-start">
        <div className="min-w-0 space-y-5">
          <section className="rounded-2xl border border-[var(--border)] bg-white p-4 sm:p-5">
            <div className="flex items-start gap-3">
              <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]">
                <ShieldCheck className="size-5" />
              </div>

              <div className="min-w-0">
                <span className="inline-flex w-fit rounded-full bg-[var(--accent-soft)] px-3 py-1 text-xs font-semibold text-[var(--accent)]">
                  Identitas &amp; tujuan
                </span>
                <h2 className="mt-3 font-semibold text-neutral-950">
                  Identitas Role
                </h2>
                <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
                  Perbarui nama dan deskripsi agar tanggung jawab role tetap
                  mudah dipahami oleh administrator.
                </p>
              </div>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <label className="block text-sm">
                <span className="mb-2 block font-medium text-neutral-800">
                  Nama role
                </span>
                <input
                  name="name"
                  required
                  maxLength={120}
                  value={roleName}
                  onChange={(event) => setRoleName(event.target.value)}
                  className={inputClassName}
                  placeholder="Contoh: Supervisor Kasir"
                />
                <FieldError message={state.fieldErrors?.name} />
              </label>

              <label className="block text-sm">
                <span className="mb-2 block font-medium text-neutral-800">
                  Kode role
                </span>
                <input
                  value={role.code}
                  readOnly
                  className={`${inputClassName} cursor-not-allowed bg-neutral-50 font-mono text-neutral-500`}
                />
                <p className="mt-1.5 text-xs leading-5 text-[var(--muted)]">
                  Kode menjadi identitas permanen dan tidak dapat diubah setelah
                  role dibuat.
                </p>
              </label>

              <label className="block text-sm sm:col-span-2">
                <span className="mb-2 block font-medium text-neutral-800">
                  Deskripsi
                </span>
                <textarea
                  name="description"
                  maxLength={1000}
                  rows={4}
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  className="w-full resize-y rounded-xl border border-[var(--border)] bg-white px-3 py-3 text-sm text-neutral-950 outline-none transition placeholder:text-neutral-400 focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent-soft)]"
                  placeholder="Jelaskan tanggung jawab dan penggunaan role ini."
                />
                <div className="mt-1.5 flex items-start justify-between gap-3">
                  <FieldError message={state.fieldErrors?.description} />
                  <span className="ml-auto shrink-0 text-xs text-[var(--muted)]">
                    {description.length}/1000
                  </span>
                </div>
              </label>
            </div>
          </section>

          <section className="rounded-2xl border border-[var(--border)] bg-white p-4 sm:p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex items-start gap-3">
                <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]">
                  <LockKeyhole className="size-5" />
                </div>
                <div className="min-w-0">
                  <span className="inline-flex w-fit rounded-full bg-[var(--accent-soft)] px-3 py-1 text-xs font-semibold text-[var(--accent)]">
                    Kontrol akses
                  </span>
                  <h2 className="mt-3 font-semibold text-neutral-950">
                    Permission Matrix
                  </h2>
                  <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
                    Pilih fungsi yang dapat digunakan staff ketika role ini
                    aktif.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setSelectedPermissionIds(
                      permissions.map((permission) => permission.id),
                    )
                  }
                  disabled={selectedPermissionIds.length === permissions.length}
                  className="inline-flex h-9 items-center justify-center rounded-lg border border-[var(--border)] bg-white px-3 text-xs font-semibold text-neutral-700 transition hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Pilih semua
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedPermissionIds([])}
                  disabled={selectedPermissionIds.length === 0}
                  className="inline-flex h-9 items-center justify-center rounded-lg border border-[var(--border)] bg-white px-3 text-xs font-semibold text-neutral-700 transition hover:border-neutral-400 hover:text-neutral-950 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Kosongkan
                </button>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2 text-xs text-neutral-600">
              <span className="rounded-full bg-[var(--surface-muted)] px-3 py-1.5 font-semibold">
                {selectedPermissionIds.length} permission dipilih
              </span>
              <span className="rounded-full bg-[var(--surface-muted)] px-3 py-1.5 font-semibold">
                {selectedModuleCount} modul dikonfigurasi
              </span>
              {permissionChanges > 0 ? (
                <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 font-semibold text-amber-700">
                  {permissionChanges} perubahan
                </span>
              ) : null}
            </div>

            {!hasApplicationAccess ? (
              <div className="mt-4 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-700">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                <span>
                  Pilih minimal <strong>admin.access</strong> atau{" "}
                  <strong>pos.access</strong> agar role menyediakan akses
                  aplikasi.
                </span>
              </div>
            ) : null}

            {groupedPermissions.length > 0 ? (
              <div className="mt-5 space-y-4">
                {groupedPermissions.map(([module, modulePermissions]) => {
                  const selectedCount = modulePermissions.filter((permission) =>
                    selectedPermissionIds.includes(permission.id),
                  ).length;
                  const allSelected =
                    selectedCount === modulePermissions.length &&
                    modulePermissions.length > 0;

                  return (
                    <section
                      key={module}
                      className="rounded-2xl border border-[var(--border)] bg-white p-4"
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-sm font-semibold text-neutral-950">
                              {moduleLabels[module] ?? module}
                            </h3>
                            <span className="rounded-full bg-[var(--surface-muted)] px-2.5 py-1 text-[11px] font-semibold text-neutral-600">
                              {selectedCount}/{modulePermissions.length} dipilih
                            </span>
                          </div>
                          <p className="mt-1 text-xs text-[var(--muted)]">
                            Kelola permission untuk modul{" "}
                            {moduleLabels[module] ?? module}.
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() =>
                            toggleModule(modulePermissions, !allSelected)
                          }
                          className="inline-flex h-9 w-fit items-center justify-center rounded-lg border border-[var(--border)] bg-white px-3 text-xs font-semibold text-neutral-700 transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
                        >
                          {allSelected ? "Kosongkan modul" : "Pilih semua modul"}
                        </button>
                      </div>

                      <div className="mt-4 grid gap-3 md:grid-cols-2">
                        {modulePermissions.map((permission) => {
                          const checked = selectedPermissionIds.includes(
                            permission.id,
                          );

                          return (
                            <label
                              key={permission.id}
                              className={cn(
                                "flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 transition",
                                checked
                                  ? "border-amber-300 bg-amber-50/70"
                                  : "border-[var(--border)] bg-white hover:border-amber-200 hover:bg-amber-50/30",
                              )}
                            >
                              <input
                                type="checkbox"
                                name="permissionIds"
                                value={permission.id}
                                checked={checked}
                                onChange={(event) =>
                                  togglePermission(
                                    permission.id,
                                    event.target.checked,
                                  )
                                }
                                className="mt-1 size-4 shrink-0 accent-[var(--accent)]"
                              />

                              <span className="min-w-0 flex-1">
                                <span className="flex flex-wrap items-center gap-2">
                                  <span className="text-sm font-semibold text-neutral-900">
                                    {permission.name}
                                  </span>
                                  {checked ? (
                                    <span className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                                      <CheckCircle2 className="size-3" />
                                      Dipilih
                                    </span>
                                  ) : null}
                                </span>

                                <span className="mt-1.5 inline-flex max-w-full rounded-lg border border-[var(--border)] bg-white px-2 py-1 font-mono text-[11px] text-neutral-500">
                                  <span className="break-all">
                                    {permission.code}
                                  </span>
                                </span>

                                {permission.description ? (
                                  <span className="mt-2 block text-xs leading-5 text-[var(--muted)]">
                                    {permission.description}
                                  </span>
                                ) : null}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    </section>
                  );
                })}
              </div>
            ) : (
              <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-800">
                Permission belum tersedia untuk dikonfigurasi.
              </div>
            )}

            <FieldError message={state.fieldErrors?.permissionIds} />
          </section>
        </div>

        <aside className="min-w-0 space-y-5 xl:sticky xl:top-5">
          <section className="rounded-2xl border border-[var(--border)] bg-white p-4 sm:p-5">
            <div className="flex items-start gap-3">
              <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-[var(--surface-muted)] text-neutral-600">
                <ShieldCheck className="size-5" />
              </div>
              <div className="min-w-0">
                <h2 className="font-semibold text-neutral-950">Status Role</h2>
                <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
                  Role nonaktif tidak memberikan permission kepada staff yang
                  memilikinya.
                </p>
              </div>
            </div>

            <label
              className={cn(
                "mt-5 flex cursor-pointer items-center gap-3 rounded-xl border p-4 transition",
                isActive
                  ? "border-emerald-200 bg-emerald-50/70"
                  : "border-[var(--border)] bg-[var(--surface-muted)]",
              )}
            >
              <input
                type="checkbox"
                name="isActive"
                checked={isActive}
                onChange={(event) => setIsActive(event.target.checked)}
                className="sr-only"
              />
              <span
                aria-hidden="true"
                className={cn(
                  "relative inline-flex h-6 w-11 shrink-0 rounded-full transition",
                  isActive ? "bg-emerald-600" : "bg-neutral-300",
                )}
              >
                <span
                  className={cn(
                    "absolute left-0.5 top-0.5 size-5 rounded-full bg-white transition",
                    isActive ? "translate-x-5" : "translate-x-0",
                  )}
                />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-neutral-900">
                  {isActive ? "Role aktif" : "Role nonaktif"}
                </span>
                <span className="mt-1 block text-xs leading-5 text-[var(--muted)]">
                  {isActive
                    ? "Permission diterapkan saat role diberikan kepada staff."
                    : "Konfigurasi disimpan tanpa memberikan permission aktif."}
                </span>
              </span>
            </label>

            {statusChanged ? (
              <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3 text-xs leading-5 text-amber-800">
                Status akan berubah dari{" "}
                {savedSnapshot.isActive ? "aktif" : "nonaktif"} menjadi{" "}
                {isActive ? "aktif" : "nonaktif"} setelah disimpan.
              </div>
            ) : null}
          </section>

          <section className="rounded-2xl border border-[var(--border)] bg-white p-4 sm:p-5">
            <div className="flex items-start gap-3">
              <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]">
                <Layers3 className="size-5" />
              </div>
              <div className="min-w-0">
                <h2 className="font-semibold text-neutral-950">
                  Ringkasan Perubahan
                </h2>
                <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
                  Konfigurasi yang akan diterapkan setelah form disimpan.
                </p>
              </div>
            </div>

            <div className="mt-5 space-y-3">
              {setupSummary.map((item) => (
                <div
                  key={item.label}
                  className="flex items-start gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] px-3.5 py-3"
                >
                  {item.complete ? (
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" />
                  ) : (
                    <CircleDashed className="mt-0.5 size-4 shrink-0 text-neutral-400" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-[var(--muted)]">{item.label}</p>
                    <p className="mt-0.5 text-sm font-semibold text-neutral-900">
                      {item.value}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              {[
                { label: "Admin", available: hasAdminAccess },
                { label: "POS", available: hasPosAccess },
              ].map((access) => (
                <div
                  key={access.label}
                  className={cn(
                    "rounded-xl border px-3 py-3",
                    access.available
                      ? "border-emerald-200 bg-emerald-50"
                      : "border-[var(--border)] bg-[var(--surface-muted)]",
                  )}
                >
                  <div className="flex items-center gap-2">
                    {access.available ? (
                      <CheckCircle2 className="size-4 text-emerald-600" />
                    ) : (
                      <CircleDashed className="size-4 text-neutral-400" />
                    )}
                    <span className="text-xs font-semibold text-neutral-800">
                      {access.label}
                    </span>
                  </div>
                  <p className="mt-2 text-[11px] leading-4 text-[var(--muted)]">
                    {access.available ? "Akses tersedia" : "Belum dipilih"}
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-4 flex items-start gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] px-3.5 py-3">
              <UsersRound className="mt-0.5 size-4 shrink-0 text-[var(--accent)]" />
              <div className="min-w-0">
                <p className="text-xs font-semibold text-neutral-800">
                  {role.userCount} staff menggunakan role ini
                </p>
                <p className="mt-1 text-[11px] leading-4 text-[var(--muted)]">
                  {accessChanged
                    ? "Session staff terdampak akan dicabut setelah disimpan."
                    : "Tidak ada perubahan akses yang mencabut session."}
                </p>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-neutral-950">
                  Simpan perubahan role
                </p>
                <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
                  {hasUnsavedChanges
                    ? "Periksa kembali status dan permission sebelum menyimpan."
                    : "Konfigurasi masih sama dengan data tersimpan."}
                </p>
              </div>
              {hasUnsavedChanges ? (
                <span className="shrink-0 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700">
                  Belum disimpan
                </span>
              ) : null}
            </div>

            <FormSubmitButton
              pendingText="Menyimpan perubahan..."
              className="mt-4 w-full"
            >
              <Save className="size-4" />
              Simpan Perubahan
            </FormSubmitButton>
          </section>
        </aside>
      </div>
    </form>
  );
}

export function SystemRoleView({
  role,
  permissions,
}: {
  role: EditableRole;
  permissions: PermissionOption[];
}) {
  const selectedIds = new Set(
    role.permissions.map((permission) => permission.id),
  );
  const selectedCodes = new Set(
    role.permissions.map((permission) => permission.code),
  );
  const groupedPermissions = groupPermissions(permissions);
  const configuredModuleCount = groupedPermissions.filter(
    ([, modulePermissions]) =>
      modulePermissions.some((permission) => selectedIds.has(permission.id)),
  ).length;
  const hasAdminAccess = selectedCodes.has("admin.access");
  const hasPosAccess = selectedCodes.has("pos.access");

  return (
    <div className="space-y-5">
      <section className="flex items-start gap-3 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3.5 text-blue-800">
        <ShieldCheck className="mt-0.5 size-5 shrink-0" />
        <div className="min-w-0">
          <p className="text-sm font-semibold">Role sistem bersifat read-only</p>
          <p className="mt-1 text-xs leading-5">
            Identitas, status, dan permission role ini dijaga oleh sistem. Buat
            role custom untuk menyusun cakupan akses yang berbeda.
          </p>
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px] xl:items-start">
        <div className="min-w-0 space-y-5">
          <section className="rounded-2xl border border-[var(--border)] bg-white p-4 sm:p-5">
            <div className="flex items-start gap-3">
              <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]">
                <ShieldCheck className="size-5" />
              </div>
              <div className="min-w-0">
                <span className="inline-flex w-fit rounded-full bg-[var(--accent-soft)] px-3 py-1 text-xs font-semibold text-[var(--accent)]">
                  Konfigurasi bawaan
                </span>
                <h2 className="mt-3 font-semibold text-neutral-950">
                  Identitas Role Sistem
                </h2>
                <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
                  Informasi berikut hanya dapat ditinjau dan tidak dapat diubah.
                </p>
              </div>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3">
                <p className="text-xs text-[var(--muted)]">Nama role</p>
                <p className="mt-1 text-sm font-semibold text-neutral-950">
                  {role.name}
                </p>
              </div>

              <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3">
                <p className="text-xs text-[var(--muted)]">Kode role</p>
                <code className="mt-1 block break-all font-mono text-sm font-semibold text-neutral-800">
                  {role.code}
                </code>
              </div>

              <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3 sm:col-span-2">
                <p className="text-xs text-[var(--muted)]">Deskripsi</p>
                <p className="mt-1 text-sm leading-6 text-neutral-700">
                  {role.description ?? "Tidak ada deskripsi."}
                </p>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-[var(--border)] bg-white p-4 sm:p-5">
            <div className="flex items-start gap-3">
              <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]">
                <LockKeyhole className="size-5" />
              </div>
              <div className="min-w-0">
                <span className="inline-flex w-fit rounded-full bg-[var(--accent-soft)] px-3 py-1 text-xs font-semibold text-[var(--accent)]">
                  Read-only
                </span>
                <h2 className="mt-3 font-semibold text-neutral-950">
                  Permission Matrix
                </h2>
                <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
                  Permission aktif ditandai dengan jelas. Permission lain
                  ditampilkan redup sebagai referensi katalog.
                </p>
              </div>
            </div>

            <div className="mt-5 space-y-4">
              {groupedPermissions.map(([module, modulePermissions]) => {
                const selectedCount = modulePermissions.filter((permission) =>
                  selectedIds.has(permission.id),
                ).length;

                return (
                  <section
                    key={module}
                    className="rounded-2xl border border-[var(--border)] bg-white p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <h3 className="text-sm font-semibold text-neutral-950">
                          {moduleLabels[module] ?? module}
                        </h3>
                        <p className="mt-1 text-xs text-[var(--muted)]">
                          {selectedCount} dari {modulePermissions.length}{" "}
                          permission aktif
                        </p>
                      </div>
                      <span
                        className={cn(
                          "rounded-full px-2.5 py-1 text-[11px] font-semibold",
                          selectedCount > 0
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-[var(--surface-muted)] text-neutral-500",
                        )}
                      >
                        {selectedCount > 0 ? "Digunakan" : "Tidak digunakan"}
                      </span>
                    </div>

                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      {modulePermissions.map((permission) => {
                        const selected = selectedIds.has(permission.id);

                        return (
                          <div
                            key={permission.id}
                            className={cn(
                              "flex items-start gap-3 rounded-xl border p-3.5",
                              selected
                                ? "border-emerald-200 bg-emerald-50/70"
                                : "border-[var(--border)] bg-[var(--surface-muted)] opacity-55",
                            )}
                          >
                            <div
                              className={cn(
                                "mt-0.5 grid size-5 shrink-0 place-items-center rounded-full",
                                selected
                                  ? "bg-emerald-600 text-white"
                                  : "border border-neutral-300 bg-white",
                              )}
                            >
                              {selected ? <Check className="size-3" /> : null}
                            </div>

                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-neutral-900">
                                {permission.name}
                              </p>
                              <code className="mt-1 block break-all font-mono text-[11px] text-[var(--muted)]">
                                {permission.code}
                              </code>
                              {permission.description ? (
                                <p className="mt-2 text-xs leading-5 text-[var(--muted)]">
                                  {permission.description}
                                </p>
                              ) : null}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                );
              })}
            </div>
          </section>
        </div>

        <aside className="min-w-0 space-y-5 xl:sticky xl:top-5">
          <section className="rounded-2xl border border-[var(--border)] bg-white p-4 sm:p-5">
            <div className="flex items-start gap-3">
              <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]">
                <Layers3 className="size-5" />
              </div>
              <div className="min-w-0">
                <h2 className="font-semibold text-neutral-950">
                  Ringkasan Role
                </h2>
                <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
                  Cakupan akses dan penggunaan role saat ini.
                </p>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3">
              {[
                { label: "Total pengguna", value: role.userCount },
                { label: "Pengguna aktif", value: role.activeUserCount },
                { label: "Permission", value: role.permissions.length },
                { label: "Modul", value: configuredModuleCount },
              ].map((item) => (
                <div
                  key={item.label}
                  className="rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] px-3.5 py-3"
                >
                  <p className="text-lg font-semibold text-neutral-950">
                    {item.value}
                  </p>
                  <p className="mt-1 text-[11px] leading-4 text-[var(--muted)]">
                    {item.label}
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              {[
                { label: "Admin", available: hasAdminAccess },
                { label: "POS", available: hasPosAccess },
              ].map((access) => (
                <div
                  key={access.label}
                  className={cn(
                    "rounded-xl border px-3 py-3",
                    access.available
                      ? "border-emerald-200 bg-emerald-50"
                      : "border-[var(--border)] bg-[var(--surface-muted)]",
                  )}
                >
                  <div className="flex items-center gap-2">
                    {access.available ? (
                      <CheckCircle2 className="size-4 text-emerald-600" />
                    ) : (
                      <CircleDashed className="size-4 text-neutral-400" />
                    )}
                    <span className="text-xs font-semibold text-neutral-800">
                      {access.label}
                    </span>
                  </div>
                  <p className="mt-2 text-[11px] leading-4 text-[var(--muted)]">
                    {access.available ? "Akses tersedia" : "Tidak tersedia"}
                  </p>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
            <p className="text-sm font-semibold text-blue-950">
              Butuh akses yang berbeda?
            </p>
            <p className="mt-1 text-xs leading-5 text-blue-800">
              Buat role custom agar permission dapat disesuaikan tanpa mengubah
              konfigurasi sistem.
            </p>
            <Link
              href="/admin/administrasi/peran-akses/tambah"
              className="mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-blue-200 bg-white px-4 text-sm font-semibold text-blue-700 transition hover:border-blue-300 hover:bg-blue-100/40"
            >
              <ShieldCheck className="size-4" />
              Buat Role Custom
            </Link>
          </section>
        </aside>
      </div>
    </div>
  );
}

function DeleteRoleSubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={disabled || pending}
      className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-red-600 px-4 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
    >
      {pending ? (
        <>
          <LoaderCircle className="size-4 animate-spin" />
          Menghapus role...
        </>
      ) : (
        <>
          <Trash2 className="size-4" />
          Hapus Role
        </>
      )}
    </button>
  );
}

export function DeleteRoleSection({
  role,
}: {
  role: {
    id: string;
    code: string;
    name: string;
    userCount: number;
  };
}) {
  const action = deleteRoleAction.bind(null, role.id);
  const [state, formAction] = useActionState(action, initialRoleActionState);
  const [confirmationCode, setConfirmationCode] = useState("");
  const roleIsUnused = role.userCount === 0;
  const confirmationMatches =
    confirmationCode.trim().toLowerCase() === role.code.toLowerCase();

  return (
    <section className="rounded-2xl border border-red-200 bg-white p-4 sm:p-5">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-red-50 text-red-600">
            <Trash2 className="size-5" />
          </div>
          <div className="min-w-0">
            <span className="inline-flex rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-semibold text-red-700">
              Tindakan permanen
            </span>
            <h2 className="mt-3 font-semibold text-neutral-950">
              Zona Berbahaya
            </h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-[var(--muted)]">
              Menghapus role akan menghapus konfigurasi permission secara
              permanen. Audit penghapusan tetap tersimpan pada sistem.
            </p>
          </div>
        </div>

        <div className="grid min-w-0 grid-cols-2 gap-3 lg:w-72">
          <div className="rounded-xl border border-red-100 bg-red-50/60 px-3.5 py-3">
            <p className="text-xs text-red-700">Role</p>
            <p className="mt-1 truncate text-sm font-semibold text-neutral-950">
              {role.name}
            </p>
          </div>
          <div className="rounded-xl border border-red-100 bg-red-50/60 px-3.5 py-3">
            <p className="text-xs text-red-700">Pengguna</p>
            <p className="mt-1 text-sm font-semibold text-neutral-950">
              {role.userCount} staff
            </p>
          </div>
        </div>
      </div>

      {state.status === "error" && state.message ? (
        <div
          role="alert"
          className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {state.message}
        </div>
      ) : null}

      {!roleIsUnused ? (
        <div className="mt-5 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-800">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-semibold">Role tidak dapat dihapus</p>
            <p className="mt-1 text-xs leading-5">
              Role ini masih digunakan oleh <strong>{role.userCount} staff</strong>.
              Pindahkan seluruh staff ke role lain terlebih dahulu.
            </p>
          </div>
        </div>
      ) : (
        <form
          action={formAction}
          className="mt-5 rounded-2xl border border-red-100 bg-red-50/50 p-4"
        >
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" />
            <p className="text-sm leading-6 text-neutral-700">
              Role <strong>{role.name}</strong> belum digunakan oleh staff dan
              dapat dihapus permanen.
            </p>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
            <label className="block text-sm">
              <span className="mb-2 block font-medium text-neutral-800">
                Ketik kode role untuk konfirmasi
              </span>
              <input
                name="confirmationCode"
                value={confirmationCode}
                onChange={(event) => setConfirmationCode(event.target.value)}
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                placeholder={role.code}
                className="h-11 w-full rounded-xl border border-red-200 bg-white px-3 font-mono text-sm text-neutral-950 outline-none transition placeholder:text-neutral-400 focus:border-red-500 focus:ring-4 focus:ring-red-50"
              />
              <p className="mt-1.5 text-xs leading-5 text-[var(--muted)]">
                Ketik{" "}
                <code className="rounded bg-white px-1.5 py-0.5 font-mono text-neutral-700">
                  {role.code}
                </code>{" "}
                untuk mengaktifkan tombol hapus.
              </p>
              {state.fieldErrors?.confirmationCode ? (
                <p className="mt-1.5 text-xs text-red-600">
                  {state.fieldErrors.confirmationCode}
                </p>
              ) : null}
            </label>

            <DeleteRoleSubmitButton disabled={!confirmationMatches} />
          </div>
        </form>
      )}
    </section>
  );
}
