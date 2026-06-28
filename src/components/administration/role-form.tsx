"use client";

import {
  AlertTriangle,
  Check,
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
