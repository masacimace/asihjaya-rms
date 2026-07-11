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
import { useActionState, useState } from "react";
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
  const initialPermissionIds =
    props.mode === "edit"
      ? props.role.permissions.map((permission) => permission.id)
      : [];

  const [selectedPermissionIds, setSelectedPermissionIds] =
    useState<string[]>(initialPermissionIds);

  const action =
    props.mode === "create"
      ? createRoleAction
      : updateRoleAction.bind(null, props.role.id);

  const [state, formAction] = useActionState(action, initialRoleActionState);

  const groupedPermissions = groupPermissions(props.permissions);

  const selectedPermissionCodes = props.permissions
    .filter((permission) => selectedPermissionIds.includes(permission.id))
    .map((permission) => permission.code);

  const hasApplicationAccess =
    selectedPermissionCodes.includes("admin.access") ||
    selectedPermissionCodes.includes("pos.access");

  function togglePermission(permissionId: string, checked: boolean) {
    setSelectedPermissionIds((current) =>
      checked
        ? [...new Set([...current, permissionId])]
        : current.filter((id) => id !== permissionId),
    );
  }

  return (
    <form action={formAction} className="space-y-6">
      <ActionMessage state={state} />

      <section className="rounded-2xl border border-[var(--border)] bg-white p-5">
        <div>
          <h2 className="font-semibold text-neutral-950">Identitas Role</h2>

          <p className="mt-1 text-xs text-[var(--muted)]">
            Nama role digunakan pada daftar staff dan audit log.
          </p>
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
              defaultValue={props.mode === "edit" ? props.role.name : ""}
              className={inputClassName}
              placeholder="Contoh: Supervisor Kasir"
            />

            <FieldError message={state.fieldErrors?.name} />
          </label>

          <label className="block text-sm">
            <span className="mb-2 block font-medium text-neutral-800">
              Kode role
            </span>

            {props.mode === "create" ? (
              <input
                name="code"
                required
                minLength={3}
                maxLength={64}
                autoCapitalize="none"
                autoCorrect="off"
                className={inputClassName}
                placeholder="supervisor_kasir"
              />
            ) : (
              <input
                value={props.role.code}
                readOnly
                className={`${inputClassName} cursor-not-allowed bg-neutral-50 text-neutral-500`}
              />
            )}

            <FieldError message={state.fieldErrors?.code} />

            <p className="mt-1.5 text-xs text-[var(--muted)]">
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
              defaultValue={
                props.mode === "edit" ? (props.role.description ?? "") : ""
              }
              className="w-full resize-y rounded-xl border border-[var(--border)] bg-white px-3 py-3 text-sm text-neutral-950 outline-none transition placeholder:text-neutral-400 focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent-soft)]"
              placeholder="Jelaskan tanggung jawab dan penggunaan role ini."
            />

            <FieldError message={state.fieldErrors?.description} />
          </label>
        </div>

        <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-xl border border-[var(--border)] p-4">
          <input
            type="checkbox"
            name="isActive"
            defaultChecked={props.mode === "edit" ? props.role.isActive : true}
            className="mt-0.5 size-4 accent-[var(--accent)]"
          />

          <span>
            <span className="block text-sm font-medium text-neutral-900">
              Role aktif
            </span>

            <span className="mt-1 block text-xs leading-5 text-[var(--muted)]">
              Role nonaktif tidak memberikan permission kepada staff yang
              memilikinya.
            </span>
          </span>
        </label>
      </section>

      {props.mode === "edit" && props.role.activeUserCount > 0 ? (
        <section className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-800">
          <AlertTriangle className="mt-0.5 size-5 shrink-0" />

          <div>
            <p className="text-sm font-semibold">
              Perubahan akan berdampak pada {props.role.activeUserCount} staff
              aktif
            </p>

            <p className="mt-1 text-xs leading-5">
              Perubahan status atau permission akan mencabut session staff yang
              menggunakan role ini.
            </p>
          </div>
        </section>
      ) : null}

      <section className="rounded-2xl border border-[var(--border)] bg-white p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]">
              <LockKeyhole className="size-5" />
            </div>

            <div>
              <h2 className="font-semibold text-neutral-950">
                Permission Matrix
              </h2>

              <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
                Pilih fungsi yang dapat digunakan oleh role ini.
              </p>
            </div>
          </div>

          <span className="w-fit rounded-full bg-neutral-100 px-3 py-1.5 text-xs font-medium text-neutral-600">
            {selectedPermissionIds.length} permission dipilih
          </span>
        </div>

        {!hasApplicationAccess ? (
          <div className="mt-4 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-700">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />

            <span>
              Pilih minimal
              <strong> admin.access</strong> atau
              <strong> pos.access</strong>.
            </span>
          </div>
        ) : null}

        <div className="mt-5 space-y-5">
          {groupedPermissions.map(([module, modulePermissions]) => (
            <section
              key={module}
              className="rounded-2xl border border-[var(--border)] p-4"
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-neutral-900">
                    {moduleLabels[module] ?? module}
                  </h3>

                  <p className="mt-0.5 text-xs text-[var(--muted)]">
                    {modulePermissions.length} permission tersedia
                  </p>
                </div>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {modulePermissions.map((permission) => {
                  const checked = selectedPermissionIds.includes(permission.id);

                  return (
                    <label
                      key={permission.id}
                      className={
                        checked
                          ? "flex cursor-pointer items-start gap-3 rounded-xl border border-[var(--accent)] bg-[var(--accent-soft)] p-3"
                          : "flex cursor-pointer items-start gap-3 rounded-xl border border-[var(--border)] p-3 transition hover:bg-neutral-50"
                      }
                    >
                      <input
                        type="checkbox"
                        name="permissionIds"
                        value={permission.id}
                        checked={checked}
                        onChange={(event) =>
                          togglePermission(permission.id, event.target.checked)
                        }
                        className="mt-1 size-4 accent-[var(--accent)]"
                      />

                      <span className="min-w-0">
                        <span className="block text-sm font-medium text-neutral-900">
                          {permission.name}
                        </span>

                        <span className="mt-0.5 block break-all text-[11px] font-medium text-[var(--accent)]">
                          {permission.code}
                        </span>

                        {permission.description ? (
                          <span className="mt-1 block text-xs leading-5 text-[var(--muted)]">
                            {permission.description}
                          </span>
                        ) : null}
                      </span>
                    </label>
                  );
                })}
              </div>
            </section>
          ))}
        </div>

        <FieldError message={state.fieldErrors?.permissionIds} />
      </section>

      <div className="flex justify-end">
        <FormSubmitButton
          pendingText={
            props.mode === "create"
              ? "Membuat role..."
              : "Menyimpan perubahan..."
          }
        >
          {props.mode === "create" ? (
            <ShieldCheck className="size-4" />
          ) : (
            <Save className="size-4" />
          )}

          {props.mode === "create" ? "Buat Role" : "Simpan Perubahan"}
        </FormSubmitButton>
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

  const groupedPermissions = groupPermissions(permissions);

  return (
    <div className="space-y-6">
      <section className="flex items-start gap-3 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-blue-800">
        <ShieldCheck className="mt-0.5 size-5 shrink-0" />

        <div>
          <p className="text-sm font-semibold">Role sistem dilindungi</p>

          <p className="mt-1 text-xs leading-5">
            Nama, status, kode, dan permission role sistem tidak dapat diubah.
            Buat role custom untuk kebutuhan akses yang berbeda.
          </p>
        </div>
      </section>

      <section className="rounded-2xl border border-[var(--border)] bg-white p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-xs text-[var(--muted)]">Nama role</p>

            <p className="mt-1 font-semibold text-neutral-950">{role.name}</p>
          </div>

          <div>
            <p className="text-xs text-[var(--muted)]">Kode</p>

            <p className="mt-1 font-mono text-sm font-medium text-neutral-800">
              {role.code}
            </p>
          </div>

          <div className="sm:col-span-2">
            <p className="text-xs text-[var(--muted)]">Deskripsi</p>

            <p className="mt-1 text-sm leading-6 text-neutral-700">
              {role.description ?? "Tidak ada deskripsi."}
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl bg-[var(--surface-muted)] p-4">
            <UsersRound className="size-4 text-[var(--accent)]" />

            <p className="mt-3 text-xl font-semibold">{role.userCount}</p>

            <p className="mt-1 text-xs text-[var(--muted)]">Total pengguna</p>
          </div>

          <div className="rounded-xl bg-[var(--surface-muted)] p-4">
            <UsersRound className="size-4 text-emerald-700" />

            <p className="mt-3 text-xl font-semibold">{role.activeUserCount}</p>

            <p className="mt-1 text-xs text-[var(--muted)]">Pengguna aktif</p>
          </div>

          <div className="rounded-xl bg-[var(--surface-muted)] p-4">
            <LockKeyhole className="size-4 text-violet-700" />

            <p className="mt-3 text-xl font-semibold">
              {role.permissions.length}
            </p>

            <p className="mt-1 text-xs text-[var(--muted)]">Permission</p>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-[var(--border)] bg-white p-5">
        <h2 className="font-semibold text-neutral-950">Permission Matrix</h2>

        <div className="mt-5 space-y-5">
          {groupedPermissions.map(([module, modulePermissions]) => (
            <section
              key={module}
              className="rounded-2xl border border-[var(--border)] p-4"
            >
              <h3 className="text-sm font-semibold">
                {moduleLabels[module] ?? module}
              </h3>

              <div className="mt-3 grid gap-2 md:grid-cols-2">
                {modulePermissions.map((permission) => {
                  const selected = selectedIds.has(permission.id);

                  return (
                    <div
                      key={permission.id}
                      className={
                        selected
                          ? "flex items-start gap-3 rounded-xl bg-emerald-50 p-3"
                          : "flex items-start gap-3 rounded-xl bg-neutral-50 p-3 opacity-55"
                      }
                    >
                      <div
                        className={
                          selected
                            ? "mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-emerald-600 text-white"
                            : "mt-0.5 size-5 shrink-0 rounded-full border border-neutral-300"
                        }
                      >
                        {selected ? <Check className="size-3" /> : null}
                      </div>

                      <div>
                        <p className="text-sm font-medium">{permission.name}</p>

                        <p className="mt-0.5 text-[11px] text-[var(--muted)]">
                          {permission.code}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      </section>
    </div>
  );
}
function DeleteRoleSubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={disabled || pending}
      className="flex h-11 items-center justify-center gap-2 rounded-xl bg-red-600 px-4 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {pending ? (
        <>
          {" "}
          <LoaderCircle className="size-4 animate-spin" />
          Menghapus role...
        </>
      ) : (
        <>
          {" "}
          <Trash2 className="size-4" />
          Hapus Role
        </>
      )}{" "}
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
    <section className="rounded-2xl border border-red-200 bg-white p-5">
      {" "}
      <div className="flex items-start gap-4">
        {" "}
        <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-red-50 text-red-600">
          {" "}
          <Trash2 className="size-5" />{" "}
        </div>
        <div className="min-w-0">
          <h2 className="font-semibold text-neutral-950">Zona Berbahaya</h2>

          <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
            Menghapus role akan menghapus konfigurasi permission secara
            permanen. Audit penghapusan tetap tersimpan.
          </p>
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

          <div>
            <p className="text-sm font-medium">Role tidak dapat dihapus</p>

            <p className="mt-1 text-xs leading-5">
              Role ini masih digunakan oleh{" "}
              <strong>{role.userCount} staff</strong>. Pindahkan seluruh staff
              ke role lain terlebih dahulu.
            </p>
          </div>
        </div>
      ) : (
        <form action={formAction} className="mt-5">
          <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
            Role <strong>{role.name}</strong> belum digunakan oleh staff dan
            dapat dihapus permanen.
          </div>

          <label className="mt-4 block text-sm">
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

            <p className="mt-1.5 text-xs text-[var(--muted)]">
              Ketik{" "}
              <code className="rounded bg-neutral-100 px-1.5 py-0.5 font-mono text-neutral-700">
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

          <div className="mt-5 flex justify-end">
            <DeleteRoleSubmitButton disabled={!confirmationMatches} />
          </div>
        </form>
      )}
    </section>
  );
}
