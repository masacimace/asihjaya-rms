import { ArrowLeft, CheckCircle2, Palette, PlusCircle } from "lucide-react";
import Link from "next/link";

import { saveProductColorPresetAction } from "@/app/actions/product-color-presets";
import { getProductColorPresetSettingsData } from "@/features/settings/product-color-presets";
import { requirePermission } from "@/lib/auth/session";

export const metadata = {
  title: "Varian Warna Produk",
};

export const runtime = "nodejs";

const inputClassName =
  "h-11 w-full rounded-xl border border-[var(--border)] bg-white px-3 text-sm text-neutral-950 outline-none transition placeholder:text-neutral-400 focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent-soft)]";
const textareaClassName =
  "min-h-24 w-full resize-y rounded-xl border border-[var(--border)] bg-white px-3 py-3 text-sm text-neutral-950 outline-none transition placeholder:text-neutral-400 focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent-soft)]";
const labelClassName = "mb-1.5 block text-xs font-semibold text-neutral-700";

function PresetFields({
  preset,
}: {
  preset?: {
    id: string;
    name: string;
    description: string | null;
    isActive: boolean;
  };
}) {
  return (
    <>
      {preset ? <input type="hidden" name="presetId" value={preset.id} /> : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <label>
          <span className={labelClassName}>
            Nama Warna <span className="text-red-500">*</span>
          </span>
          <input
            name="name"
            required
            maxLength={64}
            defaultValue={preset?.name ?? ""}
            placeholder="Contoh: Kuning, Rose Gold, Kombinasi"
            className={inputClassName}
          />
        </label>

        <label className="flex items-center gap-3 self-end rounded-xl border border-[var(--border)] bg-neutral-50 px-3 py-3 text-sm font-medium text-neutral-800">
          <input
            type="checkbox"
            name="isActive"
            defaultChecked={preset?.isActive ?? true}
            className="size-4 accent-[var(--accent)]"
          />
          Aktif dan dapat dipilih pada form produk
        </label>

        <label className="sm:col-span-2">
          <span className={labelClassName}>Deskripsi (opsional)</span>
          <textarea
            name="description"
            maxLength={500}
            defaultValue={preset?.description ?? ""}
            placeholder="Catatan singkat untuk membedakan varian warna, boleh dikosongkan."
            className={textareaClassName}
          />
        </label>
      </div>

      <button
        type="submit"
        className="mt-4 inline-flex h-10 items-center justify-center rounded-xl bg-neutral-950 px-4 text-sm font-semibold text-white transition hover:bg-neutral-800"
      >
        {preset ? "Simpan perubahan" : "Tambah preset warna"}
      </button>
    </>
  );
}

export default async function ProductColorPresetSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; message?: string }>;
}) {
  const auth = await requirePermission("settings.manage");
  const [presets, params] = await Promise.all([
    getProductColorPresetSettingsData(auth.organization.id),
    searchParams,
  ]);

  const message = params.message?.slice(0, 260) ?? null;
  const messageType = params.type === "error" ? "error" : "success";
  const activeCount = presets.filter((preset) => preset.isActive).length;

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-[var(--border)] bg-white p-6 lg:p-7">
        <Link
          href="/admin/pengaturan"
          className="mb-5 inline-flex items-center gap-2 text-sm font-semibold text-neutral-700 hover:text-[var(--accent)]"
        >
          <ArrowLeft className="size-4" />
          Kembali ke Pengaturan
        </Link>

        <div className="inline-flex items-center gap-2 rounded-full bg-[var(--accent-soft)] px-3 py-1 text-xs font-semibold text-[var(--accent)]">
          <Palette className="size-3.5" />
          Master produk
        </div>
        <h1 className="mt-4 text-2xl font-semibold text-neutral-950 sm:text-3xl">
          Varian Warna Produk
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--muted)]">
          Kelola pilihan warna yang digunakan pada Tambah Produk, Edit Item,
          Buyback, dan Pemrosesan Buyback. Deskripsi bersifat opsional dan nama
          warna tetap disimpan sebagai snapshot pada item/transaksi.
        </p>
        <p className="mt-3 flex items-center gap-2 text-xs font-semibold text-emerald-700">
          <CheckCircle2 className="size-4" />
          {activeCount} preset aktif dari {presets.length} total preset.
        </p>
      </section>

      {message ? (
        <div
          className={
            messageType === "error"
              ? "rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
              : "rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
          }
        >
          {message}
        </div>
      ) : null}

      <section className="rounded-3xl border border-[var(--border)] bg-white p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <div className="grid size-10 shrink-0 place-items-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent)]">
            <PlusCircle className="size-5" />
          </div>
          <div>
            <h2 className="font-semibold text-neutral-950">Tambah Preset Warna</h2>
            <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
              Nama warna harus unik. Preset baru langsung aktif kecuali checkbox dinonaktifkan.
            </p>
          </div>
        </div>

        <form action={saveProductColorPresetAction} className="mt-5">
          <PresetFields />
        </form>
      </section>

      <section className="rounded-3xl border border-[var(--border)] bg-white p-5 sm:p-6">
        <div>
          <h2 className="font-semibold text-neutral-950">Daftar Preset</h2>
          <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
            Nonaktifkan preset yang sudah tidak dipakai daripada menghapusnya,
            sehingga nilai warna pada data lama tetap aman.
          </p>
        </div>

        <div className="mt-5 grid gap-3">
          {presets.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-[var(--border)] px-4 py-6 text-sm text-[var(--muted)]">
              Belum ada preset warna. Tambahkan preset pertama dari form di atas.
            </p>
          ) : (
            presets.map((preset) => (
              <details
                key={preset.id}
                className="rounded-2xl border border-[var(--border)] p-4"
              >
                <summary className="cursor-pointer list-none">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-neutral-950">{preset.name}</p>
                      <p className="mt-1 line-clamp-2 text-xs leading-5 text-[var(--muted)]">
                        {preset.description || "Tanpa deskripsi"}
                      </p>
                    </div>
                    <span
                      className={
                        preset.isActive
                          ? "shrink-0 text-xs font-semibold text-emerald-700"
                          : "shrink-0 text-xs font-semibold text-neutral-400"
                      }
                    >
                      {preset.isActive ? "Aktif" : "Nonaktif"}
                    </span>
                  </div>
                </summary>

                <form
                  action={saveProductColorPresetAction}
                  className="mt-4 border-t border-[var(--border)] pt-4"
                >
                  <PresetFields preset={preset} />
                </form>
              </details>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
