"use client";

import {
  Building2,
  CheckCircle2,
  CircleDot,
  Eye,
  EyeOff,
  KeyRound,
  Save,
  ShieldCheck,
  Store,
  UserPlus,
  UserRound,
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
import { cn } from "@/lib/utils";

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
      <span className="mb-2 block font-medium text-neutral-800">{label}</span>
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

  const [status, setStatus] = useState<"active" | "inactive">("active");
  const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>([]);
  const [selectedOutletIds, setSelectedOutletIds] = useState<string[]>([]);
  const [primaryOutletId, setPrimaryOutletId] = useState("");

  function updateRole(roleId: string, checked: boolean) {
    setSelectedRoleIds((currentRoleIds) =>
      checked
        ? [...new Set([...currentRoleIds, roleId])]
        : currentRoleIds.filter((id) => id !== roleId),
    );
  }

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

  const primaryOutlet = outlets.find(
    (outlet) => outlet.id === primaryOutletId,
  );

  const setupSummary = [
    {
      label: "Role dipilih",
      value:
        selectedRoleIds.length > 0
          ? `${selectedRoleIds.length} role`
          : "Belum dipilih",
      complete: selectedRoleIds.length > 0,
    },
    {
      label: "Outlet dipilih",
      value:
        selectedOutletIds.length > 0
          ? `${selectedOutletIds.length} outlet`
          : "Belum dipilih",
      complete: selectedOutletIds.length > 0,
    },
    {
      label: "Outlet utama",
      value: primaryOutlet?.name ?? "Belum ditentukan",
      complete: Boolean(primaryOutlet),
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
                <UserRound className="size-5" />
              </div>

              <div className="min-w-0">
                <span className="inline-flex w-fit rounded-full bg-[var(--accent-soft)] px-3 py-1 text-xs font-semibold text-[var(--accent)]">
                  Identitas &amp; login
                </span>
                <h2 className="mt-3 font-semibold text-neutral-950">
                  Identitas Staff
                </h2>
                <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
                  Informasi ini digunakan untuk mengenali staff dan masuk ke
                  sistem ASIHJAYA.
                </p>
              </div>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <label className="block text-sm sm:col-span-2">
                <span className="mb-2 block font-medium text-neutral-800">
                  Nama lengkap
                </span>

                <input
                  name="fullName"
                  required
                  minLength={2}
                  maxLength={160}
                  autoComplete="name"
                  className={inputClassName}
                  placeholder="Contoh: Hanita Prameswari"
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
                  minLength={3}
                  maxLength={80}
                  autoCapitalize="none"
                  autoCorrect="off"
                  autoComplete="username"
                  className={inputClassName}
                  placeholder="hanita.prameswari"
                />

                <p className="mt-1.5 text-xs leading-5 text-[var(--muted)]">
                  Gunakan huruf kecil, angka, titik, garis bawah, atau tanda
                  hubung.
                </p>

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
                  autoCapitalize="none"
                  autoComplete="email"
                  className={inputClassName}
                  placeholder="hanita@asihjaya.local"
                />

                <FieldError message={state.fieldErrors?.email} />
              </label>

              <label className="block text-sm sm:col-span-2">
                <span className="mb-2 block font-medium text-neutral-800">
                  Nomor telepon
                </span>

                <input
                  name="phone"
                  type="tel"
                  maxLength={32}
                  autoComplete="tel"
                  className={inputClassName}
                  placeholder="08xxxxxxxxxx"
                />

                <FieldError message={state.fieldErrors?.phone} />
              </label>
            </div>
          </section>

          <section className="rounded-2xl border border-[var(--border)] bg-white p-4 sm:p-5">
            <div className="flex items-start gap-3">
              <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-[var(--surface-muted)] text-neutral-600">
                <KeyRound className="size-5" />
              </div>

              <div className="min-w-0">
                <span className="inline-flex w-fit rounded-full bg-neutral-100 px-3 py-1 text-xs font-semibold text-neutral-700">
                  Keamanan akun
                </span>
                <h2 className="mt-3 font-semibold text-neutral-950">
                  Kata Sandi Sementara
                </h2>
                <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
                  Buat kata sandi awal yang aman untuk digunakan staff saat login
                  pertama.
                </p>
              </div>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
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

            <div className="mt-4 flex items-start gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3">
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-[var(--accent)]" />
              <p className="text-xs leading-5 text-[var(--muted)]">
                Kata sandi harus terdiri dari 12–128 karakter. Sampaikan hanya
                kepada staff terkait melalui kanal yang aman.
              </p>
            </div>
          </section>

          <section className="rounded-2xl border border-[var(--border)] bg-white p-4 sm:p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex items-start gap-3">
                <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]">
                  <ShieldCheck className="size-5" />
                </div>

                <div className="min-w-0">
                  <span className="inline-flex w-fit rounded-full bg-[var(--accent-soft)] px-3 py-1 text-xs font-semibold text-[var(--accent)]">
                    Hak akses aplikasi
                  </span>
                  <h2 className="mt-3 font-semibold text-neutral-950">
                    Role &amp; Hak Akses
                  </h2>
                  <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
                    Pilih minimal satu role yang memberikan akses Admin atau POS.
                  </p>
                </div>
              </div>

              <span className="inline-flex w-fit shrink-0 rounded-full border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-1.5 text-xs font-semibold text-neutral-700">
                {selectedRoleIds.length} dipilih
              </span>
            </div>

            {roles.length > 0 ? (
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {roles.map((role) => {
                  const checked = selectedRoleIds.includes(role.id);

                  return (
                    <label
                      key={role.id}
                      className={cn(
                        "flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition",
                        checked
                          ? "border-amber-300 bg-amber-50/70"
                          : "border-[var(--border)] bg-white hover:border-amber-200 hover:bg-amber-50/30",
                      )}
                    >
                      <input
                        type="checkbox"
                        name="roleIds"
                        value={role.id}
                        checked={checked}
                        onChange={(event) =>
                          updateRole(role.id, event.target.checked)
                        }
                        className="mt-1 size-4 shrink-0 accent-[var(--accent)]"
                      />

                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-semibold text-neutral-900">
                            {role.name}
                          </span>

                          {checked ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                              <CheckCircle2 className="size-3" />
                              Dipilih
                            </span>
                          ) : null}
                        </span>

                        <span className="mt-1 block text-xs leading-5 text-[var(--muted)]">
                          {role.description ??
                            "Role aktif untuk akses operasional staff."}
                        </span>

                        <span className="mt-3 inline-flex rounded-lg border border-[var(--border)] bg-white px-2 py-1 font-mono text-[11px] text-neutral-500">
                          {role.code}
                        </span>
                      </span>
                    </label>
                  );
                })}
              </div>
            ) : (
              <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-800">
                Role aktif belum tersedia. Buat atau aktifkan role terlebih dahulu
                sebelum menambahkan staff.
              </div>
            )}

            <FieldError message={state.fieldErrors?.roleIds} />
          </section>

          <section className="rounded-2xl border border-[var(--border)] bg-white p-4 sm:p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex items-start gap-3">
                <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]">
                  <Building2 className="size-5" />
                </div>

                <div className="min-w-0">
                  <span className="inline-flex w-fit rounded-full bg-[var(--accent-soft)] px-3 py-1 text-xs font-semibold text-[var(--accent)]">
                    Lingkup operasional
                  </span>
                  <h2 className="mt-3 font-semibold text-neutral-950">
                    Akses Outlet
                  </h2>
                  <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
                    Pilih outlet yang dapat diakses, lalu tentukan satu outlet
                    utama staff.
                  </p>
                </div>
              </div>

              <span className="inline-flex w-fit shrink-0 rounded-full border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-1.5 text-xs font-semibold text-neutral-700">
                {selectedOutletIds.length} dipilih
              </span>
            </div>

            {outlets.length > 0 ? (
              <div className="mt-5 space-y-3">
                {outlets.map((outlet) => {
                  const checked = selectedOutletIds.includes(outlet.id);
                  const isPrimary = primaryOutletId === outlet.id;

                  return (
                    <div
                      key={outlet.id}
                      className={cn(
                        "flex flex-col gap-4 rounded-xl border p-4 transition sm:flex-row sm:items-center",
                        checked
                          ? "border-amber-300 bg-amber-50/60"
                          : "border-[var(--border)] bg-white",
                      )}
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
                          className="size-4 shrink-0 accent-[var(--accent)]"
                        />

                        <span
                          className={cn(
                            "grid size-10 shrink-0 place-items-center rounded-xl",
                            checked
                              ? "bg-white text-amber-700"
                              : "bg-[var(--surface-muted)] text-neutral-500",
                          )}
                        >
                          <Store className="size-4" />
                        </span>

                        <span className="min-w-0">
                          <span className="flex flex-wrap items-center gap-2">
                            <span className="block text-sm font-semibold text-neutral-900">
                              {outlet.name}
                            </span>

                            {isPrimary ? (
                              <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                                Outlet utama
                              </span>
                            ) : null}
                          </span>

                          <span className="mt-1 block text-xs text-[var(--muted)]">
                            Kode outlet · {outlet.code}
                          </span>
                        </span>
                      </label>

                      <label
                        className={cn(
                          "flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-medium transition",
                          checked
                            ? "cursor-pointer border-amber-200 bg-white text-neutral-700"
                            : "cursor-not-allowed border-[var(--border)] bg-neutral-50 text-neutral-400",
                        )}
                      >
                        <input
                          type="radio"
                          name="primaryOutletId"
                          value={outlet.id}
                          checked={isPrimary}
                          disabled={!checked}
                          onChange={() => setPrimaryOutletId(outlet.id)}
                          className="size-4 accent-[var(--accent)]"
                        />
                        Jadikan utama
                      </label>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-800">
                Outlet aktif belum tersedia. Buat atau aktifkan outlet terlebih
                dahulu sebelum menambahkan staff.
              </div>
            )}

            <FieldError message={state.fieldErrors?.outletIds} />
            <FieldError message={state.fieldErrors?.primaryOutletId} />
          </section>
        </div>

        <aside className="min-w-0 space-y-5 xl:sticky xl:top-5">
          <section className="rounded-2xl border border-[var(--border)] bg-white p-4 sm:p-5">
            <div className="flex items-start gap-3">
              <div
                className={cn(
                  "grid size-11 shrink-0 place-items-center rounded-xl",
                  status === "active"
                    ? "bg-emerald-50 text-emerald-700"
                    : "bg-[var(--surface-muted)] text-neutral-600",
                )}
              >
                <CircleDot className="size-5" />
              </div>

              <div className="min-w-0 flex-1">
                <h2 className="font-semibold text-neutral-950">Status Akun</h2>
                <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
                  Tentukan apakah akun langsung dapat digunakan atau disimpan
                  dalam keadaan nonaktif.
                </p>
              </div>
            </div>

            <label className="mt-5 block text-sm">
              <span className="mb-2 block font-medium text-neutral-800">
                Status awal
              </span>

              <select
                name="status"
                value={status}
                onChange={(event) =>
                  setStatus(event.target.value as "active" | "inactive")
                }
                className={inputClassName}
              >
                <option value="active">Aktif</option>
                <option value="inactive">Nonaktif</option>
              </select>

              <FieldError message={state.fieldErrors?.status} />
            </label>

            <div className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3 text-xs leading-5 text-[var(--muted)]">
              {status === "active"
                ? "Akun aktif dapat digunakan untuk login setelah role dan outlet ditetapkan."
                : "Akun nonaktif tetap tersimpan, tetapi belum dapat digunakan untuk login."}
            </div>
          </section>

          <section className="rounded-2xl border border-[var(--border)] bg-white p-4 sm:p-5">
            <div className="flex items-start gap-3">
              <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]">
                <ShieldCheck className="size-5" />
              </div>

              <div className="min-w-0">
                <h2 className="font-semibold text-neutral-950">
                  Ringkasan Setup
                </h2>
                <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
                  Periksa konfigurasi akses sebelum membuat akun staff.
                </p>
              </div>
            </div>

            <div className="mt-5 space-y-3">
              {setupSummary.map((item) => {
                const Icon = item.complete ? CheckCircle2 : CircleDot;

                return (
                  <div
                    key={item.label}
                    className="flex items-start gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] px-3.5 py-3"
                  >
                    <Icon
                      className={cn(
                        "mt-0.5 size-4 shrink-0",
                        item.complete
                          ? "text-emerald-600"
                          : "text-neutral-400",
                      )}
                    />

                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-[var(--muted)]">{item.label}</p>
                      <p className="mt-0.5 truncate text-sm font-semibold text-neutral-900">
                        {item.value}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] p-4">
            <div className="flex items-start gap-3">
              <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-white text-[var(--accent)]">
                <UserPlus className="size-5" />
              </div>

              <div className="min-w-0">
                <p className="text-sm font-semibold text-neutral-950">
                  Buat akun staff
                </p>
                <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
                  Setelah berhasil dibuat, Anda akan diarahkan ke halaman detail
                  staff untuk pemeriksaan akhir.
                </p>
              </div>
            </div>

            <FormSubmitButton
              pendingText="Membuat staff..."
              className="mt-4 w-full"
            >
              <UserPlus className="size-4" />
              Buat Staff
            </FormSubmitButton>
          </section>
        </aside>
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
