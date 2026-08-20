"use client";

import { ImageIcon, Loader2, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { syncLegacyProductImagesAction } from "@/app/actions/legacy-product-import";

export function LegacyImageSyncRunner({
  batchId,
  initialPendingCount,
  initialSyncedCount,
  initialFailedCount,
  missingCount,
  totalWithSourceCount,
  canSync,
}: {
  batchId: string;
  initialPendingCount: number;
  initialSyncedCount: number;
  initialFailedCount: number;
  missingCount: number;
  totalWithSourceCount: number;
  canSync: boolean;
}) {
  const router = useRouter();
  const startedRef = useRef(false);
  const stoppedRef = useRef(false);
  const runningRef = useRef(false);
  const pendingRef = useRef(initialPendingCount);
  const [pendingCount, setPendingCount] = useState(initialPendingCount);
  const [syncedCount, setSyncedCount] = useState(initialSyncedCount);
  const [failedCount, setFailedCount] = useState(initialFailedCount);
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const run = useCallback(async () => {
    if (!canSync || runningRef.current || pendingRef.current <= 0) return;

    stoppedRef.current = false;
    runningRef.current = true;
    setRunning(true);
    setMessage(null);

    try {
      let remaining = pendingRef.current;
      while (!stoppedRef.current && remaining > 0) {
        const result = await syncLegacyProductImagesAction(batchId);
        remaining = result.pendingCount;
        pendingRef.current = result.pendingCount;
        setPendingCount(result.pendingCount);
        setSyncedCount(result.syncedCount);
        setFailedCount(result.totalFailedCount);

        if (result.processedCount === 0) break;
      }

      if (!stoppedRef.current && remaining === 0) {
        setMessage("Sinkronisasi foto legacy selesai.");
        router.refresh();
      }
    } catch (error) {
      setMessage(
        error instanceof Error
          ? `Sinkronisasi foto berhenti: ${error.message}`
          : "Sinkronisasi foto berhenti karena kendala sistem.",
      );
    } finally {
      runningRef.current = false;
      setRunning(false);
    }
  }, [batchId, canSync, router]);

  useEffect(() => {
    pendingRef.current = pendingCount;
  }, [pendingCount]);

  useEffect(() => {
    return () => {
      stoppedRef.current = true;
    };
  }, []);

  useEffect(() => {
    if (!canSync || initialPendingCount <= 0 || startedRef.current) return;
    startedRef.current = true;

    const timer = window.setTimeout(() => {
      void run();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [canSync, initialPendingCount, run]);

  const completed = pendingCount === 0;
  const sourceProcessed = syncedCount + failedCount;
  const progress =
    totalWithSourceCount > 0
      ? Math.min(100, Math.round((sourceProcessed / totalWithSourceCount) * 100))
      : 100;

  return (
    <section className="rounded-3xl border border-[var(--border)] bg-white p-5 lg:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="flex items-center gap-2 font-semibold text-neutral-950">
            <ImageIcon className="size-4 text-[var(--accent)]" />
            Foto produk legacy
          </p>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">
            Item sudah aktif tanpa menunggu foto. URL legacy disalin bertahap ke
            internal storage selama halaman batch ini terbuka. Foto yang gagal
            tidak memblokir POS dan dapat ditambahkan manual nanti.
          </p>
        </div>

        {canSync && pendingCount > 0 ? (
          <button
            type="button"
            disabled={running}
            onClick={() => void run()}
            className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-white px-4 text-sm font-semibold text-neutral-900 transition hover:border-[var(--accent)] hover:bg-[var(--accent-soft)]/40 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {running ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <RefreshCw className="size-4" />
            )}
            {running ? "Menyalin foto..." : "Lanjutkan sinkronisasi"}
          </button>
        ) : null}
      </div>

      <div className="mt-5 h-2 overflow-hidden rounded-full bg-neutral-100">
        <div
          className="h-full rounded-full bg-neutral-950 transition-[width] duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-2xl bg-neutral-50 p-3">
          <p className="text-xs text-[var(--muted)]">Tersalin</p>
          <p className="mt-1 font-semibold text-neutral-950">
            {syncedCount.toLocaleString("id-ID")}
          </p>
        </div>
        <div className="rounded-2xl bg-neutral-50 p-3">
          <p className="text-xs text-[var(--muted)]">Menunggu</p>
          <p className="mt-1 font-semibold text-neutral-950">
            {pendingCount.toLocaleString("id-ID")}
          </p>
        </div>
        <div className="rounded-2xl bg-neutral-50 p-3">
          <p className="text-xs text-[var(--muted)]">Gagal download</p>
          <p className="mt-1 font-semibold text-neutral-950">
            {failedCount.toLocaleString("id-ID")}
          </p>
        </div>
        <div className="rounded-2xl bg-neutral-50 p-3">
          <p className="text-xs text-[var(--muted)]">Tanpa URL foto</p>
          <p className="mt-1 font-semibold text-neutral-950">
            {missingCount.toLocaleString("id-ID")}
          </p>
        </div>
      </div>

      {message ? (
        <p
          className={`mt-4 rounded-2xl px-4 py-3 text-sm ${
            completed
              ? "bg-emerald-50 text-emerald-800"
              : "bg-amber-50 text-amber-800"
          }`}
        >
          {message}
        </p>
      ) : null}
    </section>
  );
}
