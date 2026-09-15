"use client";

import { useActionState } from "react";

import { verifyPublicCustomerHistoryPinAction } from "@/app/actions/customer-history";
import { initialPublicCustomerHistoryPinActionState } from "@/features/customers/contracts";

function PinInput({
  name,
  label,
  autoFocus,
  error,
}: {
  name: string;
  label: string;
  autoFocus?: boolean;
  error?: string;
}) {
  return (
    <label className="block">
      <span className="text-sm font-semibold text-neutral-800">{label}</span>
      <input
        name={name}
        type="password"
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9]{6}"
        minLength={6}
        maxLength={6}
        required
        autoFocus={autoFocus}
        aria-invalid={Boolean(error)}
        className="mt-2 h-14 w-full rounded-2xl border border-neutral-300 bg-white px-4 text-center font-mono text-2xl font-bold tracking-[0.45em] text-neutral-950 outline-none transition focus:border-[#9a681d] focus:ring-4 focus:ring-[#fff2d4]"
      />
      {error ? (
        <span className="mt-2 block text-xs font-medium text-red-600">
          {error}
        </span>
      ) : null}
    </label>
  );
}

export function PublicHistoryPinVerificationForm({
  token,
}: {
  token: string;
}) {
  const action = verifyPublicCustomerHistoryPinAction.bind(null, token);
  const [state, formAction, pending] = useActionState(
    action,
    initialPublicCustomerHistoryPinActionState,
  );

  return (
    <form action={formAction} className="mt-7 grid gap-5">
      <PinInput
        name="pin"
        label="PIN pelanggan"
        autoFocus
        error={state.fieldErrors?.pin}
      />

      {state.status === "error" && state.message ? (
        <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {state.message}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="inline-flex h-12 items-center justify-center rounded-2xl bg-neutral-950 px-5 text-sm font-bold text-white transition hover:bg-neutral-800 disabled:cursor-wait disabled:opacity-60"
      >
        {pending ? "Memverifikasi PIN..." : "Buka Riwayat Transaksi"}
      </button>
    </form>
  );
}
