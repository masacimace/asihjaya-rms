"use client";

import {
  Check,
  CheckCircle2,
  Clipboard,
  Download,
  KeyRound,
  MonitorCog,
  X,
} from "lucide-react";
import { useActionState, useMemo, useRef, useState } from "react";

import {
  revokeHardwareHubEnrollmentAction,
  setupHardwareHubAction,
  type HardwareHubSetupActionState,
} from "@/app/actions/hardware-hub-provisioning";
import { FormSubmitButton } from "@/components/forms/form-submit-button";
import type { HardwareHubProvisioningOption } from "@/features/hardware/provisioning-options";

const initialState: HardwareHubSetupActionState = { status: "idle" };

function formatExpiry(value: string | Date) {
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function HardwareHubSetupDialog({
  options,
}: {
  options: HardwareHubProvisioningOption[];
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const firstAvailable = options.find((option) => !option.activeAgent) ?? null;
  const [selectedOutletId, setSelectedOutletId] = useState(
    firstAvailable?.outlet.id ?? "",
  );
  const [selectedRegisterId, setSelectedRegisterId] = useState(
    firstAvailable?.register.id ?? "",
  );
  const [requestId, setRequestId] = useState("");
  const [copied, setCopied] = useState(false);
  const [state, action] = useActionState(setupHardwareHubAction, initialState);

  const availableOptions = useMemo(
    () => options.filter((option) => !option.activeAgent),
    [options],
  );

  const outlets = useMemo(() => {
    const values = new Map<string, HardwareHubProvisioningOption["outlet"]>();
    for (const option of availableOptions) {
      values.set(option.outlet.id, option.outlet);
    }
    return [...values.values()];
  }, [availableOptions]);

  const registers = useMemo(
    () =>
      availableOptions.filter(
        (option) => option.outlet.id === selectedOutletId,
      ),
    [availableOptions, selectedOutletId],
  );

  const selectedOption =
    availableOptions.find(
      (option) =>
        option.outlet.id === selectedOutletId &&
        option.register.id === selectedRegisterId,
    ) ?? null;

  function open() {
    const available = availableOptions[0] ?? null;
    if (available) {
      setSelectedOutletId(available.outlet.id);
      setSelectedRegisterId(available.register.id);
    }
    setRequestId(window.crypto.randomUUID());
    setCopied(false);
    dialogRef.current?.showModal();
  }

  async function copyInstallationCode(code: string) {
    await navigator.clipboard.writeText(code);
    setCopied(true);
  }

  const hasAvailable = availableOptions.length > 0;

  return (
    <>
      <button
        type="button"
        onClick={open}
        disabled={!hasAvailable}
        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-45"
      >
        <MonitorCog className="size-4" />
        Siapkan Hardware Hub
      </button>

      <dialog
        ref={dialogRef}
        className="m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-xl overflow-hidden rounded-3xl border border-[var(--border)] bg-white p-0 shadow-2xl backdrop:bg-black/40"
      >
        {state.status === "success" ? (
          <div className="max-h-[calc(100dvh-2rem)] overflow-y-auto p-5 sm:p-6">
            <div className="flex items-start gap-3">
              <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-700">
                <CheckCircle2 className="size-5" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-neutral-950">
                  Hardware Hub siap dipasang
                </h2>
                <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
                  {state.enrollment.outletName} · {state.enrollment.registerName}
                </p>
              </div>
            </div>

            <div className="mt-5 rounded-2xl border border-sky-200 bg-sky-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-sky-700">
                1. Download installer
              </p>
              <p className="mt-1 text-sm leading-6 text-sky-950">
                Download installer resmi, lalu jalankan dengan double-click pada Mini PC outlet.
              </p>
              <a
                href="/api/hardware/installer/download"
                className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-sky-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-800"
              >
                <Download className="size-4" />
                Download ASIHJAYA Hardware Hub Setup
              </a>
              <p className="mt-2 text-xs leading-5 text-sky-800">
                Jalankan Setup secara normal dan setujui UAC ketika diminta. Jangan gunakan menu
                Run as administrator agar credential DPAPI tetap terikat ke user Windows outlet.
              </p>
            </div>

            <div className="mt-4 rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-neutral-800">
                <KeyRound className="size-4 text-[var(--accent)]" />
                2. Installation Code
              </div>
              <div className="mt-3 rounded-xl border border-dashed border-neutral-300 bg-white px-4 py-4 text-center font-mono text-xl font-bold tracking-[0.14em] text-neutral-950 sm:text-2xl">
                {state.installationCode}
              </div>
              <button
                type="button"
                onClick={() => copyInstallationCode(state.installationCode)}
                className="mt-3 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm font-semibold text-neutral-800 hover:border-[var(--accent)] hover:text-[var(--accent)]"
              >
                {copied ? <Check className="size-4" /> : <Clipboard className="size-4" />}
                {copied ? "Kode disalin" : "Salin Kode"}
              </button>
              <p className="mt-3 text-center text-xs leading-5 text-[var(--muted)]">
                Berlaku sampai {formatExpiry(state.enrollment.expiresAt)}. Kode hanya
                digunakan untuk menghubungkan satu Mini PC ke register ini.
              </p>
            </div>

            <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm leading-6 text-emerald-950">
              <p className="font-semibold">3. Selesaikan wizard di Mini PC</p>
              <p className="mt-1">
                Masukkan Installation Code, pilih printer SATO untuk label dan EPSON untuk nota,
                lalu biarkan Setup menyimpan credential secara aman dan mengaktifkan Hardware Hub.
                Agent ID, secret, Node.js, dan konfigurasi teknis tidak perlu diisi staff.
              </p>
            </div>

            <div className="mt-5 grid gap-2 sm:grid-cols-2">
              <form action={revokeHardwareHubEnrollmentAction}>
                <input
                  type="hidden"
                  name="enrollmentId"
                  value={state.enrollment.id}
                />
                <FormSubmitButton
                  className="w-full rounded-xl border border-red-200 bg-white px-4 py-2.5 text-sm font-semibold text-red-700 hover:bg-red-50"
                  pendingText="Membatalkan..."
                >
                  Batalkan Kode
                </FormSubmitButton>
              </form>

              <button
                type="button"
                onClick={() => window.location.assign("/admin/operasional/hardware")}
                className="inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white"
              >
                Selesai
              </button>
            </div>
          </div>
        ) : (
          <div className="flex max-h-[calc(100dvh-2rem)] flex-col">
            <div className="flex items-start justify-between gap-4 border-b border-[var(--border)] p-5 sm:p-6">
              <div>
                <h2 className="text-xl font-semibold text-neutral-950">
                  Siapkan Hardware Hub
                </h2>
                <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
                  Pilih outlet dan register Hardware Hub yang akan dihubungkan ke Mini PC.
                </p>
              </div>
              <button
                type="button"
                onClick={() => dialogRef.current?.close()}
                className="grid size-9 shrink-0 place-items-center rounded-xl text-neutral-500 hover:bg-neutral-100"
                aria-label="Tutup"
              >
                <X className="size-4" />
              </button>
            </div>

            <form action={action} className="min-h-0 overflow-y-auto p-5 sm:p-6">
              {state.status === "error" ? (
                <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {state.message}
                </div>
              ) : null}

              <div className="grid gap-4">
                <label className="grid gap-2 text-sm">
                  <span className="font-medium text-neutral-800">Outlet</span>
                  <select
                    value={selectedOutletId}
                    onChange={(event) => {
                      const outletId = event.target.value;
                      const next = availableOptions.find(
                        (option) => option.outlet.id === outletId,
                      );
                      setSelectedOutletId(outletId);
                      setSelectedRegisterId(next?.register.id ?? "");
                    }}
                    className="h-11 rounded-xl border border-[var(--border)] bg-white px-3 text-sm"
                  >
                    {outlets.map((outlet) => (
                      <option key={outlet.id} value={outlet.id}>
                        {outlet.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="grid gap-2 text-sm">
                  <span className="font-medium text-neutral-800">Register</span>
                  <select
                    value={selectedRegisterId}
                    onChange={(event) => setSelectedRegisterId(event.target.value)}
                    className="h-11 rounded-xl border border-[var(--border)] bg-white px-3 text-sm"
                  >
                    {registers.map((option) => (
                      <option key={option.register.id} value={option.register.id}>
                        {option.register.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <input type="hidden" name="outletId" value={selectedOutletId} />
              <input type="hidden" name="registerId" value={selectedRegisterId} />
              <input type="hidden" name="requestId" value={requestId} />

              {selectedOption?.pendingEnrollment ? (
                <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
                  <p className="font-semibold">Installation Code masih aktif.</p>
                  <p className="mt-1">
                    Berlaku sampai {formatExpiry(selectedOption.pendingEnrollment.expiresAt)}.
                    Demi keamanan, kode plaintext tidak dapat ditampilkan ulang setelah halaman
                    ditutup atau direfresh. Membuat kode baru akan otomatis membatalkan kode lama.
                  </p>
                </div>
              ) : (
                <div className="mt-5 rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] p-4 text-sm leading-6 text-[var(--muted)]">
                  RMS akan membuat Installation Code sementara. Staff cukup memasukkan
                  kode tersebut ke installer Hardware Hub pada Mini PC; tidak ada Agent ID,
                  secret, atau file konfigurasi yang perlu dipindahkan manual.
                </div>
              )}

              <FormSubmitButton
                className="mt-5 w-full rounded-xl bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white"
                pendingText="Membuat kode..."
              >
                {selectedOption?.pendingEnrollment
                  ? "Buat Installation Code Baru"
                  : "Buat Installation Code"}
              </FormSubmitButton>
            </form>
          </div>
        )}
      </dialog>
    </>
  );
}
