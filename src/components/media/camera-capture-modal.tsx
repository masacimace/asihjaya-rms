"use client";

import { Camera, RotateCcw, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

const CAMERA_CONSTRAINTS: MediaStreamConstraints = {
  audio: false,
  video: {
    facingMode: { ideal: "environment" },
    width: { ideal: 1920 },
    height: { ideal: 1080 },
  },
};

const MAX_CAPTURE_DIMENSION = 1600;
const CAPTURE_JPEG_QUALITY = 0.9;

type CameraCaptureModalProps = {
  isOpen: boolean;
  title?: string;
  description?: string;
  onClose: () => void;
  onCapture: (file: File) => void;
};

type CameraCaptureDialogProps = Omit<CameraCaptureModalProps, "isOpen">;

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
    return "Akses kamera ditolak. Izinkan akses kamera untuk situs ini melalui pengaturan browser, lalu coba lagi.";
  }

  if (
    errorName === "NotFoundError" ||
    errorName === "DevicesNotFoundError"
  ) {
    return "Kamera tidak ditemukan pada perangkat ini. Periksa kamera perangkat lalu coba lagi.";
  }

  if (
    errorName === "NotReadableError" ||
    errorName === "TrackStartError" ||
    errorName === "AbortError"
  ) {
    return "Kamera sedang digunakan aplikasi lain atau gagal dibuka. Tutup aplikasi kamera lain lalu coba lagi.";
  }

  if (
    errorName === "OverconstrainedError" ||
    errorName === "ConstraintNotSatisfiedError"
  ) {
    return "Kamera perangkat tidak mendukung konfigurasi yang diminta. Muat ulang halaman lalu coba lagi.";
  }

  if (!window.isSecureContext) {
    return "Kamera di dalam aplikasi hanya dapat digunakan melalui HTTPS atau localhost.";
  }

  return "Kamera gagal dimulai. Periksa izin kamera pada browser lalu coba lagi.";
}

function stopMediaStream(stream: MediaStream | null) {
  stream?.getTracks().forEach((track) => track.stop());
}

function canvasToJpegBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
          return;
        }

        reject(new Error("Foto gagal diproses dari kamera."));
      },
      "image/jpeg",
      CAPTURE_JPEG_QUALITY,
    );
  });
}

function buildCameraFileName() {
  return `camera-${new Date().toISOString().replace(/[:.]/g, "-")}.jpg`;
}

function CameraCaptureDialog({
  title = "Ambil Foto",
  description = "Posisikan produk di dalam frame lalu tekan tombol kamera.",
  onClose,
  onCapture,
}: CameraCaptureDialogProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [cameraSession, setCameraSession] = useState(0);

  const stopCamera = useCallback(() => {
    stopMediaStream(streamRef.current);
    streamRef.current = null;

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  const closeCamera = useCallback(() => {
    stopCamera();
    onClose();
  }, [onClose, stopCamera]);

  useEffect(() => {
    let disposed = false;

    async function startCamera() {
      setError(null);
      setIsCameraReady(false);
      stopCamera();

      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
        setError(
          "Kamera di dalam aplikasi hanya dapat digunakan melalui browser yang mendukung kamera pada HTTPS atau localhost.",
        );
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia(
          CAMERA_CONSTRAINTS,
        );

        if (disposed) {
          stopMediaStream(stream);
          return;
        }

        streamRef.current = stream;

        if (!videoRef.current) {
          stopMediaStream(stream);
          streamRef.current = null;
          return;
        }

        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      } catch (cameraError) {
        if (disposed) return;
        console.error("Camera capture error:", cameraError);
        stopCamera();
        setError(getCameraErrorMessage(cameraError));
      }
    }

    void startCamera();

    return () => {
      disposed = true;
      stopCamera();
    };
  }, [cameraSession, stopCamera]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closeCamera();
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [closeCamera]);

  function retryCamera() {
    setError(null);
    setIsCameraReady(false);
    setCameraSession((current) => current + 1);
  }

  async function capturePhoto() {
    const video = videoRef.current;

    if (
      !video ||
      !isCameraReady ||
      isCapturing ||
      video.videoWidth <= 0 ||
      video.videoHeight <= 0
    ) {
      return;
    }

    setIsCapturing(true);
    setError(null);

    try {
      const sourceWidth = video.videoWidth;
      const sourceHeight = video.videoHeight;
      const scale = Math.min(
        1,
        MAX_CAPTURE_DIMENSION / Math.max(sourceWidth, sourceHeight),
      );
      const targetWidth = Math.max(1, Math.round(sourceWidth * scale));
      const targetHeight = Math.max(1, Math.round(sourceHeight * scale));
      const canvas = document.createElement("canvas");
      canvas.width = targetWidth;
      canvas.height = targetHeight;

      const context = canvas.getContext("2d");
      if (!context) {
        throw new Error("Canvas kamera tidak tersedia.");
      }

      context.drawImage(video, 0, 0, targetWidth, targetHeight);
      const blob = await canvasToJpegBlob(canvas);
      const file = new File([blob], buildCameraFileName(), {
        type: "image/jpeg",
        lastModified: Date.now(),
      });

      stopCamera();
      setIsCapturing(false);
      onCapture(file);
      onClose();
    } catch (captureError) {
      console.error("Camera photo capture error:", captureError);
      setIsCapturing(false);
      setError("Foto gagal diambil dari kamera. Coba ulangi pengambilan foto.");
    }
  }

  return (
    <div className="fixed inset-0 z-[80] flex min-h-dvh flex-col bg-black text-white">
      <div className="relative z-20 flex items-center justify-between gap-3 bg-black/80 px-4 py-3 backdrop-blur-sm sm:px-5">
        <div className="min-w-0">
          <h2 className="truncate text-base font-semibold">{title}</h2>
          <p className="mt-0.5 line-clamp-1 text-xs text-white/65">
            {description}
          </p>
        </div>

        <button
          type="button"
          onClick={closeCamera}
          aria-label="Tutup kamera"
          className="grid size-10 shrink-0 place-items-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
        >
          <X className="size-5" />
        </button>
      </div>

      <div className="relative min-h-0 flex-1 overflow-hidden bg-neutral-950">
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          disablePictureInPicture
          onPlaying={() => setIsCameraReady(true)}
          className="size-full object-contain"
        />

        {!error ? (
          <div className="pointer-events-none absolute inset-5 rounded-3xl border border-white/35 sm:inset-8">
            <span className="absolute left-0 top-0 size-9 rounded-tl-3xl border-l-2 border-t-2 border-white" />
            <span className="absolute right-0 top-0 size-9 rounded-tr-3xl border-r-2 border-t-2 border-white" />
            <span className="absolute bottom-0 left-0 size-9 rounded-bl-3xl border-b-2 border-l-2 border-white" />
            <span className="absolute bottom-0 right-0 size-9 rounded-br-3xl border-b-2 border-r-2 border-white" />
          </div>
        ) : null}

        {!error && !isCameraReady ? (
          <div className="absolute inset-0 grid place-items-center bg-black/60 px-6 text-center text-sm font-medium text-white">
            Menyiapkan kamera belakang...
          </div>
        ) : null}

        {error ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 bg-neutral-950 px-8 text-center">
            <div className="grid size-14 place-items-center rounded-full bg-white/10">
              <Camera className="size-6" />
            </div>
            <p className="max-w-sm text-sm leading-6 text-red-200">{error}</p>
            <button
              type="button"
              onClick={retryCamera}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-white px-4 text-sm font-semibold text-neutral-950"
            >
              <RotateCcw className="size-4" />
              Coba Kamera Lagi
            </button>
          </div>
        ) : null}
      </div>

      <div className="relative z-20 flex min-h-28 items-center justify-center bg-black px-4 py-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        <button
          type="button"
          onClick={capturePhoto}
          disabled={!isCameraReady || Boolean(error) || isCapturing}
          aria-label="Ambil foto"
          className="grid size-18 place-items-center rounded-full border-4 border-white bg-white/20 transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-35"
        >
          <span className="size-13 rounded-full bg-white" />
        </button>
      </div>
    </div>
  );
}

export function CameraCaptureModal({
  isOpen,
  title,
  description,
  onClose,
  onCapture,
}: CameraCaptureModalProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <CameraCaptureDialog
      title={title}
      description={description}
      onClose={onClose}
      onCapture={onCapture}
    />
  );
}
