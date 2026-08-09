"use client";

import {
  CheckCircle2,
  Clipboard,
  Cpu,
  Download,
  KeyRound,
  Laptop,
  Plus,
  RefreshCw,
  ShieldCheck,
  ShieldOff,
  X,
} from "lucide-react";
import {
  useActionState,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  provisionHardwareAgentAction,
  type ProvisionHardwareAgentActionState,
} from "@/app/actions/hardware";
import {
  disableHardwareAgentAction,
  replaceHardwareAgentDeviceAction,
  rotateHardwareAgentCredentialAction,
  type HardwareAgentLifecycleActionState,
} from "@/app/actions/hardware-agent-lifecycle";
import { FormSubmitButton } from "@/components/forms/form-submit-button";
import type { HardwareAgentProvisioningOption } from "@/features/hardware/queries";

const initialProvisionState: ProvisionHardwareAgentActionState = {
  status: "idle",
};

const initialLifecycleState: HardwareAgentLifecycleActionState = {
  status: "idle",
};

const inputClassName =
  "h-11 w-full min-w-0 rounded-xl border border-[var(--border)] bg-white px-3 text-sm text-neutral-950 outline-none transition focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent-soft)]";

type Props = {
  options: HardwareAgentProvisioningOption[];
};

type CredentialResult = {
  agent: {
    id: string;
    code: string;
    name: string;
    outletId: string;
    outletCode: string;
    outletName: string;
    registerId: string;
    registerCode: string;
    registerName: string;
  };
  credential: {
    secret: string;
    authMode: "signed";
    protocolMode: "v2-preferred";
  };
};

function buildSuggestedCode(registerCode: string) {
  const normalized = registerCode
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return `${normalized}-HH`.slice(0, 80);
}

function buildEnvironmentFile(result: CredentialResult) {
  return [
    `ASIHJAYA_API_URL=${window.location.origin}`,
    "",
    `HARDWARE_AGENT_ID=${result.agent.id}`,
    `HARDWARE_AGENT_SECRET=${result.credential.secret}`,
    "HARDWARE_AGENT_REQUEST_AUTH_MODE=signed",
    "HARDWARE_PROTOCOL_MODE=v2-preferred",
    "",
    "# Safe-first onboarding. Aktifkan hardware real hanya setelah UAT.",
    "HARDWARE_ADAPTER_MODE=fake",
    "LABEL_PRINTER_ADAPTER=fake",
    "DOCUMENT_PRINTER_ADAPTER=fake",
    "CASH_DRAWER_ADAPTER=fake",
    "",
  ].join("\r\n");
}

function CredentialResultPanel({
  result,
  title,
  description,
}: {
  result: CredentialResult;
  title: string;
  description: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copyCredential() {
    await navigator.clipboard.writeText(buildEnvironmentFile(result));
    setCopied(true);
  }

  function downloadCredential() {
    const blob = new Blob([buildEnvironmentFile(result)], {
      type: "text/plain;charset=utf-8",
    });

    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");

    anchor.href = url;
    anchor.download =
      `hardware-hub-${result.agent.code.toLowerCase()}.env`;

    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-700">
          <CheckCircle2 className="size-5" />
        </div>
        <div className="min-w-0">
          <h2 className="text-xl font-semibold text-neutral-950">{title}</h2>
          <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
            {description}
          </p>
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4">
        <div className="flex items-start gap-2">
          <KeyRound className="mt-0.5 size-4 shrink-0 text-amber-700" />
          <p className="text-sm leading-6 text-amber-900">
            Secret hanya ditampilkan pada proses ini. Simpan konfigurasi
            sebelum menutup halaman.
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-4">
        <div className="min-w-0 rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
            Agent
          </p>
          <p className="mt-2 font-semibold text-neutral-950">
            {result.agent.name}
          </p>
          <p className="mt-1 break-all font-mono text-xs text-[var(--muted)]">
            {result.agent.code} · {result.agent.id}
          </p>
        </div>

        <div className="min-w-0 rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
            Agent Secret
          </p>
          <textarea
            readOnly
            value={result.credential.secret}
            rows={3}
            className="mt-2 w-full resize-none break-all rounded-xl border border-[var(--border)] bg-white p-3 font-mono text-xs text-neutral-950 outline-none"
          />
        </div>
      </div>

      <div className="mt-5 rounded-2xl border border-blue-100 bg-blue-50 p-4">
        <div className="flex items-start gap-2">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-blue-700" />
          <p className="text-xs leading-5 text-blue-900">
            File onboarding menggunakan signed auth, Protocol v2-preferred,
            dan seluruh adapter fake.
          </p>
        </div>
      </div>

      <div className="sticky bottom-0 z-10 -mx-5 mt-6 border-t border-[var(--border)] bg-white/95 px-5 pb-1 pt-4 backdrop-blur sm:-mx-6 sm:px-6">
        <div className="grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            onClick={copyCredential}
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-white px-4 py-2.5 text-sm font-semibold text-neutral-700 transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
          >
            <Clipboard className="size-4" />
            {copied ? "Konfigurasi Disalin" : "Salin Konfigurasi"}
          </button>

          <button
            type="button"
            onClick={downloadCredential}
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
          >
            <Download className="size-4" />
            Download hardware-hub.env
          </button>
        </div>

        <button
          type="button"
          onClick={() =>
            window.location.assign("/admin/operasional/hardware")
          }
          className="mt-2 inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-[var(--border)] bg-white px-4 py-2.5 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-50"
        >
          Selesai
        </button>
      </div>
    </div>
  );
}

function HardwareAgentLifecyclePanel({
  agent,
}: {
  agent: NonNullable<HardwareAgentProvisioningOption["activeAgent"]>;
}) {
  const [rotateState, rotateAction] = useActionState(
    rotateHardwareAgentCredentialAction,
    initialLifecycleState,
  );
  const [replaceState, replaceAction] = useActionState(
    replaceHardwareAgentDeviceAction,
    initialLifecycleState,
  );

  if (rotateState.status === "success") {
    return (
      <CredentialResultPanel
        result={rotateState}
        title="Credential berhasil dirotasi"
        description="Credential lama langsung tidak berlaku. Gunakan file baru pada Hardware Hub yang sama."
      />
    );
  }

  if (replaceState.status === "success") {
    return (
      <CredentialResultPanel
        result={replaceState}
        title="Mini PC replacement berhasil diprovisikan"
        description="Agent lama dinonaktifkan dan Agent ID + secret baru dibuat untuk Mini PC pengganti."
      />
    );
  }

  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
      <div className="flex items-start gap-3">
        <Laptop className="mt-0.5 size-5 shrink-0 text-amber-700" />
        <div className="min-w-0">
          <p className="font-semibold text-amber-950">
            Register sudah memiliki Hardware Agent aktif
          </p>
          <p className="mt-1 text-sm leading-6 text-amber-900">
            {agent.name} · <span className="font-mono">{agent.code}</span>
          </p>
          <p className="mt-2 text-xs leading-5 text-amber-900">
            Stop Hardware Hub pada Mini PC lama sebelum melakukan rotate,
            replacement, atau disable. Lifecycle action akan ditolak jika
            masih ada hardware job aktif.
          </p>
        </div>
      </div>

      {rotateState.status === "error" ? (
        <p className="mt-3 rounded-xl border border-red-200 bg-white px-3 py-2 text-xs leading-5 text-red-700">
          {rotateState.message}
        </p>
      ) : null}

      {replaceState.status === "error" ? (
        <p className="mt-3 rounded-xl border border-red-200 bg-white px-3 py-2 text-xs leading-5 text-red-700">
          {replaceState.message}
        </p>
      ) : null}

      <div className="mt-4 grid gap-2 lg:grid-cols-3">
        <form
          action={rotateAction}
          onSubmit={(event) => {
            if (
              !window.confirm(
                "Rotate credential sekarang? Credential lama langsung tidak berlaku.",
              )
            ) {
              event.preventDefault();
            }
          }}
        >
          <input type="hidden" name="agentId" value={agent.id} />
          <FormSubmitButton
            pendingText="Merotasi..."
            className="w-full bg-white !text-amber-900 border border-amber-300 hover:bg-amber-100 [&_svg]:!text-amber-900"
          >
            <RefreshCw className="size-4" />
            Rotate Credential
          </FormSubmitButton>
        </form>

        <form
          action={replaceAction}
          onSubmit={(event) => {
            if (
              !window.confirm(
                "Ganti Mini PC sekarang? Agent lama akan dinonaktifkan dan credential baru dibuat.",
              )
            ) {
              event.preventDefault();
            }
          }}
        >
          <input type="hidden" name="agentId" value={agent.id} />
          <FormSubmitButton
            pendingText="Mengganti..."
            className="w-full bg-white !text-blue-800 border border-blue-200 hover:bg-blue-50 [&_svg]:!text-blue-800"
          >
            <Laptop className="size-4" />
            Ganti Mini PC
          </FormSubmitButton>
        </form>

        <form
          action={disableHardwareAgentAction}
          onSubmit={(event) => {
            if (
              !window.confirm(
                "Nonaktifkan Hardware Agent ini? Perangkat tidak akan bisa mengambil job lagi.",
              )
            ) {
              event.preventDefault();
            }
          }}
        >
          <input type="hidden" name="agentId" value={agent.id} />
          <FormSubmitButton
            pendingText="Menonaktifkan..."
            className="w-full bg-white !text-red-700 border border-red-200 hover:bg-red-50 [&_svg]:!text-red-700"
          >
            <ShieldOff className="size-4" />
            Nonaktifkan
          </FormSubmitButton>
        </form>
      </div>
    </div>
  );
}

export function HardwareAgentProvisioningDialog({ options }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  const firstAvailable =
    options.find((option) => !option.activeAgent) ?? options[0] ?? null;

  const [selectedOutletId, setSelectedOutletId] = useState(
    firstAvailable?.outlet.id ?? "",
  );
  const [selectedRegisterId, setSelectedRegisterId] = useState(
    firstAvailable?.register.id ?? "",
  );
  const [code, setCode] = useState(
    firstAvailable ? buildSuggestedCode(firstAvailable.register.code) : "",
  );
  const [name, setName] = useState(
    firstAvailable ? `Hardware Hub ${firstAvailable.outlet.name}` : "",
  );
  const [requestId, setRequestId] = useState("");

  const [state, formAction] = useActionState(
    provisionHardwareAgentAction,
    initialProvisionState,
  );

  const outlets = useMemo(() => {
    const unique = new Map<string, HardwareAgentProvisioningOption["outlet"]>();

    for (const option of options) {
      unique.set(option.outlet.id, option.outlet);
    }

    return [...unique.values()];
  }, [options]);

  const registers = useMemo(
    () => options.filter((option) => option.outlet.id === selectedOutletId),
    [options, selectedOutletId],
  );

  const selectedOption =
    options.find(
      (option) =>
        option.outlet.id === selectedOutletId &&
        option.register.id === selectedRegisterId,
    ) ?? null;

  function openDialog() {
    const available =
      options.find((option) => !option.activeAgent) ??
      options[0] ??
      null;

    if (available) {
      setSelectedOutletId(available.outlet.id);
      setSelectedRegisterId(available.register.id);
      setCode(buildSuggestedCode(available.register.code));
      setName(`Hardware Hub ${available.outlet.name}`);
    }

    setRequestId(window.crypto.randomUUID());
    dialogRef.current?.showModal();
  }

  const hasProvisioningOption = options.length > 0;
  const hasAvailableRegister = options.some((option) => !option.activeAgent);

  return (
    <>
      <div className="w-full sm:w-auto sm:max-w-md">
        <div className="flex flex-col gap-2 sm:items-end">
          <button
            type="button"
            onClick={openDialog}
            disabled={!hasProvisioningOption}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-45 sm:w-auto"
          >
            <Plus className="size-4" />
            Tambah Hardware Agent
          </button>

          {!hasProvisioningOption ? (
            <p className="text-xs leading-5 text-[var(--muted)] sm:max-w-md sm:text-right">
              Belum ada outlet/register aktif yang bisa dipakai untuk
              provisioning.
            </p>
          ) : !hasAvailableRegister ? (
            <p className="text-xs leading-5 text-amber-700 sm:max-w-md sm:text-right">
              Semua register yang tersedia sudah memiliki Hardware Agent aktif.
              Buka dialog untuk mengelola agent yang terpakai.
            </p>
          ) : null}
        </div>
      </div>

      <dialog
        ref={dialogRef}
        className="m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-2xl overflow-hidden rounded-3xl border border-[var(--border)] bg-white p-0 shadow-2xl backdrop:bg-black/40"
        onCancel={(event) => {
          if (state.status === "success") {
            event.preventDefault();
          }
        }}
      >
        <div className="flex max-h-[calc(100dvh-2rem)] min-h-0 flex-col">
          {state.status === "success" ? (
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
              <CredentialResultPanel
                result={state}
                title="Hardware Agent berhasil dibuat"
                description="Simpan credential sekarang. Secret tidak dapat ditampilkan kembali setelah halaman ini ditutup."
              />
            </div>
          ) : (
            <>
            <div className="flex shrink-0 items-start justify-between gap-4 border-b border-[var(--border)] p-5 sm:p-6">
          <div className="flex min-w-0 items-start gap-3">
            <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]">
              <Cpu className="size-5" />
            </div>

            <div className="min-w-0">
              <h2 className="text-xl font-semibold text-neutral-950">
                Hardware Agent
              </h2>
              <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
                Provision agent baru atau kelola lifecycle Mini PC yang sudah
                aktif.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            className="grid size-9 shrink-0 place-items-center rounded-xl text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-900"
            aria-label="Tutup"
          >
            <X className="size-4" />
          </button>
        </div>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
              <div className="grid min-w-0 gap-5 p-5 pb-6 sm:p-6 sm:pb-7">
          <label className="grid min-w-0 gap-2 text-sm">
            <span className="font-medium text-neutral-800">Outlet</span>

            <select
              value={selectedOutletId}
              onChange={(event) => {
                const outletId = event.target.value;
                const next =
                  options.find(
                    (option) =>
                      option.outlet.id === outletId && !option.activeAgent,
                  ) ??
                  options.find((option) => option.outlet.id === outletId);

                setSelectedOutletId(outletId);

                if (next) {
                  setSelectedRegisterId(next.register.id);
                  setCode(buildSuggestedCode(next.register.code));
                  setName(`Hardware Hub ${next.outlet.name}`);
                }
              }}
              className={inputClassName}
            >
              {outlets.map((outlet) => (
                <option value={outlet.id} key={outlet.id}>
                  {outlet.code} · {outlet.name}
                </option>
              ))}
            </select>
          </label>

          <label className="grid min-w-0 gap-2 text-sm">
            <span className="font-medium text-neutral-800">Register</span>

            <select
              value={selectedRegisterId}
              onChange={(event) => {
                const registerId = event.target.value;
                const next = options.find(
                  (option) => option.register.id === registerId,
                );

                setSelectedRegisterId(registerId);

                if (next) {
                  setCode(buildSuggestedCode(next.register.code));
                }
              }}
              className={inputClassName}
            >
              {registers.map((option) => (
                <option
                  value={option.register.id}
                  key={option.register.id}
                >
                  {option.register.code} · {option.register.name}
                  {option.activeAgent
                    ? ` — ${option.activeAgent.name}`
                    : " — tersedia"}
                </option>
              ))}
            </select>
          </label>

          {selectedOption?.activeAgent ? (
            <HardwareAgentLifecyclePanel
              agent={selectedOption.activeAgent}
            />
          ) : (
            <form action={formAction} className="grid gap-5">
              {state.status === "error" ? (
                <div
                  role="alert"
                  className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
                >
                  {state.message}
                </div>
              ) : null}

              <input type="hidden" name="requestId" value={requestId} />
              <input
                type="hidden"
                name="outletId"
                value={selectedOutletId}
              />
              <input
                type="hidden"
                name="registerId"
                value={selectedRegisterId}
              />

              <label className="grid min-w-0 gap-2 text-sm">
                <span className="font-medium text-neutral-800">
                  Nama perangkat
                </span>

                <input
                  name="name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  required
                  minLength={3}
                  maxLength={160}
                  className={inputClassName}
                  placeholder="Mini PC Kasir Bantar Gebang"
                />
              </label>

              <label className="grid min-w-0 gap-2 text-sm">
                <span className="font-medium text-neutral-800">
                  Kode Agent
                </span>

                <input
                  name="code"
                  value={code}
                  onChange={(event) =>
                    setCode(event.target.value.toUpperCase())
                  }
                  required
                  minLength={3}
                  maxLength={80}
                  autoCapitalize="characters"
                  autoCorrect="off"
                  spellCheck={false}
                  className={`${inputClassName} font-mono uppercase`}
                  placeholder="POS-BG1-HH"
                />

                <p className="text-xs leading-5 text-[var(--muted)]">
                  3–80 karakter. Gunakan huruf kapital, angka, underscore,
                  atau tanda hubung.
                </p>
              </label>

              <FormSubmitButton
                className="w-full rounded-xl bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white"
              >
                Buat Hardware Agent
              </FormSubmitButton>
            </form>
          )}
              </div>
            </div>
            </>
          )}
        </div>
      </dialog>
    </>
  );
}
