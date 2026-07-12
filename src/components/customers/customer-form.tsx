"use client";

import {
  AlertTriangle,
  BadgeCheck,
  CheckCircle2,
  CircleUserRound,
  ContactRound,
  FileText,
  Hash,
  LoaderCircle,
  Mail,
  MapPin,
  MessageCircleMore,
  Phone,
  Save,
  ShoppingBag,
  UserPlus,
} from "lucide-react";
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import {
  createAdminCustomerAction,
  updateAdminCustomerAction,
} from "@/app/actions/customers";
import { FormSubmitButton } from "@/components/forms/form-submit-button";
import {
  initialAdminCustomerActionState,
  type AdminCustomerActionState,
  type AdminCustomerFormData,
} from "@/features/customers/contracts";

const inputClassName =
  "h-11 w-full rounded-xl border border-[var(--border)] bg-white px-3 text-sm text-neutral-950 outline-none transition placeholder:text-neutral-400 focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent-soft)]";

const textareaClassName =
  "w-full resize-y rounded-xl border border-[var(--border)] bg-white px-3 py-2.5 text-sm leading-6 text-neutral-950 outline-none transition placeholder:text-neutral-400 focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent-soft)]";

type CustomerStatus = "active" | "inactive";

function ActionMessage({ state }: { state: AdminCustomerActionState }) {
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

function getInitials(fullName: string) {
  const nameParts = fullName.trim().split(/\s+/).filter(Boolean);
  const firstName = nameParts[0];

  if (!firstName) {
    return "?";
  }

  if (nameParts.length === 1) {
    return firstName.slice(0, 2).toUpperCase();
  }

  const lastName = nameParts.at(-1);

  return `${firstName.charAt(0)}${lastName?.charAt(0) ?? ""}`.toUpperCase();
}

function SummaryRow({
  icon: Icon,
  label,
  value,
  valueClassName,
}: {
  icon: typeof ContactRound;
  label: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] px-3.5 py-3">
      <Icon className="mt-0.5 size-4 shrink-0 text-[var(--accent)]" />
      <div className="min-w-0 flex-1">
        <p className="text-xs text-[var(--muted)]">{label}</p>
        <p
          className={`mt-0.5 break-words text-sm font-semibold text-neutral-900 ${valueClassName ?? ""}`}
        >
          {value}
        </p>
      </div>
    </div>
  );
}

export function CreateCustomerForm() {
  const [state, formAction] = useActionState(
    createAdminCustomerAction,
    initialAdminCustomerActionState,
  );
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState<CustomerStatus>("active");

  const normalizedName = fullName.trim();
  const initials = getInitials(normalizedName);
  const completionItems = [
    normalizedName.length >= 2,
    phone.trim().length > 0,
    email.trim().length > 0,
    address.trim().length > 0,
    notes.trim().length > 0,
  ];
  const completedItemCount = completionItems.filter(Boolean).length;
  const completionPercentage =
    (completedItemCount / completionItems.length) * 100;
  const hasContact = phone.trim().length > 0 || email.trim().length > 0;

  return (
    <form action={formAction} className="space-y-5">
      <ActionMessage state={state} />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px] xl:items-start">
        <div className="min-w-0 space-y-5">
          <section className="rounded-2xl border border-[var(--border)] bg-white p-4 sm:p-5">
            <div className="flex items-start gap-3">
              <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]">
                <CircleUserRound className="size-5" />
              </div>

              <div className="min-w-0">
                <span className="inline-flex w-fit rounded-full bg-[var(--accent-soft)] px-3 py-1 text-xs font-semibold text-[var(--accent)]">
                  Identitas pelanggan
                </span>
                <h2 className="mt-3 font-semibold text-neutral-950">
                  Profil Utama
                </h2>
                <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
                  Nama menjadi identitas utama pelanggan di Admin, pencarian
                  POS, dan histori transaksi.
                </p>
              </div>
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px] lg:items-start">
              <label className="block text-sm">
                <span className="mb-2 block font-medium text-neutral-800">
                  Nama lengkap
                </span>
                <input
                  name="fullName"
                  required
                  minLength={2}
                  maxLength={180}
                  autoComplete="name"
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  className={inputClassName}
                  placeholder="Contoh: Ibu Siti Aminah"
                />
                <p className="mt-1.5 text-xs leading-5 text-[var(--muted)]">
                  Gunakan nama yang mudah dikenali oleh staff saat melayani
                  pelanggan.
                </p>
                <FieldError message={state.fieldErrors?.fullName} />
              </label>

              <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] p-4">
                <div className="flex items-center gap-3">
                  <div className="grid size-12 shrink-0 place-items-center rounded-xl bg-white text-sm font-semibold text-[var(--accent)]">
                    {initials}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-neutral-950">
                      {normalizedName || "Nama pelanggan"}
                    </p>
                    <p className="mt-0.5 text-xs text-[var(--muted)]">
                      Kode dibuat otomatis
                    </p>
                  </div>
                </div>

                <div className="mt-3 flex items-start gap-2 rounded-xl border border-[var(--border)] bg-white px-3 py-2.5 text-xs leading-5 text-[var(--muted)]">
                  <BadgeCheck className="mt-0.5 size-4 shrink-0 text-[var(--accent)]" />
                  Format kode akan dibuat sistem setelah profil berhasil
                  disimpan.
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-[var(--border)] bg-white p-4 sm:p-5">
            <div className="flex items-start gap-3">
              <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-[var(--surface-muted)] text-neutral-600">
                <ContactRound className="size-5" />
              </div>

              <div className="min-w-0">
                <h2 className="font-semibold text-neutral-950">
                  Informasi Kontak
                </h2>
                <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
                  Kontak membantu pencarian pelanggan, follow-up, dan mencegah
                  profil ganda berdasarkan nomor atau email yang sama.
                </p>
              </div>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <label className="block text-sm">
                <span className="mb-2 flex items-center gap-2 font-medium text-neutral-800">
                  <Phone className="size-4 text-[var(--accent)]" />
                  Nomor WhatsApp / Telepon
                </span>
                <input
                  name="phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  maxLength={32}
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  className={inputClassName}
                  placeholder="08xxxxxxxxxx"
                />
                <FieldError message={state.fieldErrors?.phone} />
              </label>

              <label className="block text-sm">
                <span className="mb-2 flex items-center gap-2 font-medium text-neutral-800">
                  <Mail className="size-4 text-[var(--accent)]" />
                  Email
                </span>
                <input
                  name="email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  maxLength={254}
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className={inputClassName}
                  placeholder="pelanggan@email.com"
                />
                <FieldError message={state.fieldErrors?.email} />
              </label>
            </div>

            <div
              className={`mt-4 flex items-start gap-3 rounded-xl border px-4 py-3 text-xs leading-5 ${
                hasContact
                  ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                  : "border-amber-200 bg-amber-50 text-amber-800"
              }`}
            >
              {hasContact ? (
                <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
              ) : (
                <ContactRound className="mt-0.5 size-4 shrink-0" />
              )}
              <p>
                {hasContact
                  ? "Kontak pelanggan sudah tersedia untuk pencarian dan follow-up."
                  : "Sebaiknya isi minimal salah satu kontak agar pelanggan mudah ditemukan dan dihubungi."}
              </p>
            </div>
          </section>

          <section className="rounded-2xl border border-[var(--border)] bg-white p-4 sm:p-5">
            <div className="flex items-start gap-3">
              <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-[var(--surface-muted)] text-neutral-600">
                <MapPin className="size-5" />
              </div>

              <div className="min-w-0">
                <h2 className="font-semibold text-neutral-950">
                  Alamat & Catatan Pelayanan
                </h2>
                <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
                  Informasi tambahan ini bersifat opsional dan dapat diperbarui
                  kapan saja dari detail pelanggan.
                </p>
              </div>
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              <label className="block text-sm">
                <span className="mb-2 flex items-center justify-between gap-3">
                  <span className="font-medium text-neutral-800">Alamat</span>
                  <span className="text-xs text-[var(--muted)]">
                    {address.length}/1000
                  </span>
                </span>
                <textarea
                  name="address"
                  rows={6}
                  maxLength={1000}
                  autoComplete="street-address"
                  value={address}
                  onChange={(event) => setAddress(event.target.value)}
                  className={textareaClassName}
                  placeholder="Alamat pelanggan untuk kebutuhan pengiriman atau follow-up"
                />
                <p className="mt-1.5 text-xs leading-5 text-[var(--muted)]">
                  Gunakan alamat yang paling relevan untuk pelayanan pelanggan.
                </p>
                <FieldError message={state.fieldErrors?.address} />
              </label>

              <label className="block text-sm">
                <span className="mb-2 flex items-center justify-between gap-3">
                  <span className="font-medium text-neutral-800">
                    Catatan internal
                  </span>
                  <span className="text-xs text-[var(--muted)]">
                    {notes.length}/500
                  </span>
                </span>
                <textarea
                  name="notes"
                  rows={6}
                  maxLength={500}
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  className={textareaClassName}
                  placeholder="Contoh: suka model simple, follow-up via WhatsApp sore hari"
                />
                <div className="mt-1.5 flex items-start gap-2 text-xs leading-5 text-[var(--muted)]">
                  <FileText className="mt-0.5 size-3.5 shrink-0 text-[var(--accent)]" />
                  Catatan hanya untuk kebutuhan internal dan tidak dicetak pada
                  nota pelanggan.
                </div>
                <FieldError message={state.fieldErrors?.notes} />
              </label>
            </div>
          </section>
        </div>

        <aside className="min-w-0 space-y-5 xl:sticky xl:top-5">
          <section className="rounded-2xl border border-[var(--border)] bg-white p-4 sm:p-5">
            <div className="flex items-start gap-3">
              <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]">
                <ShoppingBag className="size-5" />
              </div>

              <div className="min-w-0">
                <h2 className="font-semibold text-neutral-950">
                  Status Pelanggan
                </h2>
                <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
                  Tentukan apakah profil langsung tersedia untuk transaksi baru
                  melalui POS.
                </p>
              </div>
            </div>

            <div className="mt-5 space-y-3">
              <label
                className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition ${
                  status === "active"
                    ? "border-[var(--accent)] bg-[var(--accent-soft)]"
                    : "border-[var(--border)] bg-white hover:bg-[var(--surface-muted)]"
                }`}
              >
                <input
                  type="radio"
                  name="status"
                  value="active"
                  checked={status === "active"}
                  onChange={() => setStatus("active")}
                  className="mt-0.5 size-4 accent-[var(--accent)]"
                />
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-neutral-950">
                    Pelanggan aktif
                  </span>
                  <span className="mt-1 block text-xs leading-5 text-[var(--muted)]">
                    Diprioritaskan pada pencarian POS dan dapat dipilih untuk
                    transaksi baru.
                  </span>
                </span>
              </label>

              <label
                className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition ${
                  status === "inactive"
                    ? "border-[var(--accent)] bg-[var(--accent-soft)]"
                    : "border-[var(--border)] bg-white hover:bg-[var(--surface-muted)]"
                }`}
              >
                <input
                  type="radio"
                  name="status"
                  value="inactive"
                  checked={status === "inactive"}
                  onChange={() => setStatus("inactive")}
                  className="mt-0.5 size-4 accent-[var(--accent)]"
                />
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-neutral-950">
                    Pelanggan nonaktif
                  </span>
                  <span className="mt-1 block text-xs leading-5 text-[var(--muted)]">
                    Tidak diprioritaskan pada POS, tetapi profil dan histori
                    transaksi tetap tersimpan.
                  </span>
                </span>
              </label>
            </div>

            <FieldError message={state.fieldErrors?.status} />
          </section>

          <section className="rounded-2xl border border-[var(--border)] bg-white p-4 sm:p-5">
            <div className="flex items-start gap-3">
              <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-[var(--surface-muted)] text-neutral-600">
                <ContactRound className="size-5" />
              </div>

              <div className="min-w-0">
                <h2 className="font-semibold text-neutral-950">
                  Ringkasan Profil
                </h2>
                <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
                  Periksa kelengkapan data sebelum membuat profil pelanggan.
                </p>
              </div>
            </div>

            <div className="mt-5 flex items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] p-4">
              <div className="grid size-12 shrink-0 place-items-center rounded-xl bg-white text-sm font-semibold text-[var(--accent)]">
                {initials}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-neutral-950">
                  {normalizedName || "Nama belum diisi"}
                </p>
                <p className="mt-0.5 text-xs text-[var(--muted)]">
                  {status === "active"
                    ? "Pelanggan aktif"
                    : "Pelanggan nonaktif"}
                </p>
              </div>
            </div>

            <div className="mt-4 space-y-3">
              <SummaryRow
                icon={Phone}
                label="WhatsApp / Telepon"
                value={phone.trim() || "Belum diisi"}
              />
              <SummaryRow
                icon={Mail}
                label="Email"
                value={email.trim() || "Belum diisi"}
              />
              <SummaryRow
                icon={MapPin}
                label="Alamat"
                value={address.trim() ? "Tersedia" : "Belum diisi"}
              />
              <SummaryRow
                icon={MessageCircleMore}
                label="Catatan internal"
                value={notes.trim() ? "Tersedia" : "Belum diisi"}
              />
            </div>

            <div className="mt-5 rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-medium text-neutral-700">
                  Kelengkapan profil
                </p>
                <p className="text-xs font-semibold text-neutral-950">
                  {completedItemCount}/{completionItems.length}
                </p>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-white">
                <div
                  className="h-full rounded-full bg-[var(--accent)] transition-[width]"
                  style={{ width: `${completionPercentage}%` }}
                />
              </div>
              <p className="mt-2 text-xs leading-5 text-[var(--muted)]">
                Nama wajib diisi. Kontak, alamat, dan catatan dapat dilengkapi
                sesuai informasi yang tersedia.
              </p>
            </div>
          </section>

          <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] p-4">
            <p className="text-sm font-semibold text-neutral-950">
              Buat profil pelanggan
            </p>
            <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
              Sistem akan membuat kode pelanggan otomatis dan mengarahkan Anda
              ke halaman detail setelah data berhasil disimpan.
            </p>

            <FormSubmitButton
              pendingText="Membuat pelanggan..."
              className="mt-4 w-full"
            >
              <UserPlus className="size-4" />
              Buat Pelanggan
            </FormSubmitButton>
          </section>
        </aside>
      </div>
    </form>
  );
}

function EditCustomerSubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={disabled || pending}
      className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-4 text-sm font-semibold !text-white transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50 [&_svg]:!text-white"
    >
      {pending ? (
        <>
          <LoaderCircle className="size-4 animate-spin" />
          Menyimpan pelanggan...
        </>
      ) : (
        <>
          <Save className="size-4" />
          Simpan Perubahan
        </>
      )}
    </button>
  );
}

export function EditCustomerForm({
  customer,
}: {
  customer: AdminCustomerFormData;
}) {
  const action = updateAdminCustomerAction.bind(null, customer.id);
  const [state, formAction] = useActionState(
    action,
    initialAdminCustomerActionState,
  );

  const initialFullName = customer.fullName.trim();
  const initialPhone = customer.phone?.trim() ?? "";
  const initialEmail = customer.email?.trim() ?? "";
  const initialAddress = customer.address?.trim() ?? "";
  const initialNotes = customer.notes?.trim() ?? "";
  const initialStatus: CustomerStatus = customer.isActive
    ? "active"
    : "inactive";

  const [fullName, setFullName] = useState(initialFullName);
  const [phone, setPhone] = useState(initialPhone);
  const [email, setEmail] = useState(initialEmail);
  const [address, setAddress] = useState(initialAddress);
  const [notes, setNotes] = useState(initialNotes);
  const [status, setStatus] = useState<CustomerStatus>(initialStatus);

  const normalizedName = fullName.trim();
  const normalizedPhone = phone.trim();
  const normalizedEmail = email.trim();
  const normalizedAddress = address.trim();
  const normalizedNotes = notes.trim();
  const initials = getInitials(normalizedName);
  const hasContact = normalizedPhone.length > 0 || normalizedEmail.length > 0;

  const changedFields = [
    normalizedName !== initialFullName,
    normalizedPhone !== initialPhone,
    normalizedEmail !== initialEmail,
    normalizedAddress !== initialAddress,
    normalizedNotes !== initialNotes,
    status !== initialStatus,
  ];
  const changeCount = changedFields.filter(Boolean).length;
  const hasUnsavedChanges = changeCount > 0;

  const contactValue =
    normalizedPhone && normalizedEmail
      ? "WhatsApp & email tersedia"
      : normalizedPhone
        ? "WhatsApp / telepon tersedia"
        : normalizedEmail
          ? "Email tersedia"
          : "Kontak belum diisi";

  return (
    <form action={formAction} className="space-y-5">
      <ActionMessage state={state} />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px] xl:items-start">
        <div className="min-w-0 space-y-5">
          <section className="rounded-2xl border border-[var(--border)] bg-white p-4 sm:p-5">
            <div className="flex items-start gap-3">
              <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]">
                <CircleUserRound className="size-5" />
              </div>

              <div className="min-w-0">
                <span className="inline-flex w-fit rounded-full bg-[var(--accent-soft)] px-3 py-1 text-xs font-semibold text-[var(--accent)]">
                  Identitas pelanggan
                </span>
                <h2 className="mt-3 font-semibold text-neutral-950">
                  Profil Utama
                </h2>
                <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
                  Nama tampil pada pencarian POS, detail transaksi, nota, dan
                  histori pelayanan pelanggan.
                </p>
              </div>
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_240px] lg:items-start">
              <label className="block text-sm">
                <span className="mb-2 block font-medium text-neutral-800">
                  Nama lengkap
                </span>
                <input
                  name="fullName"
                  required
                  minLength={2}
                  maxLength={180}
                  autoComplete="name"
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  className={inputClassName}
                  placeholder="Contoh: Ibu Siti Aminah"
                />
                <p className="mt-1.5 text-xs leading-5 text-[var(--muted)]">
                  Gunakan nama yang mudah dikenali oleh staff saat melayani
                  pelanggan.
                </p>
                <FieldError message={state.fieldErrors?.fullName} />
              </label>

              <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] p-4">
                <div className="flex items-center gap-3">
                  <div className="grid size-12 shrink-0 place-items-center rounded-xl bg-white text-sm font-semibold text-[var(--accent)]">
                    {initials}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-neutral-950">
                      {normalizedName || "Nama belum diisi"}
                    </p>
                    <p className="mt-0.5 text-xs text-[var(--muted)]">
                      Preview profil pelanggan
                    </p>
                  </div>
                </div>

                <div className="mt-4 rounded-xl border border-[var(--border)] bg-white px-3 py-2.5">
                  <div className="flex items-center gap-2 text-xs text-[var(--muted)]">
                    <Hash className="size-3.5 shrink-0 text-[var(--accent)]" />
                    Kode pelanggan
                  </div>
                  <p className="mt-1 break-all font-mono text-xs font-semibold text-neutral-900">
                    {customer.customerCode ?? "Belum tersedia"}
                  </p>
                </div>

                <p className="mt-3 text-xs leading-5 text-[var(--muted)]">
                  Kode merupakan identitas permanen dan tidak berubah ketika
                  profil diperbarui.
                </p>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-[var(--border)] bg-white p-4 sm:p-5">
            <div className="flex items-start gap-3">
              <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-[var(--surface-muted)] text-neutral-600">
                <ContactRound className="size-5" />
              </div>

              <div className="min-w-0">
                <h2 className="font-semibold text-neutral-950">
                  Informasi Kontak
                </h2>
                <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
                  Nomor dan email membantu pencarian pelanggan serta mencegah
                  profil duplikat pada organisasi yang sama.
                </p>
              </div>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <label className="block text-sm">
                <span className="mb-2 flex items-center gap-2 font-medium text-neutral-800">
                  <Phone className="size-4 text-[var(--accent)]" />
                  Nomor WhatsApp / Telepon
                </span>
                <input
                  name="phone"
                  type="tel"
                  inputMode="tel"
                  maxLength={32}
                  autoComplete="tel"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  className={inputClassName}
                  placeholder="08xxxxxxxxxx"
                />
                <FieldError message={state.fieldErrors?.phone} />
              </label>

              <label className="block text-sm">
                <span className="mb-2 flex items-center gap-2 font-medium text-neutral-800">
                  <Mail className="size-4 text-[var(--accent)]" />
                  Email
                </span>
                <input
                  name="email"
                  type="email"
                  maxLength={254}
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className={inputClassName}
                  placeholder="pelanggan@email.com"
                />
                <FieldError message={state.fieldErrors?.email} />
              </label>
            </div>

            <div
              className={`mt-4 flex items-start gap-3 rounded-xl border px-4 py-3 ${
                hasContact
                  ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                  : "border-amber-200 bg-amber-50 text-amber-800"
              }`}
            >
              {hasContact ? (
                <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
              ) : (
                <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              )}
              <p className="text-xs leading-5">
                {hasContact
                  ? "Minimal satu kanal kontak tersedia untuk kebutuhan pencarian dan follow-up pelanggan."
                  : "Nomor telepon dan email masih kosong. Profil tetap dapat disimpan, tetapi follow-up dan pencarian kontak akan lebih terbatas."}
              </p>
            </div>
          </section>

          <section className="rounded-2xl border border-[var(--border)] bg-white p-4 sm:p-5">
            <div className="flex items-start gap-3">
              <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-[var(--surface-muted)] text-neutral-600">
                <FileText className="size-5" />
              </div>

              <div className="min-w-0">
                <h2 className="font-semibold text-neutral-950">
                  Alamat & Catatan Pelayanan
                </h2>
                <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
                  Lengkapi konteks pelanggan untuk pengiriman, follow-up, dan
                  pelayanan yang lebih personal.
                </p>
              </div>
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              <label className="block text-sm">
                <span className="mb-2 flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2 font-medium text-neutral-800">
                    <MapPin className="size-4 text-[var(--accent)]" />
                    Alamat
                  </span>
                  <span className="text-xs text-[var(--muted)]">
                    {address.length}/1000
                  </span>
                </span>
                <textarea
                  name="address"
                  rows={6}
                  maxLength={1000}
                  autoComplete="street-address"
                  value={address}
                  onChange={(event) => setAddress(event.target.value)}
                  className={textareaClassName}
                  placeholder="Alamat pelanggan jika tersedia"
                />
                <p className="mt-1.5 text-xs leading-5 text-[var(--muted)]">
                  Dapat digunakan sebagai referensi pengiriman atau kunjungan.
                </p>
                <FieldError message={state.fieldErrors?.address} />
              </label>

              <label className="block text-sm">
                <span className="mb-2 flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2 font-medium text-neutral-800">
                    <MessageCircleMore className="size-4 text-[var(--accent)]" />
                    Catatan internal
                  </span>
                  <span className="text-xs text-[var(--muted)]">
                    {notes.length}/500
                  </span>
                </span>
                <textarea
                  name="notes"
                  rows={6}
                  maxLength={500}
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  className={textareaClassName}
                  placeholder="Contoh: suka model simple, follow-up via WhatsApp sore hari"
                />
                <p className="mt-1.5 text-xs leading-5 text-[var(--muted)]">
                  Catatan hanya untuk internal dan tidak dicetak pada nota.
                </p>
                <FieldError message={state.fieldErrors?.notes} />
              </label>
            </div>
          </section>
        </div>

        <aside className="min-w-0 space-y-5 xl:sticky xl:top-5">
          <section className="rounded-2xl border border-[var(--border)] bg-white p-4 sm:p-5">
            <div className="flex items-start gap-3">
              <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]">
                <BadgeCheck className="size-5" />
              </div>

              <div className="min-w-0">
                <h2 className="font-semibold text-neutral-950">
                  Status Pelanggan
                </h2>
                <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
                  Tentukan apakah profil dapat diprioritaskan untuk transaksi
                  baru di POS.
                </p>
              </div>
            </div>

            <div className="mt-5 space-y-3">
              <label
                className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition ${
                  status === "active"
                    ? "border-[var(--accent)] bg-[var(--accent-soft)]"
                    : "border-[var(--border)] bg-white hover:border-neutral-300"
                }`}
              >
                <input
                  type="radio"
                  name="status"
                  value="active"
                  checked={status === "active"}
                  onChange={() => setStatus("active")}
                  className="mt-0.5 size-4 accent-[var(--accent)]"
                />
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-neutral-950">
                    Pelanggan aktif
                  </span>
                  <span className="mt-1 block text-xs leading-5 text-[var(--muted)]">
                    Dapat ditemukan dan dipilih untuk transaksi baru di POS.
                  </span>
                </span>
              </label>

              <label
                className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition ${
                  status === "inactive"
                    ? "border-neutral-400 bg-neutral-100"
                    : "border-[var(--border)] bg-white hover:border-neutral-300"
                }`}
              >
                <input
                  type="radio"
                  name="status"
                  value="inactive"
                  checked={status === "inactive"}
                  onChange={() => setStatus("inactive")}
                  className="mt-0.5 size-4 accent-neutral-700"
                />
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-neutral-950">
                    Pelanggan nonaktif
                  </span>
                  <span className="mt-1 block text-xs leading-5 text-[var(--muted)]">
                    Tidak diprioritaskan pada POS, tetapi profil dan histori
                    transaksi tetap tersimpan.
                  </span>
                </span>
              </label>
            </div>

            {status === "inactive" ? (
              <div className="mt-4 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-800">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                <p className="text-xs leading-5">
                  Menonaktifkan pelanggan tidak menghapus histori transaksi,
                  tetapi profil tidak lagi diprioritaskan untuk transaksi baru.
                </p>
              </div>
            ) : null}

            <FieldError message={state.fieldErrors?.status} />
          </section>

          <section className="rounded-2xl border border-[var(--border)] bg-white p-4 sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-3">
                <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-[var(--surface-muted)] text-neutral-600">
                  <ContactRound className="size-5" />
                </div>
                <div className="min-w-0">
                  <h2 className="font-semibold text-neutral-950">
                    Ringkasan Perubahan
                  </h2>
                  <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
                    Kondisi profil yang akan disimpan.
                  </p>
                </div>
              </div>

              <span
                className={`inline-flex shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
                  hasUnsavedChanges
                    ? "border-amber-200 bg-amber-50 text-amber-700"
                    : "border-emerald-200 bg-emerald-50 text-emerald-700"
                }`}
              >
                {hasUnsavedChanges ? "Belum disimpan" : "Tersimpan"}
              </span>
            </div>

            <div className="mt-5 flex items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] p-4">
              <div className="grid size-12 shrink-0 place-items-center rounded-xl bg-white text-sm font-semibold text-[var(--accent)]">
                {initials}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-neutral-950">
                  {normalizedName || "Nama belum diisi"}
                </p>
                <p className="mt-0.5 font-mono text-xs text-[var(--muted)]">
                  {customer.customerCode ?? "Kode belum tersedia"}
                </p>
              </div>
            </div>

            <div className="mt-4 space-y-3">
              <SummaryRow icon={Phone} label="Kontak" value={contactValue} />
              <SummaryRow
                icon={MapPin}
                label="Alamat"
                value={normalizedAddress ? "Tersedia" : "Belum diisi"}
              />
              <SummaryRow
                icon={MessageCircleMore}
                label="Catatan internal"
                value={normalizedNotes ? "Tersedia" : "Belum diisi"}
              />
              <SummaryRow
                icon={BadgeCheck}
                label="Status pelanggan"
                value={status === "active" ? "Aktif" : "Nonaktif"}
                valueClassName={
                  status === "active" ? "text-emerald-700" : "text-neutral-600"
                }
              />
            </div>

            <div className="mt-5 rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-medium text-neutral-700">
                  Perubahan terdeteksi
                </p>
                <p className="text-xs font-semibold text-neutral-950">
                  {changeCount} field
                </p>
              </div>
              <p className="mt-2 text-xs leading-5 text-[var(--muted)]">
                {hasUnsavedChanges
                  ? "Simpan perubahan agar data terbaru berlaku pada Admin dan POS."
                  : "Profil saat ini sama dengan data yang tersimpan."}
              </p>
            </div>
          </section>

          <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] p-4">
            <p className="text-sm font-semibold text-neutral-950">
              Simpan profil pelanggan
            </p>
            <p className="mt-2 mb-2 text-xs leading-5 text-[var(--muted)]">
              Kode dan histori transaksi tetap terhubung. Setelah berhasil, Anda
              akan diarahkan kembali ke detail pelanggan.
            </p>

            <EditCustomerSubmitButton disabled={!hasUnsavedChanges} />

            {!hasUnsavedChanges ? (
              <p className="mt-2 text-center text-xs text-[var(--muted)]">
                Belum ada perubahan untuk disimpan.
              </p>
            ) : null}
          </section>
        </aside>
      </div>
    </form>
  );
}
