"use client";

import { Barcode } from "lucide-react";
import { useRef, useState } from "react";

export function PrintLabelButton({ itemId }: { itemId: string }) {
  const [isPrinting, setIsPrinting] = useState(false);
  const requestIdRef = useRef<string | null>(null);

  async function handlePrint() {
    setIsPrinting(true);
    const requestId = requestIdRef.current ?? crypto.randomUUID();
    requestIdRef.current = requestId;
    try {
      const response = await fetch("/api/print-jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemId,
          copies: 1,
          requestId,
        }),
      });
      const body = (await response.json()) as {
        error?: string;
        duplicate?: boolean;
      };

      if (!response.ok) {
        throw new Error(body.error || "Failed to queue print job");
      }

      requestIdRef.current = null;
      alert(
        body.duplicate
          ? "Permintaan cetak ini sudah ada di antrean."
          : "Tugas cetak label berhasil dikirim ke antrean toko!",
      );
    } catch (error) {
      console.error(error);
      alert(
        error instanceof Error
          ? error.message
          : "Gagal mengirim tugas cetak label.",
      );
    } finally {
      setIsPrinting(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handlePrint}
      disabled={isPrinting}
      className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-white px-4 !text-sm !font-medium text-black transition hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:opacity-50"
    >
      <Barcode className="size-4" />
      {isPrinting ? "Mengirim..." : "Cetak Label"}
    </button>
  );
}
