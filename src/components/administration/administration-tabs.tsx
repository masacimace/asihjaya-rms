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
  href: string;
  icon: typeof ShieldCheck;
  accessKey?: AccessKey;
};

const navigationItems: NavigationItem[] = [
  {
    id: "overview",
    label: "Ringkasan",
    href: "/admin/administrasi",
    icon: ShieldCheck,
  },
  {
    id: "staff",
    label: "Staff",
    href: "/admin/administrasi/staff",
    icon: UsersRound,
    accessKey: "canManageStaff",
  },
  {
    id: "roles",
    label: "Role & Akses",
    href: "/admin/administrasi/peran-akses",
    icon: ShieldCheck,
    accessKey: "canManageRoles",
  },
  {
    id: "outlets",
    label: "Outlet",
    href: "/admin/administrasi/outlet",
    icon: Building2,
    accessKey: "canManageOutlets",
  },
  {
    id: "registers",
    label: "Register",
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
    <div className="overflow-x-auto">
      <nav className="flex min-w-max gap-1 rounded-2xl border border-[var(--border)] bg-white p-1.5">
        {visibleItems.map(({ id, label, href, icon: Icon }) => {
          const isActive = active === id;

          return (
            <Link
              key={id}
              href={href}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "flex h-10 items-center gap-2 rounded-xl px-3 text-sm font-medium transition-colors",
                isActive
                  ? "bg-[var(--accent-soft)] text-[var(--accent)]"
                  : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-950",
              )}
            >
              <Icon className="size-4" />
              {label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
