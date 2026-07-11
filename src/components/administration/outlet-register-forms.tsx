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
import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

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

type OutletOperationalSummary = {
  activeRegisterCount: number;
  assignedStaffCount: number;
  inventoryItemCount: number;
  activeShiftCount: number;
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

export function EditOutletForm({
  outlet,
  operationalSummary,
}: {
  outlet: OutletData;
  operationalSummary: OutletOperationalSummary;
}) {
  const router = useRouter();
  const [state, formAction] = useActionState(
    updateOutletAction.bind(null, outlet.id),
    initialOperationsActionState,
  );
  const [name, setName] = useState(outlet.name);
  const [phone, setPhone] = useState(outlet.phone ?? "");
  const [address, setAddress] = useState(outlet.address ?? "");
  const [googleMapsEmbedUrl, setGoogleMapsEmbedUrl] = useState(
    outlet.googleMapsEmbedUrl ?? "",
  );
  const [isActive, setIsActive] = useState(outlet.isActive);
  const [savedSnapshot, setSavedSnapshot] = useState(() => ({
    name: outlet.name,
    phone: outlet.phone ?? "",
    address: outlet.address ?? "",
    googleMapsEmbedUrl: outlet.googleMapsEmbedUrl ?? "",
    isActive: outlet.isActive,
  }));
  const handledSuccessStateRef = useRef<OperationsActionState | null>(null);

  useEffect(() => {
    if (
      state.status !== "success" ||
      handledSuccessStateRef.current === state
    ) {
      return;
    }

    handledSuccessStateRef.current = state;

    const normalizedName = name.trim();
    const normalizedPhone = phone.trim();
    const normalizedAddress = address.trim();
    const normalizedGoogleMapsEmbedUrl = googleMapsEmbedUrl.trim();

    setName(normalizedName);
    setPhone(normalizedPhone);
    setAddress(normalizedAddress);
    setGoogleMapsEmbedUrl(normalizedGoogleMapsEmbedUrl);
    setSavedSnapshot({
      name: normalizedName,
      phone: normalizedPhone,
      address: normalizedAddress,
      googleMapsEmbedUrl: normalizedGoogleMapsEmbedUrl,
      isActive,
    });
    router.refresh();
  }, [address, googleMapsEmbedUrl, isActive, name, phone, router, state]);

  const safeGoogleMapsEmbedUrl = getSafeGoogleMapsEmbedUrl(
    googleMapsEmbedUrl,
  );
  const hasMapsValue = googleMapsEmbedUrl.trim().length > 0;
  const hasInvalidMapsUrl = hasMapsValue && !safeGoogleMapsEmbedUrl;
  const normalizedCurrent = {
    name: name.trim(),
    phone: phone.trim(),
    address: address.trim(),
    googleMapsEmbedUrl: googleMapsEmbedUrl.trim(),
    isActive,
  };
  const changedFields = [
    normalizedCurrent.name !== savedSnapshot.name,
    normalizedCurrent.phone !== savedSnapshot.phone,
    normalizedCurrent.address !== savedSnapshot.address,
    normalizedCurrent.googleMapsEmbedUrl !==
      savedSnapshot.googleMapsEmbedUrl,
    normalizedCurrent.isActive !== savedSnapshot.isActive,
  ].filter(Boolean).length;
  const hasUnsavedChanges = changedFields > 0;
  const deactivationBlockerCount =
    operationalSummary.activeRegisterCount +
    operationalSummary.assignedStaffCount +
    operationalSummary.inventoryItemCount +
    operationalSummary.activeShiftCount;
  const isDeactivationRequested = savedSnapshot.isActive && !isActive;

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
                <h2 className="font-semibold text-neutral-950">
                  Identitas Outlet
                </h2>
                <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
                  Perbarui nama lokasi operasional. Kode outlet tetap digunakan
                  sebagai identitas internal dan tidak dapat diubah.
                </p>
              </div>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <label className="block text-sm">
                <span className="mb-2 block font-medium text-neutral-800">
                  Kode outlet
                </span>

                <input
                  value={outlet.code}
                  readOnly
                  className={`${inputClassName} cursor-not-allowed bg-neutral-50 font-mono uppercase text-neutral-500`}
                />

                <p className="mt-1.5 text-xs leading-5 text-[var(--muted)]">
                  Kode dipakai pada register, laporan, inventaris, dan audit log.
                </p>
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
                  Nama ini tampil pada POS, daftar outlet, dan pilihan lokasi.
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
                  Pastikan kontak dan alamat tetap akurat untuk kebutuhan staff,
                  pelanggan, serta operasional outlet.
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
                  Opsional. Nomor ini menjadi kontak utama yang ditampilkan pada
                  informasi outlet.
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
                  Alamat membantu verifikasi lokasi dan ditampilkan pada daftar
                  outlet.
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
                      Periksa kembali titik lokasi melalui preview sebelum
                      menyimpan perubahan.
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
                      ? "Maps tersedia"
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
                Gunakan URL HTTPS dari www.google.com dengan path /maps/embed.
              </p>

              <FieldError message={state.fieldErrors?.googleMapsEmbedUrl} />
            </label>

            <div className="mt-4 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)]">
              {safeGoogleMapsEmbedUrl ? (
                <iframe
                  src={safeGoogleMapsEmbedUrl}
                  title={`Lokasi ${name.trim() || outlet.name}`}
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
                      ? "Periksa kembali URL embed Google Maps yang digunakan."
                      : "Tambahkan Google Maps Embed URL agar lokasi outlet dapat diverifikasi langsung dari halaman ini."}
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
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h2 className="font-semibold text-neutral-950">
                      Status Operasional
                    </h2>
                    <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
                      Tentukan apakah outlet dapat digunakan untuk aktivitas baru.
                    </p>
                  </div>

                  <span
                    className={
                      isActive
                        ? "rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700"
                        : "rounded-full border border-neutral-200 bg-neutral-100 px-2.5 py-1 text-xs font-semibold text-neutral-600"
                    }
                  >
                    {isActive ? "Aktif" : "Nonaktif"}
                  </span>
                </div>
              </div>
            </div>

            <label
              className={`mt-5 flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition ${
                isActive
                  ? "border-emerald-200 bg-emerald-50/70"
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
                  {isActive ? "Outlet siap digunakan" : "Outlet dinonaktifkan"}
                </span>
                <span className="mt-1 block text-xs leading-5 text-[var(--muted)]">
                  {isActive
                    ? "Register, shift, inventaris, dan transaksi baru dapat menggunakan outlet ini."
                    : "Data outlet tetap tersimpan, tetapi tidak dapat digunakan untuk operasional baru."}
                </span>
              </span>
            </label>

            {isDeactivationRequested && deactivationBlockerCount > 0 ? (
              <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3">
                <div className="flex items-start gap-2.5 text-amber-800">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs font-semibold">
                      Outlet belum siap dinonaktifkan
                    </p>
                    <p className="mt-1 text-xs leading-5">
                      Selesaikan relasi operasional aktif berikut sebelum menyimpan
                      status nonaktif.
                    </p>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-lg border border-amber-200 bg-white px-2.5 py-2">
                    <span className="block text-amber-700">Register aktif</span>
                    <strong className="mt-0.5 block text-amber-950">
                      {operationalSummary.activeRegisterCount}
                    </strong>
                  </div>
                  <div className="rounded-lg border border-amber-200 bg-white px-2.5 py-2">
                    <span className="block text-amber-700">Staff terhubung</span>
                    <strong className="mt-0.5 block text-amber-950">
                      {operationalSummary.assignedStaffCount}
                    </strong>
                  </div>
                  <div className="rounded-lg border border-amber-200 bg-white px-2.5 py-2">
                    <span className="block text-amber-700">Item fisik</span>
                    <strong className="mt-0.5 block text-amber-950">
                      {operationalSummary.inventoryItemCount}
                    </strong>
                  </div>
                  <div className="rounded-lg border border-amber-200 bg-white px-2.5 py-2">
                    <span className="block text-amber-700">Shift aktif</span>
                    <strong className="mt-0.5 block text-amber-950">
                      {operationalSummary.activeShiftCount}
                    </strong>
                  </div>
                </div>
              </div>
            ) : null}

            <FieldError message={state.fieldErrors?.isActive} />
          </section>

          <section className="rounded-2xl border border-[var(--border)] bg-white p-4 sm:p-5">
            <div className="flex items-start gap-3">
              <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]">
                <Store className="size-5" />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h2 className="font-semibold text-neutral-950">
                      Ringkasan Perubahan
                    </h2>
                    <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
                      Kondisi form yang akan disimpan ke sistem.
                    </p>
                  </div>

                  <span
                    className={
                      hasUnsavedChanges
                        ? "rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700"
                        : "rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700"
                    }
                  >
                    {hasUnsavedChanges ? "Belum disimpan" : "Tersimpan"}
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-5 space-y-3 rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] px-3.5 py-3">
              <div className="flex items-start justify-between gap-3">
                <span className="text-xs text-[var(--muted)]">Nama outlet</span>
                <span className="max-w-[60%] break-words text-right text-xs font-semibold text-neutral-900">
                  {name.trim() || "Belum diisi"}
                </span>
              </div>
              <div className="flex items-start justify-between gap-3">
                <span className="text-xs text-[var(--muted)]">Kontak</span>
                <span className="text-right text-xs font-semibold text-neutral-900">
                  {phone.trim() ? "Tersedia" : "Belum diisi"}
                </span>
              </div>
              <div className="flex items-start justify-between gap-3">
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
              <div className="flex items-start justify-between gap-3">
                <span className="text-xs text-[var(--muted)]">Status</span>
                <span
                  className={`text-right text-xs font-semibold ${
                    isActive ? "text-emerald-700" : "text-neutral-700"
                  }`}
                >
                  {isActive ? "Aktif" : "Nonaktif"}
                </span>
              </div>
              <div className="border-t border-[var(--border)] pt-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs text-[var(--muted)]">
                    Perubahan terdeteksi
                  </span>
                  <span className="text-xs font-semibold text-neutral-900">
                    {changedFields} field
                  </span>
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] p-4">
            <p className="text-sm font-semibold text-neutral-950">
              Simpan perubahan outlet
            </p>
            <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
              Perubahan identitas, lokasi, dan status langsung berlaku setelah
              berhasil disimpan.
            </p>

            {hasInvalidMapsUrl ? (
              <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-xs leading-5 text-red-700">
                Perbaiki Google Maps Embed URL sebelum menyimpan perubahan.
              </div>
            ) : null}

            <FormSubmitButton
              pendingText="Menyimpan outlet..."
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


export function CreateRegisterForm({
  outlets,
  defaultOutletId,
}: {
  outlets: OutletOption[];
  defaultOutletId?: string;
}) {
  const initialOutletId = defaultOutletId ?? outlets[0]?.id ?? "";
  const [selectedOutletId, setSelectedOutletId] = useState(initialOutletId);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [isHardwareHub, setIsHardwareHub] = useState(false);
  const [state, formAction] = useActionState(
    createRegisterAction,
    initialOperationsActionState,
  );

  const selectedOutlet = outlets.find(
    (outlet) => outlet.id === selectedOutletId,
  );
  const replacingHub =
    isHardwareHub && selectedOutlet?.hardwareHub
      ? selectedOutlet.hardwareHub
      : null;
  const completedStepCount = [
    Boolean(selectedOutlet),
    code.trim().length >= 2,
    name.trim().length >= 2,
  ].filter(Boolean).length;
  const completionPercentage = Math.round((completedStepCount / 3) * 100);

  function updateActive(checked: boolean) {
    setIsActive(checked);

    if (!checked) {
      setIsHardwareHub(false);
    }
  }

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

              <div className="min-w-0 flex-1">
                <span className="inline-flex w-fit rounded-full bg-[var(--accent-soft)] px-3 py-1 text-xs font-semibold text-[var(--accent)]">
                  Penempatan terminal
                </span>
                <h2 className="mt-3 font-semibold text-neutral-950">
                  Pilih Outlet
                </h2>
                <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
                  Register selalu terhubung ke satu outlet aktif dan tidak dapat
                  dipindahkan setelah dibuat.
                </p>
              </div>
            </div>

            <label className="mt-5 block text-sm">
              <span className="mb-2 block font-medium text-neutral-800">
                Outlet penempatan
              </span>

              <select
                name="outletId"
                required
                value={selectedOutletId}
                onChange={(event) => setSelectedOutletId(event.target.value)}
                className={inputClassName}
              >
                <option value="">Pilih outlet aktif</option>

                {outlets.map((outlet) => (
                  <option key={outlet.id} value={outlet.id}>
                    {outlet.name} · {outlet.code}
                  </option>
                ))}
              </select>

              <FieldError message={state.fieldErrors?.outletId} />
            </label>

            <div className="mt-4 rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] p-4">
              {selectedOutlet ? (
                <div className="flex items-start gap-3">
                  <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-white text-[var(--accent)]">
                    <Store className="size-5" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-neutral-950">
                          {selectedOutlet.name}
                        </p>
                        <p className="mt-0.5 font-mono text-xs text-[var(--muted)]">
                          {selectedOutlet.code}
                        </p>
                      </div>

                      <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                        Outlet aktif
                      </span>
                    </div>

                    <div className="mt-3 border-t border-[var(--border)] pt-3">
                      <p className="text-xs font-medium text-neutral-700">
                        Hardware hub saat ini
                      </p>
                      <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
                        {selectedOutlet.hardwareHub
                          ? `${selectedOutlet.hardwareHub.name} · ${selectedOutlet.hardwareHub.code}`
                          : "Belum dikonfigurasi. Register ini dapat dijadikan hardware hub pertama."}
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex min-h-28 flex-col items-center justify-center px-4 py-5 text-center">
                  <Store className="size-5 text-neutral-400" />
                  <p className="mt-2 text-sm font-semibold text-neutral-900">
                    Outlet belum dipilih
                  </p>
                  <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
                    Pilih outlet untuk melihat kondisi hardware hub saat ini.
                  </p>
                </div>
              )}
            </div>
          </section>

          <section className="rounded-2xl border border-[var(--border)] bg-white p-4 sm:p-5">
            <div className="flex items-start gap-3">
              <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-[var(--surface-muted)] text-neutral-600">
                <MonitorSmartphone className="size-5" />
              </div>

              <div className="min-w-0">
                <h2 className="font-semibold text-neutral-950">
                  Identitas Register
                </h2>
                <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
                  Gunakan identitas yang mudah dikenali oleh kasir dan tim
                  operasional outlet.
                </p>
              </div>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <label className="block text-sm">
                <span className="mb-2 block font-medium text-neutral-800">
                  Kode register
                </span>

                <input
                  name="code"
                  value={code}
                  onChange={(event) => setCode(event.target.value.toUpperCase())}
                  required
                  minLength={2}
                  maxLength={32}
                  autoCapitalize="characters"
                  autoCorrect="off"
                  spellCheck={false}
                  className={`${inputClassName} font-mono uppercase`}
                  placeholder="POS-01"
                />

                <p className="mt-1.5 text-xs leading-5 text-[var(--muted)]">
                  Gunakan 2–32 karakter: huruf kapital, angka, garis bawah,
                  atau tanda hubung. Kode tidak dapat diubah setelah dibuat.
                </p>

                <FieldError message={state.fieldErrors?.code} />
              </label>

              <label className="block text-sm">
                <span className="mb-2 block font-medium text-neutral-800">
                  Nama register
                </span>

                <input
                  name="name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  required
                  minLength={2}
                  maxLength={120}
                  autoComplete="off"
                  className={inputClassName}
                  placeholder="Kasir Utama"
                />

                <p className="mt-1.5 text-xs leading-5 text-[var(--muted)]">
                  Nama ini tampil pada pilihan terminal, shift, dan pengaturan
                  perangkat outlet.
                </p>

                <FieldError message={state.fieldErrors?.name} />
              </label>
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
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h2 className="font-semibold text-neutral-950">
                      Status Register
                    </h2>
                    <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
                      Tentukan kesiapan terminal untuk operasional POS.
                    </p>
                  </div>

                  <span
                    className={
                      isActive
                        ? "rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700"
                        : "rounded-full border border-neutral-200 bg-neutral-100 px-2.5 py-1 text-xs font-semibold text-neutral-600"
                    }
                  >
                    {isActive ? "Aktif" : "Nonaktif"}
                  </span>
                </div>
              </div>
            </div>

            <label
              className={`mt-5 flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition ${
                isActive
                  ? "border-emerald-200 bg-emerald-50/70"
                  : "border-[var(--border)] bg-[var(--surface-muted)]"
              }`}
            >
              <input
                type="checkbox"
                name="isActive"
                checked={isActive}
                onChange={(event) => updateActive(event.target.checked)}
                className="mt-0.5 size-4 accent-[var(--accent)]"
              />

              <span className="min-w-0">
                <span className="block text-sm font-semibold text-neutral-900">
                  {isActive ? "Register siap digunakan" : "Register dinonaktifkan"}
                </span>
                <span className="mt-1 block text-xs leading-5 text-[var(--muted)]">
                  {isActive
                    ? "Terminal dapat membuka shift, menjalankan POS, dan membuat transaksi baru."
                    : "Data terminal tetap tersimpan, tetapi tidak dapat digunakan untuk shift atau transaksi."}
                </span>
              </span>
            </label>

            <FieldError message={state.fieldErrors?.isActive} />
          </section>

          <section className="rounded-2xl border border-[var(--border)] bg-white p-4 sm:p-5">
            <div className="flex items-start gap-3">
              <div
                className={`grid size-11 shrink-0 place-items-center rounded-xl ${
                  isHardwareHub && isActive
                    ? "bg-[var(--accent-soft)] text-[var(--accent)]"
                    : "bg-[var(--surface-muted)] text-neutral-500"
                }`}
              >
                <Cpu className="size-5" />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h2 className="font-semibold text-neutral-950">
                      Peran Perangkat
                    </h2>
                    <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
                      Pilih apakah terminal juga mengelola perangkat lokal outlet.
                    </p>
                  </div>

                  <span className="rounded-full border border-[var(--border)] bg-[var(--surface-muted)] px-2.5 py-1 text-xs font-semibold text-neutral-600">
                    {isHardwareHub ? "Hardware hub" : "Terminal biasa"}
                  </span>
                </div>
              </div>
            </div>

            <label
              className={`mt-5 flex items-start gap-3 rounded-2xl border p-4 transition ${
                !isActive
                  ? "cursor-not-allowed border-[var(--border)] bg-neutral-50 opacity-60"
                  : isHardwareHub
                    ? "cursor-pointer border-[var(--accent)] bg-[var(--accent-soft)]"
                    : "cursor-pointer border-[var(--border)] bg-white hover:border-neutral-300"
              }`}
            >
              <input
                type="checkbox"
                name="isHardwareHub"
                checked={isHardwareHub}
                disabled={!isActive}
                onChange={(event) => setIsHardwareHub(event.target.checked)}
                className="mt-0.5 size-4 accent-[var(--accent)] disabled:opacity-50"
              />

              <span className="min-w-0">
                <span className="block text-sm font-semibold text-neutral-900">
                  {isHardwareHub
                    ? "Jadikan hardware hub outlet"
                    : "Gunakan sebagai terminal kasir biasa"}
                </span>
                <span className="mt-1 block text-xs leading-5 text-[var(--muted)]">
                  {isHardwareHub
                    ? "Register mengoordinasi printer, cash drawer, dan antrean perangkat lokal outlet."
                    : "Register dipakai untuk operasional POS tanpa menjadi pengendali perangkat lokal."}
                </span>
              </span>
            </label>

            {!isActive ? (
              <p className="mt-3 text-xs leading-5 text-[var(--muted)]">
                Aktifkan register terlebih dahulu untuk memilih peran hardware hub.
              </p>
            ) : null}

            <FieldError message={state.fieldErrors?.isHardwareHub} />

            {replacingHub ? (
              <div className="mt-4 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-800">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" />

                <div className="min-w-0">
                  <p className="text-xs font-semibold">
                    Hardware hub akan dipindahkan
                  </p>
                  <p className="mt-1 text-xs leading-5">
                    <strong>{replacingHub.name}</strong> ({replacingHub.code})
                    saat ini menjadi hub outlet. Menyimpan register ini akan
                    memindahkan status hub secara otomatis.
                  </p>
                </div>
              </div>
            ) : isHardwareHub && selectedOutlet ? (
              <div className="mt-4 flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-800">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
                <p className="text-xs leading-5">
                  Register ini akan menjadi hardware hub pertama untuk outlet
                  {" "}<strong>{selectedOutlet.name}</strong>.
                </p>
              </div>
            ) : null}
          </section>

          <section className="rounded-2xl border border-[var(--border)] bg-white p-4 sm:p-5">
            <div className="flex items-start gap-3">
              <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]">
                <MonitorSmartphone className="size-5" />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h2 className="font-semibold text-neutral-950">
                      Ringkasan Setup
                    </h2>
                    <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
                      Periksa konfigurasi terminal sebelum disimpan.
                    </p>
                  </div>

                  <span className="rounded-full border border-[var(--border)] bg-[var(--surface-muted)] px-2.5 py-1 text-xs font-semibold text-neutral-600">
                    {completedStepCount}/3 lengkap
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-5 h-2 overflow-hidden rounded-full bg-neutral-100">
              <div
                className="h-full rounded-full bg-[var(--accent)] transition-[width]"
                style={{ width: `${completionPercentage}%` }}
              />
            </div>

            <div className="mt-4 space-y-3 rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] px-3.5 py-3">
              <div className="flex items-start justify-between gap-3">
                <span className="text-xs text-[var(--muted)]">Outlet</span>
                <span className="max-w-[62%] break-words text-right text-xs font-semibold text-neutral-900">
                  {selectedOutlet?.name ?? "Belum dipilih"}
                </span>
              </div>
              <div className="flex items-start justify-between gap-3">
                <span className="text-xs text-[var(--muted)]">Identitas</span>
                <span className="max-w-[62%] break-words text-right text-xs font-semibold text-neutral-900">
                  {code.trim() || name.trim()
                    ? `${code.trim() || "Kode belum diisi"} · ${name.trim() || "Nama belum diisi"}`
                    : "Belum diisi"}
                </span>
              </div>
              <div className="flex items-start justify-between gap-3">
                <span className="text-xs text-[var(--muted)]">Status</span>
                <span
                  className={`text-right text-xs font-semibold ${
                    isActive ? "text-emerald-700" : "text-neutral-700"
                  }`}
                >
                  {isActive ? "Aktif" : "Nonaktif"}
                </span>
              </div>
              <div className="flex items-start justify-between gap-3">
                <span className="text-xs text-[var(--muted)]">Peran perangkat</span>
                <span className="text-right text-xs font-semibold text-neutral-900">
                  {isHardwareHub ? "Hardware hub" : "Terminal biasa"}
                </span>
              </div>
              <div className="flex items-start justify-between gap-3">
                <span className="text-xs text-[var(--muted)]">Hub outlet</span>
                <span className="max-w-[62%] break-words text-right text-xs font-semibold text-neutral-900">
                  {replacingHub
                    ? `Menggantikan ${replacingHub.name}`
                    : isHardwareHub
                      ? "Register ini"
                      : selectedOutlet?.hardwareHub?.name ?? "Belum tersedia"}
                </span>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] p-4">
            <p className="text-sm font-semibold text-neutral-950">
              Buat register baru
            </p>
            <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
              Setelah tersimpan, register langsung terhubung ke outlet. Printer,
              cash drawer, dan perangkat lain dikonfigurasi dari detail register.
            </p>

            <FormSubmitButton
              pendingText="Membuat register..."
              className="mt-4 w-full"
            >
              <MonitorSmartphone className="size-4" />
              Buat Register
            </FormSubmitButton>
          </section>
        </aside>
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
