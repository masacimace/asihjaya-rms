"use client";

import { ImagePlus, Trash2, X } from "lucide-react";
import {
  type ChangeEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

const AVATAR_DATABASE = "asihjaya-customer-portal";
const AVATAR_STORE = "avatars";
const AVATAR_SIZE = 384;
const MAX_AVATAR_FILE_BYTES = 12 * 1024 * 1024;

function getInitials(name: string) {
  const parts = name
    .trim()
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length === 0) return "AJ";
  if (parts.length === 1) return parts[0]!.slice(0, 1).toUpperCase();

  return `${parts[0]!.slice(0, 1)}${parts.at(-1)!.slice(0, 1)}`.toUpperCase();
}

function openAvatarDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(AVATAR_DATABASE, 1);

    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(AVATAR_STORE)) {
        database.createObjectStore(AVATAR_STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("IndexedDB gagal dibuka."));
  });
}

async function readAvatarBlob(storageKey: string) {
  const database = await openAvatarDatabase();

  try {
    return await new Promise<Blob | null>((resolve, reject) => {
      const transaction = database.transaction(AVATAR_STORE, "readonly");
      const request = transaction.objectStore(AVATAR_STORE).get(storageKey);
      request.onsuccess = () => {
        resolve(request.result instanceof Blob ? request.result : null);
      };
      request.onerror = () =>
        reject(request.error ?? new Error("Avatar gagal dibaca."));
    });
  } finally {
    database.close();
  }
}

async function writeAvatarBlob(storageKey: string, blob: Blob) {
  const database = await openAvatarDatabase();

  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(AVATAR_STORE, "readwrite");
      transaction.objectStore(AVATAR_STORE).put(blob, storageKey);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () =>
        reject(transaction.error ?? new Error("Avatar gagal disimpan."));
    });
  } finally {
    database.close();
  }
}

async function deleteAvatarBlob(storageKey: string) {
  const database = await openAvatarDatabase();

  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(AVATAR_STORE, "readwrite");
      transaction.objectStore(AVATAR_STORE).delete(storageKey);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () =>
        reject(transaction.error ?? new Error("Avatar gagal dihapus."));
    });
  } finally {
    database.close();
  }
}

function loadImageFromFile(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = document.createElement("img");

    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Foto tidak dapat dibaca."));
    };
    image.src = url;
  });
}

async function prepareAvatarBlob(file: File) {
  const image = await loadImageFromFile(file);
  const sourceSide = Math.min(image.naturalWidth, image.naturalHeight);
  const sourceX = Math.max(0, (image.naturalWidth - sourceSide) / 2);
  const sourceY = Math.max(0, (image.naturalHeight - sourceSide) / 2);
  const canvas = document.createElement("canvas");
  canvas.width = AVATAR_SIZE;
  canvas.height = AVATAR_SIZE;
  const context = canvas.getContext("2d");

  if (!context) throw new Error("Browser tidak mendukung pemrosesan foto.");

  context.drawImage(
    image,
    sourceX,
    sourceY,
    sourceSide,
    sourceSide,
    0,
    0,
    AVATAR_SIZE,
    AVATAR_SIZE,
  );

  const webpBlob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, "image/webp", 0.84);
  });

  if (webpBlob) return webpBlob;

  const jpegBlob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, "image/jpeg", 0.86);
  });

  if (!jpegBlob) throw new Error("Foto belum berhasil diproses.");
  return jpegBlob;
}

export function PublicHistoryLocalAvatar({
  customerName,
  storageKey,
}: {
  customerName: string;
  storageKey: string;
}) {
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const initials = getInitials(customerName);

  const refreshAvatar = useCallback(async () => {
    try {
      const blob = await readAvatarBlob(storageKey);
      setAvatarUrl((currentUrl) => {
        if (currentUrl) URL.revokeObjectURL(currentUrl);
        return blob ? URL.createObjectURL(blob) : null;
      });
    } catch {
      setAvatarUrl(null);
    }
  }, [storageKey]);

  useEffect(() => {
    let cancelled = false;

    void readAvatarBlob(storageKey)
      .then((blob) => {
        if (cancelled) return;

        setAvatarUrl((currentUrl) => {
          if (currentUrl) URL.revokeObjectURL(currentUrl);
          return blob ? URL.createObjectURL(blob) : null;
        });
      })
      .catch(() => {
        if (cancelled) return;
        setAvatarUrl(null);
      });

    return () => {
      cancelled = true;
    };
  }, [storageKey]);

  useEffect(
    () => () => {
      if (avatarUrl) URL.revokeObjectURL(avatarUrl);
    },
    [avatarUrl],
  );

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0] ?? null;
    event.currentTarget.value = "";
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Pilih file foto yang valid.");
      return;
    }

    if (file.size > MAX_AVATAR_FILE_BYTES) {
      setError("Ukuran foto maksimal 12 MB sebelum diproses.");
      return;
    }

    setBusy(true);
    setError(null);

    try {
      const blob = await prepareAvatarBlob(file);
      await writeAvatarBlob(storageKey, blob);
      await refreshAvatar();
      setIsOpen(false);
    } catch (avatarError) {
      setError(
        avatarError instanceof Error
          ? avatarError.message
          : "Foto belum berhasil disimpan.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleRemove() {
    setBusy(true);
    setError(null);

    try {
      await deleteAvatarBlob(storageKey);
      setAvatarUrl((currentUrl) => {
        if (currentUrl) URL.revokeObjectURL(currentUrl);
        return null;
      });
      setIsOpen(false);
    } catch {
      setError("Foto belum berhasil dihapus.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="group relative grid size-[76px] shrink-0 place-items-center overflow-hidden rounded-full border border-white/80 bg-white/[0.45] text-xl font-black text-[#6d4a1d] shadow-[0_14px_35px_rgba(79,49,18,0.18)] backdrop-blur-xl transition hover:scale-[1.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b9863b] sm:size-[88px]"
        aria-label="Ganti foto profil lokal"
      >
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={avatarUrl}
            alt={`Foto profil ${customerName}`}
            className="size-full object-cover"
          />
        ) : (
          <span className="grid size-full place-items-center bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,.92),rgba(229,197,143,.62)_48%,rgba(178,128,58,.38))]">
            {initials}
          </span>
        )}
        <span className="absolute inset-x-0 bottom-0 bg-black/[0.45] py-1 text-[9px] font-bold uppercase tracking-[0.14em] text-white opacity-0 backdrop-blur-sm transition group-hover:opacity-100">
          Ubah
        </span>
      </button>

      {isOpen ? (
        <div className="fixed inset-0 z-[140] grid place-items-center bg-black/[0.35] p-4 backdrop-blur-sm">
          <button
            type="button"
            className="absolute inset-0 cursor-default"
            onClick={() => setIsOpen(false)}
            aria-label="Tutup pengaturan foto profil"
          />
          <div className="relative z-10 w-full max-w-sm rounded-[28px] border border-white/60 bg-white/[0.55] p-5 shadow-[0_24px_80px_rgba(74,48,24,0.14)] backdrop-blur-2xl sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#95651e]">
                  Foto Profil
                </p>
                <h2 className="mt-1 text-xl font-black text-neutral-950">
                  Personalisasi perangkat ini
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="grid size-10 place-items-center rounded-full border border-white/80 bg-white/[0.55] text-neutral-700 transition hover:bg-white/80"
                aria-label="Tutup"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="mx-auto mt-6 grid size-28 place-items-center overflow-hidden rounded-full border border-white/90 bg-white/[0.55] text-2xl font-black text-[#6d4a1d] shadow-lg">
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={avatarUrl}
                  alt={`Preview foto ${customerName}`}
                  className="size-full object-cover"
                />
              ) : (
                initials
              )}
            </div>

            <p className="mt-5 text-center text-xs leading-5 text-neutral-600">
              Foto disimpan hanya di browser perangkat ini. Foto tidak diunggah ke server ASIHJAYA.
            </p>

            {error ? (
              <p className="mt-4 rounded-2xl border border-red-200/80 bg-red-50/80 px-4 py-3 text-sm font-medium text-red-700">
                {error}
              </p>
            ) : null}

            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />

            <div className="mt-5 grid gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => inputRef.current?.click()}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-neutral-950 px-4 text-sm font-bold text-white transition hover:bg-neutral-800 disabled:cursor-wait disabled:opacity-60"
              >
                <ImagePlus className="size-4" />
                {busy ? "Memproses foto..." : avatarUrl ? "Ganti Foto" : "Pilih Foto"}
              </button>
              {avatarUrl ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={handleRemove}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-red-200/80 bg-white/[0.55] px-4 text-sm font-semibold text-red-700 transition hover:bg-red-50/80 disabled:cursor-wait disabled:opacity-60"
                >
                  <Trash2 className="size-4" />
                  Hapus Foto
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
