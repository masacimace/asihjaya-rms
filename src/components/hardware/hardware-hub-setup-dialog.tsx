"use client";

import { CheckCircle2, Download, MonitorCog, X } from "lucide-react";
import { useActionState, useMemo, useRef, useState } from "react";

import {
  setupHardwareHubAction,
  type HardwareHubSetupActionState,
} from "@/app/actions/hardware-hub-provisioning";
import { FormSubmitButton } from "@/components/forms/form-submit-button";
import type { HardwareHubProvisioningOption } from "@/features/hardware/provisioning-options";

const initialState: HardwareHubSetupActionState = { status: "idle" };

function buildSuggestedCode(registerCode: string) {
  const normalized = registerCode
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return `${normalized}-HH`.slice(0, 80);
}

function buildEnvironmentFile(
  state: Extract<HardwareHubSetupActionState, { status: "success" }>,
) {
  return [
    `ASIHJAYA_API_URL=${window.location.origin}`,
    "",
    `HARDWARE_AGENT_ID=${state.agent.id}`,
    `HARDWARE_AGENT_SECRET=${state.credential.secret}`,
    "HARDWARE_AGENT_REQUEST_AUTH_MODE=signed",
    "HARDWARE_PROTOCOL_MODE=v2-preferred",
    "",
    "# Temporary Stage 1 onboarding. Installer enrollment akan menggantikan file ini pada Stage 2.",
    "HARDWARE_ADAPTER_MODE=fake",
    "LABEL_PRINTER_ADAPTER=fake",
    "DOCUMENT_PRINTER_ADAPTER=fake",
    "CASH_DRAWER_ADAPTER=fake",
    "",
  ].join("\r\n");
}

export function HardwareHubSetupDialog({
  options,
}: {
  options: HardwareHubProvisioningOption[];
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const availableOptions = useMemo(
    () => options.filter((option) => !option.activeAgent),
    [options],
  );
  const firstAvailable = availableOptions[0] ?? null;
  const [selectedOutletId, setSelectedOutletId] = useState(
    firstAvailable?.outlet.id ?? "",
  );
  const [selectedRegisterId, setSelectedRegisterId] = useState(
    firstAvailable?.register.id ?? "",
  );
  const [requestId, setRequestId] = useState("");
  const [state, action] = useActionState(setupHardwareHubAction, initialState);

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

  const selected =
    availableOptions.find(
      (option) =>
        option.outlet.id === selectedOutletId &&
        option.register.id === selectedRegisterId,
    ) ?? firstAvailable;

  function open() {
    const available = availableOptions[0] ?? null;
    if (available) {
      setSelectedOutletId(available.outlet.id);
      setSelectedRegisterId(available.register.id);
    }
    setRequestId(window.crypto.randomUUID());
    dialogRef.current?.showModal();
  }

  function downloadTemporaryConfig() {
    if (state.status !== "success") return;
    const blob = new Blob([buildEnvironmentFile(state)], {
      type: "text/plain;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `hardware-hub-${state.agent.code.toLowerCase()}.env`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
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
          <div className="p-5 sm:p-6">
            <div className="flex items-start gap-3">
              <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-700">
                <CheckCircle2 className="size-5" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-neutral-950">
                  Hardware Hub siap dilanjutkan
                </h2>
                <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
                  {state.agent.outletName} · {state.agent.registerName}
                </p>
              </div>
            </div>

            <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
              Tahap ini masih memakai konfigurasi manual sementara. Pada Stage 2,
              langkah download file konfigurasi akan diganti Installation Code
              untuk installer Windows.
            </div>

            <button
              type="button"
              onClick={downloadTemporaryConfig}
              className="mt-5 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-white px-4 py-2.5 text-sm font-semibold text-neutral-800 hover:border-[var(--accent)] hover:text-[var(--accent)]"
            >
              <Download className="size-4" />
              Download Konfigurasi Sementara
            </button>

            <button
              type="button"
              onClick={() => window.location.assign("/admin/operasional/hardware")}
              className="mt-2 inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white"
            >
              Selesai
            </button>
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
              <input
                type="hidden"
                name="code"
                value={selected ? buildSuggestedCode(selected.register.code) : ""}
              />
              <input
                type="hidden"
                name="name"
                value={selected ? `Hardware Hub ${selected.outlet.name}` : ""}
              />

              <div className="mt-5 rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] p-4 text-sm leading-6 text-[var(--muted)]">
                Nama perangkat dan kode agent dibuat otomatis agar staff tidak perlu memahami konfigurasi teknis.
              </div>

              <FormSubmitButton
                className="mt-5 w-full rounded-xl bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white"
                pendingText="Menyiapkan..."
              >
                Siapkan Hardware Hub
              </FormSubmitButton>
            </form>
          </div>
        )}
      </dialog>
    </>
  );
}
