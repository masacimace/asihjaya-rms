"use client";

import { LoaderCircle } from "lucide-react";
import { useFormStatus } from "react-dom";

import { cn } from "@/lib/utils";

type FormSubmitButtonProps = {
  children: React.ReactNode;
  pendingText?: string;
  className?: string;
};

export function FormSubmitButton({
  children,
  pendingText = "Menyimpan...",
  className,
}: FormSubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className={cn(
        "flex h-11 items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-4 text-sm font-semibold !text-white transition hover:brightness-95 disabled:cursor-wait disabled:opacity-60 [&_svg]:!text-white",
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
