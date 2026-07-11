"use client";

import {
  AlertTriangle,
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
  const [status, setStatus] = useState(staff.status);

  const statusOptions: Array<{
    value: StaffData["status"];
    label: string;
    description: string;
    selectedClassName: string;
    iconClassName: string;
  }> = [
    {
      value: "active",
      label: "Aktif",
      description: "Akun dapat digunakan untuk login dan operasional.",
      selectedClassName: "border-emerald-300 bg-emerald-50",
      iconClassName: "text-emerald-600",
    },
    {
      value: "inactive",
      label: "Nonaktif",
      description: "Akun tersimpan, tetapi akses login dinonaktifkan.",
      selectedClassName: "border-neutral-300 bg-neutral-100",
      iconClassName: "text-neutral-500",
    },
    {
      value: "suspended",
      label: "Ditangguhkan",
      description: "Akses dihentikan sementara dan perlu ditinjau kembali.",
      selectedClassName: "border-red-300 bg-red-50",
      iconClassName: "text-red-600",
    },
  ];

  const selectedStatus = statusOptions.find((option) => option.value === status);

  return (
    <form action={formAction} className="space-y-5">
      <ActionMessage state={state} />

      <section className="rounded-2xl border border-[var(--border)] bg-white p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]">
            <UserRound className="size-5" />
          </div>

          <div className="min-w-0">
            <span className="inline-flex w-fit rounded-full bg-[var(--accent-soft)] px-3 py-1 text-xs font-semibold text-[var(--accent)]">
              Profil &amp; login
            </span>
            <h2 className="mt-3 font-semibold text-neutral-950">
              Identitas Staff
            </h2>
            <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
              Perbarui informasi yang digunakan untuk mengenali staff dan masuk
              ke sistem.
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
              defaultValue={staff.fullName}
              required
              minLength={2}
              maxLength={160}
              autoComplete="name"
              className={inputClassName}
            />

            <FieldError message={state.fieldErrors?.fullName} />
          </label>

          <label className="block text-sm">
            <span className="mb-2 block font-medium text-neutral-800">
              Username
            </span>

            <input
              name="username"
              defaultValue={staff.username}
              required
              minLength={3}
              maxLength={80}
              autoCapitalize="none"
              autoCorrect="off"
              autoComplete="username"
              className={inputClassName}
            />

            <p className="mt-1.5 text-xs leading-5 text-[var(--muted)]">
              Gunakan huruf kecil, angka, titik, garis bawah, atau tanda hubung.
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
              defaultValue={staff.email}
              required
              maxLength={254}
              autoCapitalize="none"
              autoCorrect="off"
              autoComplete="email"
              className={inputClassName}
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
              defaultValue={staff.phone ?? ""}
              maxLength={32}
              autoComplete="tel"
              inputMode="tel"
              className={inputClassName}
              placeholder="Contoh: 0812 3456 7890"
            />

            <FieldError message={state.fieldErrors?.phone} />
          </label>
        </div>
      </section>

      <section className="rounded-2xl border border-[var(--border)] bg-white p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <div
            className={cn(
              "grid size-11 shrink-0 place-items-center rounded-xl",
              status === "active"
                ? "bg-emerald-50 text-emerald-700"
                : status === "suspended"
                  ? "bg-red-50 text-red-700"
                  : "bg-[var(--surface-muted)] text-neutral-600",
            )}
          >
            <CircleDot className="size-5" />
          </div>

          <div className="min-w-0 flex-1">
            <h2 className="font-semibold text-neutral-950">
              Status Operasional
            </h2>
            <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
              Status menentukan apakah akun dapat digunakan untuk login.
            </p>
          </div>
        </div>

        {isCurrentUser ? (
          <input type="hidden" name="status" value={staff.status} />
        ) : null}

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          {statusOptions.map((option) => {
            const checked = status === option.value;

            return (
              <label
                key={option.value}
                className={cn(
                  "flex min-w-0 items-start gap-3 rounded-xl border p-3 transition",
                  isCurrentUser
                    ? "cursor-not-allowed opacity-65"
                    : "cursor-pointer hover:border-[var(--accent)]",
                  checked
                    ? option.selectedClassName
                    : "border-[var(--border)] bg-white",
                )}
              >
                <input
                  type="radio"
                  name={isCurrentUser ? undefined : "status"}
                  value={option.value}
                  checked={checked}
                  disabled={isCurrentUser}
                  onChange={() => setStatus(option.value)}
                  className="mt-0.5 size-4 shrink-0 accent-[var(--accent)]"
                />

                <span className="min-w-0">
                  <span className="flex items-center gap-2">
                    <CircleDot
                      className={cn(
                        "size-3.5 shrink-0",
                        checked ? option.iconClassName : "text-neutral-400",
                      )}
                    />
                    <span className="text-sm font-semibold text-neutral-900">
                      {option.label}
                    </span>
                  </span>

                  <span className="mt-1 block text-xs leading-5 text-[var(--muted)]">
                    {option.description}
                  </span>
                </span>
              </label>
            );
          })}
        </div>

        <FieldError message={state.fieldErrors?.status} />

        <div
          className={cn(
            "mt-4 rounded-xl border px-4 py-3 text-xs leading-5",
            status === "active"
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : status === "suspended"
                ? "border-red-200 bg-red-50 text-red-700"
                : "border-[var(--border)] bg-[var(--surface-muted)] text-[var(--muted)]",
          )}
        >
          {selectedStatus?.description}
          {status !== "active"
            ? " Seluruh session aktif staff akan dicabut setelah perubahan disimpan."
            : null}
        </div>

        {isCurrentUser ? (
          <div className="mt-4 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-800">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <p className="text-xs leading-5">
              Anda sedang mengedit akun sendiri. Status akun dikunci untuk
              mencegah kehilangan akses administrasi.
            </p>
          </div>
        ) : null}

        <div className="mt-5 flex flex-col gap-3 border-t border-[var(--border)] pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs leading-5 text-[var(--muted)]">
            Perubahan nama, username, email, telepon, dan status disimpan
            bersamaan.
          </p>

          <FormSubmitButton pendingText="Menyimpan profil...">
            <Save className="size-4" />
            Simpan Profil
          </FormSubmitButton>
        </div>
      </section>
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
  const [selectedRoleIds, setSelectedRoleIds] = useState(
    staff.roles.map((role) => role.id),
  );
  const [selectedOutletIds, setSelectedOutletIds] = useState(
    staff.outlets.map((outlet) => outlet.id),
  );
  const [primaryOutletId, setPrimaryOutletId] = useState(
    staff.outlets.find((outlet) => outlet.isPrimary)?.id ??
      staff.outlets[0]?.id ??
      "",
  );

  function updateRole(roleId: string, checked: boolean) {
    setSelectedRoleIds((currentRoleIds) =>
      checked
        ? [...new Set([...currentRoleIds, roleId])]
        : currentRoleIds.filter((id) => id !== roleId),
    );
  }

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

  const primaryOutlet = outlets.find(
    (outlet) => outlet.id === primaryOutletId,
  );

  if (isCurrentUser) {
    return (
      <section className="rounded-2xl border border-[var(--border)] bg-white p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-amber-50 text-amber-700">
            <ShieldCheck className="size-5" />
          </div>

          <div className="min-w-0 flex-1">
            <h2 className="font-semibold text-neutral-950">
              Role &amp; Akses Outlet
            </h2>
            <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
              Konfigurasi akses akun Anda ditampilkan sebagai informasi saja.
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] p-4">
            <p className="text-xs font-medium text-[var(--muted)]">
              Role tersimpan
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {staff.roles.length > 0 ? (
                staff.roles.map((role) => (
                  <span
                    key={role.id}
                    className="rounded-full border border-[var(--border)] bg-white px-2.5 py-1 text-xs font-semibold text-neutral-700"
                  >
                    {role.name}
                  </span>
                ))
              ) : (
                <span className="text-xs text-[var(--muted)]">
                  Belum memiliki role
                </span>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] p-4">
            <p className="text-xs font-medium text-[var(--muted)]">
              Outlet tersimpan
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {staff.outlets.length > 0 ? (
                staff.outlets.map((outlet) => (
                  <span
                    key={outlet.id}
                    className="rounded-full border border-[var(--border)] bg-white px-2.5 py-1 text-xs font-semibold text-neutral-700"
                  >
                    {outlet.name}
                    {outlet.isPrimary ? " · Utama" : ""}
                  </span>
                ))
              ) : (
                <span className="text-xs text-[var(--muted)]">
                  Belum memiliki outlet
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="mt-4 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-800">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <p className="text-xs leading-5">
            Akses akun sendiri tidak dapat diubah dari halaman ini untuk
            mencegah kehilangan akses administrasi.
          </p>
        </div>
      </section>
    );
  }

  const accessSummary = [
    {
      label: "Role",
      value:
        selectedRoleIds.length > 0
          ? `${selectedRoleIds.length} dipilih`
          : "Belum dipilih",
      complete: selectedRoleIds.length > 0,
    },
    {
      label: "Outlet",
      value:
        selectedOutletIds.length > 0
          ? `${selectedOutletIds.length} dipilih`
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

      <section className="rounded-2xl border border-[var(--border)] bg-white p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]">
              <ShieldCheck className="size-5" />
            </div>

            <div className="min-w-0">
              <span className="inline-flex w-fit rounded-full bg-[var(--accent-soft)] px-3 py-1 text-xs font-semibold text-[var(--accent)]">
                Hak akses
              </span>
              <h2 className="mt-3 font-semibold text-neutral-950">
                Role Staff
              </h2>
              <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
                Pilih role yang memberikan akses Admin atau POS sesuai tanggung
                jawab staff.
              </p>
            </div>
          </div>

          <span className="inline-flex w-fit rounded-full border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-1 text-xs font-semibold text-neutral-700">
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
                    "flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 transition",
                    checked
                      ? "border-[var(--accent)] bg-[var(--accent-soft)]"
                      : "border-[var(--border)] bg-white hover:border-neutral-300",
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
                      <span className="rounded-full border border-[var(--border)] bg-white px-2 py-0.5 text-[11px] font-medium text-[var(--muted)]">
                        {role.code}
                      </span>
                    </span>

                    <span className="mt-1.5 block text-xs leading-5 text-[var(--muted)]">
                      {role.description ??
                        "Role ini belum memiliki deskripsi tambahan."}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
        ) : (
          <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-800">
            Role aktif belum tersedia. Buat atau aktifkan role terlebih dahulu.
          </div>
        )}

        <FieldError message={state.fieldErrors?.roleIds} />
      </section>

      <section className="rounded-2xl border border-[var(--border)] bg-white p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-amber-50 text-amber-700">
              <Building2 className="size-5" />
            </div>

            <div className="min-w-0">
              <span className="inline-flex w-fit rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
                Area operasional
              </span>
              <h2 className="mt-3 font-semibold text-neutral-950">
                Akses Outlet
              </h2>
              <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
                Tentukan outlet yang dapat digunakan dan pilih satu outlet utama.
              </p>
            </div>
          </div>

          <span className="inline-flex w-fit rounded-full border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-1 text-xs font-semibold text-neutral-700">
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
                    "flex flex-col gap-3 rounded-xl border p-3.5 transition sm:flex-row sm:items-center",
                    checked
                      ? "border-amber-300 bg-amber-50"
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
            Outlet aktif belum tersedia. Buat atau aktifkan outlet terlebih dahulu.
          </div>
        )}

        <FieldError message={state.fieldErrors?.outletIds} />
        <FieldError message={state.fieldErrors?.primaryOutletId} />
      </section>

      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] p-4">
        <div className="flex items-start gap-3">
          <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-white text-[var(--accent)]">
            <ShieldCheck className="size-5" />
          </div>

          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-neutral-950">
              Simpan konfigurasi akses
            </p>
            <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
              Perubahan role atau outlet akan mencabut seluruh session aktif
              staff agar hak akses terbaru langsung diterapkan.
            </p>
          </div>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          {accessSummary.map((item) => (
            <div
              key={item.label}
              className="rounded-xl border border-[var(--border)] bg-white px-3 py-2.5"
            >
              <p className="text-[11px] text-[var(--muted)]">{item.label}</p>
              <div className="mt-1 flex items-center gap-1.5">
                {item.complete ? (
                  <CheckCircle2 className="size-3.5 shrink-0 text-emerald-600" />
                ) : (
                  <CircleDot className="size-3.5 shrink-0 text-neutral-400" />
                )}
                <p className="truncate text-xs font-semibold text-neutral-800">
                  {item.value}
                </p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 flex flex-col gap-3 border-t border-[var(--border)] pt-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-2 text-xs leading-5 text-amber-800">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            Staff perlu login ulang setelah akses disimpan.
          </div>

          <FormSubmitButton pendingText="Menyimpan akses...">
            <ShieldCheck className="size-4" />
            Simpan Akses
          </FormSubmitButton>
        </div>
      </section>
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

  if (isCurrentUser) {
    return (
      <section className="rounded-2xl border border-[var(--border)] bg-white p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-amber-50 text-amber-700">
            <KeyRound className="size-5" />
          </div>

          <div className="min-w-0">
            <h2 className="font-semibold text-neutral-950">
              Keamanan Akun
            </h2>
            <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
              Kata sandi akun yang sedang digunakan tidak dapat direset dari
              halaman pengelolaan staff.
            </p>
          </div>
        </div>

        <div className="mt-4 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-800">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <p className="text-xs leading-5">
            Perubahan kata sandi akun sendiri akan tersedia melalui menu
            Keamanan Akun.
          </p>
        </div>
      </section>
    );
  }

  return (
    <form
      action={formAction}
      className="rounded-2xl border border-[var(--border)] bg-white p-4 sm:p-5"
    >
      <div className="flex items-start gap-3">
        <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]">
          <KeyRound className="size-5" />
        </div>

        <div className="min-w-0">
          <h2 className="font-semibold text-neutral-950">
            Reset Kata Sandi
          </h2>
          <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
            Buat kata sandi sementara baru saat staff tidak dapat mengakses akun.
          </p>
        </div>
      </div>

      <div className="mt-4">
        <ActionMessage state={state} />
      </div>

      <div className="mt-5 space-y-4">
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

      <div className="mt-4 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-800">
        <AlertTriangle className="mt-0.5 size-4 shrink-0" />
        <p className="text-xs leading-5">
          Seluruh session aktif staff akan dicabut. Staff perlu login kembali
          menggunakan kata sandi baru.
        </p>
      </div>

      <FormSubmitButton
        pendingText="Mereset kata sandi..."
        className="mt-4 w-full"
      >
        <KeyRound className="size-4" />
        Reset Kata Sandi
      </FormSubmitButton>
    </form>
  );
}
