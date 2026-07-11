"use client";

import {
  ChevronDown,
  LayoutDashboard,
  LogOut,
  ShoppingBag,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { logoutAction } from "@/app/actions/auth";


type UserMenuProps = {
  fullName: string;
  roleLabel: string;
  currentArea: "admin" | "pos";
  canAccessAdmin?: boolean;
  canAccessPos?: boolean;
};

function getUserInitials(fullName: string) {
  const nameParts = fullName
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  const firstPart = nameParts.at(0);

  if (!firstPart) {
    return "?";
  }

  if (nameParts.length === 1) {
    return firstPart.slice(0, 2).toUpperCase();
  }

  const lastPart = nameParts.at(-1) ?? firstPart;

  return `${firstPart.charAt(0)}${lastPart.charAt(0)}`.toUpperCase();
}

export function UserMenu({
  fullName,
  roleLabel,
  currentArea,
  canAccessAdmin = false,
  canAccessPos = false,
}: UserMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const initials = getUserInitials(fullName);

  return (
    <div className="relative">
      <button
        type="button"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((current) => !current)}
        className="flex items-center gap-2 rounded-2xl border border-transparent px-1.5 py-1.5 text-left transition hover:border-[var(--border)] hover:bg-neutral-50 sm:px-2"
      >
        <span className="grid size-10 shrink-0 place-items-center rounded-2xl border border-amber-100 bg-amber-50 text-sm font-bold text-amber-700">
          {initials}
        </span>

        <div className="hidden min-w-0 sm:block">
          <p className="max-w-36 truncate text-xs font-semibold text-neutral-950">
            {fullName}
          </p>

          <p className="max-w-36 truncate text-xs text-[var(--muted)]">
            {roleLabel}
          </p>
        </div>

        <ChevronDown className="hidden size-4 shrink-0 text-neutral-400 sm:block" />
      </button>

      {isOpen ? (
        <div className="absolute right-0 top-[calc(100%+0.5rem)] z-50 w-72 overflow-hidden rounded-3xl border border-[var(--border)] bg-white p-2">
          <div className="rounded-2xl border border-[var(--border)] bg-neutral-50 p-3">
            <div className="flex items-center gap-3">
              <span className="grid size-11 shrink-0 place-items-center rounded-2xl border border-amber-100 bg-amber-50 text-sm font-bold text-amber-700">
                {initials}
              </span>

              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-neutral-950">
                  {fullName}
                </p>

                <p className="mt-0.5 truncate text-xs text-[var(--muted)]">
                  {roleLabel}
                </p>
              </div>
            </div>
          </div>

          <div className="py-2">
            {currentArea === "admin" && canAccessPos ? (
              <Link
                href="/pos"
                onClick={() => setIsOpen(false)}
                className="flex h-10 items-center gap-3 rounded-xl px-3 text-sm text-neutral-700 transition hover:bg-neutral-100 hover:text-neutral-950"
              >
                <ShoppingBag className="size-4" />
                Buka Aplikasi POS
              </Link>
            ) : null}

            {currentArea === "pos" && canAccessAdmin ? (
              <Link
                href="/admin"
                onClick={() => setIsOpen(false)}
                className="flex h-10 items-center gap-3 rounded-xl px-3 text-sm text-neutral-700 transition hover:bg-neutral-100 hover:text-neutral-950"
              >
                <LayoutDashboard className="size-4" />
                Dashboard Admin
              </Link>
            ) : null}
          </div>

          <form
            action={logoutAction}
            className="border-t border-[var(--border)] pt-2"
          >
            <button
              type="submit"
              className="flex h-10 w-full items-center gap-3 rounded-xl px-3 text-sm text-red-600 transition hover:bg-red-50"
            >
              <LogOut className="size-4" />
              Keluar
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
