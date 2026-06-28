"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const PRINT_JOB_REFRESH_INTERVAL_MS = 2_000;
const MAX_PRINT_JOB_REFRESH_COUNT = 45;

export function PrintJobAutoRefresh({ enabled }: { enabled: boolean }) {
  const router = useRouter();

  useEffect(() => {
    if (!enabled) {
      return;
    }

    let refreshCount = 0;

    const intervalId = window.setInterval(() => {
      refreshCount += 1;
      router.refresh();

      if (refreshCount >= MAX_PRINT_JOB_REFRESH_COUNT) {
        window.clearInterval(intervalId);
      }
    }, PRINT_JOB_REFRESH_INTERVAL_MS);

    return () => window.clearInterval(intervalId);
  }, [enabled, router]);

  if (!enabled) {
    return null;
  }

  return (
    <p className="rounded-2xl bg-neutral-50 p-3 text-xs leading-5 text-[var(--muted)]">
      Status print job diperbarui otomatis setiap beberapa detik sampai selesai.
    </p>
  );
}
