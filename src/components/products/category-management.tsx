"use client";

import {
  ChevronRight,
  CircleDot,
  FolderPen,
  Plus,
  Shapes,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";

import {
  CreateCategoryForm,
  EditCategoryForm,
} from "@/components/products/category-form";

export type CategoryListItem = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  isActive: boolean;
  productCount: number;
  activeProductCount: number;
  updatedAtLabel: string;
};

function DrawerShell({
  titleId,
  title,
  description,
  icon,
  onClose,
  children,
}: {
  titleId: string;
  title: string;
  description: string;
  icon: ReactNode;
  onClose: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[80] bg-black/35 md:flex md:justify-end"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <button
        type="button"
        aria-label="Tutup panel kategori"
        className="absolute inset-0 cursor-default"
        onClick={onClose}
      />

      <aside className="relative z-[1] flex h-[100dvh] w-full flex-col overflow-hidden bg-white shadow-2xl md:w-[min(620px,calc(100vw-32px))] md:border-l md:border-[var(--border)]">
        <header className="shrink-0 border-b border-[var(--border)] bg-white px-4 py-4 sm:px-5 md:px-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 items-start gap-3">
              <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]">
                {icon}
              </div>
              <div className="min-w-0">
                <h2
                  id={titleId}
                  className="text-lg font-semibold text-neutral-950"
                >
                  {title}
                </h2>
                <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
                  {description}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="grid size-9 shrink-0 place-items-center rounded-xl text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-950"
              aria-label="Tutup"
            >
              <X className="size-4" />
            </button>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-neutral-50/60 p-4 sm:p-5 md:p-6">
          {children}
        </div>
      </aside>
    </div>
  );
}

export function CategoryCreateDrawer({
  label = "Tambah Kategori",
}: {
  label?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-black px-4 text-sm font-semibold !text-white transition hover:brightness-95"
      >
        <Plus className="size-4" />
        {label}
      </button>

      {open ? (
        <DrawerShell
          titleId="create-category-title"
          title="Tambah Kategori"
          description="Buat kategori baru tanpa meninggalkan daftar kategori."
          icon={<Shapes className="size-5" />}
          onClose={() => setOpen(false)}
        >
          <CreateCategoryForm
            inlineSubmit
            onSuccess={() => setOpen(false)}
          />
        </DrawerShell>
      ) : null}
    </>
  );
}

export function CategoryListInteractive({
  categories,
  canManage,
}: {
  categories: CategoryListItem[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<CategoryListItem | null>(null);

  function openCategory(category: CategoryListItem) {
    if (canManage) {
      setSelected(category);
      return;
    }

    router.push(`/admin/produk/kategori/${category.id}`);
  }

  function handleKeyDown(
    event: ReactKeyboardEvent,
    category: CategoryListItem,
  ) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openCategory(category);
    }
  }

  return (
    <>
      <div className="hidden overflow-x-auto lg:block">
        <table className="w-full min-w-[880px] border-collapse text-left">
          <thead className="bg-[var(--surface-muted)] text-xs text-[var(--muted)]">
            <tr>
              <th className="px-5 py-3 font-medium">Kategori</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Product Master</th>
              <th className="px-4 py-3 font-medium">Diperbarui</th>
              <th className="w-12 px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {categories.map((category) => (
              <tr
                key={category.id}
                role="button"
                tabIndex={0}
                aria-label={`${canManage ? "Edit" : "Buka"} kategori ${category.name}`}
                onClick={() => openCategory(category)}
                onKeyDown={(event) => handleKeyDown(event, category)}
                className="group cursor-pointer align-middle outline-none transition hover:bg-neutral-50 focus-visible:bg-[var(--accent-soft)]/40"
              >
                <td className="px-5 py-4">
                  <div className="flex min-w-0 items-start gap-3">
                    <div className="grid size-11 shrink-0 place-items-center rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] text-[var(--accent)] transition group-hover:border-[var(--accent)]/30 group-hover:bg-[var(--accent-soft)]">
                      <Shapes className="size-5" />
                    </div>
                    <div className="min-w-0 max-w-xl">
                      <p className="font-semibold text-neutral-950">
                        {category.name}
                      </p>
                      <p className="mt-1 font-mono text-xs text-[var(--muted)]">
                        {category.code}
                      </p>
                      <p className="mt-1 line-clamp-1 text-xs leading-5 text-[var(--muted)]">
                        {category.description?.trim() || "Tanpa deskripsi"}
                      </p>
                    </div>
                  </div>
                </td>

                <td className="px-4 py-4">
                  <span
                    className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${
                      category.isActive
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                        : "border-neutral-200 bg-neutral-50 text-neutral-600"
                    }`}
                  >
                    {category.isActive ? "Aktif" : "Nonaktif"}
                  </span>
                </td>

                <td className="px-4 py-4">
                  <p className="font-semibold text-neutral-950">
                    {category.productCount} produk
                  </p>
                  <p className="mt-1 text-xs text-[var(--muted)]">
                    {category.activeProductCount} aktif
                  </p>
                </td>

                <td className="px-4 py-4 text-sm text-neutral-700">
                  {category.updatedAtLabel}
                </td>

                <td className="px-4 py-4 text-right">
                  <ChevronRight className="ml-auto size-4 text-neutral-400 transition group-hover:translate-x-0.5 group-hover:text-[var(--accent)]" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="divide-y divide-[var(--border)] lg:hidden">
        {categories.map((category) => (
          <button
            key={category.id}
            type="button"
            onClick={() => openCategory(category)}
            className="group block w-full p-4 text-left transition hover:bg-neutral-50 focus-visible:bg-[var(--accent-soft)]/40 focus-visible:outline-none sm:p-5"
          >
            <div className="flex items-start gap-3">
              <div className="grid size-11 shrink-0 place-items-center rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] text-[var(--accent)]">
                <Shapes className="size-5" />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="break-words font-semibold text-neutral-950">
                      {category.name}
                    </h3>
                    <p className="mt-1 font-mono text-xs text-[var(--muted)]">
                      {category.code}
                    </p>
                  </div>
                  <ChevronRight className="mt-1 size-4 shrink-0 text-neutral-400" />
                </div>

                <p className="mt-2 line-clamp-2 text-xs leading-5 text-[var(--muted)]">
                  {category.description?.trim() || "Tanpa deskripsi"}
                </p>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span
                    className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
                      category.isActive
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                        : "border-neutral-200 bg-neutral-50 text-neutral-600"
                    }`}
                  >
                    {category.isActive ? "Aktif" : "Nonaktif"}
                  </span>
                  <span className="rounded-full border border-[var(--border)] bg-[var(--surface-muted)] px-2.5 py-1 text-[11px] text-neutral-700">
                    {category.productCount} Product Master
                  </span>
                </div>

                <p className="mt-3 text-[11px] text-[var(--muted)]">
                  Diperbarui {category.updatedAtLabel}
                </p>
              </div>
            </div>
          </button>
        ))}
      </div>

      {selected ? (
        <DrawerShell
          titleId="edit-category-title"
          title="Edit Kategori"
          description={`${selected.name} · ${selected.code}`}
          icon={<FolderPen className="size-5" />}
          onClose={() => setSelected(null)}
        >
          <EditCategoryForm
            key={selected.id}
            category={selected}
            inlineSubmit
            onSuccess={() => setSelected(null)}
          />
        </DrawerShell>
      ) : null}
    </>
  );
}
