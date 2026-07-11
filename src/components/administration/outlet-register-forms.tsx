"use client";

import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  CircleOff,
  ContactRound,
  Cpu,
  MapPin,
  MapPinned,
  MonitorSmartphone,
  Phone,
  Save,
  Store,
} from "lucide-react";
import { useActionState, useState } from "react";

import {
  createOutletAction,
  createRegisterAction,
  updateOutletAction,
  updateRegisterAction,
} from "@/app/actions/outlets-registers";
import { FormSubmitButton } from "@/components/forms/form-submit-button";
import {
  initialOperationsActionState,
  type OperationsActionState,
} from "@/features/administration/outlet-register-contracts";

const inputClassName =
  "h-11 w-full rounded-xl border border-[var(--border)] bg-white px-3 text-sm text-neutral-950 outline-none transition placeholder:text-neutral-400 focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent-soft)]";

type OutletData = {
  id: string;
  code: string;
  name: string;
  address: string | null;
  phone: string | null;
  googleMapsEmbedUrl: string | null;
  isActive: boolean;
};

type RegisterData = {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
  isHardwareHub: boolean;
  outletId: string;
  outletCode: string;
  outletName: string;
};

type OutletOption = {
  id: string;
  code: string;
  name: string;

  hardwareHub: {
    id: string;
    code: string;
    name: string;
  } | null;
};

function ActionMessage({ state }: { state: OperationsActionState }) {
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


function getSafeGoogleMapsEmbedUrl(value: string) {
  const normalizedValue = value.trim();

  if (!normalizedValue) {
    return null;
  }

  try {
    const url = new URL(normalizedValue);

    if (
      url.protocol === "https:" &&
      url.hostname === "www.google.com" &&
      url.pathname === "/maps/embed"
    ) {
      return normalizedValue;
    }
  } catch {
    return null;
  }

  return null;
}

export function CreateOutletForm() {
  const [state, formAction] = useActionState(
    createOutletAction,
    initialOperationsActionState,
  );
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [googleMapsEmbedUrl, setGoogleMapsEmbedUrl] = useState("");
  const [isActive, setIsActive] = useState(true);

  const safeGoogleMapsEmbedUrl = getSafeGoogleMapsEmbedUrl(
    googleMapsEmbedUrl,
  );
  const hasMapsValue = googleMapsEmbedUrl.trim().length > 0;
  const hasInvalidMapsUrl = hasMapsValue && !safeGoogleMapsEmbedUrl;
  const completedFieldCount = [
    code.trim().length >= 2,
    name.trim().length >= 2,
    phone.trim().length > 0,
    address.trim().length > 0,
    Boolean(safeGoogleMapsEmbedUrl),
  ].filter(Boolean).length;

  return (
    <form action={formAction} className="space-y-5">
      <ActionMessage state={state} />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px] xl:items-start">
        <div className="min-w-0 space-y-5">
          <section className="rounded-2xl border border-[var(--border)] bg-white p-4 sm:p-5">
            <div className="flex items-start gap-3">
              <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]">
                <Building2 className="size-5" />
              </div>

              <div className="min-w-0">
                <span className="inline-flex w-fit rounded-full bg-[var(--accent-soft)] px-3 py-1 text-xs font-semibold text-[var(--accent)]">
                  Identitas lokasi
                </span>

                <h2 className="mt-3 font-semibold text-neutral-950">
                  Identitas Outlet
                </h2>

                <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
                  Nama digunakan pada tampilan operasional, sedangkan kode menjadi
                  identitas internal permanen untuk outlet ini.
                </p>
              </div>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <label className="block text-sm">
                <span className="mb-2 block font-medium text-neutral-800">
                  Kode outlet
                </span>

                <input
                  name="code"
                  value={code}
                  onChange={(event) => setCode(event.target.value.toUpperCase())}
                  required
                  minLength={2}
                  maxLength={24}
                  autoCapitalize="characters"
                  autoCorrect="off"
                  spellCheck={false}
                  className={`${inputClassName} font-mono uppercase`}
                  placeholder="Contoh: BG"
                />

                <p className="mt-1.5 text-xs leading-5 text-[var(--muted)]">
                  Gunakan 2–24 karakter: huruf kapital, angka, garis bawah, atau
                  tanda hubung. Kode tidak dapat diubah setelah dibuat.
                </p>

                <FieldError message={state.fieldErrors?.code} />
              </label>

              <label className="block text-sm">
                <span className="mb-2 block font-medium text-neutral-800">
                  Nama outlet
                </span>

                <input
                  name="name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  required
                  minLength={2}
                  maxLength={160}
                  autoComplete="organization"
                  className={inputClassName}
                  placeholder="Outlet Bantar Gebang"
                />

                <p className="mt-1.5 text-xs leading-5 text-[var(--muted)]">
                  Gunakan nama yang mudah dikenali oleh staff pada POS dan halaman
                  administrasi.
                </p>

                <FieldError message={state.fieldErrors?.name} />
              </label>
            </div>
          </section>

          <section className="rounded-2xl border border-[var(--border)] bg-white p-4 sm:p-5">
            <div className="flex items-start gap-3">
              <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-[var(--surface-muted)] text-neutral-600">
                <ContactRound className="size-5" />
              </div>

              <div className="min-w-0">
                <h2 className="font-semibold text-neutral-950">
                  Kontak &amp; Alamat
                </h2>

                <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
                  Informasi ini membantu staff, pelanggan, dan tim operasional
                  mengenali serta menghubungi lokasi outlet.
                </p>
              </div>
            </div>

            <div className="mt-5 grid gap-4">
              <label className="block text-sm">
                <span className="mb-2 block font-medium text-neutral-800">
                  Nomor telepon
                </span>

                <div className="relative">
                  <Phone className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />

                  <input
                    name="phone"
                    type="tel"
                    inputMode="tel"
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                    maxLength={32}
                    autoComplete="tel"
                    className={`${inputClassName} pl-9`}
                    placeholder="08xxxxxxxxxx"
                  />
                </div>

                <p className="mt-1.5 text-xs leading-5 text-[var(--muted)]">
                  Opsional. Nomor ini tampil sebagai kontak utama outlet.
                </p>

                <FieldError message={state.fieldErrors?.phone} />
              </label>

              <label className="block text-sm">
                <span className="mb-2 flex items-center justify-between gap-3 font-medium text-neutral-800">
                  <span>Alamat lengkap</span>
                  <span className="text-xs font-normal text-[var(--muted)]">
                    {address.length}/2000
                  </span>
                </span>

                <textarea
                  name="address"
                  rows={5}
                  maxLength={2000}
                  value={address}
                  onChange={(event) => setAddress(event.target.value)}
                  autoComplete="street-address"
                  className="w-full resize-y rounded-xl border border-[var(--border)] bg-white px-3 py-3 text-sm text-neutral-950 outline-none transition placeholder:text-neutral-400 focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent-soft)]"
                  placeholder="Nama jalan, nomor bangunan, kelurahan, kecamatan, kota, dan kode pos"
                />

                <p className="mt-1.5 text-xs leading-5 text-[var(--muted)]">
                  Alamat akan tampil di daftar outlet dan membantu verifikasi lokasi
                  operasional.
                </p>

                <FieldError message={state.fieldErrors?.address} />
              </label>
            </div>
          </section>

          <section className="rounded-2xl border border-[var(--border)] bg-white p-4 sm:p-5">
            <div className="flex items-start gap-3">
              <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]">
                <MapPinned className="size-5" />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h2 className="font-semibold text-neutral-950">
                      Lokasi Google Maps
                    </h2>

                    <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
                      Tambahkan URL embed untuk menampilkan preview lokasi outlet.
                    </p>
                  </div>

                  <span
                    className={
                      safeGoogleMapsEmbedUrl
                        ? "inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700"
                        : hasInvalidMapsUrl
                          ? "inline-flex rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-semibold text-red-700"
                          : "inline-flex rounded-full border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-1 text-xs font-semibold text-neutral-600"
                    }
                  >
                    {safeGoogleMapsEmbedUrl
                      ? "URL valid"
                      : hasInvalidMapsUrl
                        ? "URL belum valid"
                        : "Belum diatur"}
                  </span>
                </div>
              </div>
            </div>

            <label className="mt-5 block text-sm">
              <span className="mb-2 block font-medium text-neutral-800">
                Google Maps Embed URL
              </span>

              <div className="relative">
                <MapPin className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />

                <input
                  name="googleMapsEmbedUrl"
                  type="url"
                  inputMode="url"
                  value={googleMapsEmbedUrl}
                  onChange={(event) =>
                    setGoogleMapsEmbedUrl(event.target.value)
                  }
                  autoComplete="url"
                  className={`${inputClassName} pl-9`}
                  placeholder="https://www.google.com/maps/embed?..."
                />
              </div>

              <p className="mt-2 text-xs leading-5 text-[var(--muted)]">
                Buka Google Maps, pilih lokasi, klik Share, pilih Embed a map,
                kemudian salin nilai URL dari atribut iframe src.
              </p>

              <FieldError message={state.fieldErrors?.googleMapsEmbedUrl} />
            </label>

            <div className="mt-4 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)]">
              {safeGoogleMapsEmbedUrl ? (
                <iframe
                  src={safeGoogleMapsEmbedUrl}
                  title={`Preview lokasi ${name.trim() || "outlet baru"}`}
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  className="h-64 w-full border-0"
                  allowFullScreen
                />
              ) : (
                <div className="flex min-h-64 flex-col items-center justify-center px-5 py-8 text-center">
                  <div className="grid size-12 place-items-center rounded-2xl border border-[var(--border)] bg-white text-neutral-400">
                    <MapPinned className="size-5" />
                  </div>

                  <p className="mt-3 text-sm font-semibold text-neutral-900">
                    {hasInvalidMapsUrl
                      ? "URL Maps belum dapat dipreview"
                      : "Preview lokasi belum tersedia"}
                  </p>

                  <p className="mt-1 max-w-sm text-xs leading-5 text-[var(--muted)]">
                    {hasInvalidMapsUrl
                      ? "Gunakan URL HTTPS dari www.google.com dengan path /maps/embed."
                      : "Masukkan Google Maps Embed URL untuk memeriksa titik lokasi sebelum outlet disimpan."}
                  </p>
                </div>
              )}
            </div>
          </section>
        </div>

        <aside className="min-w-0 space-y-5 xl:sticky xl:top-5">
          <section className="rounded-2xl border border-[var(--border)] bg-white p-4 sm:p-5">
            <div className="flex items-start gap-3">
              <div
                className={`grid size-11 shrink-0 place-items-center rounded-xl ${
                  isActive
                    ? "bg-emerald-50 text-emerald-700"
                    : "bg-neutral-100 text-neutral-500"
                }`}
              >
                {isActive ? (
                  <CheckCircle2 className="size-5" />
                ) : (
                  <CircleOff className="size-5" />
                )}
              </div>

              <div className="min-w-0 flex-1">
                <h2 className="font-semibold text-neutral-950">
                  Status Operasional
                </h2>

                <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
                  Tentukan apakah outlet langsung tersedia untuk konfigurasi
                  operasional setelah dibuat.
                </p>
              </div>
            </div>

            <label
              className={`mt-5 flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition ${
                isActive
                  ? "border-emerald-200 bg-emerald-50"
                  : "border-[var(--border)] bg-[var(--surface-muted)]"
              }`}
            >
              <input
                type="checkbox"
                name="isActive"
                checked={isActive}
                onChange={(event) => setIsActive(event.target.checked)}
                className="mt-0.5 size-4 accent-[var(--accent)]"
              />

              <span className="min-w-0">
                <span className="block text-sm font-semibold text-neutral-900">
                  {isActive ? "Outlet aktif" : "Outlet nonaktif"}
                </span>

                <span className="mt-1 block text-xs leading-5 text-[var(--muted)]">
                  {isActive
                    ? "Outlet dapat menerima register, staff, inventaris, shift, dan transaksi baru."
                    : "Data outlet tetap tersimpan, tetapi tidak dapat digunakan untuk operasional baru."}
                </span>
              </span>
            </label>

            <FieldError message={state.fieldErrors?.isActive} />
          </section>

          <section className="rounded-2xl border border-[var(--border)] bg-white p-4 sm:p-5">
            <div className="flex items-start gap-3">
              <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]">
                <Store className="size-5" />
              </div>

              <div className="min-w-0">
                <h2 className="font-semibold text-neutral-950">
                  Ringkasan Setup
                </h2>

                <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
                  Periksa data utama sebelum outlet disimpan.
                </p>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] p-3">
                <p className="text-xs text-[var(--muted)]">Kelengkapan</p>
                <p className="mt-1 text-lg font-semibold text-neutral-950">
                  {completedFieldCount}/5
                </p>
              </div>

              <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] p-3">
                <p className="text-xs text-[var(--muted)]">Status</p>
                <p className="mt-1 text-sm font-semibold text-neutral-950">
                  {isActive ? "Aktif" : "Nonaktif"}
                </p>
              </div>
            </div>

            <div className="mt-4 space-y-3">
              <div className="flex items-start justify-between gap-3 border-b border-[var(--border)] pb-3">
                <span className="text-xs text-[var(--muted)]">Kode outlet</span>
                <span className="max-w-[58%] break-words text-right font-mono text-xs font-semibold text-neutral-900">
                  {code.trim() || "Belum diisi"}
                </span>
              </div>

              <div className="flex items-start justify-between gap-3 border-b border-[var(--border)] pb-3">
                <span className="text-xs text-[var(--muted)]">Nama outlet</span>
                <span className="max-w-[58%] break-words text-right text-xs font-semibold text-neutral-900">
                  {name.trim() || "Belum diisi"}
                </span>
              </div>

              <div className="flex items-start justify-between gap-3 border-b border-[var(--border)] pb-3">
                <span className="text-xs text-[var(--muted)]">Kontak</span>
                <span className="text-right text-xs font-semibold text-neutral-900">
                  {phone.trim() ? "Tersedia" : "Belum diisi"}
                </span>
              </div>

              <div className="flex items-start justify-between gap-3 border-b border-[var(--border)] pb-3">
                <span className="text-xs text-[var(--muted)]">Alamat</span>
                <span className="text-right text-xs font-semibold text-neutral-900">
                  {address.trim() ? "Tersedia" : "Belum diisi"}
                </span>
              </div>

              <div className="flex items-start justify-between gap-3">
                <span className="text-xs text-[var(--muted)]">Google Maps</span>
                <span
                  className={`text-right text-xs font-semibold ${
                    safeGoogleMapsEmbedUrl
                      ? "text-emerald-700"
                      : hasInvalidMapsUrl
                        ? "text-red-700"
                        : "text-neutral-900"
                  }`}
                >
                  {safeGoogleMapsEmbedUrl
                    ? "Siap ditampilkan"
                    : hasInvalidMapsUrl
                      ? "Perlu diperbaiki"
                      : "Belum diatur"}
                </span>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] p-4">
            <p className="text-sm font-semibold text-neutral-950">
              Simpan outlet baru
            </p>

            <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
              Setelah outlet dibuat, lanjutkan ke detail outlet untuk menambahkan
              register dan menentukan perangkat hardware hub.
            </p>

            <div className="mt-4 rounded-xl border border-[var(--border)] bg-white px-3.5 py-3 text-xs leading-5 text-[var(--muted)]">
              Register, staff, inventaris, dan shift belum dibuat pada tahap ini.
            </div>

            <FormSubmitButton
              pendingText="Membuat outlet..."
              className="mt-4 w-full"
            >
              <Building2 className="size-4" />
              Buat Outlet
            </FormSubmitButton>
          </section>
        </aside>
      </div>
    </form>
  );
}

type OutletFormProps =
  | {
      mode: "create";
    }
  | {
      mode: "edit";
      outlet: OutletData;
    };

export function OutletForm(props: OutletFormProps) {
  const action =
    props.mode === "create"
      ? createOutletAction
      : updateOutletAction.bind(null, props.outlet.id);

  const [state, formAction] = useActionState(
    action,
    initialOperationsActionState,
  );

  return (
    <form action={formAction} className="space-y-6">
      <ActionMessage state={state} />

      <section className="rounded-2xl border border-[var(--border)] bg-white p-5">
        <div className="flex items-start gap-3">
          <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]">
            <Building2 className="size-5" />
          </div>

          <div>
            <h2 className="font-semibold text-neutral-950">Informasi Outlet</h2>

            <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
              Kode outlet digunakan sebagai identitas internal dan tidak dapat
              diubah setelah dibuat.
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="mb-2 block font-medium text-neutral-800">
              Kode outlet
            </span>

            {props.mode === "create" ? (
              <input
                name="code"
                required
                minLength={2}
                maxLength={24}
                autoCapitalize="characters"
                autoCorrect="off"
                className={inputClassName}
                placeholder="Contoh: BG"
              />
            ) : (
              <input
                value={props.outlet.code}
                readOnly
                className={`${inputClassName} cursor-not-allowed bg-neutral-50 font-mono text-neutral-500`}
              />
            )}

            <FieldError message={state.fieldErrors?.code} />
          </label>

          <label className="block text-sm">
            <span className="mb-2 block font-medium text-neutral-800">
              Nama outlet
            </span>

            <input
              name="name"
              required
              minLength={2}
              maxLength={160}
              defaultValue={props.mode === "edit" ? props.outlet.name : ""}
              className={inputClassName}
              placeholder="Outlet Bantar Gebang"
            />

            <FieldError message={state.fieldErrors?.name} />
          </label>

          <label className="block text-sm">
            <span className="mb-2 block font-medium text-neutral-800">
              Nomor telepon
            </span>

            <input
              name="phone"
              maxLength={32}
              defaultValue={
                props.mode === "edit" ? (props.outlet.phone ?? "") : ""
              }
              className={inputClassName}
              placeholder="08xxxxxxxxxx"
            />

            <FieldError message={state.fieldErrors?.phone} />
          </label>

          <label className="block text-sm sm:col-span-2">
            <span className="mb-2 block font-medium text-neutral-800">
              Google Maps Embed URL
            </span>

            <div className="relative">
              <MapPinned className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />

              <input
                name="googleMapsEmbedUrl"
                type="url"
                inputMode="url"
                defaultValue={
                  props.mode === "edit"
                    ? (props.outlet.googleMapsEmbedUrl ?? "")
                    : ""
                }
                className={`${inputClassName} pl-9`}
                placeholder="https://www.google.com/maps/embed?..."
              />
            </div>

            <p className="mt-2 text-xs leading-5 text-[var(--muted)]">
              Buka Google Maps, pilih lokasi outlet, klik Share, pilih Embed a map, lalu salin nilai URL dari atribut iframe src.
            </p>

            <FieldError message={state.fieldErrors?.googleMapsEmbedUrl} />
          </label>

          <label className="block text-sm sm:col-span-2">
            <span className="mb-2 block font-medium text-neutral-800">
              Alamat
            </span>

            <textarea
              name="address"
              rows={4}
              maxLength={2000}
              defaultValue={
                props.mode === "edit" ? (props.outlet.address ?? "") : ""
              }
              className="w-full resize-y rounded-xl border border-[var(--border)] bg-white px-3 py-3 text-sm text-neutral-950 outline-none transition placeholder:text-neutral-400 focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent-soft)]"
              placeholder="Alamat lengkap outlet"
            />

            <FieldError message={state.fieldErrors?.address} />
          </label>
        </div>

        <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-xl border border-[var(--border)] p-4">
          <input
            type="checkbox"
            name="isActive"
            defaultChecked={
              props.mode === "edit" ? props.outlet.isActive : true
            }
            className="mt-0.5 size-4 accent-[var(--accent)]"
          />

          <span>
            <span className="block text-sm font-medium text-neutral-900">
              Outlet aktif
            </span>

            <span className="mt-1 block text-xs leading-5 text-[var(--muted)]">
              Outlet nonaktif tidak dapat digunakan untuk register, shift, atau
              transaksi baru.
            </span>
          </span>
        </label>

        <FieldError message={state.fieldErrors?.isActive} />
      </section>

      <div className="flex justify-end">
        <FormSubmitButton
          pendingText={
            props.mode === "create"
              ? "Membuat outlet..."
              : "Menyimpan outlet..."
          }
        >
          {props.mode === "create" ? (
            <Building2 className="size-4" />
          ) : (
            <Save className="size-4" />
          )}

          {props.mode === "create" ? "Buat Outlet" : "Simpan Perubahan"}
        </FormSubmitButton>
      </div>
    </form>
  );
}

type RegisterFormProps =
  | {
      mode: "create";
      outlets: OutletOption[];
      defaultOutletId?: string;
    }
  | {
      mode: "edit";
      outlets: OutletOption[];
      register: RegisterData;
    };

export function RegisterForm(props: RegisterFormProps) {
  const initialOutletId =
    props.mode === "edit"
      ? props.register.outletId
      : (props.defaultOutletId ?? props.outlets[0]?.id ?? "");

  const initialIsActive =
    props.mode === "edit" ? props.register.isActive : true;

  const initialIsHardwareHub =
    props.mode === "edit" ? props.register.isHardwareHub : false;

  const [selectedOutletId, setSelectedOutletId] = useState(initialOutletId);

  const [isActive, setIsActive] = useState(initialIsActive);

  const [isHardwareHub, setIsHardwareHub] = useState(initialIsHardwareHub);

  const action =
    props.mode === "create"
      ? createRegisterAction
      : updateRegisterAction.bind(null, props.register.id);

  const [state, formAction] = useActionState(
    action,
    initialOperationsActionState,
  );

  const selectedOutlet = props.outlets.find(
    (outlet) => outlet.id === selectedOutletId,
  );

  const replacingHub =
    isHardwareHub &&
    selectedOutlet?.hardwareHub &&
    (props.mode === "create" ||
      selectedOutlet.hardwareHub.id !== props.register.id)
      ? selectedOutlet.hardwareHub
      : null;

  function updateActive(checked: boolean) {
    setIsActive(checked);

    if (!checked) {
      setIsHardwareHub(false);
    }
  }

  return (
    <form action={formAction} className="space-y-6">
      <ActionMessage state={state} />

      <section className="rounded-2xl border border-[var(--border)] bg-white p-5">
        <div className="flex items-start gap-3">
          <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]">
            <MonitorSmartphone className="size-5" />
          </div>

          <div>
            <h2 className="font-semibold text-neutral-950">
              Informasi Register
            </h2>

            <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
              Register mewakili perangkat atau terminal kasir pada outlet.
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="mb-2 block font-medium text-neutral-800">
              Outlet
            </span>

            {props.mode === "create" ? (
              <select
                name="outletId"
                required
                value={selectedOutletId}
                onChange={(event) => setSelectedOutletId(event.target.value)}
                className={inputClassName}
              >
                <option value="">Pilih outlet</option>

                {props.outlets.map((outlet) => (
                  <option key={outlet.id} value={outlet.id}>
                    {outlet.name} · {outlet.code}
                  </option>
                ))}
              </select>
            ) : (
              <input
                value={`${props.register.outletName} · ${props.register.outletCode}`}
                readOnly
                className={`${inputClassName} cursor-not-allowed bg-neutral-50 text-neutral-500`}
              />
            )}

            <FieldError message={state.fieldErrors?.outletId} />
          </label>

          <label className="block text-sm">
            <span className="mb-2 block font-medium text-neutral-800">
              Kode register
            </span>

            {props.mode === "create" ? (
              <input
                name="code"
                required
                minLength={2}
                maxLength={32}
                autoCapitalize="characters"
                autoCorrect="off"
                className={inputClassName}
                placeholder="POS-01"
              />
            ) : (
              <input
                value={props.register.code}
                readOnly
                className={`${inputClassName} cursor-not-allowed bg-neutral-50 font-mono text-neutral-500`}
              />
            )}

            <FieldError message={state.fieldErrors?.code} />
          </label>

          <label className="block text-sm sm:col-span-2">
            <span className="mb-2 block font-medium text-neutral-800">
              Nama register
            </span>

            <input
              name="name"
              required
              minLength={2}
              maxLength={120}
              defaultValue={props.mode === "edit" ? props.register.name : ""}
              className={inputClassName}
              placeholder="Kasir Utama"
            />

            <FieldError message={state.fieldErrors?.name} />
          </label>
        </div>
      </section>

      <section className="rounded-2xl border border-[var(--border)] bg-white p-5">
        <h2 className="font-semibold text-neutral-950">Status dan Perangkat</h2>

        <div className="mt-5 space-y-3">
          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-[var(--border)] p-4">
            <input
              type="checkbox"
              name="isActive"
              checked={isActive}
              onChange={(event) => updateActive(event.target.checked)}
              className="mt-0.5 size-4 accent-[var(--accent)]"
            />

            <span>
              <span className="block text-sm font-medium text-neutral-900">
                Register aktif
              </span>

              <span className="mt-1 block text-xs leading-5 text-[var(--muted)]">
                Register aktif dapat digunakan untuk membuka shift dan membuat
                transaksi.
              </span>
            </span>
          </label>

          <FieldError message={state.fieldErrors?.isActive} />

          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-[var(--border)] p-4">
            <input
              type="checkbox"
              name="isHardwareHub"
              checked={isHardwareHub}
              disabled={!isActive}
              onChange={(event) => setIsHardwareHub(event.target.checked)}
              className="mt-0.5 size-4 accent-[var(--accent)] disabled:opacity-50"
            />

            <span>
              <span className="flex items-center gap-2 text-sm font-medium text-neutral-900">
                <Cpu className="size-4 text-[var(--accent)]" />
                Jadikan hardware hub
              </span>

              <span className="mt-1 block text-xs leading-5 text-[var(--muted)]">
                Hardware hub mengoordinasi printer, cash drawer, dan perangkat
                lokal outlet.
              </span>
            </span>
          </label>

          <FieldError message={state.fieldErrors?.isHardwareHub} />
        </div>

        {replacingHub ? (
          <div className="mt-4 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-800">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />

            <p className="text-xs leading-5">
              Register <strong>{replacingHub.name}</strong> ({replacingHub.code}
              ) saat ini adalah hardware hub. Menyimpan perubahan akan
              memindahkan status hub ke register ini.
            </p>
          </div>
        ) : null}
      </section>

      <div className="flex justify-end">
        <FormSubmitButton
          pendingText={
            props.mode === "create"
              ? "Membuat register..."
              : "Menyimpan register..."
          }
        >
          {props.mode === "create" ? (
            <MonitorSmartphone className="size-4" />
          ) : (
            <Save className="size-4" />
          )}

          {props.mode === "create" ? "Buat Register" : "Simpan Perubahan"}
        </FormSubmitButton>
      </div>
    </form>
  );
}
