"use client";

import { useFormStatus } from "react-dom";

import { cn } from "@/lib/utils";

export function ReprintSubmitButton({
  disabled,
  className,
}: {
  disabled?: boolean;
  className?: string;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={disabled || pending}
      className={cn(
        "inline-flex min-h-11 w-full items-center justify-center rounded-xl border px-4 py-3 !text-xs font-semibold transition",
        disabled
          ? "cursor-not-allowed border-dashed border-[var(--border)] bg-neutral-50 text-neutral-400"
          : "border-[var(--accent)] bg-[var(--accent)] text-white hover:bg-[var(--accent)]/90 disabled:cursor-wait disabled:opacity-70",
        className,
      )}
    >
      {pending ? "Mengirim job print..." : "Reprint ke printer"}
    </button>
  );
}
