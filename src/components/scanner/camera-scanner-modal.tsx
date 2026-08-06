"use client";

import { RotateCcw, ScanBarcode, Search, X } from "lucide-react";
import {
  FormEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { type DetectedBarcode, useZxing } from "react-zxing";

type CameraScannerModalProps = {
  isOpen: boolean;
  isProcessing?: boolean;
  onClose: () => void;
  onScan: (result: string) => void;
};

type CameraScannerDialogProps = Omit<CameraScannerModalProps, "isOpen">;

type CameraScannerViewportProps = {
  isPaused: boolean;
  onDecode: (result: DetectedBarcode) => void;
  onError: (error: unknown) => void;
  onReady: () => void;
};

const CAMERA_CONSTRAINTS: MediaStreamConstraints = {
  audio: false,
  video: {
    facingMode: { ideal: "environment" },
    width: { ideal: 1280 },
    height: { ideal: 720 },
  },
};

function getErrorName(error: unknown) {
  if (error instanceof DOMException) {
    return error.name;
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    typeof error.name === "string"
  ) {
    return error.name;
  }

  return null;
}

function getCameraErrorMessage(error: unknown) {
  const errorName = getErrorName(error);

  if (errorName === "NotAllowedError" || errorName === "SecurityError") {
    return "Akses kamera ditolak. Izinkan kamera untuk ajsystem.id melalui pengaturan browser, lalu coba lagi.";
  }

  if (
    errorName === "NotFoundError" ||
    errorName === "DevicesNotFoundError"
  ) {
    return "Kamera tidak ditemukan pada perangkat ini. Gunakan input barcode manual atau periksa kamera perangkat.";
  }

  if (
    errorName === "NotReadableError" ||
    errorName === "TrackStartError" ||
    errorName === "AbortError"
  ) {
    return "Kamera sedang digunakan aplikasi lain atau gagal dibuka. Tutup aplikasi kamera lain, lalu coba lagi.";
  }

  if (
    errorName === "OverconstrainedError" ||
    errorName === "ConstraintNotSatisfiedError"
  ) {
    return "Kamera perangkat tidak mendukung konfigurasi scanner. Muat ulang halaman lalu coba kembali.";
  }

  if (!window.isSecureContext) {
    return "Scanner kamera hanya dapat digunakan melalui HTTPS. Buka POS dari https://ajsystem.id.";
  }

  return "Kamera gagal dimulai. Periksa izin kamera, koneksi internet, lalu coba lagi atau gunakan input manual.";
}

function CameraScannerViewport({
  isPaused,
  onDecode,
  onError,
  onReady,
}: CameraScannerViewportProps) {
  const { ref } = useZxing({
    paused: isPaused,
    constraints: CAMERA_CONSTRAINTS,
    trySkew: true,
    timeBetweenDecodingAttempts: 200,
    onDecodeResult: onDecode,
    onError,
  });

  return (
    <div className="relative h-full w-full overflow-hidden rounded-2xl bg-neutral-900">
      <video
        ref={ref}
        autoPlay
        muted
        playsInline
        disablePictureInPicture
        onPlaying={onReady}
        className="h-full w-full object-cover"
      />

      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="h-32 w-56 rounded-xl border-2 border-dashed border-white/70 shadow-[0_0_0_4000px_rgba(0,0,0,0.4)]" />
      </div>
    </div>
  );
}

function CameraScannerDialog({
  isProcessing = false,
  onClose,
  onScan,
}: CameraScannerDialogProps) {
  const hasSubmittedScanRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [manualScanValue, setManualScanValue] = useState("");
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [scannerSession, setScannerSession] = useState(0);

  const handleDecode = useCallback(
    (result: DetectedBarcode) => {
      if (hasSubmittedScanRef.current || isProcessing) {
        return;
      }

      const text = result.rawValue?.trim();

      if (text) {
        hasSubmittedScanRef.current = true;
        onScan(text);
      }
    },
    [isProcessing, onScan],
  );

  const handleCameraError = useCallback((cameraError: unknown) => {
    console.error("Camera scanner error:", cameraError);
    setIsCameraReady(false);
    setError(getCameraErrorMessage(cameraError));
  }, []);

  const closeScanner = useCallback(() => {
    hasSubmittedScanRef.current = false;
    onClose();
  }, [onClose]);

  const retryCamera = useCallback(() => {
    setError(null);
    setIsCameraReady(false);
    hasSubmittedScanRef.current = false;
    setScannerSession((current) => current + 1);
  }, []);

  function submitManualScan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const value = manualScanValue.trim();

    if (!value || hasSubmittedScanRef.current || isProcessing) {
      return;
    }

    hasSubmittedScanRef.current = true;
    onScan(value);
  }

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closeScanner();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [closeScanner]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-3 py-4">
      <button
        type="button"
        className="absolute inset-0 backdrop-blur-xs"
        onClick={closeScanner}
        aria-label="Tutup scanner"
      />

      <div className="relative z-10 w-full max-w-sm overflow-hidden rounded-3xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4">
          <div className="flex items-center gap-3 text-neutral-950">
            <ScanBarcode className="size-5 text-[var(--accent)]" />
            <h2 className="font-semibold">Scan Barcode / QR</h2>
          </div>

          <button
            type="button"
            onClick={closeScanner}
            aria-label="Tutup scanner"
            className="grid size-9 place-items-center rounded-full bg-neutral-100 text-neutral-500 hover:bg-neutral-200 hover:text-neutral-950"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="relative aspect-[4/3] bg-black p-4">
          {error ? (
            <div className="flex h-full flex-col items-center justify-center gap-4 rounded-2xl bg-neutral-950 p-6 text-center text-sm leading-6 text-red-300">
              <p>{error}</p>
              <button
                type="button"
                onClick={retryCamera}
                className="inline-flex h-10 items-center gap-2 rounded-xl bg-white px-4 text-sm font-semibold text-neutral-950"
              >
                <RotateCcw className="size-4" />
                Coba kamera lagi
              </button>
            </div>
          ) : (
            <>
              <CameraScannerViewport
                key={scannerSession}
                isPaused={isProcessing}
                onDecode={handleDecode}
                onError={handleCameraError}
                onReady={() => setIsCameraReady(true)}
              />

              {!isCameraReady ? (
                <div className="pointer-events-none absolute inset-4 grid place-items-center rounded-2xl bg-black/60 text-sm font-medium text-white">
                  Menyiapkan kamera belakang...
                </div>
              ) : null}
            </>
          )}
        </div>

        <div className="space-y-4 bg-[var(--surface-muted)] px-5 py-4">
          <p className="text-center text-sm text-[var(--muted)]">
            {isProcessing
              ? "Sedang mencari item hasil scan..."
              : "Posisikan barcode mendatar di dalam kotak, atau masukkan kode manual."}
          </p>

          <form onSubmit={submitManualScan} className="flex gap-2">
            <label className="flex h-11 min-w-0 flex-1 items-center gap-3 rounded-xl border border-[var(--border)] bg-white px-3 shadow-sm">
              <Search className="size-4 shrink-0 text-neutral-400" />

              <input
                value={manualScanValue}
                onChange={(event) => setManualScanValue(event.target.value)}
                placeholder="Input barcode/SKU manual"
                disabled={isProcessing}
                inputMode="text"
                autoCapitalize="characters"
                autoCorrect="off"
                className="min-w-0 flex-1 bg-transparent !text-xs outline-none placeholder:text-neutral-400 disabled:cursor-not-allowed"
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

export function CameraScannerModal({
  isOpen,
  isProcessing = false,
  onClose,
  onScan,
}: CameraScannerModalProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <CameraScannerDialog
      isProcessing={isProcessing}
      onClose={onClose}
      onScan={onScan}
    />
  );
}
