"use client";

import {
  AlertTriangle,
  AlignLeft,
  Check,
  CheckCircle2,
  CircleOff,
  Folder,
  FolderTree,
  Info,
  Layers3,
  ListOrdered,
  LoaderCircle,
  LockKeyhole,
  MoveRight,
  PackageSearch,
  PencilLine,
  Save,
  Shapes,
} from "lucide-react";
import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";

import {
  createProductCategoryAction,
  updateProductCategoryAction,
} from "@/app/actions/product-categories";
import { FormSubmitButton } from "@/components/forms/form-submit-button";
import {
  initialCategoryActionState,
  type CategoryActionState,
} from "@/features/products/category-contracts";

const inputClassName =
  "h-11 w-full rounded-xl border border-[var(--border)] bg-white px-3 text-sm text-neutral-950 outline-none transition placeholder:text-neutral-400 focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent-soft)]";

type CategoryData = {
  id: string;
  code: string;
  name: string;
  parentCategoryId: string | null;
  description: string | null;
  displayOrder: number;
  isActive: boolean;
};

type ParentCategoryOption = {
  id: string;
  code: string;
  name: string;
  displayOrder: number;
  isActive: boolean;
};

function ActionMessage({ state }: { state: CategoryActionState }) {
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

function SummaryRow({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-[var(--border)] pb-3 last:border-b-0 last:pb-0">
      <dt className="text-[var(--muted)]">{label}</dt>
      <dd
        className={`max-w-[58%] text-right font-medium text-neutral-900 ${
          mono ? "font-mono text-xs" : ""
        }`}
      >
        {value}
      </dd>
    </div>
  );
}

function CreateCategorySubmitButton({
  disabled,
  className,
}: {
  disabled: boolean;
  className?: string;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending || disabled}
      className={`flex h-11 items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-4 text-sm font-semibold text-white transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-55 ${
        className ?? ""
      }`}
    >
      {pending ? (
        <>
          <LoaderCircle className="size-4 animate-spin" />
          Membuat kategori...
        </>
      ) : (
        <>
          <Shapes className="size-4" />
          Buat Kategori
        </>
      )}
    </button>
  );
}

type CategoryFormProps =
  | {
      mode: "create";
      parentOptions: ParentCategoryOption[];
      defaultParentId?: string;
    }
  | {
      mode: "edit";
      category: CategoryData;
      parentOptions: ParentCategoryOption[];
    };

export function CreateCategoryForm({
  parentOptions,
  defaultParentId,
}: {
  parentOptions: ParentCategoryOption[];
  defaultParentId?: string;
}) {
  const [state, formAction] = useActionState(
    createProductCategoryAction,
    initialCategoryActionState,
  );

  const initialParentId = defaultParentId ?? "";
  const [structure, setStructure] = useState<"root" | "child">(
    initialParentId ? "child" : "root",
  );
  const [parentCategoryId, setParentCategoryId] = useState(initialParentId);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [displayOrder, setDisplayOrder] = useState("0");
  const [isActive, setIsActive] = useState(true);

  const selectedParent = parentOptions.find(
    (option) => option.id === parentCategoryId,
  );
  const hasParentOptions = parentOptions.length > 0;
  const codeIsComplete = /^[A-Z0-9][A-Z0-9_-]{1,31}$/.test(code);
  const nameIsComplete = name.trim().length >= 2;
  const displayOrderValue = Number.parseInt(displayOrder, 10);
  const orderIsComplete =
    /^\d+$/.test(displayOrder) &&
    displayOrderValue >= 0 &&
    displayOrderValue <= 9999;
  const structureIsComplete = structure === "root" || Boolean(selectedParent);
  const completedSteps = [
    structureIsComplete,
    codeIsComplete,
    nameIsComplete,
    orderIsComplete,
  ].filter(Boolean).length;
  const setupIsComplete = completedSteps === 4;
  const progress = Math.round((completedSteps / 4) * 100);
  const previewName = name.trim() || "Nama kategori belum diisi";
  const previewCode = code || "KODE-KATEGORI";

  function selectStructure(nextStructure: "root" | "child") {
    setStructure(nextStructure);

    if (nextStructure === "root") {
      setParentCategoryId("");
      return;
    }

    if (!parentCategoryId && parentOptions[0]) {
      setParentCategoryId(parentOptions[0].id);
    }
  }

  return (
    <form action={formAction} className="space-y-5">
      <ActionMessage state={state} />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px] xl:items-start">
        <div className="min-w-0 space-y-5">
          <section className="rounded-2xl border border-[var(--border)] bg-white p-4 sm:p-5">
            <div className="flex items-start gap-3">
              <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]">
                <FolderTree className="size-5" />
              </div>

              <div className="min-w-0">
                <span className="inline-flex w-fit rounded-full bg-[var(--accent-soft)] px-3 py-1 text-xs font-semibold text-[var(--accent)]">
                  Langkah 1
                </span>
                <h2 className="mt-3 font-semibold text-neutral-950">
                  Struktur Kategori
                </h2>
                <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
                  Kategori utama berada di tingkat pertama. Subkategori hanya
                  dapat berada di bawah satu kategori utama aktif.
                </p>
              </div>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                aria-pressed={structure === "root"}
                onClick={() => selectStructure("root")}
                className={`rounded-2xl border p-4 text-left transition ${
                  structure === "root"
                    ? "border-[var(--accent)] bg-[var(--accent-soft)]"
                    : "border-[var(--border)] bg-white hover:border-neutral-300"
                }`}
              >
                <div className="flex items-start gap-3">
                  <span
                    className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border ${
                      structure === "root"
                        ? "border-[var(--accent)] bg-[var(--accent)]"
                        : "border-neutral-300 bg-white"
                    }`}
                  >
                    {structure === "root" ? (
                      <Check className="size-3 text-white" />
                    ) : null}
                  </span>

                  <span>
                    <span className="flex items-center gap-2 text-sm font-semibold text-neutral-950">
                      <Folder className="size-4 text-[var(--accent)]" />
                      Kategori Utama
                    </span>
                    <span className="mt-1.5 block text-xs leading-5 text-[var(--muted)]">
                      Kelompok katalog tingkat pertama yang dapat memiliki
                      beberapa subkategori.
                    </span>
                  </span>
                </div>
              </button>

              <button
                type="button"
                aria-pressed={structure === "child"}
                disabled={!hasParentOptions}
                onClick={() => selectStructure("child")}
                className={`rounded-2xl border p-4 text-left transition disabled:cursor-not-allowed disabled:opacity-55 ${
                  structure === "child"
                    ? "border-[var(--accent)] bg-[var(--accent-soft)]"
                    : "border-[var(--border)] bg-white hover:border-neutral-300"
                }`}
              >
                <div className="flex items-start gap-3">
                  <span
                    className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border ${
                      structure === "child"
                        ? "border-[var(--accent)] bg-[var(--accent)]"
                        : "border-neutral-300 bg-white"
                    }`}
                  >
                    {structure === "child" ? (
                      <Check className="size-3 text-white" />
                    ) : null}
                  </span>

                  <span>
                    <span className="flex items-center gap-2 text-sm font-semibold text-neutral-950">
                      <Layers3 className="size-4 text-[var(--accent)]" />
                      Subkategori
                    </span>
                    <span className="mt-1.5 block text-xs leading-5 text-[var(--muted)]">
                      Struktur tingkat kedua yang berada di bawah satu kategori
                      utama aktif.
                    </span>
                  </span>
                </div>
              </button>
            </div>

            {!hasParentOptions ? (
              <div className="mt-4 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-900">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                <p className="text-xs leading-5">
                  Kategori utama aktif belum tersedia. Buat kategori utama
                  terlebih dahulu sebelum membuat subkategori.
                </p>
              </div>
            ) : null}

            {structure === "child" ? (
              <div className="mt-5">
                <label className="block text-sm">
                  <span className="mb-2 block font-medium text-neutral-800">
                    Kategori induk
                  </span>
                  <select
                    name="parentCategoryId"
                    required
                    value={parentCategoryId}
                    onChange={(event) =>
                      setParentCategoryId(event.target.value)
                    }
                    className={inputClassName}
                  >
                    <option value="">Pilih kategori utama</option>
                    {parentOptions.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.name} · {option.code}
                      </option>
                    ))}
                  </select>
                  <FieldError message={state.fieldErrors?.parentCategoryId} />
                </label>

                {selectedParent ? (
                  <div className="mt-4 rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] p-4">
                    <div className="flex items-start gap-3">
                      <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-white text-[var(--accent)]">
                        <FolderTree className="size-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-[var(--muted)]">
                          Kategori induk terpilih
                        </p>
                        <p className="mt-1 truncate text-sm font-semibold text-neutral-950">
                          {selectedParent.name}
                        </p>
                        <p className="mt-1 font-mono text-xs text-neutral-600">
                          {selectedParent.code}
                        </p>
                      </div>
                    </div>
                    <p className="mt-3 text-xs leading-5 text-[var(--muted)]">
                      Kategori baru akan tampil sebagai subkategori di bawah
                      struktur ini.
                    </p>
                  </div>
                ) : null}
              </div>
            ) : (
              <input type="hidden" name="parentCategoryId" value="" />
            )}
          </section>

          <section className="rounded-2xl border border-[var(--border)] bg-white p-4 sm:p-5">
            <div className="flex items-start gap-3">
              <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]">
                <Shapes className="size-5" />
              </div>

              <div className="min-w-0">
                <span className="inline-flex w-fit rounded-full bg-[var(--accent-soft)] px-3 py-1 text-xs font-semibold text-[var(--accent)]">
                  Langkah 2
                </span>
                <h2 className="mt-3 font-semibold text-neutral-950">
                  Identitas Kategori
                </h2>
                <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
                  Kode menjadi identitas internal permanen. Nama dapat digunakan
                  oleh admin untuk mengenali kelompok produk di katalog.
                </p>
              </div>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <label className="block text-sm">
                <span className="mb-2 block font-medium text-neutral-800">
                  Kode kategori
                </span>
                <input
                  name="code"
                  required
                  minLength={2}
                  maxLength={32}
                  autoCapitalize="characters"
                  autoCorrect="off"
                  value={code}
                  onChange={(event) =>
                    setCode(
                      event.target.value
                        .toUpperCase()
                        .replace(/\s+/g, "-")
                        .replace(/[^A-Z0-9_-]/g, "")
                        .slice(0, 32),
                    )
                  }
                  className={`${inputClassName} font-mono`}
                  placeholder="RING-WOMEN"
                />
                <p className="mt-1.5 text-xs leading-5 text-[var(--muted)]">
                  Gunakan 2–32 karakter: huruf kapital, angka, garis bawah, atau
                  tanda hubung.
                </p>
                <FieldError message={state.fieldErrors?.code} />
              </label>

              <label className="block text-sm">
                <span className="mb-2 flex items-center justify-between gap-3 font-medium text-neutral-800">
                  <span>Nama kategori</span>
                  <span className="text-xs font-normal text-[var(--muted)]">
                    {name.length}/120
                  </span>
                </span>
                <input
                  name="name"
                  required
                  minLength={2}
                  maxLength={120}
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  className={inputClassName}
                  placeholder="Cincin Wanita"
                />
                <FieldError message={state.fieldErrors?.name} />
              </label>
            </div>

            <div className="mt-4 rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] p-4">
              <div className="flex items-start gap-3">
                <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-white text-[var(--accent)]">
                  {structure === "child" ? (
                    <Layers3 className="size-5" />
                  ) : (
                    <Folder className="size-5" />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-neutral-950">
                    {previewName}
                  </p>
                  <p className="mt-1 font-mono text-xs text-neutral-600">
                    {previewCode}
                  </p>
                  <p className="mt-1.5 text-xs leading-5 text-[var(--muted)]">
                    {structure === "child"
                      ? selectedParent
                        ? `Subkategori dari ${selectedParent.name}`
                        : "Pilih kategori induk untuk melengkapi struktur."
                      : "Kategori utama tingkat pertama."}
                  </p>
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-[var(--border)] bg-white p-4 sm:p-5">
            <div className="flex items-start gap-3">
              <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-[var(--surface-muted)] text-neutral-700">
                <AlignLeft className="size-5" />
              </div>

              <div className="min-w-0">
                <span className="inline-flex w-fit rounded-full border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-1 text-xs font-semibold text-neutral-700">
                  Langkah 3
                </span>
                <h2 className="mt-3 font-semibold text-neutral-950">
                  Deskripsi & Urutan
                </h2>
                <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
                  Deskripsi membantu tim memahami cakupan kategori. Urutan
                  menentukan posisi kategori dalam tingkat yang sama.
                </p>
              </div>
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px]">
              <label className="block text-sm">
                <span className="mb-2 flex items-center justify-between gap-3 font-medium text-neutral-800">
                  <span>Deskripsi</span>
                  <span className="text-xs font-normal text-[var(--muted)]">
                    {description.length}/2.000
                  </span>
                </span>
                <textarea
                  name="description"
                  rows={6}
                  maxLength={2000}
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  className="w-full resize-y rounded-xl border border-[var(--border)] bg-white px-3 py-3 text-sm text-neutral-950 outline-none transition placeholder:text-neutral-400 focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent-soft)]"
                  placeholder="Jelaskan jenis produk yang termasuk dalam kategori ini"
                />
                <p className="mt-1.5 text-xs leading-5 text-[var(--muted)]">
                  Deskripsi bersifat internal dan membantu konsistensi
                  pengelolaan katalog.
                </p>
                <FieldError message={state.fieldErrors?.description} />
              </label>

              <div className="min-w-0">
                <label className="block text-sm">
                  <span className="mb-2 block font-medium text-neutral-800">
                    Urutan tampilan
                  </span>
                  <input
                    type="number"
                    name="displayOrder"
                    required
                    min={0}
                    max={9999}
                    step={1}
                    value={displayOrder}
                    onChange={(event) => setDisplayOrder(event.target.value)}
                    className={inputClassName}
                  />
                  <FieldError message={state.fieldErrors?.displayOrder} />
                </label>

                <div className="mt-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] p-4">
                  <div className="flex items-center gap-3">
                    <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-white text-sm font-semibold text-[var(--accent)]">
                      {orderIsComplete ? displayOrderValue : "–"}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-neutral-950">
                        Urutan kategori
                      </p>
                      <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
                        Angka lebih kecil tampil lebih dahulu.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>

        <aside className="min-w-0 space-y-5 xl:sticky xl:top-5">
          <section className="rounded-2xl border border-[var(--border)] bg-white p-4 sm:p-5">
            <div className="flex items-start gap-3">
              <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-[var(--surface-muted)] text-neutral-700">
                {isActive ? (
                  <CheckCircle2 className="size-5" />
                ) : (
                  <CircleOff className="size-5" />
                )}
              </div>
              <div className="min-w-0">
                <h2 className="font-semibold text-neutral-950">
                  Status Kategori
                </h2>
                <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
                  Tentukan apakah kategori langsung tersedia untuk produk master
                  baru.
                </p>
              </div>
            </div>

            <input
              type="checkbox"
              name="isActive"
              checked={isActive}
              readOnly
              className="sr-only"
            />

            <div className="mt-5 space-y-3">
              <button
                type="button"
                aria-pressed={isActive}
                onClick={() => setIsActive(true)}
                className={`w-full rounded-2xl border p-4 text-left transition ${
                  isActive
                    ? "border-emerald-300 bg-emerald-50"
                    : "border-[var(--border)] bg-white hover:border-neutral-300"
                }`}
              >
                <div className="flex items-start gap-3">
                  <span
                    className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border ${
                      isActive
                        ? "border-emerald-600 bg-emerald-600"
                        : "border-neutral-300 bg-white"
                    }`}
                  >
                    {isActive ? <Check className="size-3 text-white" /> : null}
                  </span>
                  <span>
                    <span className="block text-sm font-semibold text-neutral-950">
                      Kategori aktif
                    </span>
                    <span className="mt-1 block text-xs leading-5 text-[var(--muted)]">
                      Langsung tersedia untuk produk master baru setelah
                      disimpan.
                    </span>
                  </span>
                </div>
              </button>

              <button
                type="button"
                aria-pressed={!isActive}
                onClick={() => setIsActive(false)}
                className={`w-full rounded-2xl border p-4 text-left transition ${
                  !isActive
                    ? "border-neutral-400 bg-neutral-100"
                    : "border-[var(--border)] bg-white hover:border-neutral-300"
                }`}
              >
                <div className="flex items-start gap-3">
                  <span
                    className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border ${
                      !isActive
                        ? "border-neutral-700 bg-neutral-700"
                        : "border-neutral-300 bg-white"
                    }`}
                  >
                    {!isActive ? <Check className="size-3 text-white" /> : null}
                  </span>
                  <span>
                    <span className="block text-sm font-semibold text-neutral-950">
                      Kategori nonaktif
                    </span>
                    <span className="mt-1 block text-xs leading-5 text-[var(--muted)]">
                      Disimpan sebagai struktur persiapan dan belum tersedia
                      untuk produk baru.
                    </span>
                  </span>
                </div>
              </button>
            </div>

            {structure === "child" && isActive ? (
              <div className="mt-4 flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-blue-900">
                <Info className="mt-0.5 size-4 shrink-0" />
                <p className="text-xs leading-5">
                  Subkategori aktif hanya dapat digunakan selama kategori
                  induknya tetap berstatus aktif.
                </p>
              </div>
            ) : null}

            <FieldError message={state.fieldErrors?.isActive} />
          </section>

          <section className="rounded-2xl border border-[var(--border)] bg-white p-4 sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-neutral-950">
                  Ringkasan Setup
                </p>
                <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
                  Periksa struktur dan identitas sebelum menyimpan.
                </p>
              </div>
              <span
                className={`inline-flex shrink-0 rounded-full border px-2.5 py-1 text-xs font-semibold ${
                  setupIsComplete
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : "border-amber-200 bg-amber-50 text-amber-800"
                }`}
              >
                {completedSteps}/4
              </span>
            </div>

            <div className="mt-4 h-2 overflow-hidden rounded-full bg-neutral-100">
              <div
                className="h-full rounded-full bg-[var(--accent)] transition-[width]"
                style={{ width: `${progress}%` }}
              />
            </div>

            <dl className="mt-5 space-y-3 text-sm">
              <SummaryRow
                label="Struktur"
                value={structure === "root" ? "Kategori utama" : "Subkategori"}
              />
              <SummaryRow
                label="Induk"
                value={
                  structure === "root"
                    ? "Tidak ada"
                    : (selectedParent?.name ?? "Belum dipilih")
                }
              />
              <SummaryRow
                label="Identitas"
                value={code || "Belum lengkap"}
                mono={Boolean(code)}
              />
              <SummaryRow
                label="Urutan"
                value={
                  orderIsComplete ? String(displayOrderValue) : "Belum valid"
                }
              />
              <SummaryRow
                label="Deskripsi"
                value={description.trim() ? "Tersedia" : "Belum diisi"}
              />
              <SummaryRow
                label="Status"
                value={isActive ? "Aktif" : "Nonaktif"}
              />
            </dl>
          </section>

          <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] p-4">
            <p className="text-sm font-semibold text-neutral-950">
              Buat kategori baru
            </p>
            <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
              Setelah tersimpan, kode menjadi permanen dan kategori aktif dapat
              langsung dipilih pada produk master.
            </p>

            <CreateCategorySubmitButton
              disabled={!setupIsComplete}
              className="mt-4 w-full"
            />

            {!setupIsComplete ? (
              <p className="mt-2 text-center text-xs leading-5 text-[var(--muted)]">
                Lengkapi struktur, kode, nama, dan urutan terlebih dahulu.
              </p>
            ) : null}
          </section>
        </aside>
      </div>
    </form>
  );
}

type EditCategoryData = CategoryData & {
  parent: {
    id: string;
    code: string;
    name: string;
    isActive: boolean;
  } | null;
  productCount: number;
  activeProductCount: number;
  childCount: number;
  activeChildCount: number;
};

function EditCategorySubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending || disabled}
      className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-4 text-sm font-semibold text-white transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-55"
    >
      {pending ? (
        <>
          <LoaderCircle className="size-4 animate-spin" />
          Menyimpan perubahan...
        </>
      ) : (
        <>
          <Save className="size-4" />
          Simpan Perubahan
        </>
      )}
    </button>
  );
}

export function EditCategoryForm({
  category,
  parentOptions,
}: {
  category: EditCategoryData;
  parentOptions: ParentCategoryOption[];
}) {
  const router = useRouter();
  const action = updateProductCategoryAction.bind(null, category.id);
  const [state, formAction] = useActionState(
    action,
    initialCategoryActionState,
  );

  const initialStructure: "root" | "child" = category.parentCategoryId
    ? "child"
    : "root";
  const [structure, setStructure] = useState<"root" | "child">(
    initialStructure,
  );
  const [parentCategoryId, setParentCategoryId] = useState(
    category.parentCategoryId ?? "",
  );
  const [name, setName] = useState(category.name);
  const [description, setDescription] = useState(category.description ?? "");
  const [displayOrder, setDisplayOrder] = useState(
    String(category.displayOrder),
  );
  const [isActive, setIsActive] = useState(category.isActive);

  useEffect(() => {
    if (state.status === "success") {
      router.refresh();
    }
  }, [router, state.status]);

  const selectedParent =
    parentOptions.find((option) => option.id === parentCategoryId) ??
    (category.parent?.id === parentCategoryId ? category.parent : null);
  const hasParentOptions = parentOptions.length > 0;
  const canBecomeChild = category.childCount === 0 && hasParentOptions;
  const nameIsValid = name.trim().length >= 2 && name.trim().length <= 120;
  const parsedDisplayOrder = Number.parseInt(displayOrder, 10);
  const displayOrderIsValid =
    /^\d+$/.test(displayOrder) &&
    parsedDisplayOrder >= 0 &&
    parsedDisplayOrder <= 9999;
  const structureIsValid =
    structure === "root" || Boolean(selectedParent?.isActive);

  const initialSnapshot = JSON.stringify({
    name: category.name,
    parentCategoryId: category.parentCategoryId ?? "",
    description: category.description ?? "",
    displayOrder: String(category.displayOrder),
    isActive: category.isActive,
  });
  const currentSnapshot = JSON.stringify({
    name,
    parentCategoryId: structure === "root" ? "" : parentCategoryId,
    description,
    displayOrder,
    isActive,
  });
  const hasChanges = currentSnapshot !== initialSnapshot;
  const canSubmit =
    hasChanges && nameIsValid && displayOrderIsValid && structureIsValid;
  const changedFields = [
    name !== category.name,
    (structure === "root" ? "" : parentCategoryId) !==
      (category.parentCategoryId ?? ""),
    description !== (category.description ?? ""),
    displayOrder !== String(category.displayOrder),
    isActive !== category.isActive,
  ].filter(Boolean).length;
  const movingToChild = initialStructure === "root" && structure === "child";
  const movingToRoot = initialStructure === "child" && structure === "root";
  const changingParent =
    structure === "child" &&
    parentCategoryId !== (category.parentCategoryId ?? "");
  const deactivationBlockedByDependencies =
    category.isActive &&
    !isActive &&
    (category.activeProductCount > 0 || category.activeChildCount > 0);

  function selectStructure(nextStructure: "root" | "child") {
    if (nextStructure === "child" && !canBecomeChild) {
      return;
    }

    setStructure(nextStructure);

    if (nextStructure === "root") {
      setParentCategoryId("");
      return;
    }

    if (!parentCategoryId) {
      const firstActiveParent = parentOptions.find((option) => option.isActive);
      setParentCategoryId(firstActiveParent?.id ?? "");
    }
  }

  return (
    <form action={formAction} className="space-y-5">
      <ActionMessage state={state} />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_370px] xl:items-start">
        <div className="min-w-0 space-y-5">
          <section className="rounded-2xl border border-[var(--border)] bg-white p-4 sm:p-5">
            <div className="flex items-start gap-3">
              <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]">
                <PencilLine className="size-5" />
              </div>
              <div className="min-w-0">
                <span className="inline-flex w-fit rounded-full bg-[var(--accent-soft)] px-3 py-1 text-xs font-semibold text-[var(--accent)]">
                  Identitas kategori
                </span>
                <h2 className="mt-3 font-semibold text-neutral-950">
                  Profil Kategori
                </h2>
                <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
                  Perbarui nama kategori. Kode tetap menjadi identitas permanen
                  pada katalog dan audit log.
                </p>
              </div>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(220px,0.65fr)]">
              <label className="block text-sm">
                <span className="mb-2 block font-medium text-neutral-800">
                  Nama kategori
                </span>
                <input
                  name="name"
                  required
                  minLength={2}
                  maxLength={120}
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  className={inputClassName}
                  placeholder="Cincin Wanita"
                />
                <div className="mt-1.5 flex items-center justify-between gap-3 text-xs">
                  <span className="text-[var(--muted)]">
                    Nama tampil pada katalog dan pemilihan produk master.
                  </span>
                  <span className="shrink-0 text-[var(--muted)]">
                    {name.length}/120
                  </span>
                </div>
                <FieldError message={state.fieldErrors?.name} />
              </label>

              <div>
                <p className="mb-2 text-sm font-medium text-neutral-800">
                  Kode permanen
                </p>
                <div className="flex h-11 items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] px-3">
                  <LockKeyhole className="size-4 shrink-0 text-[var(--muted)]" />
                  <span className="min-w-0 truncate font-mono text-sm font-semibold text-neutral-950">
                    {category.code}
                  </span>
                </div>
                <p className="mt-1.5 text-xs leading-5 text-[var(--muted)]">
                  Kode tidak dapat diubah setelah kategori dibuat.
                </p>
              </div>
            </div>

            <div className="mt-5 rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] p-4">
              <div className="flex items-start gap-3">
                <div className="grid size-10 shrink-0 place-items-center rounded-xl border border-[var(--border)] bg-white text-[var(--accent)]">
                  {structure === "root" ? (
                    <Folder className="size-4" />
                  ) : (
                    <Layers3 className="size-4" />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-neutral-950">
                    {name.trim() || "Nama kategori belum diisi"}
                  </p>
                  <p className="mt-1 font-mono text-xs text-[var(--muted)]">
                    {category.code}
                  </p>
                  <p className="mt-2 text-xs leading-5 text-[var(--muted)]">
                    {structure === "root"
                      ? "Kategori utama pada tingkat pertama katalog."
                      : `Subkategori dari ${selectedParent?.name ?? "induk yang belum dipilih"}.`}
                  </p>
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-[var(--border)] bg-white p-4 sm:p-5">
            <div className="flex items-start gap-3">
              <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]">
                <FolderTree className="size-5" />
              </div>
              <div className="min-w-0">
                <span className="inline-flex w-fit rounded-full bg-[var(--accent-soft)] px-3 py-1 text-xs font-semibold text-[var(--accent)]">
                  Struktur katalog
                </span>
                <h2 className="mt-3 font-semibold text-neutral-950">
                  Posisi Kategori
                </h2>
                <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
                  Hierarki dibatasi satu tingkat. Kategori yang masih memiliki
                  subkategori tidak dapat dipindahkan menjadi subkategori.
                </p>
              </div>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                aria-pressed={structure === "root"}
                onClick={() => selectStructure("root")}
                className={`rounded-2xl border p-4 text-left transition ${
                  structure === "root"
                    ? "border-[var(--accent)] bg-[var(--accent-soft)]"
                    : "border-[var(--border)] bg-white hover:border-neutral-300"
                }`}
              >
                <div className="flex items-start gap-3">
                  <span
                    className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border ${
                      structure === "root"
                        ? "border-[var(--accent)] bg-[var(--accent)]"
                        : "border-neutral-300 bg-white"
                    }`}
                  >
                    {structure === "root" ? (
                      <Check className="size-3 text-white" />
                    ) : null}
                  </span>
                  <span>
                    <span className="flex items-center gap-2 text-sm font-semibold text-neutral-950">
                      <Folder className="size-4 text-[var(--accent)]" />
                      Kategori Utama
                    </span>
                    <span className="mt-1.5 block text-xs leading-5 text-[var(--muted)]">
                      Tetap berada pada tingkat pertama dan dapat memiliki
                      subkategori.
                    </span>
                  </span>
                </div>
              </button>

              <button
                type="button"
                aria-pressed={structure === "child"}
                disabled={!canBecomeChild}
                onClick={() => selectStructure("child")}
                className={`rounded-2xl border p-4 text-left transition disabled:cursor-not-allowed disabled:opacity-55 ${
                  structure === "child"
                    ? "border-[var(--accent)] bg-[var(--accent-soft)]"
                    : "border-[var(--border)] bg-white hover:border-neutral-300"
                }`}
              >
                <div className="flex items-start gap-3">
                  <span
                    className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border ${
                      structure === "child"
                        ? "border-[var(--accent)] bg-[var(--accent)]"
                        : "border-neutral-300 bg-white"
                    }`}
                  >
                    {structure === "child" ? (
                      <Check className="size-3 text-white" />
                    ) : null}
                  </span>
                  <span>
                    <span className="flex items-center gap-2 text-sm font-semibold text-neutral-950">
                      <Layers3 className="size-4 text-[var(--accent)]" />
                      Subkategori
                    </span>
                    <span className="mt-1.5 block text-xs leading-5 text-[var(--muted)]">
                      Tempatkan kategori di bawah satu kategori utama aktif.
                    </span>
                  </span>
                </div>
              </button>
            </div>

            {category.childCount > 0 ? (
              <div className="mt-4 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-900">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                <p className="text-xs leading-5">
                  Kategori ini masih memiliki {category.childCount} subkategori.
                  Pindahkan atau hapus relasi seluruh subkategori sebelum
                  mengubahnya menjadi subkategori.
                </p>
              </div>
            ) : !hasParentOptions ? (
              <div className="mt-4 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-900">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                <p className="text-xs leading-5">
                  Belum ada kategori utama aktif lain yang dapat dipilih sebagai
                  induk.
                </p>
              </div>
            ) : null}

            {structure === "child" ? (
              <div className="mt-5">
                <label className="block text-sm">
                  <span className="mb-2 block font-medium text-neutral-800">
                    Kategori induk
                  </span>
                  <select
                    value={parentCategoryId}
                    onChange={(event) =>
                      setParentCategoryId(event.target.value)
                    }
                    className={inputClassName}
                  >
                    <option value="">Pilih kategori induk</option>
                    {parentOptions.map((option) => (
                      <option
                        key={option.id}
                        value={option.id}
                        disabled={!option.isActive}
                      >
                        {option.name} · {option.code}
                        {option.isActive ? "" : " (Nonaktif)"}
                      </option>
                    ))}
                  </select>
                  <FieldError message={state.fieldErrors?.parentCategoryId} />
                </label>

                <div className="mt-4 rounded-2xl border border-blue-200 bg-blue-50 p-4">
                  <div className="flex items-start gap-3">
                    <MoveRight className="mt-0.5 size-4 shrink-0 text-blue-700" />
                    <div>
                      <p className="text-sm font-semibold text-blue-950">
                        {selectedParent?.name ?? "Induk belum dipilih"}
                      </p>
                      <p className="mt-1 font-mono text-xs text-blue-800">
                        {selectedParent?.code ?? "—"}
                      </p>
                      <p className="mt-2 text-xs leading-5 text-blue-800">
                        Subkategori akan tampil di bawah kategori utama ini dan
                        tidak dapat memiliki turunan sendiri.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            <input
              type="hidden"
              name="parentCategoryId"
              value={structure === "root" ? "" : parentCategoryId}
            />
          </section>

          <section className="rounded-2xl border border-[var(--border)] bg-white p-4 sm:p-5">
            <div className="flex items-start gap-3">
              <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]">
                <AlignLeft className="size-5" />
              </div>
              <div className="min-w-0">
                <span className="inline-flex w-fit rounded-full bg-[var(--accent-soft)] px-3 py-1 text-xs font-semibold text-[var(--accent)]">
                  Informasi tambahan
                </span>
                <h2 className="mt-3 font-semibold text-neutral-950">
                  Deskripsi & Urutan
                </h2>
                <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
                  Jelaskan cakupan kategori dan tentukan posisinya pada daftar
                  katalog.
                </p>
              </div>
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px]">
              <label className="block text-sm">
                <span className="mb-2 block font-medium text-neutral-800">
                  Deskripsi
                </span>
                <textarea
                  name="description"
                  rows={6}
                  maxLength={2000}
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  className="w-full resize-y rounded-xl border border-[var(--border)] bg-white px-3 py-3 text-sm text-neutral-950 outline-none transition placeholder:text-neutral-400 focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent-soft)]"
                  placeholder="Jelaskan jenis produk yang termasuk dalam kategori ini"
                />
                <div className="mt-1.5 flex items-center justify-between gap-3 text-xs">
                  <span className="text-[var(--muted)]">
                    Deskripsi membantu tim memahami cakupan kategori.
                  </span>
                  <span className="shrink-0 text-[var(--muted)]">
                    {description.length}/2000
                  </span>
                </div>
                <FieldError message={state.fieldErrors?.description} />
              </label>

              <label className="block text-sm">
                <span className="mb-2 block font-medium text-neutral-800">
                  Urutan tampilan
                </span>
                <input
                  type="number"
                  name="displayOrder"
                  required
                  min={0}
                  max={9999}
                  step={1}
                  value={displayOrder}
                  onChange={(event) => setDisplayOrder(event.target.value)}
                  className={inputClassName}
                />
                <div className="mt-3 rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] p-4">
                  <div className="flex items-center gap-2">
                    <ListOrdered className="size-4 text-[var(--accent)]" />
                    <span className="text-sm font-semibold text-neutral-950">
                      Urutan {displayOrderIsValid ? parsedDisplayOrder : "—"}
                    </span>
                  </div>
                  <p className="mt-2 text-xs leading-5 text-[var(--muted)]">
                    Angka lebih kecil muncul lebih dahulu di tingkat struktur
                    yang sama.
                  </p>
                </div>
                <FieldError message={state.fieldErrors?.displayOrder} />
              </label>
            </div>
          </section>
        </div>

        <aside className="min-w-0 space-y-5 xl:sticky xl:top-5">
          <section className="rounded-2xl border border-[var(--border)] bg-white p-4 sm:p-5">
            <div className="flex items-start gap-3">
              <div
                className={`grid size-11 shrink-0 place-items-center rounded-xl ${
                  isActive
                    ? "bg-emerald-50 text-emerald-700"
                    : "bg-neutral-100 text-neutral-600"
                }`}
              >
                {isActive ? (
                  <CheckCircle2 className="size-5" />
                ) : (
                  <CircleOff className="size-5" />
                )}
              </div>
              <div>
                <h2 className="font-semibold text-neutral-950">
                  Status Kategori
                </h2>
                <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
                  Atur ketersediaan kategori untuk produk master baru.
                </p>
              </div>
            </div>

            <div className="mt-5 space-y-3">
              <button
                type="button"
                aria-pressed={isActive}
                onClick={() => setIsActive(true)}
                className={`w-full rounded-2xl border p-4 text-left transition ${
                  isActive
                    ? "border-emerald-300 bg-emerald-50"
                    : "border-[var(--border)] bg-white hover:border-emerald-200"
                }`}
              >
                <div className="flex items-start gap-3">
                  <span
                    className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border ${
                      isActive
                        ? "border-emerald-600 bg-emerald-600"
                        : "border-neutral-300 bg-white"
                    }`}
                  >
                    {isActive ? <Check className="size-3 text-white" /> : null}
                  </span>
                  <span>
                    <span className="block text-sm font-semibold text-neutral-950">
                      Kategori aktif
                    </span>
                    <span className="mt-1 block text-xs leading-5 text-[var(--muted)]">
                      Dapat dipilih untuk produk master baru selama kategori
                      induk juga aktif.
                    </span>
                  </span>
                </div>
              </button>

              <button
                type="button"
                aria-pressed={!isActive}
                onClick={() => setIsActive(false)}
                className={`w-full rounded-2xl border p-4 text-left transition ${
                  !isActive
                    ? "border-neutral-400 bg-neutral-100"
                    : "border-[var(--border)] bg-white hover:border-neutral-300"
                }`}
              >
                <div className="flex items-start gap-3">
                  <span
                    className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border ${
                      !isActive
                        ? "border-neutral-700 bg-neutral-700"
                        : "border-neutral-300 bg-white"
                    }`}
                  >
                    {!isActive ? <Check className="size-3 text-white" /> : null}
                  </span>
                  <span>
                    <span className="block text-sm font-semibold text-neutral-950">
                      Kategori nonaktif
                    </span>
                    <span className="mt-1 block text-xs leading-5 text-[var(--muted)]">
                      Tidak tersedia untuk produk baru, tetapi histori dan
                      relasi lama tetap tersimpan.
                    </span>
                  </span>
                </div>
              </button>
            </div>

            {deactivationBlockedByDependencies ? (
              <div className="mt-4 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-900">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                <div className="text-xs leading-5">
                  <p className="font-semibold">Penonaktifan dapat ditolak</p>
                  <p className="mt-1">
                    {category.activeProductCount > 0
                      ? `${category.activeProductCount} produk aktif masih terhubung. `
                      : ""}
                    {category.activeChildCount > 0
                      ? `${category.activeChildCount} subkategori aktif masih berada di bawah kategori ini.`
                      : ""}
                  </p>
                </div>
              </div>
            ) : !isActive ? (
              <div className="mt-4 flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-blue-900">
                <Info className="mt-0.5 size-4 shrink-0" />
                <p className="text-xs leading-5">
                  Menonaktifkan kategori tidak menghapus produk, histori, atau
                  audit yang sudah tersimpan.
                </p>
              </div>
            ) : null}

            {isActive && structure === "child" && !selectedParent?.isActive ? (
              <div className="mt-4 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-800">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                <p className="text-xs leading-5">
                  Pilih kategori induk aktif sebelum menyimpan subkategori
                  aktif.
                </p>
              </div>
            ) : null}

            {isActive ? (
              <input type="hidden" name="isActive" value="on" />
            ) : null}
            <FieldError message={state.fieldErrors?.isActive} />
          </section>

          <section className="rounded-2xl border border-[var(--border)] bg-white p-4 sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-neutral-950">
                  Ringkasan Perubahan
                </p>
                <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
                  Tinjau kondisi kategori sebelum menyimpan.
                </p>
              </div>
              <span
                className={`inline-flex shrink-0 rounded-full border px-2.5 py-1 text-xs font-semibold ${
                  hasChanges
                    ? "border-amber-200 bg-amber-50 text-amber-800"
                    : "border-emerald-200 bg-emerald-50 text-emerald-700"
                }`}
              >
                {hasChanges ? "Belum disimpan" : "Tersimpan"}
              </span>
            </div>

            <dl className="mt-5 space-y-3 text-sm">
              <SummaryRow label="Nama" value={name.trim() || "Belum diisi"} />
              <SummaryRow label="Kode" value={category.code} mono />
              <SummaryRow
                label="Struktur"
                value={structure === "root" ? "Kategori utama" : "Subkategori"}
              />
              <SummaryRow
                label="Induk"
                value={
                  structure === "root"
                    ? "Tidak ada"
                    : (selectedParent?.name ?? "Belum dipilih")
                }
              />
              <SummaryRow
                label="Urutan"
                value={
                  displayOrderIsValid
                    ? String(parsedDisplayOrder)
                    : "Tidak valid"
                }
              />
              <SummaryRow
                label="Status"
                value={isActive ? "Aktif" : "Nonaktif"}
              />
              <SummaryRow
                label="Dependensi"
                value={`${category.activeProductCount} produk · ${category.activeChildCount} subkategori aktif`}
              />
              <SummaryRow
                label="Perubahan"
                value={
                  changedFields > 0 ? `${changedFields} field` : "Tidak ada"
                }
              />
            </dl>

            {movingToChild || movingToRoot || changingParent ? (
              <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-xs leading-5 text-blue-900">
                {movingToChild
                  ? "Kategori akan dipindahkan menjadi subkategori."
                  : movingToRoot
                    ? "Kategori akan dipindahkan menjadi kategori utama."
                    : "Kategori akan dipindahkan ke induk yang berbeda."}
              </div>
            ) : null}
          </section>

          <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] p-4">
            <div className="flex items-start gap-3">
              <PackageSearch className="mt-0.5 size-4 shrink-0 text-[var(--accent)]" />
              <div>
                <p className="text-sm font-semibold text-neutral-950">
                  Simpan perubahan
                </p>
                <p className="mt-2 mb-2 text-xs leading-5 text-[var(--muted)]">
                  Kode kategori tetap sama. Perubahan struktur dan status
                  langsung memengaruhi ketersediaan kategori pada produk master.
                </p>
              </div>
            </div>

            <EditCategorySubmitButton disabled={!canSubmit} />

            {!hasChanges ? (
              <p className="mt-2 text-center text-xs leading-5 text-[var(--muted)]">
                Belum ada perubahan yang perlu disimpan.
              </p>
            ) : !canSubmit ? (
              <p className="mt-2 text-center text-xs leading-5 text-amber-800">
                Periksa nama, struktur induk, dan urutan tampilan.
              </p>
            ) : null}
          </section>
        </aside>
      </div>
    </form>
  );
}

export function CategoryForm(props: CategoryFormProps) {
  const action =
    props.mode === "create"
      ? createProductCategoryAction
      : updateProductCategoryAction.bind(null, props.category.id);

  const [state, formAction] = useActionState(
    action,
    initialCategoryActionState,
  );

  const defaultParentId =
    props.mode === "edit"
      ? (props.category.parentCategoryId ?? "")
      : (props.defaultParentId ?? "");

  return (
    <form action={formAction} className="space-y-6">
      <ActionMessage state={state} />

      <section className="rounded-2xl border border-[var(--border)] bg-white p-5">
        <div className="flex items-start gap-3">
          <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]">
            <Shapes className="size-5" />
          </div>

          <div>
            <h2 className="font-semibold text-neutral-950">
              Informasi Kategori
            </h2>

            <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
              Kode menjadi identitas internal kategori dan tidak dapat diubah
              setelah kategori dibuat.
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="mb-2 block font-medium text-neutral-800">
              Kode kategori
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
                placeholder="Contoh: RING-WOMEN"
              />
            ) : (
              <input
                value={props.category.code}
                readOnly
                className={`${inputClassName} cursor-not-allowed bg-neutral-50 font-mono text-neutral-500`}
              />
            )}

            <FieldError message={state.fieldErrors?.code} />
          </label>

          <label className="block text-sm">
            <span className="mb-2 block font-medium text-neutral-800">
              Nama kategori
            </span>

            <input
              name="name"
              required
              minLength={2}
              maxLength={120}
              defaultValue={props.mode === "edit" ? props.category.name : ""}
              className={inputClassName}
              placeholder="Cincin Wanita"
            />

            <FieldError message={state.fieldErrors?.name} />
          </label>

          <label className="block text-sm">
            <span className="mb-2 block font-medium text-neutral-800">
              Kategori induk
            </span>

            <select
              name="parentCategoryId"
              defaultValue={defaultParentId}
              className={inputClassName}
            >
              <option value="">Tidak ada · kategori utama</option>

              {props.parentOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name} · {option.code}
                  {option.isActive ? "" : " (Nonaktif)"}
                </option>
              ))}
            </select>

            <p className="mt-1.5 text-xs leading-5 text-[var(--muted)]">
              Hierarki dibatasi satu tingkat. Subkategori tidak dapat menjadi
              induk bagi kategori lain.
            </p>

            <FieldError message={state.fieldErrors?.parentCategoryId} />
          </label>

          <label className="block text-sm">
            <span className="mb-2 block font-medium text-neutral-800">
              Urutan tampilan
            </span>

            <input
              type="number"
              name="displayOrder"
              required
              min={0}
              max={9999}
              step={1}
              defaultValue={
                props.mode === "edit" ? props.category.displayOrder : 0
              }
              className={inputClassName}
            />

            <p className="mt-1.5 text-xs leading-5 text-[var(--muted)]">
              Angka lebih kecil ditampilkan lebih dahulu.
            </p>

            <FieldError message={state.fieldErrors?.displayOrder} />
          </label>

          <label className="block text-sm sm:col-span-2">
            <span className="mb-2 block font-medium text-neutral-800">
              Deskripsi
            </span>

            <textarea
              name="description"
              rows={4}
              maxLength={2000}
              defaultValue={
                props.mode === "edit" ? (props.category.description ?? "") : ""
              }
              className="w-full resize-y rounded-xl border border-[var(--border)] bg-white px-3 py-3 text-sm text-neutral-950 outline-none transition placeholder:text-neutral-400 focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent-soft)]"
              placeholder="Penjelasan singkat mengenai kategori produk"
            />

            <FieldError message={state.fieldErrors?.description} />
          </label>
        </div>
      </section>

      <section className="rounded-2xl border border-[var(--border)] bg-white p-5">
        <div className="flex items-start gap-3">
          <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-[var(--surface-muted)] text-neutral-600">
            <FolderTree className="size-5" />
          </div>

          <div className="min-w-0 flex-1">
            <h2 className="font-semibold text-neutral-950">Status Kategori</h2>

            <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl border border-[var(--border)] p-4">
              <input
                type="checkbox"
                name="isActive"
                defaultChecked={
                  props.mode === "edit" ? props.category.isActive : true
                }
                className="mt-0.5 size-4 accent-[var(--accent)]"
              />

              <span>
                <span className="block text-sm font-medium text-neutral-900">
                  Kategori aktif
                </span>

                <span className="mt-1 block text-xs leading-5 text-[var(--muted)]">
                  Kategori aktif dapat dipilih untuk produk baru. Kategori
                  dengan produk aktif atau subkategori aktif tidak dapat
                  dinonaktifkan.
                </span>
              </span>
            </label>

            <FieldError message={state.fieldErrors?.isActive} />
          </div>
        </div>
      </section>

      <div className="flex justify-end">
        <FormSubmitButton
          pendingText={
            props.mode === "create"
              ? "Membuat kategori..."
              : "Menyimpan kategori..."
          }
        >
          {props.mode === "create" ? (
            <Shapes className="size-4" />
          ) : (
            <Save className="size-4" />
          )}

          {props.mode === "create" ? "Buat Kategori" : "Simpan Perubahan"}
        </FormSubmitButton>
      </div>
    </form>
  );
}
