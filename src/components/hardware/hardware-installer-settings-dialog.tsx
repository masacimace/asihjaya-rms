"use client";

import { Link2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef, useState } from "react";

import {
  updateHardwareInstallerSettingsAction,
  type HardwareInstallerSettingsState,
} from "@/app/actions/hardware-installer-settings";
import { FormSubmitButton } from "@/components/forms/form-submit-button";

const initialState: HardwareInstallerSettingsState = { status: "idle" };

export function HardwareInstallerSettingsDialog({ currentUrl }: { currentUrl: string | null }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const router = useRouter();
  const [value, setValue] = useState(currentUrl ?? "");
  const [state, action, pending] = useActionState(updateHardwareInstallerSettingsAction, initialState);
  useEffect(() => {
    if (state.status === "success") router.refresh();
  }, [state, router]);

  return (
    <>
      <button type="button" onClick={() => {
        setValue(currentUrl ?? "");
        dialog.current?.showModal();
      }} className="mt-3 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm font-semibold text-neutral-800 transition hover:bg-neutral-50">
        <Link2 className="size-4" /> Ubah Link Installer
      </button>
      <dialog ref={dialog} aria-labelledby="installer-settings-title" className="m-auto w-[calc(100%-2rem)] max-w-xl overflow-hidden rounded-3xl border border-[var(--border)] bg-white p-0 shadow-2xl backdrop:bg-black/40">
        <header className="flex items-start justify-between gap-3 border-b border-[var(--border)] p-5">
          <div>
            <h2 id="installer-settings-title" className="text-lg font-semibold text-neutral-950">Link Installer Hardware Hub</h2>
            <p className="mt-1 text-sm leading-6 text-[var(--muted)]">Berlaku untuk seluruh outlet. Tautan yang disimpan langsung digunakan tombol Download Installer.</p>
          </div>
          <button type="button" onClick={() => dialog.current?.close()} aria-label="Tutup pengaturan installer" className="rounded-lg p-2 text-neutral-500 hover:bg-neutral-100"><X className="size-5" /></button>
        </header>
        <form action={action} className="space-y-4 p-5">
          <div>
            <label htmlFor="hardware-installer-url" className="text-sm font-semibold text-neutral-800">Link download installer</label>
            <input id="hardware-installer-url" name="downloadUrl" type="url" required maxLength={2048} value={value} onChange={(event) => setValue(event.target.value)} disabled={pending}
              placeholder="https://github.com/.../ASIHJAYA-Hardware-Hub-Setup.exe"
              aria-describedby="hardware-installer-url-help"
              className="mt-2 min-h-11 w-full min-w-0 rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm text-neutral-950 outline-none focus:border-[var(--accent)]" />
            <p id="hardware-installer-url-help" className="mt-2 text-xs leading-5 text-[var(--muted)]">Gunakan link HTTPS langsung ke file ASIHJAYA-Hardware-Hub-Setup.exe dari release resmi.</p>
          </div>
          {state.status === "error" ? <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">{state.message}</p> : null}
          {state.status === "success" && value.trim() === state.downloadUrl ? <p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">{state.message}</p> : null}
          <footer className="flex flex-wrap justify-end gap-2 border-t border-[var(--border)] pt-4">
            <button type="button" onClick={() => dialog.current?.close()} className="rounded-xl border border-[var(--border)] px-4 py-2 text-sm font-medium text-neutral-800">Tutup</button>
            <FormSubmitButton pendingText="Menyimpan link...">Simpan Link</FormSubmitButton>
          </footer>
        </form>
      </dialog>
    </>
  );
}
