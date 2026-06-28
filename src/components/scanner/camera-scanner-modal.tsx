"use client";

import { ScanBarcode, Search, X } from "lucide-react";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { useZxing } from "react-zxing";

type CameraScannerModalProps = {
  isOpen: boolean;
  isProcessing?: boolean;
  onClose: () => void;
  onScan: (result: string) => void;
};

export function CameraScannerModal({
  isOpen,
  isProcessing = false,
  onClose,
  onScan,
}: CameraScannerModalProps) {
  const hasSubmittedScanRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [manualScanValue, setManualScanValue] = useState("");

  const { ref } = useZxing({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onDecodeResult(result: any) {
      if (hasSubmittedScanRef.current || isProcessing) {
        return;
      }

      const text = result.getText
        ? result.getText()
        : result.rawValue || result.text || result;

      if (text && typeof text === "string") {
        hasSubmittedScanRef.current = true;
        onScan(text);
      }
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onError(error: any) {
      // Ignore common errors like NotFoundException during continuous scanning.
      if (error?.name === "NotFoundException") {
        return;
      }

      if (error?.name === "NotAllowedError") {
        setError(
          "Akses kamera ditolak. Izinkan kamera di browser atau gunakan input manual.",
        );
        return;
      }

      console.error("Zxing error:", error);
    },
  });

  const closeScanner = useCallback(() => {
    setError(null);
    setManualScanValue("");
    hasSubmittedScanRef.current = false;
    onClose();
  }, [onClose]);

  function submitManualScan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const value = manualScanValue.trim();

    if (!value || hasSubmittedScanRef.current || isProcessing) {
      return;
    }

    hasSubmittedScanRef.current = true;
    onScan(value);
  }

  // Allow a new scan every time the modal opens.
  useEffect(() => {
    if (isOpen) {
      hasSubmittedScanRef.current = false;
    }
  }, [isOpen]);

  // Handle escape key.
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && isOpen) {
        closeScanner();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [closeScanner, isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <button
        type="button"
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={closeScanner}
        aria-label="Tutup scanner"
      />

      <div className="relative z-10 w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4">
          <div className="flex items-center gap-3 text-neutral-950">
            <ScanBarcode className="size-5 text-[var(--accent)]" />
            <h2 className="font-semibold">Scan Barcode / QR</h2>
          </div>

          <button
            type="button"
            onClick={closeScanner}
            className="grid size-9 place-items-center rounded-full bg-neutral-100 text-neutral-500 hover:bg-neutral-200 hover:text-neutral-950"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="relative aspect-square bg-black p-4">
          {error ? (
            <div className="flex h-full items-center justify-center rounded-2xl bg-neutral-950 p-6 text-center text-sm leading-6 text-red-300">
              {error}
            </div>
          ) : (
            <div className="relative h-full w-full overflow-hidden rounded-2xl bg-neutral-900">
              <video ref={ref} className="h-full w-full object-cover" />
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div className="size-48 rounded-xl border-2 border-dashed border-white/50 shadow-[0_0_0_4000px_rgba(0,0,0,0.4)]" />
              </div>
            </div>
          )}
        </div>

        <div className="space-y-4 bg-[var(--surface-muted)] px-5 py-4">
          <p className="text-center text-sm text-[var(--muted)]">
            {isProcessing
              ? "Sedang mencari item hasil scan..."
              : "Arahkan kamera ke barcode/QR, atau masukkan kode manual."}
          </p>

          <form onSubmit={submitManualScan} className="flex gap-2">
            <label className="flex h-11 min-w-0 flex-1 items-center gap-3 rounded-xl border border-[var(--border)] bg-white px-3 shadow-sm">
              <Search className="size-4 shrink-0 text-neutral-400" />

              <input
                value={manualScanValue}
                onChange={(event) => setManualScanValue(event.target.value)}
                placeholder="Input barcode/SKU manual"
                disabled={isProcessing}
                className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-neutral-400 disabled:cursor-not-allowed"
              />
            </label>

            <button
              type="submit"
              disabled={!manualScanValue.trim() || isProcessing}
              className="h-11 shrink-0 rounded-xl bg-[var(--accent)] px-4 text-sm font-semibold text-white transition hover:bg-[var(--accent)]/90 disabled:cursor-not-allowed disabled:bg-neutral-300"
            >
              Cari
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
