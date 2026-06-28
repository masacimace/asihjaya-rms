"use client";

import {
  AlertTriangle,
  Building2,
  Cpu,
  MonitorSmartphone,
  Save,
} from "lucide-react";
import { useActionState, useState } from "react";

import {
  createOutletAction,
  createRegisterAction,
  updateOutletAction,
  updateRegisterAction,
} from "@/app/actions/outlets-registers";
import { FormSubmitButton } from "@/components/forms/form-submit-button";
import {
  initialOperationsActionState,
  type OperationsActionState,
} from "@/features/administration/outlet-register-contracts";

const inputClassName =
  "h-11 w-full rounded-xl border border-[var(--border)] bg-white px-3 text-sm text-neutral-950 outline-none transition placeholder:text-neutral-400 focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent-soft)]";

type OutletData = {
  id: string;
  code: string;
  name: string;
  address: string | null;
  phone: string | null;
  isActive: boolean;
};

type RegisterData = {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
  isHardwareHub: boolean;
  outletId: string;
  outletCode: string;
  outletName: string;
};

type OutletOption = {
  id: string;
  code: string;
  name: string;

  hardwareHub: {
    id: string;
    code: string;
    name: string;
  } | null;
};

function ActionMessage({ state }: { state: OperationsActionState }) {
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

type OutletFormProps =
  | {
      mode: "create";
    }
  | {
      mode: "edit";
      outlet: OutletData;
    };

export function OutletForm(props: OutletFormProps) {
  const action =
    props.mode === "create"
      ? createOutletAction
      : updateOutletAction.bind(null, props.outlet.id);

  const [state, formAction] = useActionState(
    action,
    initialOperationsActionState,
  );

  return (
    <form action={formAction} className="space-y-6">
      <ActionMessage state={state} />

      <section className="rounded-2xl border border-[var(--border)] bg-white p-5">
        <div className="flex items-start gap-3">
          <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]">
            <Building2 className="size-5" />
          </div>

          <div>
            <h2 className="font-semibold text-neutral-950">Informasi Outlet</h2>

            <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
              Kode outlet digunakan sebagai identitas internal dan tidak dapat
              diubah setelah dibuat.
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="mb-2 block font-medium text-neutral-800">
              Kode outlet
            </span>

            {props.mode === "create" ? (
              <input
                name="code"
                required
                minLength={2}
                maxLength={24}
                autoCapitalize="characters"
                autoCorrect="off"
                className={inputClassName}
                placeholder="Contoh: BG"
              />
            ) : (
              <input
                value={props.outlet.code}
                readOnly
                className={`${inputClassName} cursor-not-allowed bg-neutral-50 font-mono text-neutral-500`}
              />
            )}

            <FieldError message={state.fieldErrors?.code} />
          </label>

          <label className="block text-sm">
            <span className="mb-2 block font-medium text-neutral-800">
              Nama outlet
            </span>

            <input
              name="name"
              required
              minLength={2}
              maxLength={160}
              defaultValue={props.mode === "edit" ? props.outlet.name : ""}
              className={inputClassName}
              placeholder="Outlet Bantar Gebang"
            />

            <FieldError message={state.fieldErrors?.name} />
          </label>

          <label className="block text-sm">
            <span className="mb-2 block font-medium text-neutral-800">
              Nomor telepon
            </span>

            <input
              name="phone"
              maxLength={32}
              defaultValue={
                props.mode === "edit" ? (props.outlet.phone ?? "") : ""
              }
              className={inputClassName}
              placeholder="08xxxxxxxxxx"
            />

            <FieldError message={state.fieldErrors?.phone} />
          </label>

          <div />

          <label className="block text-sm sm:col-span-2">
            <span className="mb-2 block font-medium text-neutral-800">
              Alamat
            </span>

            <textarea
              name="address"
              rows={4}
              maxLength={2000}
              defaultValue={
                props.mode === "edit" ? (props.outlet.address ?? "") : ""
              }
              className="w-full resize-y rounded-xl border border-[var(--border)] bg-white px-3 py-3 text-sm text-neutral-950 outline-none transition placeholder:text-neutral-400 focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent-soft)]"
              placeholder="Alamat lengkap outlet"
            />

            <FieldError message={state.fieldErrors?.address} />
          </label>
        </div>

        <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-xl border border-[var(--border)] p-4">
          <input
            type="checkbox"
            name="isActive"
            defaultChecked={
              props.mode === "edit" ? props.outlet.isActive : true
            }
            className="mt-0.5 size-4 accent-[var(--accent)]"
          />

          <span>
            <span className="block text-sm font-medium text-neutral-900">
              Outlet aktif
            </span>

            <span className="mt-1 block text-xs leading-5 text-[var(--muted)]">
              Outlet nonaktif tidak dapat digunakan untuk register, shift, atau
              transaksi baru.
            </span>
          </span>
        </label>

        <FieldError message={state.fieldErrors?.isActive} />
      </section>

      <div className="flex justify-end">
        <FormSubmitButton
          pendingText={
            props.mode === "create"
              ? "Membuat outlet..."
              : "Menyimpan outlet..."
          }
        >
          {props.mode === "create" ? (
            <Building2 className="size-4" />
          ) : (
            <Save className="size-4" />
          )}

          {props.mode === "create" ? "Buat Outlet" : "Simpan Perubahan"}
        </FormSubmitButton>
      </div>
    </form>
  );
}

type RegisterFormProps =
  | {
      mode: "create";
      outlets: OutletOption[];
      defaultOutletId?: string;
    }
  | {
      mode: "edit";
      outlets: OutletOption[];
      register: RegisterData;
    };

export function RegisterForm(props: RegisterFormProps) {
  const initialOutletId =
    props.mode === "edit"
      ? props.register.outletId
      : (props.defaultOutletId ?? props.outlets[0]?.id ?? "");

  const initialIsActive =
    props.mode === "edit" ? props.register.isActive : true;

  const initialIsHardwareHub =
    props.mode === "edit" ? props.register.isHardwareHub : false;

  const [selectedOutletId, setSelectedOutletId] = useState(initialOutletId);

  const [isActive, setIsActive] = useState(initialIsActive);

  const [isHardwareHub, setIsHardwareHub] = useState(initialIsHardwareHub);

  const action =
    props.mode === "create"
      ? createRegisterAction
      : updateRegisterAction.bind(null, props.register.id);

  const [state, formAction] = useActionState(
    action,
    initialOperationsActionState,
  );

  const selectedOutlet = props.outlets.find(
    (outlet) => outlet.id === selectedOutletId,
  );

  const replacingHub =
    isHardwareHub &&
    selectedOutlet?.hardwareHub &&
    (props.mode === "create" ||
      selectedOutlet.hardwareHub.id !== props.register.id)
      ? selectedOutlet.hardwareHub
      : null;

  function updateActive(checked: boolean) {
    setIsActive(checked);

    if (!checked) {
      setIsHardwareHub(false);
    }
  }

  return (
    <form action={formAction} className="space-y-6">
      <ActionMessage state={state} />

      <section className="rounded-2xl border border-[var(--border)] bg-white p-5">
        <div className="flex items-start gap-3">
          <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]">
            <MonitorSmartphone className="size-5" />
          </div>

          <div>
            <h2 className="font-semibold text-neutral-950">
              Informasi Register
            </h2>

            <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
              Register mewakili perangkat atau terminal kasir pada outlet.
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="mb-2 block font-medium text-neutral-800">
              Outlet
            </span>

            {props.mode === "create" ? (
              <select
                name="outletId"
                required
                value={selectedOutletId}
                onChange={(event) => setSelectedOutletId(event.target.value)}
                className={inputClassName}
              >
                <option value="">Pilih outlet</option>

                {props.outlets.map((outlet) => (
                  <option key={outlet.id} value={outlet.id}>
                    {outlet.name} · {outlet.code}
                  </option>
                ))}
              </select>
            ) : (
              <input
                value={`${props.register.outletName} · ${props.register.outletCode}`}
                readOnly
                className={`${inputClassName} cursor-not-allowed bg-neutral-50 text-neutral-500`}
              />
            )}

            <FieldError message={state.fieldErrors?.outletId} />
          </label>

          <label className="block text-sm">
            <span className="mb-2 block font-medium text-neutral-800">
              Kode register
            </span>

            {props.mode === "create" ? (
              <input
                name="code"
                required
                minLength={2}
                maxLength={32}
                autoCapitalize="characters"
                autoCorrect="off"
                className={inputClassName}
                placeholder="POS-01"
              />
            ) : (
              <input
                value={props.register.code}
                readOnly
                className={`${inputClassName} cursor-not-allowed bg-neutral-50 font-mono text-neutral-500`}
              />
            )}

            <FieldError message={state.fieldErrors?.code} />
          </label>

          <label className="block text-sm sm:col-span-2">
            <span className="mb-2 block font-medium text-neutral-800">
              Nama register
            </span>

            <input
              name="name"
              required
              minLength={2}
              maxLength={120}
              defaultValue={props.mode === "edit" ? props.register.name : ""}
              className={inputClassName}
              placeholder="Kasir Utama"
            />

            <FieldError message={state.fieldErrors?.name} />
          </label>
        </div>
      </section>

      <section className="rounded-2xl border border-[var(--border)] bg-white p-5">
        <h2 className="font-semibold text-neutral-950">Status dan Perangkat</h2>

        <div className="mt-5 space-y-3">
          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-[var(--border)] p-4">
            <input
              type="checkbox"
              name="isActive"
              checked={isActive}
              onChange={(event) => updateActive(event.target.checked)}
              className="mt-0.5 size-4 accent-[var(--accent)]"
            />

            <span>
              <span className="block text-sm font-medium text-neutral-900">
                Register aktif
              </span>

              <span className="mt-1 block text-xs leading-5 text-[var(--muted)]">
                Register aktif dapat digunakan untuk membuka shift dan membuat
                transaksi.
              </span>
            </span>
          </label>

          <FieldError message={state.fieldErrors?.isActive} />

          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-[var(--border)] p-4">
            <input
              type="checkbox"
              name="isHardwareHub"
              checked={isHardwareHub}
              disabled={!isActive}
              onChange={(event) => setIsHardwareHub(event.target.checked)}
              className="mt-0.5 size-4 accent-[var(--accent)] disabled:opacity-50"
            />

            <span>
              <span className="flex items-center gap-2 text-sm font-medium text-neutral-900">
                <Cpu className="size-4 text-[var(--accent)]" />
                Jadikan hardware hub
              </span>

              <span className="mt-1 block text-xs leading-5 text-[var(--muted)]">
                Hardware hub mengoordinasi printer, cash drawer, dan perangkat
                lokal outlet.
              </span>
            </span>
          </label>

          <FieldError message={state.fieldErrors?.isHardwareHub} />
        </div>

        {replacingHub ? (
          <div className="mt-4 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-800">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />

            <p className="text-xs leading-5">
              Register <strong>{replacingHub.name}</strong> ({replacingHub.code}
              ) saat ini adalah hardware hub. Menyimpan perubahan akan
              memindahkan status hub ke register ini.
            </p>
          </div>
        ) : null}
      </section>

      <div className="flex justify-end">
        <FormSubmitButton
          pendingText={
            props.mode === "create"
              ? "Membuat register..."
              : "Menyimpan register..."
          }
        >
          {props.mode === "create" ? (
            <MonitorSmartphone className="size-4" />
          ) : (
            <Save className="size-4" />
          )}

          {props.mode === "create" ? "Buat Register" : "Simpan Perubahan"}
        </FormSubmitButton>
      </div>
    </form>
  );
}
