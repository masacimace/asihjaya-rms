import {
  Building2,
  MonitorSmartphone,
  ShieldCheck,
  UsersRound,
} from "lucide-react";
import Link from "next/link";

import type { AdministrationAccess } from "@/features/administration/access";
import { cn } from "@/lib/utils";

type AdministrationTab =
  | "overview"
  | "staff"
  | "roles"
  | "outlets"
  | "registers";

type AccessKey = "canManageStaff" | "canManageRoles" | "canManageOutlets";

type NavigationItem = {
  id: AdministrationTab;
  label: string;
  description: string;
  href: string;
  icon: typeof ShieldCheck;
  accessKey?: AccessKey;
};

const navigationItems: NavigationItem[] = [
  {
    id: "overview",
    label: "Ringkasan",
    description: "Overview akses",
    href: "/admin/administrasi",
    icon: ShieldCheck,
  },
  {
    id: "staff",
    label: "Daftar Staff",
    description: "Akun pengguna",
    href: "/admin/administrasi/staff",
    icon: UsersRound,
    accessKey: "canManageStaff",
  },
  {
    id: "roles",
    label: "Role & Akses",
    description: "Permission modul",
    href: "/admin/administrasi/peran-akses",
    icon: ShieldCheck,
    accessKey: "canManageRoles",
  },
  {
    id: "outlets",
    label: "Daftar Outlet",
    description: "Lokasi toko",
    href: "/admin/administrasi/outlet",
    icon: Building2,
    accessKey: "canManageOutlets",
  },
  {
    id: "registers",
    label: "Register Hardware",
    description: "POS & hub",
    href: "/admin/administrasi/register",
    icon: MonitorSmartphone,
    accessKey: "canManageOutlets",
  },
];

export function AdministrationTabs({
  active,
  access,
}: {
  active: AdministrationTab;
  access: AdministrationAccess;
}) {
  const visibleItems = navigationItems.filter(
    (item) => !item.accessKey || access[item.accessKey],
  );

  return (
    <div className="rounded-[1.75rem] border border-[var(--border)] bg-white p-4">
      <nav className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-5">
        {visibleItems.map(({ id, label, description, href, icon: Icon }) => {
          const isActive = active === id;

          return (
            <Link
              key={id}
              href={href}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "group flex items-center gap-3 rounded-2xl border px-3 py-3 text-sm transition",
                isActive
                  ? "border-neutral-950 bg-neutral-950 !text-white"
                  : "border-transparent bg-neutral-50 text-neutral-700 hover:border-[var(--border)] hover:bg-white hover:text-neutral-950",
              )}
            >
              <span
                className={cn(
                  "grid size-9 shrink-0 place-items-center rounded-xl ring-1 transition",
                  isActive
                    ? "bg-white/10 text-white ring-white/15"
                    : "bg-white text-neutral-600 ring-[var(--border)] group-hover:text-[var(--accent)]",
                )}
              >
                <Icon className="size-4" />
              </span>

              <span className="min-w-0">
                <span className="block truncate font-semibold">{label}</span>
                <span
                  className={cn(
                    "mt-0.5 block truncate text-xs",
                    isActive ? "text-white/65" : "text-[var(--muted)]",
                  )}
                >
                  {description}
                </span>
              </span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
