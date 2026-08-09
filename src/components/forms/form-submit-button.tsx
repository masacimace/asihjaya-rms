"use client";

import { LoaderCircle } from "lucide-react";
import { useFormStatus } from "react-dom";

import { cn } from "@/lib/utils";

type FormSubmitButtonProps = {
  children: React.ReactNode;
  pendingText?: string;
  className?: string;
  disabled?: boolean;
};

export function FormSubmitButton({
  children,
  pendingText = "Menyimpan...",
  className,
  disabled = false,
}: FormSubmitButtonProps) {
  const { pending } = useFormStatus();
  const isDisabled = pending || disabled;

  return (
    <button
      type="submit"
      disabled={isDisabled}
      className={cn(
        "flex h-11 items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-4 text-sm font-semibold !text-white transition hover:brightness-95 disabled:opacity-60 [&_svg]:!text-white",
        pending ? "disabled:cursor-wait" : "disabled:cursor-not-allowed",
        className,
      )}
    >
      {pending ? (
        <>
          <LoaderCircle className="size-4 animate-spin" />
          {pendingText}
        </>
      ) : (
        children
      )}
    </button>
  );
}
