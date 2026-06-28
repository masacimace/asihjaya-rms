"use client";

import {
  Building2,
  Eye,
  EyeOff,
  KeyRound,
  Save,
  ShieldCheck,
  UserPlus,
} from "lucide-react";
import { useActionState, useState } from "react";

import {
  createStaffAction,
  resetStaffPasswordAction,
  updateStaffAccessAction,
  updateStaffProfileAction,
} from "@/app/actions/staff";
import { FormSubmitButton } from "@/components/forms/form-submit-button";
import {
  initialStaffActionState,
  type StaffActionState,
} from "@/features/administration/staff-contracts";

type RoleOption = {
  id: string;
  code: string;
  name: string;
  description: string | null;
};

type OutletOption = {
  id: string;
  code: string;
  name: string;
};

type StaffData = {
  id: string;
  fullName: string;
  username: string;
  email: string;
  phone: string | null;
  status: "active" | "inactive" | "suspended";
  roles: Array<{
    id: string;
    code: string;
    name: string;
  }>;
  outlets: Array<{
    id: string;
    code: string;
    name: string;
    isPrimary: boolean;
  }>;
};

function ActionMessage({ state }: { state: StaffActionState }) {
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

const inputClassName =
  "h-11 w-full rounded-xl border border-[var(--border)] bg-white px-3 text-sm text-neutral-950 outline-none transition placeholder:text-neutral-400 focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent-soft)]";

function PasswordField({
  label,
  name,
  error,
  placeholder,
}: {
  label: string;
  name: string;
  error?: string;
  placeholder?: string;
}) {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <label className="block text-sm">
      {" "}
      <span className="mb-2 block font-medium text-neutral-800">{label} </span>
      <div className="relative">
        <input
          name={name}
          type={showPassword ? "text" : "password"}
          required
          minLength={12}
          maxLength={128}
          autoComplete="new-password"
          placeholder={placeholder}
          className={`${inputClassName} pr-11`}
        />

        <button
          type="button"
          aria-label={
            showPassword
              ? `Sembunyikan ${label.toLowerCase()}`
              : `Tampilkan ${label.toLowerCase()}`
          }
          aria-pressed={showPassword}
          onClick={() => setShowPassword((current) => !current)}
          className="absolute right-1.5 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-lg text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-700 focus:outline-none focus:ring-2 focus:ring-[var(--accent-soft)]"
        >
          {showPassword ? (
            <EyeOff className="size-4" />
          ) : (
            <Eye className="size-4" />
          )}
        </button>
      </div>
      <FieldError message={error} />
    </label>
  );
}

export function CreateStaffForm({
  roles,
  outlets,
}: {
  roles: RoleOption[];
  outlets: OutletOption[];
}) {
  const [state, formAction] = useActionState(
    createStaffAction,
    initialStaffActionState,
  );

  const [selectedOutletIds, setSelectedOutletIds] = useState<string[]>([]);

  const [primaryOutletId, setPrimaryOutletId] = useState("");

  function updateOutlet(outletId: string, checked: boolean) {
    const nextOutletIds = checked
      ? [...new Set([...selectedOutletIds, outletId])]
      : selectedOutletIds.filter((id) => id !== outletId);

    setSelectedOutletIds(nextOutletIds);

    if (checked && !primaryOutletId) {
      setPrimaryOutletId(outletId);
    }

    if (!checked && primaryOutletId === outletId) {
      setPrimaryOutletId(nextOutletIds[0] ?? "");
    }
  }

  return (
    <form action={formAction} className="space-y-6">
      <ActionMessage state={state} />

      <section className="rounded-2xl border border-[var(--border)] bg-white p-5">
        <h2 className="font-semibold text-neutral-950">Identitas Staff</h2>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="block text-sm sm:col-span-2">
            <span className="mb-2 block font-medium text-neutral-800">
              Nama lengkap
            </span>

            <input
              name="fullName"
              required
              maxLength={160}
              className={inputClassName}
              placeholder="Contoh: Hanita"
            />

            <FieldError message={state.fieldErrors?.fullName} />
          </label>

          <label className="block text-sm">
            <span className="mb-2 block font-medium text-neutral-800">
              Username
            </span>

            <input
              name="username"
              required
              maxLength={80}
              autoCapitalize="none"
              autoCorrect="off"
              className={inputClassName}
              placeholder="hanita"
            />

            <FieldError message={state.fieldErrors?.username} />
          </label>

          <label className="block text-sm">
            <span className="mb-2 block font-medium text-neutral-800">
              Email
            </span>

            <input
              name="email"
              type="email"
              required
              maxLength={254}
              className={inputClassName}
              placeholder="hanita@asihjaya.local"
            />

            <FieldError message={state.fieldErrors?.email} />
          </label>

          <label className="block text-sm">
            <span className="mb-2 block font-medium text-neutral-800">
              Nomor telepon
            </span>

            <input
              name="phone"
              maxLength={32}
              className={inputClassName}
              placeholder="08xxxxxxxxxx"
            />

            <FieldError message={state.fieldErrors?.phone} />
          </label>

          <label className="block text-sm">
            <span className="mb-2 block font-medium text-neutral-800">
              Status awal
            </span>

            <select
              name="status"
              defaultValue="active"
              className={inputClassName}
            >
              <option value="active">Aktif</option>
              <option value="inactive">Nonaktif</option>
            </select>
          </label>

          <PasswordField
            label="Kata sandi sementara"
            name="password"
            placeholder="Minimal 12 karakter"
            error={state.fieldErrors?.password}
          />

          <PasswordField
            label="Konfirmasi kata sandi"
            name="passwordConfirmation"
            placeholder="Ulangi kata sandi"
            error={state.fieldErrors?.passwordConfirmation}
          />
        </div>
      </section>

      <section className="rounded-2xl border border-[var(--border)] bg-white p-5">
        <div className="flex items-center gap-3">
          <ShieldCheck className="size-5 text-[var(--accent)]" />

          <div>
            <h2 className="font-semibold text-neutral-950">Role</h2>
            <p className="mt-1 text-xs text-[var(--muted)]">
              Pilih minimal satu role.
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {roles.map((role) => (
            <label
              key={role.id}
              className="flex cursor-pointer items-start gap-3 rounded-xl border border-[var(--border)] p-4 transition hover:bg-neutral-50"
            >
              <input
                type="checkbox"
                name="roleIds"
                value={role.id}
                className="mt-1 size-4 accent-[var(--accent)]"
              />

              <span>
                <span className="block text-sm font-medium text-neutral-900">
                  {role.name}
                </span>

                <span className="mt-1 block text-xs leading-5 text-[var(--muted)]">
                  {role.description ?? role.code}
                </span>
              </span>
            </label>
          ))}
        </div>

        <FieldError message={state.fieldErrors?.roleIds} />
      </section>

      <section className="rounded-2xl border border-[var(--border)] bg-white p-5">
        <div className="flex items-center gap-3">
          <Building2 className="size-5 text-[var(--accent)]" />

          <div>
            <h2 className="font-semibold text-neutral-950">Akses Outlet</h2>
            <p className="mt-1 text-xs text-[var(--muted)]">
              Pilih outlet lalu tentukan outlet utama.
            </p>
          </div>
        </div>

        <div className="mt-5 space-y-3">
          {outlets.map((outlet) => {
            const checked = selectedOutletIds.includes(outlet.id);

            return (
              <div
                key={outlet.id}
                className="flex flex-col gap-3 rounded-xl border border-[var(--border)] p-4 sm:flex-row sm:items-center"
              >
                <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-3">
                  <input
                    type="checkbox"
                    name="outletIds"
                    value={outlet.id}
                    checked={checked}
                    onChange={(event) =>
                      updateOutlet(outlet.id, event.target.checked)
                    }
                    className="size-4 accent-[var(--accent)]"
                  />

                  <span>
                    <span className="block text-sm font-medium text-neutral-900">
                      {outlet.name}
                    </span>

                    <span className="block text-xs text-[var(--muted)]">
                      {outlet.code}
                    </span>
                  </span>
                </label>

                <label className="flex cursor-pointer items-center gap-2 text-xs text-neutral-600">
                  <input
                    type="radio"
                    name="primaryOutletId"
                    value={outlet.id}
                    checked={primaryOutletId === outlet.id}
                    disabled={!checked}
                    onChange={() => setPrimaryOutletId(outlet.id)}
                    className="size-4 accent-[var(--accent)]"
                  />
                  Outlet utama
                </label>
              </div>
            );
          })}
        </div>

        <FieldError message={state.fieldErrors?.outletIds} />

        <FieldError message={state.fieldErrors?.primaryOutletId} />
      </section>

      <div className="flex justify-end">
        <FormSubmitButton pendingText="Membuat staff...">
          <UserPlus className="size-4" />
          Buat Staff
        </FormSubmitButton>
      </div>
    </form>
  );
}

export function StaffProfileForm({
  staff,
  isCurrentUser,
}: {
  staff: StaffData;
  isCurrentUser: boolean;
}) {
  const action = updateStaffProfileAction.bind(null, staff.id);

  const [state, formAction] = useActionState(action, initialStaffActionState);

  return (
    <form
      action={formAction}
      className="space-y-5 rounded-2xl border border-[var(--border)] bg-white p-5"
    >
      <div>
        <h2 className="font-semibold text-neutral-950">Profil dan Status</h2>

        <p className="mt-1 text-xs text-[var(--muted)]">
          Perbarui identitas dan status akun.
        </p>
      </div>

      <ActionMessage state={state} />

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm sm:col-span-2">
          <span className="mb-2 block font-medium">Nama lengkap</span>

          <input
            name="fullName"
            defaultValue={staff.fullName}
            required
            maxLength={160}
            className={inputClassName}
          />

          <FieldError message={state.fieldErrors?.fullName} />
        </label>

        <label className="block text-sm">
          <span className="mb-2 block font-medium">Username</span>

          <input
            name="username"
            defaultValue={staff.username}
            required
            maxLength={80}
            className={inputClassName}
          />

          <FieldError message={state.fieldErrors?.username} />
        </label>

        <label className="block text-sm">
          <span className="mb-2 block font-medium">Email</span>

          <input
            name="email"
            type="email"
            defaultValue={staff.email}
            required
            maxLength={254}
            className={inputClassName}
          />

          <FieldError message={state.fieldErrors?.email} />
        </label>

        <label className="block text-sm">
          <span className="mb-2 block font-medium">Nomor telepon</span>

          <input
            name="phone"
            defaultValue={staff.phone ?? ""}
            maxLength={32}
            className={inputClassName}
          />

          <FieldError message={state.fieldErrors?.phone} />
        </label>

        <label className="block text-sm">
          <span className="mb-2 block font-medium">Status akun</span>

          {isCurrentUser ? (
            <>
              <input type="hidden" name="status" value={staff.status} />

              <select
                value={staff.status}
                disabled
                className={`${inputClassName} opacity-60`}
              >
                <option value="active">Aktif</option>
                <option value="inactive">Nonaktif</option>
                <option value="suspended">Ditangguhkan</option>
              </select>
            </>
          ) : (
            <select
              name="status"
              defaultValue={staff.status}
              className={inputClassName}
            >
              <option value="active">Aktif</option>
              <option value="inactive">Nonaktif</option>
              <option value="suspended">Ditangguhkan</option>
            </select>
          )}

          <FieldError message={state.fieldErrors?.status} />
        </label>
      </div>

      {isCurrentUser ? (
        <p className="rounded-xl bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-700">
          Anda sedang mengedit akun sendiri. Status akun tidak dapat diubah.
        </p>
      ) : null}

      <div className="flex justify-end">
        <FormSubmitButton>
          <Save className="size-4" />
          Simpan Profil
        </FormSubmitButton>
      </div>
    </form>
  );
}

export function StaffAccessForm({
  staff,
  roles,
  outlets,
  isCurrentUser,
}: {
  staff: StaffData;
  roles: RoleOption[];
  outlets: OutletOption[];
  isCurrentUser: boolean;
}) {
  const action = updateStaffAccessAction.bind(null, staff.id);

  const [state, formAction] = useActionState(action, initialStaffActionState);

  const [selectedOutletIds, setSelectedOutletIds] = useState(
    staff.outlets.map((outlet) => outlet.id),
  );

  const [primaryOutletId, setPrimaryOutletId] = useState(
    staff.outlets.find((outlet) => outlet.isPrimary)?.id ??
      staff.outlets[0]?.id ??
      "",
  );

  function updateOutlet(outletId: string, checked: boolean) {
    const nextIds = checked
      ? [...new Set([...selectedOutletIds, outletId])]
      : selectedOutletIds.filter((id) => id !== outletId);

    setSelectedOutletIds(nextIds);

    if (checked && !primaryOutletId) {
      setPrimaryOutletId(outletId);
    }

    if (!checked && primaryOutletId === outletId) {
      setPrimaryOutletId(nextIds[0] ?? "");
    }
  }

  if (isCurrentUser) {
    return (
      <section className="rounded-2xl border border-[var(--border)] bg-white p-5">
        <h2 className="font-semibold text-neutral-950">
          Role dan Akses Outlet
        </h2>

        <p className="mt-3 rounded-xl bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-700">
          Akses akun sendiri tidak dapat diubah untuk mencegah kehilangan akses
          administrasi.
        </p>
      </section>
    );
  }

  return (
    <form
      action={formAction}
      className="space-y-5 rounded-2xl border border-[var(--border)] bg-white p-5"
    >
      <div>
        <h2 className="font-semibold text-neutral-950">
          Role dan Akses Outlet
        </h2>

        <p className="mt-1 text-xs text-[var(--muted)]">
          Perubahan akses akan mencabut seluruh session staff.
        </p>
      </div>

      <ActionMessage state={state} />

      <div>
        <p className="text-sm font-medium">Role</p>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {roles.map((role) => (
            <label
              key={role.id}
              className="flex cursor-pointer items-start gap-3 rounded-xl border border-[var(--border)] p-3"
            >
              <input
                type="checkbox"
                name="roleIds"
                value={role.id}
                defaultChecked={staff.roles.some(
                  (staffRole) => staffRole.id === role.id,
                )}
                className="mt-1 size-4 accent-[var(--accent)]"
              />

              <span>
                <span className="block text-sm font-medium">{role.name}</span>

                <span className="block text-xs text-[var(--muted)]">
                  {role.code}
                </span>
              </span>
            </label>
          ))}
        </div>

        <FieldError message={state.fieldErrors?.roleIds} />
      </div>

      <div>
        <p className="text-sm font-medium">Outlet</p>

        <div className="mt-3 space-y-3">
          {outlets.map((outlet) => {
            const checked = selectedOutletIds.includes(outlet.id);

            return (
              <div
                key={outlet.id}
                className="flex flex-col gap-3 rounded-xl border border-[var(--border)] p-3 sm:flex-row sm:items-center"
              >
                <label className="flex flex-1 cursor-pointer items-center gap-3">
                  <input
                    type="checkbox"
                    name="outletIds"
                    value={outlet.id}
                    checked={checked}
                    onChange={(event) =>
                      updateOutlet(outlet.id, event.target.checked)
                    }
                    className="size-4 accent-[var(--accent)]"
                  />

                  <span className="text-sm font-medium">{outlet.name}</span>
                </label>

                <label className="flex cursor-pointer items-center gap-2 text-xs">
                  <input
                    type="radio"
                    name="primaryOutletId"
                    value={outlet.id}
                    checked={primaryOutletId === outlet.id}
                    disabled={!checked}
                    onChange={() => setPrimaryOutletId(outlet.id)}
                    className="size-4 accent-[var(--accent)]"
                  />
                  Utama
                </label>
              </div>
            );
          })}
        </div>

        <FieldError message={state.fieldErrors?.outletIds} />

        <FieldError message={state.fieldErrors?.primaryOutletId} />
      </div>

      <div className="flex justify-end">
        <FormSubmitButton>
          <ShieldCheck className="size-4" />
          Simpan Akses
        </FormSubmitButton>
      </div>
    </form>
  );
}

export function StaffPasswordForm({
  staff,
  isCurrentUser,
}: {
  staff: StaffData;
  isCurrentUser: boolean;
}) {
  const action = resetStaffPasswordAction.bind(null, staff.id);

  const [state, formAction] = useActionState(action, initialStaffActionState);

  return (
    <form
      action={formAction}
      className="space-y-5 rounded-2xl border border-[var(--border)] bg-white p-5"
    >
      <div>
        <h2 className="font-semibold text-neutral-950">Reset Kata Sandi</h2>

        <p className="mt-1 text-xs text-[var(--muted)]">
          Seluruh session aktif akan dicabut setelah reset.
        </p>
      </div>

      <ActionMessage state={state} />

      {isCurrentUser ? (
        <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-700">
          Reset password akun sendiri akan tersedia melalui menu Keamanan Akun.
        </p>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <PasswordField
              label="Kata sandi baru"
              name="password"
              placeholder="Minimal 12 karakter"
              error={state.fieldErrors?.password}
            />

            <PasswordField
              label="Konfirmasi kata sandi"
              name="passwordConfirmation"
              placeholder="Ulangi kata sandi baru"
              error={state.fieldErrors?.passwordConfirmation}
            />
          </div>

          <div className="flex justify-end">
            <FormSubmitButton pendingText="Mereset...">
              <KeyRound className="size-4" />
              Reset Kata Sandi
            </FormSubmitButton>
          </div>
        </>
      )}
    </form>
  );
}
