"use client";

import { Gem, Plus, X } from "lucide-react";
import { useEffect, useState } from "react";

import { ProductMasterForm } from "@/components/products/product-master-form";
import type { ProductMasterCategoryOption } from "@/features/products/product-master-queries";

export function ProductMasterCreateDrawer({
  categories,
}: {
  categories: ProductMasterCategoryOption[];
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-white px-4 text-sm font-semibold text-neutral-700 transition hover:border-[var(--accent)] hover:bg-[var(--accent-soft)]/50 hover:text-[var(--accent)]"
      >
        <Plus className="size-4" />
        Tambah Product Master
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-[80] bg-black/35 md:flex md:justify-end"
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-product-master-title"
        >
          <button
            type="button"
            aria-label="Tutup panel Tambah Product Master"
            className="absolute inset-0 cursor-default"
            onClick={() => setOpen(false)}
          />

          <aside className="relative z-[1] flex h-[100dvh] w-full flex-col overflow-hidden bg-white shadow-2xl md:w-[min(620px,calc(100vw-32px))] md:border-l md:border-[var(--border)]">
            <header className="shrink-0 border-b border-[var(--border)] bg-white px-4 py-4 sm:px-5 md:px-6">
              <div className="flex items-start justify-between gap-4">
                <div className="flex min-w-0 items-start gap-3">
                  <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]">
                    <Gem className="size-5" />
                  </div>
                  <div className="min-w-0">
                    <h2
                      id="create-product-master-title"
                      className="text-lg font-semibold text-neutral-950"
                    >
                      Tambah Product Master
                    </h2>
                    <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
                      Buat master baru tanpa meninggalkan daftar produk.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="grid size-9 shrink-0 place-items-center rounded-xl text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-950"
                  aria-label="Tutup"
                >
                  <X className="size-4" />
                </button>
              </div>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-neutral-50/60 p-4 sm:p-5 md:p-6">
              {categories.length > 0 ? (
                <ProductMasterForm
                  mode="create"
                  categories={categories}
                  inlineSubmit
                  onSuccess={() => setOpen(false)}
                />
              ) : (
                <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-800">
                  Belum ada kategori aktif. Buat kategori terlebih dahulu sebelum membuat Product Master.
                </section>
              )}
            </div>
          </aside>
        </div>
      ) : null}
    </>
  );
}
