"use client";

import { Download, Laptop, RefreshCw, Settings2, ShieldOff, X } from "lucide-react";
import { useActionState, useRef } from "react";

import {
  disableHardwareAgentAction,
  replaceHardwareAgentDeviceAction,
  rotateHardwareAgentCredentialAction,
  type HardwareAgentLifecycleActionState,
} from "@/app/actions/hardware-agent-lifecycle";
import { FormSubmitButton } from "@/components/forms/form-submit-button";

const initialState: HardwareAgentLifecycleActionState = { status: "idle" };

type Agent = {
  id: string;
  code: string;
  name: string;
  outletName: string;
  registerName: string;
};

function buildEnvironmentFile(
  state: Extract<HardwareAgentLifecycleActionState, { status: "success" }>,
) {
  return [
    `ASIHJAYA_API_URL=${window.location.origin}`,
    "",
    `HARDWARE_AGENT_ID=${state.agent.id}`,
    `HARDWARE_AGENT_SECRET=${state.credential.secret}`,
    "HARDWARE_AGENT_REQUEST_AUTH_MODE=signed",
    "HARDWARE_PROTOCOL_MODE=v2-preferred",
    "",
    "# Temporary Stage 1 lifecycle handoff. Installer enrollment akan menggantikan file ini pada Stage 2.",
    "HARDWARE_ADAPTER_MODE=fake",
    "LABEL_PRINTER_ADAPTER=fake",
    "DOCUMENT_PRINTER_ADAPTER=fake",
    "CASH_DRAWER_ADAPTER=fake",
    "",
  ].join("\r\n");
}

function CredentialResult({
  state,
  onDone,
}: {
  state: Extract<HardwareAgentLifecycleActionState, { status: "success" }>;
  onDone: () => void;
}) {
  function download() {
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

  return (
    <div className="p-5 sm:p-6">
      <h2 className="text-xl font-semibold text-neutral-950">
        Akses Hardware Hub diperbarui
      </h2>
      <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
        Credential lama sudah tidak berlaku. Download konfigurasi sementara untuk Mini PC yang akan digunakan.
      </p>
      <button
        type="button"
        onClick={download}
        className="mt-5 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-white px-4 py-2.5 text-sm font-semibold text-neutral-800"
      >
        <Download className="size-4" />
        Download Konfigurasi Sementara
      </button>
      <button
        type="button"
        onClick={onDone}
        className="mt-2 inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white"
      >
        Selesai
      </button>
    </div>
  );
}

export function HardwareHubManageDialog({ agent }: { agent: Agent }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [rotateState, rotateAction] = useActionState(
    rotateHardwareAgentCredentialAction,
    initialState,
  );
  const [replaceState, replaceAction] = useActionState(
    replaceHardwareAgentDeviceAction,
    initialState,
  );

  const credentialState =
    rotateState.status === "success"
      ? rotateState
      : replaceState.status === "success"
        ? replaceState
        : null;

  return (
    <>
      <button
        type="button"
        onClick={() => dialogRef.current?.showModal()}
        className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm font-semibold text-neutral-700 hover:border-[var(--accent)] hover:text-[var(--accent)]"
      >
        <Settings2 className="size-4" />
        Kelola
      </button>

      <dialog
        ref={dialogRef}
        className="m-auto w-[calc(100%-2rem)] max-w-xl overflow-hidden rounded-3xl border border-[var(--border)] bg-white p-0 shadow-2xl backdrop:bg-black/40"
      >
        {credentialState ? (
          <CredentialResult
            state={credentialState}
            onDone={() => window.location.assign("/admin/operasional/hardware")}
          />
        ) : (
          <div>
            <div className="flex items-start justify-between gap-4 border-b border-[var(--border)] p-5 sm:p-6">
              <div>
                <h2 className="text-xl font-semibold text-neutral-950">
                  Kelola Hardware Hub
                </h2>
                <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
                  {agent.outletName} · {agent.registerName}
                </p>
              </div>
              <button
                type="button"
                onClick={() => dialogRef.current?.close()}
                className="grid size-9 place-items-center rounded-xl text-neutral-500 hover:bg-neutral-100"
                aria-label="Tutup"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="grid gap-3 p-5 sm:p-6">
              {(rotateState.status === "error" || replaceState.status === "error") ? (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {rotateState.status === "error"
                    ? rotateState.message
                    : replaceState.status === "error"
                      ? replaceState.message
                      : ""}
                </div>
              ) : null}

              <div className="rounded-2xl border border-[var(--border)] p-4">
                <div className="flex gap-3">
                  <Laptop className="mt-0.5 size-5 text-neutral-500" />
                  <div>
                    <p className="font-semibold text-neutral-950">Ganti Mini PC</p>
                    <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
                      Nonaktifkan identity perangkat lama dan buat identity baru untuk Mini PC pengganti.
                    </p>
                  </div>
                </div>
                <form
                  action={replaceAction}
                  className="mt-3"
                  onSubmit={(event) => {
                    if (!window.confirm("Ganti Mini PC sekarang? Agent lama akan dinonaktifkan.")) {
                      event.preventDefault();
                    }
                  }}
                >
                  <input type="hidden" name="agentId" value={agent.id} />
                  <FormSubmitButton className="w-full" pendingText="Mengganti...">
                    <Laptop className="size-4" />
                    Ganti Mini PC
                  </FormSubmitButton>
                </form>
              </div>

              <div className="rounded-2xl border border-[var(--border)] p-4">
                <div className="flex gap-3">
                  <RefreshCw className="mt-0.5 size-5 text-neutral-500" />
                  <div>
                    <p className="font-semibold text-neutral-950">Perbarui Akses</p>
                    <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
                      Gunakan jika credential perangkat perlu diganti tanpa mengganti Mini PC.
                    </p>
                  </div>
                </div>
                <form
                  action={rotateAction}
                  className="mt-3"
                  onSubmit={(event) => {
                    if (!window.confirm("Perbarui akses sekarang? Credential lama langsung tidak berlaku.")) {
                      event.preventDefault();
                    }
                  }}
                >
                  <input type="hidden" name="agentId" value={agent.id} />
                  <FormSubmitButton className="w-full" pendingText="Memperbarui...">
                    <RefreshCw className="size-4" />
                    Perbarui Akses
                  </FormSubmitButton>
                </form>
              </div>

              <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
                <div className="flex gap-3">
                  <ShieldOff className="mt-0.5 size-5 text-red-700" />
                  <div>
                    <p className="font-semibold text-red-950">Nonaktifkan Hardware Hub</p>
                    <p className="mt-1 text-xs leading-5 text-red-800">
                      Mini PC tidak akan dapat mengambil job baru sampai diaktifkan kembali.
                    </p>
                  </div>
                </div>
                <form
                  action={disableHardwareAgentAction}
                  className="mt-3"
                  onSubmit={(event) => {
                    if (!window.confirm("Nonaktifkan Hardware Hub ini?")) {
                      event.preventDefault();
                    }
                  }}
                >
                  <input type="hidden" name="agentId" value={agent.id} />
                  <FormSubmitButton
                    className="w-full bg-red-700 hover:bg-red-800"
                    pendingText="Menonaktifkan..."
                  >
                    <ShieldOff className="size-4" />
                    Nonaktifkan
                  </FormSubmitButton>
                </form>
              </div>
            </div>
          </div>
        )}
      </dialog>
    </>
  );
}
