"use client";

import {
  KeyRound,
  RefreshCw,
  Save,
  ShieldCheck,
  ShieldX,
} from "lucide-react";
import { useActionState, useState } from "react";

import {
  generateOrResetCustomerHistoryPinAction,
  revokeCustomerHistorySessionsAction,
} from "@/app/actions/customer-history";
import {
  type AdminCustomerDetailData,
  initialAdminCustomerHistoryPinActionState,
} from "@/features/customers/contracts";

function formatDateTime(value: Date | null) {
  if (!value) {
    return "Belum tersedia";
  }

  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Jakarta",
  }).format(value);
}

function createRandomPin() {
  const values = new Uint32Array(1);
  crypto.getRandomValues(values);
  return String((values[0] ?? 0) % 1_000_000).padStart(6, "0");
}

export function CustomerHistoryAccessCard({
  customerId,
  historyAccess,
}: {
  customerId: string;
  historyAccess: AdminCustomerDetailData["historyAccess"];
}) {
  const savePinAction = generateOrResetCustomerHistoryPinAction.bind(
    null,
    customerId,
  );
  const revokeAction = revokeCustomerHistorySessionsAction.bind(
    null,
    customerId,
  );
  const [saveState, saveFormAction, savePending] = useActionState(
    savePinAction,
    initialAdminCustomerHistoryPinActionState,
  );
  const [revokeState, revokeFormAction, revokePending] = useActionState(
    revokeAction,
    initialAdminCustomerHistoryPinActionState,
  );
  const [pin, setPin] = useState("");

  const statusLabel = !historyAccess.exists
    ? "Belum dibuat"
    : !historyAccess.isActive
      ? "Nonaktif"
      : "Aktif";

  return (
    <section className="rounded-3xl border border-[var(--border)] bg-white p-5 sm:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent)]">
              <KeyRound className="size-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-neutral-950">
                PIN Customer Portal
              </h2>
              <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
                Tentukan langsung 6 angka yang akan digunakan pelanggan untuk
                membuka riwayat transaksi.
              </p>
            </div>
          </div>
        </div>

        <span className="inline-flex w-fit items-center gap-2 rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1.5 text-xs font-semibold text-neutral-700">
          {historyAccess.exists && historyAccess.isActive ? (
            <ShieldCheck className="size-4 text-emerald-600" />
          ) : (
            <ShieldX className="size-4 text-neutral-500" />
          )}
          {statusLabel}
        </span>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-[var(--border)] bg-neutral-50/70 p-4">
          <p className="text-xs font-medium text-[var(--muted)]">Dibuat / diubah</p>
          <p className="mt-2 text-sm font-semibold text-neutral-900">
            {formatDateTime(historyAccess.pinResetAt ?? historyAccess.pinCreatedAt)}
          </p>
        </div>
        <div className="rounded-2xl border border-[var(--border)] bg-neutral-50/70 p-4">
          <p className="text-xs font-medium text-[var(--muted)]">Akses terakhir</p>
          <p className="mt-2 text-sm font-semibold text-neutral-900">
            {formatDateTime(historyAccess.lastSuccessfulAccessAt)}
          </p>
        </div>
        <div className="rounded-2xl border border-[var(--border)] bg-neutral-50/70 p-4">
          <p className="text-xs font-medium text-[var(--muted)]">Pembatasan</p>
          <p className="mt-2 text-sm font-semibold text-neutral-900">
            {historyAccess.isLocked
              ? `Terkunci sampai ${formatDateTime(historyAccess.lockedUntil)}`
              : "Tidak terkunci"}
          </p>
        </div>
      </div>

      <form
        action={saveFormAction}
        className="mt-5 rounded-2xl border border-[var(--border)] bg-neutral-50/60 p-4 sm:p-5"
        onSubmit={(event) => {
          if (
            historyAccess.exists &&
            !window.confirm(
              "Mengganti PIN akan mencabut seluruh sesi Customer Portal yang sedang aktif. Lanjutkan?",
            )
          ) {
            event.preventDefault();
          }
        }}
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="min-w-0 flex-1">
            <span className="text-sm font-semibold text-neutral-800">
              PIN pelanggan
            </span>
            <input
              name="pin"
              type="text"
              inputMode="numeric"
              autoComplete="off"
              pattern="[0-9]{6}"
              minLength={6}
              maxLength={6}
              required
              value={pin}
              onChange={(event) =>
                setPin(event.currentTarget.value.replace(/\D/g, "").slice(0, 6))
              }
              placeholder="123456"
              className="mt-2 h-12 w-full rounded-xl border border-[var(--border)] bg-white px-4 text-center font-mono text-xl font-bold tracking-[0.28em] text-neutral-950 outline-none transition focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent-soft)]"
            />
          </label>

          <button
            type="button"
            onClick={() => setPin(createRandomPin())}
            className="inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-white px-4 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-100"
          >
            <RefreshCw className="size-4" />
            Buat Acak
          </button>

          <button
            type="submit"
            disabled={savePending}
            className="inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-4 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-wait disabled:opacity-60"
          >
            <Save className="size-4" />
            {savePending
              ? "Menyimpan..."
              : historyAccess.exists
                ? "Ganti PIN"
                : "Simpan PIN"}
          </button>
        </div>

        <p className="mt-3 text-xs leading-5 text-[var(--muted)]">
          PIN harus tepat 6 angka. Kombinasi bebas, termasuk PIN sederhana
          seperti 123456. Setelah disimpan, PIN dapat langsung digunakan tanpa
          wajib diganti saat login pertama.
        </p>
      </form>

      {saveState.message ? (
        <p
          className={`mt-4 rounded-2xl border px-4 py-3 text-sm font-medium ${
            saveState.status === "error"
              ? "border-red-200 bg-red-50 text-red-700"
              : "border-emerald-200 bg-emerald-50 text-emerald-700"
          }`}
        >
          {saveState.message}
        </p>
      ) : null}

      {revokeState.message ? (
        <p
          className={`mt-4 rounded-2xl border px-4 py-3 text-sm font-medium ${
            revokeState.status === "error"
              ? "border-red-200 bg-red-50 text-red-700"
              : "border-emerald-200 bg-emerald-50 text-emerald-700"
          }`}
        >
          {revokeState.message}
        </p>
      ) : null}

      {historyAccess.exists ? (
        <div className="mt-5">
          <form
            action={revokeFormAction}
            onSubmit={(event) => {
              if (
                !window.confirm(
                  "Cabut seluruh sesi Customer Portal yang sedang aktif untuk pelanggan ini?",
                )
              ) {
                event.preventDefault();
              }
            }}
          >
            <button
              type="submit"
              disabled={revokePending}
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-white px-4 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-50 disabled:cursor-wait disabled:opacity-60 sm:w-auto"
            >
              <ShieldX className="size-4" />
              {revokePending ? "Mencabut sesi..." : "Cabut Semua Sesi"}
            </button>
          </form>
        </div>
      ) : null}
    </section>
  );
}
