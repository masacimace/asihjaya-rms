import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function PosPageContainer({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "min-w-0 max-w-full overflow-x-hidden p-4 sm:p-6 lg:p-8",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function PosPageHeader({
  eyebrow = "Aplikasi POS",
  title,
  description,
  icon,
  actions,
  className,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  icon?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "mb-5 rounded-3xl border border-[var(--border)] bg-white p-4 last:mb-0 sm:p-5 lg:p-6",
        className,
      )}
    >
      <div className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 items-start gap-3 sm:gap-4">
          {icon ? (
            <div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent)] sm:size-12">
              {icon}
            </div>
          ) : null}

          <div className="min-w-0">
            <p className="text-xs font-semibold text-[var(--accent)]">
              {eyebrow}
            </p>
            <h1 className="mt-1 text-xl font-semibold text-neutral-950 sm:text-2xl">
              {title}
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--muted)]">
              {description}
            </p>
          </div>
        </div>

        {actions ? (
          <div className="flex min-w-0 shrink-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center lg:justify-end">
            {actions}
          </div>
        ) : null}
      </div>
    </section>
  );
}
