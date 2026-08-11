"use client";

import { CheckSquare2, LoaderCircle, Printer, RotateCcw, Square } from "lucide-react";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useMemo, useRef, useState } from "react";

import {
  printProductBatchImportLabelsAction,
  type ProductBatchImportLabelActionState,
} from "@/app/actions/product-batch-import";
import type {
  ProductBatchImportLabelJob,
  ProductBatchImportResultItem,
} from "@/features/product-batch-import/result-queries";

const initialState: ProductBatchImportLabelActionState = { status: "idle" };
const PRINTABLE_AVAILABILITY = new Set(["draft", "available", "reserved"]);

function newRequestId() {
  return globalThis.crypto?.randomUUID?.() ?? "";
}

function jobStatusClass(status: string) {
  if (status === "completed") return "bg-emerald-50 text-emerald-700";
  if (status === "failed" || status === "expired") return "bg-red-50 text-red-700";
  if (["pending", "claimed", "processing", "printing", "submitted"].includes(status)) {
    return "bg-amber-50 text-amber-700";
  }
  return "bg-neutral-100 text-neutral-700";
}

export function ProductBatchImportLabels({
  sessionId,
  items,
  labelJobs,
  canPrintLabels,
}: {
  sessionId: string;
  items: ProductBatchImportResultItem[];
  labelJobs: ProductBatchImportLabelJob[];
  canPrintLabels: boolean;
}) {
  const router = useRouter();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const requestIdInputRef = useRef<HTMLInputElement>(null);
  const [state, action, pending] = useActionState(
    printProductBatchImportLabelsAction,
    initialState,
  );

  useEffect(() => {
    if (state.status === "success") {
      if (requestIdInputRef.current) requestIdInputRef.current.value = "";
      router.refresh();
    }
  }, [router, state.status]);

  function ensureRequestId() {
    const input = requestIdInputRef.current;
    if (input && !input.value) input.value = newRequestId();
  }

  const latestJobByItemId = useMemo(() => {
    const map = new Map<string, ProductBatchImportLabelJob>();
    for (const job of labelJobs) {
      if (job.itemId && !map.has(job.itemId)) map.set(job.itemId, job);
    }
    return map;
  }, [labelJobs]);

  const selectableItems = items.filter(
    (item) =>
      item.isActive &&
      Boolean(item.outletId) &&
      PRINTABLE_AVAILABILITY.has(item.availability),
  );
  const selectableIds = new Set(selectableItems.map((item) => item.productItemId));
  const allSelected =
    selectableItems.length > 0 &&
    selectableItems.every((item) => selectedIds.includes(item.productItemId));

  function toggleAll() {
    setSelectedIds(allSelected ? [] : selectableItems.map((item) => item.productItemId));
  }

  function toggleItem(itemId: string) {
    setSelectedIds((current) =>
      current.includes(itemId)
        ? current.filter((value) => value !== itemId)
        : [...current, itemId],
    );
  }

  if (!canPrintLabels) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
        Result import tetap dapat dilihat dan di-download, tetapi akun ini tidak
        mempunyai permission <strong>inventory.print_label</strong> untuk membuat
        hardware label job.
      </div>
    );
  }

  return (
    <form action={action} onSubmit={ensureRequestId} className="space-y-4">
      <input type="hidden" name="sessionId" value={sessionId} />
      <input ref={requestIdInputRef} type="hidden" name="requestId" />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-semibold text-neutral-950">Label barcode</h3>
          <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
            Item tanpa outlet belum dapat dikirim ke Hardware Hub. Untuk reprint,
            pilih item yang sama lalu buat job label baru.
          </p>
        </div>
        <button
          type="button"
          onClick={toggleAll}
          disabled={selectableItems.length === 0 || pending}
          className="inline-flex h-9 items-center gap-2 rounded-xl border border-neutral-200 px-3 text-xs font-semibold text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
        >
          {allSelected ? <CheckSquare2 className="size-4" /> : <Square className="size-4" />}
          {allSelected ? "Batalkan semua pilihan" : "Pilih semua eligible"}
        </button>
      </div>

      <div className="max-h-[460px] space-y-2 overflow-y-auto pr-1">
        {items.map((item) => {
          const selectable = selectableIds.has(item.productItemId);
          const checked = selectedIds.includes(item.productItemId);
          const latestJob = latestJobByItemId.get(item.productItemId);
          return (
            <label
              key={item.productItemId}
              className={`flex min-w-0 items-start gap-3 rounded-2xl border p-3 ${
                selectable ? "border-neutral-200 bg-white" : "border-neutral-100 bg-neutral-50"
              }`}
            >
              <input
                type="checkbox"
                name="itemId"
                value={item.productItemId}
                checked={checked}
                disabled={!selectable || pending}
                onChange={() => toggleItem(item.productItemId)}
                className="mt-1 size-4 shrink-0"
              />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="break-words text-sm font-semibold text-neutral-950">
                      {item.displayName ?? item.productName}
                    </p>
                    <p className="mt-1 break-all font-mono text-[11px] text-[var(--muted)]">
                      {item.sku} · {item.barcode}
                    </p>
                  </div>
                  {latestJob ? (
                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${jobStatusClass(latestJob.status)}`}>
                      job {latestJob.status}
                    </span>
                  ) : null}
                </div>
                <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-neutral-700">
                  <span className="rounded-lg bg-neutral-100 px-2 py-1">
                    {item.outletCode ?? "Tanpa outlet"}
                  </span>
                  <span className="rounded-lg bg-neutral-100 px-2 py-1">
                    {item.availability}
                  </span>
                  {!selectable ? (
                    <span className="rounded-lg bg-amber-50 px-2 py-1 font-semibold text-amber-700">
                      Belum eligible label
                    </span>
                  ) : null}
                  {latestJob ? (
                    <span className="rounded-lg bg-neutral-100 px-2 py-1 font-mono">
                      {latestJob.id.slice(0, 8)}…
                    </span>
                  ) : null}
                </div>
              </div>
            </label>
          );
        })}
      </div>

      {state.message ? (
        <p
          className={`rounded-xl border p-3 text-xs font-medium leading-5 ${
            state.status === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-red-200 bg-red-50 text-red-800"
          }`}
        >
          {state.message}
        </p>
      ) : null}

      <div className="grid gap-2 sm:grid-cols-2">
        <button
          type="submit"
          name="mode"
          value="selected"
          disabled={pending || selectedIds.length === 0}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-neutral-200 bg-white px-4 text-sm font-semibold text-neutral-800 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? <LoaderCircle className="size-4 animate-spin" /> : <RotateCcw className="size-4" />}
          Print selected ({selectedIds.length})
        </button>
        <button
          type="submit"
          name="mode"
          value="all"
          disabled={pending || selectableItems.length === 0}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-neutral-950 px-4 text-sm font-semibold text-white hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? <LoaderCircle className="size-4 animate-spin" /> : <Printer className="size-4" />}
          Print all eligible ({selectableItems.length})
        </button>
      </div>
    </form>
  );
}
