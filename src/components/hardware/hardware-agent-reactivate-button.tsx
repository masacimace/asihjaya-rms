"use client";

import {
  CheckCircle2,
  Clipboard,
  Download,
  KeyRound,
  Power,
  ShieldCheck,
} from "lucide-react";
import {
  useActionState,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  reactivateHardwareAgentAction,
  type HardwareAgentLifecycleActionState,
} from "@/app/actions/hardware-agent-lifecycle";
import { FormSubmitButton } from "@/components/forms/form-submit-button";

const initialState: HardwareAgentLifecycleActionState = {
  status: "idle",
};

type Props = {
  agent: {
    id: string;
    code: string;
    name: string;
    outletName: string;
    registerName: string;
  };
  blockedByAgent: {
    id: string;
    code: string;
    name: string;
  } | null;
};

function buildEnvironmentFile(
  state: Extract<
    HardwareAgentLifecycleActionState,
    { status: "success" }
  >,
) {
  return [
    `ASIHJAYA_API_URL=${window.location.origin}`,
    "",
    `HARDWARE_AGENT_ID=${state.agent.id}`,
    `HARDWARE_AGENT_SECRET=${state.credential.secret}`,
    "HARDWARE_AGENT_REQUEST_AUTH_MODE=signed",
    "HARDWARE_PROTOCOL_MODE=v2-preferred",
    "",
    "# Safe-first reactivation. Aktifkan hardware real hanya setelah UAT.",
    "HARDWARE_ADAPTER_MODE=fake",
    "LABEL_PRINTER_ADAPTER=fake",
    "DOCUMENT_PRINTER_ADAPTER=fake",
    "CASH_DRAWER_ADAPTER=fake",
    "",
  ].join("\r\n");
}

export function HardwareAgentReactivateButton({
  agent,
  blockedByAgent,
}: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [copied, setCopied] = useState(false);

  const [state, formAction] = useActionState(
    reactivateHardwareAgentAction,
    initialState,
  );

  useEffect(() => {
    if (state.status === "success") {
      dialogRef.current?.showModal();
    }
  }, [state.status]);

  async function copyCredential() {
    if (state.status !== "success") return;

    await navigator.clipboard.writeText(
      buildEnvironmentFile(state),
    );
    setCopied(true);
  }

  function downloadCredential() {
    if (state.status !== "success") return;

    const blob = new Blob([buildEnvironmentFile(state)], {
      type: "text/plain;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");

    anchor.href = url;
    anchor.download =
      `hardware-hub-${state.agent.code.toLowerCase()}.env`;

    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  if (blockedByAgent) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
        <p className="text-sm font-semibold text-amber-950">
          Aktivasi ulang diblokir
        </p>
        <p className="mt-1 text-xs leading-5 text-amber-900">
          Register ini sedang dipakai oleh{" "}
          <strong>{blockedByAgent.name}</strong>{" "}
          <span className="font-mono">
            ({blockedByAgent.code})
          </span>
          . Nonaktifkan agent aktif tersebut jika memang ingin
          mengaktifkan kembali agent lama.
        </p>
      </div>
    );
  }

  return (
    <>
      <form
        action={formAction}
        onSubmit={(event) => {
          if (
            !window.confirm(
              "Aktifkan ulang Hardware Agent ini? Sistem akan membuat secret baru dan credential lama tetap tidak berlaku.",
            )
          ) {
            event.preventDefault();
          }
        }}
      >
        <input type="hidden" name="agentId" value={agent.id} />

        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-emerald-950">
                Agent nonaktif dapat digunakan kembali
              </p>
              <p className="mt-1 text-xs leading-5 text-emerald-900">
                Aktivasi ulang selalu membuat secret baru, mereset
                presence/capability lama, lalu mengembalikan agent ke
                status Offline sampai Hardware Hub melakukan heartbeat.
              </p>
            </div>

            <FormSubmitButton
              pendingText="Mengaktifkan..."
              className="shrink-0 bg-emerald-700 hover:brightness-95"
            >
              <Power className="size-4" />
              Aktifkan Ulang
            </FormSubmitButton>
          </div>
        </div>
      </form>

      <dialog
        ref={dialogRef}
        className="m-auto w-[calc(100%-2rem)] max-w-2xl overflow-hidden rounded-3xl border border-[var(--border)] bg-white p-0 shadow-2xl backdrop:bg-black/40"
        onCancel={(event) => {
          if (state.status === "success") {
            event.preventDefault();
          }
        }}
      >
        {state.status === "success" ? (
          <div className="p-5 sm:p-6">
            <div className="flex items-start gap-3">
              <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-700">
                <CheckCircle2 className="size-5" />
              </div>

              <div className="min-w-0">
                <h2 className="text-xl font-semibold text-neutral-950">
                  Hardware Agent berhasil diaktifkan ulang
                </h2>
                <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
                  Agent ID tetap sama, tetapi secret sudah diganti.
                  Simpan credential baru sekarang.
                </p>
              </div>
            </div>

            <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <div className="flex items-start gap-2">
                <KeyRound className="mt-0.5 size-4 shrink-0 text-amber-700" />
                <p className="text-sm leading-6 text-amber-900">
                  Credential lama tetap invalid. File baru ini adalah
                  satu-satunya credential yang harus dipasang pada
                  Hardware Hub setelah reactivation.
                </p>
              </div>
            </div>

            <div className="mt-5 grid gap-4">
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                  Agent
                </p>
                <p className="mt-2 font-semibold text-neutral-950">
                  {state.agent.name}
                </p>
                <p className="mt-1 break-all font-mono text-xs text-[var(--muted)]">
                  {state.agent.code} · {state.agent.id}
                </p>
              </div>

              <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                  Agent Secret
                </p>
                <textarea
                  readOnly
                  value={state.credential.secret}
                  rows={3}
                  className="mt-2 w-full resize-none break-all rounded-xl border border-[var(--border)] bg-white p-3 font-mono text-xs text-neutral-950 outline-none"
                />
              </div>
            </div>

            <div className="mt-5 grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={copyCredential}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-white px-4 py-2.5 text-sm font-semibold text-neutral-700 transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
              >
                <Clipboard className="size-4" />
                {copied ? "Konfigurasi Disalin" : "Salin Konfigurasi"}
              </button>

              <button
                type="button"
                onClick={downloadCredential}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
              >
                <Download className="size-4" />
                Download hardware-hub.env
              </button>
            </div>

            <div className="mt-5 rounded-2xl border border-blue-100 bg-blue-50 p-4">
              <div className="flex items-start gap-2">
                <ShieldCheck className="mt-0.5 size-4 shrink-0 text-blue-700" />
                <p className="text-xs leading-5 text-blue-900">
                  Konfigurasi hasil reactivation kembali ke safe-first:
                  signed auth, Protocol v2-preferred, dan seluruh adapter
                  fake.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() =>
                window.location.assign("/admin/operasional/hardware")
              }
              className="mt-6 inline-flex w-full items-center justify-center rounded-xl border border-[var(--border)] bg-white px-4 py-2.5 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-50"
            >
              Selesai
            </button>
          </div>
        ) : (
          <div className="p-6">
            <p className="text-sm text-red-700">
              {state.status === "error"
                ? state.message
                : "Credential belum tersedia."}
            </p>
          </div>
        )}
      </dialog>

      {state.status === "error" ? (
        <p className="mt-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs leading-5 text-red-700">
          {state.message}
        </p>
      ) : null}
    </>
  );
}
