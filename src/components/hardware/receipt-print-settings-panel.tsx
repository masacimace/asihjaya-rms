"use client";

import { FileText, Printer, Settings2, X, AlertTriangle } from "lucide-react";
import { useRef, useState } from "react";

import { updateOutletReceiptPrintModeAction } from "@/app/actions/receipt-print-settings";
import {
  type OutletReceiptPrintMode,
} from "@/features/hardware/receipt-print-settings";

type OutletPrintSetting = {
  id: string;
  name: string;
  mode: OutletReceiptPrintMode;
  pendingJobs: number;
};

const MODE_CUSTOM: OutletReceiptPrintMode = "preprinted_overlay";
const MODE_PLAIN: OutletReceiptPrintMode = "full_design_front_only";

function PrintModeRow({ outlet, canManage }: { outlet: OutletPrintSetting; canManage: boolean }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [selected, setSelected] = useState<OutletReceiptPrintMode>(outlet.mode);
  const isPlain = selected === MODE_PLAIN;

  return (
    <div className="border-t border-[var(--border)] px-5 py-5 first:border-t-0 lg:px-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="font-semibold text-neutral-950">{outlet.name}</p>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {outlet.mode === MODE_CUSTOM
              ? "Kertas Custom Vendor · Pre-printed Overlay · A5 noscale"
              : "Kertas Polos · Full Design Front Only · A5 fit"}
          </p>
          <p className="mt-1 text-xs text-[var(--muted)]">
            Auto Print Sale dan Buyback · 1 item = 1 halaman nota · Simplex
          </p>
        </div>
        {canManage ? (
          <button type="button" onClick={() => { setSelected(outlet.mode); dialog.current?.showModal(); }}
            className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-white px-4 py-2 text-sm font-semibold text-neutral-800 transition hover:border-[var(--accent)] hover:text-[var(--accent)]">
            <Settings2 className="size-4" /> Ubah Mode Cetak
          </button>
        ) : null}
      </div>
      {outlet.pendingJobs > 0 ? (
        <p className="mt-3 flex items-start gap-2 text-xs text-amber-800">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          {outlet.pendingJobs} job cetak masih dalam antrean/proses. Job tersebut mempertahankan mode saat dibuat; cek jenis kertas sebelum melanjutkan.
        </p>
      ) : null}
      <dialog ref={dialog} className="m-auto w-[calc(100%-2rem)] max-w-lg overflow-hidden rounded-3xl border border-[var(--border)] bg-white p-0 shadow-2xl backdrop:bg-black/40">
        <div className="flex items-start justify-between border-b border-[var(--border)] p-5">
          <div><h3 className="text-lg font-semibold text-neutral-950">Ubah Mode Cetak Nota</h3>
            <p className="mt-1 text-sm text-[var(--muted)]">{outlet.name}</p></div>
          <button type="button" onClick={() => dialog.current?.close()} className="rounded-lg p-2 text-neutral-500 hover:bg-neutral-100" aria-label="Tutup"><X className="size-5" /></button>
        </div>
        <form action={updateOutletReceiptPrintModeAction} className="space-y-4 p-5">
          <input type="hidden" name="outletId" value={outlet.id} />
          <fieldset className="space-y-3">
            <legend className="mb-2 text-sm font-semibold text-neutral-800">Pilih media cetak otomatis</legend>
            <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-[var(--border)] p-4">
              <input type="radio" name="mode" value={MODE_CUSTOM} checked={selected === MODE_CUSTOM} onChange={() => setSelected(MODE_CUSTOM)} className="mt-1 accent-amber-700" />
              <span><strong className="block text-sm">Kertas Custom Vendor</strong><span className="mt-1 block text-xs leading-5 text-[var(--muted)]">Hanya data transaksi di atas kertas pre-printed, A5 noscale.</span></span>
            </label>
            <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-[var(--border)] p-4">
              <input type="radio" name="mode" value={MODE_PLAIN} checked={selected === MODE_PLAIN} onChange={() => setSelected(MODE_PLAIN)} className="mt-1 accent-amber-700" />
              <span><strong className="block text-sm">Kertas Polos — Full Design Front Only</strong><span className="mt-1 block text-xs leading-5 text-[var(--muted)]">Desain lengkap halaman depan saja, A5 fit; tanpa ketentuan di belakang.</span></span>
            </label>
          </fieldset>
          <div className="rounded-xl bg-amber-50 p-4 text-xs leading-5 text-amber-950">
            <div className="flex items-center gap-2 font-semibold"><AlertTriangle className="size-4" /> Periksa media pada printer</div>
            <p className="mt-2">Mode baru membutuhkan <strong>{isPlain ? "kertas A5 polos" : "kertas A5 custom vendor"}</strong> pada EPSON L3250 Series. Job yang sudah dibuat tetap memakai mode sebelumnya.</p>
            {outlet.pendingJobs > 0 ? <p className="mt-2 font-semibold">Masih ada {outlet.pendingJobs} job cetak aktif; tunggu atau periksa antrean sebelum mengganti kertas.</p> : null}
          </div>
          <label className="flex items-start gap-2 text-xs leading-5 text-neutral-700">
            <input key={selected} type="checkbox" name="confirmPaper" value="yes" required className="mt-1 accent-amber-700" />
            Saya memahami bahwa kertas harus disesuaikan dan perubahan hanya berlaku untuk job baru.
          </label>
          <div className="flex justify-end gap-2 border-t border-[var(--border)] pt-4">
            <button type="button" onClick={() => dialog.current?.close()} className="rounded-xl border border-[var(--border)] px-4 py-2 text-sm font-medium">Batal</button>
            <button type="submit" disabled={selected === outlet.mode} className="rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40">Simpan Mode</button>
          </div>
        </form>
      </dialog>
    </div>
  );
}

export function ReceiptPrintSettingsPanel({ outlets, canManage }: { outlets: OutletPrintSetting[]; canManage: boolean }) {
  return (
    <section className="overflow-hidden rounded-3xl border border-[var(--border)] bg-white">
      <header className="flex items-start gap-3 border-b border-[var(--border)] p-5 lg:p-6">
        <div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent)]"><Printer className="size-5" /></div>
        <div><h2 className="text-xl font-semibold text-neutral-950">Pengaturan Cetak Nota</h2>
          <p className="mt-1 text-sm leading-6 text-[var(--muted)]">Satu mode per outlet, berlaku langsung pada Auto Print Sale dan Buyback serta job reprint baru. Download Full Design dua sisi tidak berubah.</p></div>
      </header>
      {outlets.length === 0 ? (
        <p className="p-5 text-sm text-[var(--muted)]">Belum ada outlet yang dapat diakses.</p>
      ) : outlets.map(outlet => <PrintModeRow key={outlet.id} outlet={outlet} canManage={canManage} />)}
      <div className="flex items-start gap-2 border-t border-[var(--border)] bg-[var(--surface-muted)] px-5 py-3 text-xs leading-5 text-[var(--muted)]">
        <FileText className="mt-0.5 size-4 shrink-0" />
        Konfigurasi disimpan ke database. Tanpa restart server atau Hardware Hub; mode pada job lama tidak berubah.
      </div>
    </section>
  );
}
