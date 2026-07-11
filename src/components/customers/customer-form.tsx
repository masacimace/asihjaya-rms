"use client";

import {
  BadgeCheck,
  CheckCircle2,
  CircleUserRound,
  ContactRound,
  FileText,
  Mail,
  MapPin,
  MessageCircleMore,
  Phone,
  Save,
  ShoppingBag,
  UserPlus,
} from "lucide-react";
import { useActionState, useState } from "react";

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
  const completionPercentage = (completedItemCount / completionItems.length) * 100;
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
                  {status === "active" ? "Pelanggan aktif" : "Pelanggan nonaktif"}
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

function CustomerFields({
  state,
  customer,
}: {
  state: AdminCustomerActionState;
  customer?: AdminCustomerFormData | null;
}) {
  return (
    <>
      <section className="rounded-2xl border border-[var(--border)] bg-white p-5">
        <div>
          <h2 className="font-semibold text-neutral-950">Profil Pelanggan</h2>
          <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
            Data ini dipakai di Admin, POS, nota penjualan, dan follow-up
            WhatsApp.
          </p>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="block text-sm sm:col-span-2">
            <span className="mb-2 block font-medium text-neutral-800">
              Nama lengkap
            </span>
            <input
              name="fullName"
              required
              maxLength={180}
              defaultValue={customer?.fullName ?? ""}
              className={inputClassName}
              placeholder="Contoh: Ibu Siti Aminah"
            />
            <FieldError message={state.fieldErrors?.fullName} />
          </label>

          <label className="block text-sm">
            <span className="mb-2 block font-medium text-neutral-800">
              Nomor WhatsApp / Telepon
            </span>
            <input
              name="phone"
              type="tel"
              inputMode="tel"
              maxLength={32}
              defaultValue={customer?.phone ?? ""}
              className={inputClassName}
              placeholder="08xxxxxxxxxx"
            />
            <FieldError message={state.fieldErrors?.phone} />
          </label>

          <label className="block text-sm">
            <span className="mb-2 block font-medium text-neutral-800">
              Email
            </span>
            <input
              name="email"
              type="email"
              maxLength={254}
              defaultValue={customer?.email ?? ""}
              className={inputClassName}
              placeholder="pelanggan@email.com"
            />
            <FieldError message={state.fieldErrors?.email} />
          </label>
        </div>
      </section>

      <section className="rounded-2xl border border-[var(--border)] bg-white p-5">
        <div>
          <h2 className="font-semibold text-neutral-950">Alamat & Catatan</h2>
          <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
            Catatan internal tidak dicetak ke nota. Gunakan untuk preferensi,
            permintaan khusus, atau konteks follow-up.
          </p>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          <label className="block text-sm">
            <span className="mb-2 block font-medium text-neutral-800">
              Alamat
            </span>
            <textarea
              name="address"
              rows={5}
              maxLength={1000}
              defaultValue={customer?.address ?? ""}
              className={textareaClassName}
              placeholder="Alamat pelanggan jika tersedia"
            />
            <FieldError message={state.fieldErrors?.address} />
          </label>

          <label className="block text-sm">
            <span className="mb-2 block font-medium text-neutral-800">
              Catatan internal
            </span>
            <textarea
              name="notes"
              rows={5}
              maxLength={500}
              defaultValue={customer?.notes ?? ""}
              className={textareaClassName}
              placeholder="Contoh: suka model simple, follow-up via WhatsApp sore hari"
            />
            <FieldError message={state.fieldErrors?.notes} />
          </label>
        </div>
      </section>

      <section className="rounded-2xl border border-[var(--border)] bg-white p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-semibold text-neutral-950">Status</h2>
            <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
              Pelanggan nonaktif tidak diprioritaskan di pencarian POS, tetapi
              histori transaksi tetap tersimpan.
            </p>
          </div>

          <label className="block min-w-52 text-sm">
            <span className="mb-2 block font-medium text-neutral-800">
              Status pelanggan
            </span>
            <select
              name="status"
              defaultValue={customer?.isActive === false ? "inactive" : "active"}
              className={inputClassName}
            >
              <option value="active">Aktif</option>
              <option value="inactive">Nonaktif</option>
            </select>
            <FieldError message={state.fieldErrors?.status} />
          </label>
        </div>
      </section>
    </>
  );
}

export function EditCustomerForm({ customer }: { customer: AdminCustomerFormData }) {
  const action = updateAdminCustomerAction.bind(null, customer.id);
  const [state, formAction] = useActionState(
    action,
    initialAdminCustomerActionState,
  );

  return (
    <form action={formAction} className="space-y-6">
      <ActionMessage state={state} />
      <CustomerFields state={state} customer={customer} />

      <div className="flex justify-end">
        <FormSubmitButton pendingText="Menyimpan pelanggan...">
          <Save className="size-4" />
          Simpan Perubahan
        </FormSubmitButton>
      </div>
    </form>
  );
}
