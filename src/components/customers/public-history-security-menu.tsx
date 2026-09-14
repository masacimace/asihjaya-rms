"use client";

import { LockKeyhole, LogOut, MoreHorizontal, X } from "lucide-react";
import { useActionState, useState } from "react";

import {
  logoutPublicCustomerHistoryAction,
  rotatePublicCustomerHistoryPinAction,
} from "@/app/actions/customer-history";
import { initialPublicCustomerHistoryPinActionState } from "@/features/customers/contracts";

function PinSecurityModal({
  token,
  onClose,
}: {
  token: string;
  onClose: () => void;
}) {
  const action = rotatePublicCustomerHistoryPinAction.bind(null, token);
  const [state, formAction, pending] = useActionState(
    action,
    initialPublicCustomerHistoryPinActionState,
  );

  const fieldClass =
    "mt-2 h-12 w-full rounded-2xl border border-white/70 bg-white/[0.65] px-4 text-center font-mono text-lg font-bold tracking-[0.35em] text-neutral-950 outline-none backdrop-blur transition focus:border-[#b9863b] focus:ring-4 focus:ring-[#e8c782]/25";

  return (
    <div className="fixed inset-0 z-[150] grid place-items-center overflow-y-auto bg-black/[0.35] p-4 backdrop-blur-sm">
      <button
        type="button"
        onClick={onClose}
        className="absolute inset-0 cursor-default"
        aria-label="Tutup keamanan PIN"
      />
      <div className="relative z-10 my-6 w-full max-w-md rounded-[30px] border border-white/60 bg-white/[0.55] p-5 shadow-[0_24px_80px_rgba(74,48,24,0.14)] backdrop-blur-2xl sm:p-7">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="grid size-11 place-items-center rounded-2xl bg-[#fff0c7]/80 text-[#8b5b19] shadow-sm">
              <LockKeyhole className="size-5" />
            </div>
            <h2 className="mt-4 text-2xl font-black text-neutral-950">
              Keamanan PIN
            </h2>
            <p className="mt-2 text-sm leading-6 text-neutral-600">
              Ganti PIN riwayat tanpa meninggalkan portal customer.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid size-10 place-items-center rounded-full border border-white/80 bg-white/[0.55] text-neutral-700 transition hover:bg-white/80"
            aria-label="Tutup"
          >
            <X className="size-4" />
          </button>
        </div>

        <form action={formAction} className="mt-6 grid gap-4">
          <label className="block">
            <span className="text-sm font-semibold text-neutral-800">PIN saat ini</span>
            <input
              name="currentPin"
              type="password"
              inputMode="numeric"
              autoComplete="current-password"
              pattern="[0-9]{6}"
              minLength={6}
              maxLength={6}
              required
              autoFocus
              aria-invalid={Boolean(state.fieldErrors?.currentPin)}
              className={fieldClass}
            />
            {state.fieldErrors?.currentPin ? (
              <span className="mt-2 block text-xs font-medium text-red-600">
                {state.fieldErrors.currentPin}
              </span>
            ) : null}
          </label>

          <label className="block">
            <span className="text-sm font-semibold text-neutral-800">PIN baru</span>
            <input
              name="newPin"
              type="password"
              inputMode="numeric"
              autoComplete="new-password"
              pattern="[0-9]{6}"
              minLength={6}
              maxLength={6}
              required
              aria-invalid={Boolean(state.fieldErrors?.newPin)}
              className={fieldClass}
            />
            {state.fieldErrors?.newPin ? (
              <span className="mt-2 block text-xs font-medium text-red-600">
                {state.fieldErrors.newPin}
              </span>
            ) : null}
          </label>

          <label className="block">
            <span className="text-sm font-semibold text-neutral-800">Konfirmasi PIN baru</span>
            <input
              name="confirmPin"
              type="password"
              inputMode="numeric"
              autoComplete="new-password"
              pattern="[0-9]{6}"
              minLength={6}
              maxLength={6}
              required
              aria-invalid={Boolean(state.fieldErrors?.confirmPin)}
              className={fieldClass}
            />
            {state.fieldErrors?.confirmPin ? (
              <span className="mt-2 block text-xs font-medium text-red-600">
                {state.fieldErrors.confirmPin}
              </span>
            ) : null}
          </label>

          <div className="rounded-2xl border border-amber-200/70 bg-amber-50/70 px-4 py-3 text-xs leading-5 text-amber-900">
            Hindari angka berurutan, angka berulang, atau 6 angka terakhir nomor telepon.
          </div>

          {state.status === "error" && state.message ? (
            <p className="rounded-2xl border border-red-200/80 bg-red-50/80 px-4 py-3 text-sm font-medium text-red-700">
              {state.message}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={pending}
            className="mt-1 inline-flex h-12 items-center justify-center rounded-2xl bg-neutral-950 px-5 text-sm font-bold text-white transition hover:bg-neutral-800 disabled:cursor-wait disabled:opacity-60"
          >
            {pending ? "Menyimpan PIN..." : "Simpan PIN Baru"}
          </button>
        </form>
      </div>
    </div>
  );
}

export function PublicHistorySecurityMenu({ token }: { token: string }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [pinOpen, setPinOpen] = useState(false);
  const logoutAction = logoutPublicCustomerHistoryAction.bind(null, token);

  return (
    <>
      <div className="relative">
        {menuOpen ? (
          <button
            type="button"
            aria-label="Tutup menu customer"
            onClick={() => setMenuOpen(false)}
            className="fixed inset-0 z-30 cursor-default"
          />
        ) : null}
        <button
          type="button"
          onClick={() => setMenuOpen((value) => !value)}
          className="relative z-40 grid size-12 place-items-center rounded-full border border-white/75 bg-white/[0.45] text-neutral-950 shadow-[0_10px_30px_rgba(58,39,20,.12)] backdrop-blur-xl transition hover:bg-white/[0.65] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b9863b]"
          aria-label="Buka menu customer"
          aria-expanded={menuOpen}
        >
          <MoreHorizontal className="size-5" />
        </button>

        {menuOpen ? (
          <div className="absolute right-0 top-14 z-50 w-56 overflow-hidden rounded-2xl border border-white/60 bg-white/[0.55] p-1.5 shadow-[0_24px_80px_rgba(74,48,24,0.14)] backdrop-blur-2xl">
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                setPinOpen(true);
              }}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-semibold text-neutral-800 transition hover:bg-white/60"
            >
              <LockKeyhole className="size-4 text-[#9a681d]" />
              Keamanan PIN
            </button>
            <form action={logoutAction}>
              <button
                type="submit"
                className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-semibold text-red-700 transition hover:bg-red-50/60"
              >
                <LogOut className="size-4" />
                Keluar
              </button>
            </form>
          </div>
        ) : null}
      </div>

      {pinOpen ? (
        <PinSecurityModal token={token} onClose={() => setPinOpen(false)} />
      ) : null}
    </>
  );
}
