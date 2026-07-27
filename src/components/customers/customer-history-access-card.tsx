"use client";

import { Copy, KeyRound, RotateCcw, ShieldCheck, ShieldX } from "lucide-react";
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

export function CustomerHistoryAccessCard({
  customerId,
  historyAccess,
}: {
  customerId: string;
  historyAccess: AdminCustomerDetailData["historyAccess"];
}) {
  const generateAction = generateOrResetCustomerHistoryPinAction.bind(
    null,
    customerId,
  );
  const revokeAction = revokeCustomerHistorySessionsAction.bind(
    null,
    customerId,
  );
  const [generateState, generateFormAction, generatePending] = useActionState(
    generateAction,
    initialAdminCustomerHistoryPinActionState,
  );
  const [revokeState, revokeFormAction, revokePending] = useActionState(
    revokeAction,
    initialAdminCustomerHistoryPinActionState,
  );
  const [copied, setCopied] = useState(false);

  async function copyTemporaryPin() {
    if (!generateState.temporaryPin) {
      return;
    }

    try {
      await navigator.clipboard.writeText(generateState.temporaryPin);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }

  const statusLabel = !historyAccess.exists
    ? "Belum dibuat"
    : !historyAccess.isActive
      ? "Nonaktif"
      : historyAccess.mustChangePin
        ? "PIN sementara"
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
                PIN Riwayat Pelanggan
              </h2>
              <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
                PIN digunakan pelanggan setelah memindai QR pada nota.
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
          <p className="text-xs font-medium text-[var(--muted)]">Dibuat</p>
          <p className="mt-2 text-sm font-semibold text-neutral-900">
            {formatDateTime(historyAccess.pinCreatedAt)}
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

      {generateState.status === "success" && generateState.temporaryPin ? (
        <div className="mt-5 rounded-2xl border border-amber-300 bg-amber-50 p-4 sm:p-5">
          <p className="text-xs font-bold uppercase tracking-wide text-amber-800">
            PIN sementara — tampil sekali
          </p>
          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
            <code className="flex-1 rounded-2xl border border-amber-300 bg-white px-5 py-3 text-center text-3xl font-bold tracking-[0.35em] text-neutral-950">
              {generateState.temporaryPin}
            </code>
            <button
              type="button"
              onClick={copyTemporaryPin}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-amber-300 bg-white px-4 text-sm font-semibold text-amber-900 hover:bg-amber-100"
            >
              <Copy className="size-4" />
              {copied ? "Tersalin" : "Salin PIN"}
            </button>
          </div>
          <p className="mt-3 text-xs leading-5 text-amber-800">
            Berikan PIN secara privat. Pelanggan wajib menggantinya saat akses
            pertama. PIN ini tidak dapat dilihat kembali setelah halaman dimuat
            ulang.
          </p>
        </div>
      ) : null}

      {generateState.message ? (
        <p
          className={`mt-4 rounded-2xl border px-4 py-3 text-sm font-medium ${
            generateState.status === "error"
              ? "border-red-200 bg-red-50 text-red-700"
              : "border-emerald-200 bg-emerald-50 text-emerald-700"
          }`}
        >
          {generateState.message}
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

      <div className="mt-5 flex flex-col gap-3 sm:flex-row">
        <form
          action={generateFormAction}
          onSubmit={(event) => {
            if (
              historyAccess.exists &&
              !window.confirm(
                "Reset PIN akan mencabut seluruh sesi histori pelanggan. Lanjutkan?",
              )
            ) {
              event.preventDefault();
            }
          }}
        >
          <button
            type="submit"
            disabled={generatePending}
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-4 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-wait disabled:opacity-60 sm:w-auto"
          >
            <RotateCcw className="size-4" />
            {generatePending
              ? "Membuat PIN..."
              : historyAccess.exists
                ? "Reset dan Buat PIN Baru"
                : "Buat PIN Sementara"}
          </button>
        </form>

        {historyAccess.exists ? (
          <form
            action={revokeFormAction}
            onSubmit={(event) => {
              if (
                !window.confirm(
                  "Cabut seluruh sesi histori yang sedang aktif untuk pelanggan ini?",
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
        ) : null}
      </div>
    </section>
  );
}
