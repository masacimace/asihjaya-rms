"use client";

import { Camera, ImagePlus, Trash2 } from "lucide-react";
import { useRef, useState } from "react";

const acceptedTypes = "image/jpeg,image/png,image/webp";

export type SingleImageInputState = {
  hasImage: boolean;
  changed: boolean;
};

export function SingleImageInput({
  name = "image",
  initialImageUrl = null,
  label = "Foto",
  description,
  required = false,
  disabled = false,
  onStateChange,
}: {
  name?: string;
  initialImageUrl?: string | null;
  label?: string;
  description?: string;
  required?: boolean;
  disabled?: boolean;
  onStateChange?: (state: SingleImageInputState) => void;
}) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(initialImageUrl);
  const [removeExisting, setRemoveExisting] = useState(false);
  const generatedPreviewRef = useRef<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function revokeGeneratedPreview() {
    if (generatedPreviewRef.current) {
      URL.revokeObjectURL(generatedPreviewRef.current);
      generatedPreviewRef.current = null;
    }
  }

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    revokeGeneratedPreview();

    if (!file) {
      const hasImage = removeExisting ? false : Boolean(initialImageUrl);
      setPreviewUrl(hasImage ? initialImageUrl : null);
      onStateChange?.({
        hasImage,
        changed: removeExisting,
      });
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    generatedPreviewRef.current = objectUrl;
    setPreviewUrl(objectUrl);
    setRemoveExisting(false);
    onStateChange?.({ hasImage: true, changed: true });
  }

  function removeImage() {
    if (disabled) {
      return;
    }

    revokeGeneratedPreview();
    setPreviewUrl(null);

    const shouldRemoveExisting = Boolean(initialImageUrl);
    setRemoveExisting(shouldRemoveExisting);
    onStateChange?.({
      hasImage: false,
      changed: shouldRemoveExisting,
    });

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  return (
    <div>
      <input
        type="hidden"
        name="removeImage"
        value={removeExisting ? "1" : "0"}
      />

      <div className="flex items-start gap-3">
        <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-[var(--surface-muted)] text-neutral-600">
          <Camera className="size-5" />
        </div>

        <div>
          <h2 className="font-semibold text-neutral-950">{label}</h2>
          <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
            {description ??
              "Gunakan satu foto utama dari angle yang paling jelas. Format JPG, PNG, atau WebP."}
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-[220px_minmax(0,1fr)]">
        <div className="aspect-square overflow-hidden rounded-2xl border border-dashed border-[var(--border)] bg-neutral-50">
          {previewUrl ? (
            // Preview menggunakan blob URL atau route media internal.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewUrl}
              alt="Preview foto"
              className="size-full object-cover"
            />
          ) : (
            <div className="grid size-full place-items-center px-5 text-center text-neutral-400">
              <div>
                <ImagePlus className="mx-auto size-8" />
                <p className="mt-2 text-xs">Belum ada foto</p>
              </div>
            </div>
          )}
        </div>

        <div className="space-y-3">
          <input
            ref={fileInputRef}
            type="file"
            name={name}
            accept={acceptedTypes}
            disabled={disabled}
            onChange={handleFileChange}
            className="hidden"
            aria-hidden="true"
            tabIndex={-1}
          />

          <button
            type="button"
            onClick={() => {
              if (!disabled) {
                fileInputRef.current?.click();
              }
            }}
            disabled={disabled}
            aria-required={required && !initialImageUrl ? true : undefined}
            className={`inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-white px-4 text-sm font-medium text-neutral-700 transition ${
              disabled
                ? "cursor-not-allowed opacity-50"
                : "cursor-pointer hover:border-[var(--accent)] hover:bg-[var(--accent-soft)] hover:text-[var(--accent)]"
            }`}
          >
            <ImagePlus className="size-4" />
            {previewUrl ? "Ganti Foto" : "Pilih Foto"}
          </button>

          {previewUrl ? (
            <button
              type="button"
              onClick={removeImage}
              disabled={disabled}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-red-200 bg-white px-4 text-sm font-medium text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Trash2 className="size-4" />
              Hapus Foto
            </button>
          ) : null}

          <div className="rounded-xl border border-[var(--border)] bg-neutral-50 px-4 py-3 text-xs leading-5 text-[var(--muted)]">
            Maksimal 5 MB. Foto otomatis diperkecil dan dikonversi menjadi WebP.
          </div>
        </div>
      </div>
    </div>
  );
}
