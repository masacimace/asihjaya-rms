"use client";

import { Archive, ArchiveRestore } from "lucide-react";
import { useState } from "react";

import {
  archiveProductItemAction,
  restoreProductItemAction,
} from "@/app/actions/product-items";

export function ArchiveRestoreButtons({
  itemId,
  isActive,
}: {
  itemId: string;
  isActive: boolean;
}) {
  const [isPending, setIsPending] = useState(false);

  async function handleArchive() {
    if (!confirm("Apakah Anda yakin ingin mengarsipkan item ini? Item tidak akan muncul lagi di POS.")) {
      return;
    }
    
    setIsPending(true);
    try {
      const res = await archiveProductItemAction(itemId);
      if (res.status === "error") {
        alert(res.message);
      }
    } finally {
      setIsPending(false);
    }
  }

  async function handleRestore() {
    if (!confirm("Apakah Anda yakin ingin memulihkan item ini? Item akan kembali tersedia di etalase POS.")) {
      return;
    }
    
    setIsPending(true);
    try {
      const res = await restoreProductItemAction(itemId);
      if (res.status === "error") {
        alert(res.message);
      }
    } finally {
      setIsPending(false);
    }
  }

  if (isActive) {
    return (
      <button
        type="button"
        onClick={handleArchive}
        disabled={isPending}
        className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-red-100 px-6 font-medium text-red-700 outline-none transition hover:bg-red-200 focus:ring-4 focus:ring-red-100 disabled:opacity-50"
      >
        <Archive className="size-4" />
        {isPending ? "Memproses..." : "Arsipkan Item"}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleRestore}
      disabled={isPending}
      className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-emerald-100 px-6 font-medium text-emerald-700 outline-none transition hover:bg-emerald-200 focus:ring-4 focus:ring-emerald-100 disabled:opacity-50"
    >
      <ArchiveRestore className="size-4" />
      {isPending ? "Memproses..." : "Pulihkan Item"}
    </button>
  );
}
