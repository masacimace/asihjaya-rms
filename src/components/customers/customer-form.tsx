"use client";

import { Save, UserPlus } from "lucide-react";
import { useActionState } from "react";

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
  "w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2.5 text-sm leading-6 text-neutral-950 outline-none transition placeholder:text-neutral-400 focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent-soft)]";

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

export function CreateCustomerForm() {
  const [state, formAction] = useActionState(
    createAdminCustomerAction,
    initialAdminCustomerActionState,
  );

  return (
    <form action={formAction} className="space-y-6">
      <ActionMessage state={state} />
      <CustomerFields state={state} />

      <div className="flex justify-end">
        <FormSubmitButton pendingText="Membuat pelanggan...">
          <UserPlus className="size-4" />
          Buat Pelanggan
        </FormSubmitButton>
      </div>
    </form>
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
