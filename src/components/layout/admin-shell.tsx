"use client";

import {
  Bell,
  Boxes,
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  Gem,
  LayoutDashboard,
  Menu,
  ReceiptText,
  ScanBarcode,
  Search,
  Settings,
  ShieldCheck,
  ShoppingBag,
  Store,
  UsersRound,
  X,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { UserMenu } from "@/components/auth/user-menu";
import { AdminSoundEffects } from "@/components/layout/admin-sound-effects";
import { CameraScannerModal } from "@/components/scanner/camera-scanner-modal";
import { ApprovalDrawer } from "@/components/layout/approval-drawer";
import { NotificationDrawer } from "@/components/layout/notification-drawer";
import type { AdminApprovalDrawerData } from "@/features/approvals/contracts";
import type { AdminNotificationDrawerData } from "@/features/notifications/contracts";
import { cn } from "@/lib/utils";

type AdminShellUser = {
  fullName: string;
  roleLabel: string;
  canAccessPos: boolean;
  canAccessAdministration: boolean;
  canAccessProducts: boolean;
  canAccessInventory: boolean;
};

type NavigationItem = {
  label: string;
  href?: string;
  icon: typeof Store;
  access?: "administration" | "products" | "inventory";
  children?: { label: string; href: string }[];
};

const navigation: NavigationItem[] = [
  {
    label: "Dashboard",
    href: "/admin",
    icon: LayoutDashboard,
  },
  {
    label: "Penjualan",
    href: "/admin/penjualan",
    icon: ReceiptText,
  },
  {
    label: "Produk",
    href: "/admin/produk",
    icon: Gem,
    access: "products",
  },
  {
    label: "Inventaris",
    href: "/admin/inventaris",
    icon: Boxes,
    access: "inventory",
  },
  {
    label: "Pelanggan",
    href: "/admin/pelanggan",
    icon: UsersRound,
  },
  {
    label: "Operasional",
    icon: Store,
    children: [
      { label: "Shift Kasir", href: "/admin/operasional/shift" },
      { label: "Laporan Outlet", href: "/admin/laporan" },
      { label: "Riwayat Approval", href: "/admin/operasional/approval" },
      { label: "Pergerakan Kas", href: "/admin/operasional/kas" },
      { label: "Hardware Hub", href: "/admin/operasional/hardware" },
    ],
  },
  {
    label: "Administrasi",
    href: "/admin/administrasi",
    icon: ShieldCheck,
    access: "administration",
  },
  {
    label: "Pengaturan",
    href: "/admin/pengaturan",
    icon: Settings,
  },
] as const;

function AdminBrandLink({
  onNavigate,
  variant = "desktop",
}: {
  onNavigate?: () => void;
  variant?: "desktop" | "mobile";
}) {
  const isMobile = variant === "mobile";

  return (
    <Link
      href="/admin"
      onClick={onNavigate}
      className={cn(
        "flex min-w-0 items-center gap-2 rounded-2xl transition hover:bg-neutral-50",
        isMobile ? "px-1 py-1" : "mb-6 px-2 py-1.5",
      )}
    >
      <span className="grid shrink-0 place-items-center">
        <Image
          src="/logo/asihjaya-brand-icon.png"
          alt="Asihjaya"
          width={isMobile ? 80 : 128}
          height={isMobile ? 80 : 128}
          className={cn("w-auto object-contain", isMobile ? "h-10" : "h-12")}
          priority
        />
      </span>

      <span className="min-w-0">
        <Image
          src="/logo/asihjaya-brand-text.png"
          alt="Asihjaya"
          width={140}
          height={28}
          className="h-7 w-auto object-contain"
          priority
        />
        <span
          className={cn(
            "block truncate font-medium text-[var(--muted)]",
            isMobile ? "text-[12px]" : "mt-0.5 text-xs",
          )}
        >
          Management Dashboard
        </span>
      </span>
    </Link>
  );
}

function PosAccessCard({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <Link
      href="/pos"
      onClick={onNavigate}
      className="group flex items-center gap-3 rounded-2xl border border-[var(--border)] bg-white p-3 transition-all hover:border-[var(--accent)] hover:bg-[var(--accent-soft)]"
    >
      <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)] transition-transform group-hover:scale-105">
        <ShoppingBag className="size-5" />
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold text-neutral-950">
          Buka Sistem POS
        </p>

        <p className="truncate text-xs text-[var(--muted)]">
          kasir & transaksi
        </p>
      </div>

      <ChevronRight className="size-4 shrink-0 text-neutral-400 transition-transform group-hover:translate-x-0.5 group-hover:text-[var(--accent)]" />
    </Link>
  );
}

type SidebarContentProps = {
  pathname: string;
  canAccessPos: boolean;
  canAccessAdministration: boolean;
  canAccessProducts: boolean;
  canAccessInventory: boolean;
  onNavigate?: () => void;
  showBrand?: boolean;
  showPosCta?: boolean;
};

function isNavigationActive(pathname: string, href: string) {
  return href === "/admin"
    ? pathname === "/admin"
    : pathname === href || pathname.startsWith(`${href}/`);
}

function SidebarContent({
  pathname,
  canAccessPos,
  canAccessAdministration,
  canAccessProducts,
  canAccessInventory,
  onNavigate,
  showBrand = true,
  showPosCta = true,
}: SidebarContentProps) {
  const visibleNavigation = navigation.filter((item) => {
    if (item.access === "administration") {
      return canAccessAdministration;
    }

    if (item.access === "products") {
      return canAccessProducts;
    }

    if (item.access === "inventory") {
      return canAccessInventory;
    }

    return true;
  });
  return (
    <>
      {showBrand ? <AdminBrandLink onNavigate={onNavigate} /> : null}

      <nav className="space-y-1">
        {visibleNavigation.map(({ label, href, icon: Icon, children }) => {
          if (children) {
            const isChildActive = children.some((child) =>
              isNavigationActive(pathname, child.href),
            );
            return (
              <details key={label} open={isChildActive} className="group">
                <summary className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl px-3 text-sm font-medium text-neutral-600 transition-colors hover:bg-neutral-100 hover:text-neutral-950 marker:content-none [&::-webkit-details-marker]:hidden">
                  <Icon
                    className={cn(
                      "size-[18px] shrink-0",
                      isChildActive && "text-[var(--accent)]",
                    )}
                  />
                  <span
                    className={cn(
                      "min-w-0 flex-1",
                      isChildActive && "text-neutral-950",
                    )}
                  >
                    {label}
                  </span>
                  <ChevronDown className="size-4 shrink-0 text-neutral-400 transition-transform group-open:rotate-180" />
                </summary>
                <div className="mt-1 flex flex-col gap-1 pl-10 pr-3">
                  {children.map((child) => {
                    const isSubActive = isNavigationActive(
                      pathname,
                      child.href,
                    );
                    return (
                      <Link
                        key={child.href}
                        href={child.href}
                        onClick={onNavigate}
                        className={cn(
                          "block rounded-lg px-3 py-2 text-sm transition-colors",
                          isSubActive
                            ? "bg-[var(--accent-soft)] font-medium text-[var(--accent)]"
                            : "text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900",
                        )}
                      >
                        {child.label}
                      </Link>
                    );
                  })}
                </div>
              </details>
            );
          }

          const isActive = isNavigationActive(pathname, href!);

          return (
            <Link
              key={href}
              href={href!}
              onClick={onNavigate}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors",
                isActive
                  ? "bg-[var(--accent-soft)] text-neutral-950"
                  : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-950",
              )}
            >
              <Icon
                className={cn(
                  "size-[18px] shrink-0",
                  isActive && "text-[var(--accent)]",
                )}
              />

              <span className="min-w-0 flex-1">{label}</span>
            </Link>
          );
        })}
      </nav>

      {canAccessPos && showPosCta ? (
        <div className="mt-auto pt-6">
          <PosAccessCard onNavigate={onNavigate} />
        </div>
      ) : null}
    </>
  );
}

export function AdminShell({
  children,
  user,
  approvalDrawerData,
  notificationDrawerData,
}: {
  children: ReactNode;
  user: AdminShellUser;
  approvalDrawerData: AdminApprovalDrawerData;
  notificationDrawerData: AdminNotificationDrawerData;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const refreshTimerRef = useRef<number | null>(null);

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isApprovalOpen, setIsApprovalOpen] = useState(false);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [approvalPendingCount, setApprovalPendingCount] = useState(
    approvalDrawerData.pendingCount,
  );
  const [notificationUnreadCount, setNotificationUnreadCount] = useState(
    notificationDrawerData.unreadCount,
  );

  const refreshDrawerData = useCallback(() => {
    if (refreshTimerRef.current) {
      window.clearTimeout(refreshTimerRef.current);
    }

    refreshTimerRef.current = window.setTimeout(() => {
      router.refresh();
      refreshTimerRef.current = null;
    }, 100);
  }, [router]);

  useEffect(() => {
    if (!isMobileMenuOpen) {
      return;
    }

    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;

    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
    };
  }, [isMobileMenuOpen]);

  return (
    <div className="grid h-dvh w-full max-w-[100vw] overflow-hidden bg-[var(--background)] lg:grid-cols-[260px_minmax(0,1fr)]">
      {/* Sidebar desktop */}
      <aside className="hidden h-dvh min-h-0 flex-col overflow-y-auto border-r border-[var(--border)] bg-white p-5 lg:flex">
        <SidebarContent
          pathname={pathname}
          canAccessPos={user.canAccessPos}
          canAccessAdministration={user.canAccessAdministration}
          canAccessProducts={user.canAccessProducts}
          canAccessInventory={user.canAccessInventory}
        />
      </aside>

      {/* Sidebar mobile */}
      {isMobileMenuOpen ? (
        <div className="fixed inset-0 z-[100] max-w-[100vw] overflow-hidden overscroll-none lg:hidden">
          <button
            type="button"
            aria-label="Tutup navigasi"
            className="absolute inset-0 touch-none bg-black/30 backdrop-blur-[1px]"
            onClick={() => setIsMobileMenuOpen(false)}
          />

          <aside className="relative z-[101] flex h-dvh w-[min(88vw,340px)] max-w-full touch-pan-y flex-col overflow-hidden border-r border-[var(--border)] bg-white">
            <div className="flex shrink-0 items-center gap-3 border-b border-[var(--border)] px-4 py-4">
              <AdminBrandLink
                variant="mobile"
                onNavigate={() => setIsMobileMenuOpen(false)}
              />

              <button
                type="button"
                aria-label="Tutup menu"
                onClick={() => setIsMobileMenuOpen(false)}
                className="ml-auto grid size-10 shrink-0 place-items-center rounded-xl text-neutral-600 transition hover:bg-neutral-100 hover:text-neutral-950"
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
              <SidebarContent
                pathname={pathname}
                canAccessPos={user.canAccessPos}
                canAccessAdministration={user.canAccessAdministration}
                canAccessProducts={user.canAccessProducts}
                canAccessInventory={user.canAccessInventory}
                onNavigate={() => setIsMobileMenuOpen(false)}
                showBrand={false}
                showPosCta={false}
              />
            </div>

            {user.canAccessPos ? (
              <div className="shrink-0 border-t border-[var(--border)] bg-white p-4">
                <PosAccessCard onNavigate={() => setIsMobileMenuOpen(false)} />
              </div>
            ) : null}
          </aside>
        </div>
      ) : null}

      <div className="flex h-dvh min-h-0 min-w-0 max-w-full flex-col overflow-hidden">
        {/* Topbar */}
        <header className="sticky top-0 z-50 flex h-20 w-full max-w-full min-w-0 shrink-0 items-center overflow-visible border-b border-[var(--border)] bg-white/95 px-4 backdrop-blur sm:px-6 lg:px-8">
          <button
            type="button"
            aria-label="Buka navigasi"
            onClick={() => setIsMobileMenuOpen(true)}
            className="grid size-10 shrink-0 place-items-center rounded-xl text-neutral-600 transition hover:bg-neutral-100 hover:text-neutral-950 lg:hidden"
          >
            <Menu className="size-5" />
          </button>

          <label className="hidden h-11 w-full max-w-md items-center gap-3 rounded-xl border border-[var(--border)] bg-white px-4 text-sm text-[var(--muted)] md:flex">
            <Search className="size-4 shrink-0" />

            <input
              type="search"
              placeholder="Cari transaksi, barcode, produk, atau pelanggan..."
              className="min-w-0 flex-1 bg-transparent text-neutral-950 outline-none placeholder:text-neutral-400"
            />

            <button
              type="button"
              onClick={() => setIsScannerOpen(true)}
              aria-label="Scan Barcode"
              className="mr-1 rounded-lg p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-950"
            >
              <ScanBarcode className="size-4" />
            </button>
          </label>

          <Link
            href="/admin"
            className="flex min-w-0 items-center gap-2 rounded-2xl px-1.5 py-1 transition hover:bg-neutral-50 md:hidden"
          >
            <span className="grid shrink-0 place-items-center">
              <Image
                src="/logo/asihjaya-brand-icon.png"
                alt="Asihjaya"
                width={64}
                height={64}
                className="h-10 w-auto object-contain"
                priority
              />
            </span>

            <span className="min-w-0">
              <Image
                src="/logo/asihjaya-brand-text.png"
                alt="Asihjaya"
                width={112}
                height={24}
                className="h-6 w-auto object-contain"
                priority
              />
              <span className="block truncate text-[12px] font-medium text-[var(--muted)]">
                Retail Management
              </span>
            </span>
          </Link>

          <div className="relative z-[60] ml-auto flex min-w-0 shrink-0 items-center sm:gap-1">
            <button
              type="button"
              aria-label="Persetujuan"
              onClick={() => setIsApprovalOpen(true)}
              className="relative grid size-10 place-items-center rounded-xl text-neutral-600 transition hover:bg-neutral-100 hover:text-neutral-950"
            >
              <ClipboardCheck className="size-5" />
              {approvalPendingCount > 0 ? (
                <span className="absolute -right-1 -top-1 grid size-5 place-items-center rounded-full border-2 border-white bg-red-600 text-[10px] font-bold text-white">
                  {approvalPendingCount > 9 ? "9+" : approvalPendingCount}
                </span>
              ) : null}
            </button>

            <button
              type="button"
              aria-label="Notifikasi"
              onClick={() => setIsNotificationOpen(true)}
              className="relative grid size-10 place-items-center rounded-xl text-neutral-600 transition hover:bg-neutral-100 hover:text-neutral-950"
            >
              <Bell className="size-5" />

              {notificationUnreadCount > 0 ? (
                <span className="absolute -right-1 -top-1 grid size-5 place-items-center rounded-full border-2 border-white bg-red-600 text-[10px] font-bold text-white">
                  {notificationUnreadCount > 9 ? "9+" : notificationUnreadCount}
                </span>
              ) : null}
            </button>

            <UserMenu
              fullName={user.fullName}
              roleLabel={user.roleLabel}
              currentArea="admin"
              canAccessPos={user.canAccessPos}
            />
          </div>
        </header>

        <main className="min-h-0 min-w-0 max-w-full flex-1 overflow-y-auto overflow-x-hidden overscroll-contain p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>

      <AdminSoundEffects
        initialApprovalPendingCount={approvalDrawerData.pendingCount}
        initialNotificationUnreadCount={notificationDrawerData.unreadCount}
        onCountsChange={({
          approvalPendingCount: nextApprovalCount,
          notificationUnreadCount: nextNotificationCount,
        }) => {
          setApprovalPendingCount(nextApprovalCount);
          setNotificationUnreadCount(nextNotificationCount);
          refreshDrawerData();
        }}
      />

      <CameraScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScan={(result) => {
          console.log("Barcode terscan:", result);
          setIsScannerOpen(false);
        }}
      />

      <ApprovalDrawer
        isOpen={isApprovalOpen}
        onClose={() => setIsApprovalOpen(false)}
        data={approvalDrawerData}
      />

      <NotificationDrawer
        isOpen={isNotificationOpen}
        onClose={() => setIsNotificationOpen(false)}
        data={notificationDrawerData}
      />
    </div>
  );
}
