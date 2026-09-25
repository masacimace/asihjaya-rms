"use client";

import {
  Bell,
  Boxes,
  ChevronDown,
  ChevronRight,
  Gem,
  LayoutDashboard,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
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
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";

import { UserMenu } from "@/components/auth/user-menu";
import { AdminSoundEffects } from "@/components/layout/admin-sound-effects";
import { CameraScannerModal } from "@/components/scanner/camera-scanner-modal";
import { NotificationDrawer } from "@/components/layout/notification-drawer";
import type { AdminNotificationDrawerData } from "@/features/notifications/contracts";
import { cn } from "@/lib/utils";

type AdminShellUser = {
  fullName: string;
  roleLabel: string;
  canAccessPos: boolean;
  canAccessAdministration: boolean;
  canAccessProducts: boolean;
  canAccessInventory: boolean;
  canAccessMigration: boolean;
  canAccessBuybacks: boolean;
  canAccessSettings: boolean;
};

type NavigationItem = {
  label: string;
  href?: string;
  icon: typeof Store;
  access?:
    | "administration"
    | "products"
    | "inventory"
    | "migration"
    | "settings";
  children?: {
    label: string;
    href: string;
    access?: "migration" | "buybacks";
  }[];
};

const navigation: NavigationItem[] = [
  {
    label: "Dashboard",
    href: "/admin",
    icon: LayoutDashboard,
  },
  {
    label: "Produk Master",
    href: "/admin/produk",
    icon: Gem,
    access: "products",
  },
  {
    label: "Produk Inventaris",
    href: "/admin/inventaris",
    icon: Boxes,
    access: "inventory",
  },
  {
    label: "Riwayat Penjualan",
    icon: ReceiptText,
    children: [
      {
        label: "Riwayat Penjualan",
        href: "/admin/penjualan?q=&range=thisMonth&outletId=&status=&paymentMethod=",
      },
      {
        label: "Buyback Pembelian",
        href: "/admin/buyback?q=&range=thisMonth&process=all&payout=all",
        access: "buybacks",
      },
      {
        label: "Pemasukan Bank",
        href: "/admin/operasional/pemasukan-bank",
      },
    ],
  },
  {
    label: "Daftar Customer",
    href: "/admin/pelanggan",
    icon: UsersRound,
  },
  {
    label: "Operasional",
    icon: Store,
    children: [
      /* Sidebar mobile label: "Shift Kasir", href: "/admin/operasional/shift" */
      { label: "Laporan Outlet", href: "/admin/laporan" },
      { label: "Pergerakan Kas", href: "/admin/operasional/kas" },
      {
        label: "Migrasi Produk",
        href: "/admin/migrasi-produk",
        access: "migration",
      },
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
    access: "settings",
  },
] as const;

const ADMIN_SIDEBAR_COLLAPSED_KEY = "asihjaya:admin-sidebar-collapsed";
const ADMIN_SIDEBAR_PREFERENCE_EVENT = "asihjaya:admin-sidebar-preference";

function subscribeSidebarPreference(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(ADMIN_SIDEBAR_PREFERENCE_EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(ADMIN_SIDEBAR_PREFERENCE_EVENT, callback);
  };
}

function getSidebarPreferenceSnapshot() {
  return window.localStorage.getItem(ADMIN_SIDEBAR_COLLAPSED_KEY) === "1";
}

function getSidebarPreferenceServerSnapshot() {
  return false;
}

function AdminBrandLink({
  onNavigate,
  variant = "desktop",
  collapsed = false,
}: {
  onNavigate?: () => void;
  variant?: "desktop" | "mobile";
  collapsed?: boolean;
}) {
  const isMobile = variant === "mobile";
  const iconOnly = !isMobile && collapsed;

  return (
    <Link
      href="/admin"
      onClick={onNavigate}
      title={iconOnly ? "Asihjaya Management Dashboard" : undefined}
      className={cn(
        "flex min-w-0 items-center rounded-2xl transition hover:bg-neutral-50",
        isMobile
          ? "gap-2 px-1 py-1"
          : iconOnly
            ? "justify-center p-1"
            : "gap-2 px-2 py-1.5",
      )}
    >
      <span className="grid shrink-0 place-items-center">
        <Image
          src="/logo/asihjaya-brand-icon.png"
          alt="Asihjaya"
          width={isMobile ? 80 : 128}
          height={isMobile ? 80 : 128}
          className={cn(
            "w-auto object-contain",
            isMobile ? "mb-2 h-16" : iconOnly ? "h-10" : "mb-2 h-16",
          )}
        />
      </span>

      {!iconOnly ? (
        <span className="min-w-0">
          <Image
            src="/logo/asihjaya-brand-text.png"
            alt="Asihjaya"
            width={128}
            height={128}
            className="h-7 w-auto object-contain"
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
      ) : null}
    </Link>
  );
}

function PosAccessCard({
  onNavigate,
  collapsed = false,
}: {
  onNavigate?: () => void;
  collapsed?: boolean;
}) {
  return (
    <Link
      href="/pos"
      onClick={onNavigate}
      title={collapsed ? "Buka Sistem POS" : undefined}
      className={cn(
        "group flex items-center rounded-2xl border border-[var(--border)] bg-white transition-all hover:border-[var(--accent)] hover:bg-[var(--accent-soft)]",
        collapsed ? "justify-center p-2" : "gap-3 p-3",
      )}
    >
      <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)] transition-transform group-hover:scale-105">
        <ShoppingBag className="size-5" />
      </div>

      {!collapsed ? (
        <>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-neutral-950">
              Buka Sistem POS
            </p>
            <p className="truncate text-xs text-[var(--muted)]">
              kasir & transaksi
            </p>
          </div>
          <ChevronRight className="size-4 shrink-0 text-neutral-400 transition-transform group-hover:translate-x-0.5 group-hover:text-[var(--accent)]" />
        </>
      ) : null}
    </Link>
  );
}

type SidebarContentProps = {
  pathname: string;
  canAccessPos: boolean;
  canAccessAdministration: boolean;
  canAccessProducts: boolean;
  canAccessInventory: boolean;
  canAccessMigration: boolean;
  canAccessBuybacks: boolean;
  canAccessSettings: boolean;
  onNavigate?: () => void;
  showBrand?: boolean;
  showPosCta?: boolean;
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
};

function isNavigationActive(pathname: string, href: string) {
  const hrefPath = href.split(/[?#]/, 1)[0] || href;
  return hrefPath === "/admin"
    ? pathname === "/admin"
    : pathname === hrefPath || pathname.startsWith(`${hrefPath}/`);
}

function SidebarContent({
  pathname,
  canAccessPos,
  canAccessAdministration,
  canAccessProducts,
  canAccessInventory,
  canAccessMigration,
  canAccessBuybacks,
  canAccessSettings,
  onNavigate,
  showBrand = true,
  showPosCta = true,
  collapsed = false,
  onToggleCollapsed,
}: SidebarContentProps) {
  const [openFlyout, setOpenFlyout] = useState<{
    label: string;
    top: number;
  } | null>(null);

  useEffect(() => {
    if (!collapsed || !openFlyout) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpenFlyout(null);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [collapsed, openFlyout]);

  const visibleNavigation = navigation.filter((item) => {
    if (item.access === "administration") return canAccessAdministration;
    if (item.access === "products") return canAccessProducts;
    if (item.access === "inventory") return canAccessInventory;
    if (item.access === "migration") return canAccessMigration;
    if (item.access === "settings") return canAccessSettings;
    return true;
  });

  const closeAndNavigate = () => {
    setOpenFlyout(null);
    onNavigate?.();
  };

  return (
    <>
      {showBrand ? (
        <div
          className={cn(
            "mb-5 flex items-center",
            collapsed ? "flex-col gap-2" : "justify-between gap-2",
          )}
        >
          <AdminBrandLink
            onNavigate={closeAndNavigate}
            collapsed={collapsed}
          />
          {onToggleCollapsed ? (
            <button
              type="button"
              onClick={() => {
                setOpenFlyout(null);
                onToggleCollapsed();
              }}
              title={collapsed ? "Perluas sidebar" : "Ciutkan sidebar"}
              aria-label={collapsed ? "Perluas sidebar" : "Ciutkan sidebar"}
              className="grid size-9 shrink-0 place-items-center rounded-xl text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-950"
            >
              {collapsed ? (
                <PanelLeftOpen className="size-4" />
              ) : (
                <PanelLeftClose className="size-4" />
              )}
            </button>
          ) : null}
        </div>
      ) : null}

      <nav className="space-y-1">
        {visibleNavigation.map(({ label, href, icon: Icon, children }) => {
          if (children) {
            const visibleChildren = children.filter((child) => {
              if (child.access === "migration") return canAccessMigration;
              if (child.access === "buybacks") return canAccessBuybacks;
              return true;
            });
            const isChildActive = visibleChildren.some((child) =>
              isNavigationActive(pathname, child.href),
            );

            if (collapsed) {
              const isOpen = openFlyout?.label === label;
              return (
                <div key={label}>
                  <button
                    type="button"
                    title={label}
                    aria-label={label}
                    aria-expanded={isOpen}
                    onClick={(event) => {
                      if (isOpen) {
                        setOpenFlyout(null);
                        return;
                      }
                      const rect = event.currentTarget.getBoundingClientRect();
                      const estimatedHeight = Math.max(
                        120,
                        visibleChildren.length * 42 + 48,
                      );
                      setOpenFlyout({
                        label,
                        top: Math.max(
                          12,
                          Math.min(
                            rect.top,
                            window.innerHeight - estimatedHeight - 12,
                          ),
                        ),
                      });
                    }}
                    className={cn(
                      "flex min-h-11 w-full items-center justify-center rounded-xl text-sm font-medium transition-colors",
                      isChildActive
                        ? "bg-[var(--accent-soft)] text-neutral-950"
                        : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-950",
                    )}
                  >
                    <Icon
                      className={cn(
                        "size-[18px]",
                        isChildActive && "text-[var(--accent)]",
                      )}
                    />
                  </button>

                  {isOpen ? (
                    <>
                      <button
                        type="button"
                        aria-label="Tutup submenu"
                        onClick={() => setOpenFlyout(null)}
                        className="fixed inset-0 z-[55] cursor-default bg-transparent"
                      />
                      <div
                        className="fixed left-[76px] z-[60] ml-2 w-60 rounded-2xl border border-[var(--border)] bg-white p-2 shadow-xl"
                        style={{ top: openFlyout.top }}
                      >
                        <p className="px-3 pb-2 pt-1 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                          {label}
                        </p>
                        <div className="space-y-1">
                          {visibleChildren.map((child) => {
                            const isSubActive = isNavigationActive(
                              pathname,
                              child.href,
                            );
                            return (
                              <Link
                                key={child.href}
                                href={child.href}
                                onClick={closeAndNavigate}
                                className={cn(
                                  "block rounded-xl px-3 py-2.5 text-sm transition-colors",
                                  isSubActive
                                    ? "bg-[var(--accent-soft)] font-medium text-[var(--accent)]"
                                    : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-950",
                                )}
                              >
                                {child.label}
                              </Link>
                            );
                          })}
                        </div>
                      </div>
                    </>
                  ) : null}
                </div>
              );
            }

            return (
              <details key={label} open={isChildActive} className="group">
                <summary className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl px-3 text-sm font-medium text-black transition-colors hover:bg-neutral-100 hover:text-neutral-950 marker:content-none [&::-webkit-details-marker]:hidden">
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
                  {visibleChildren.map((child) => {
                    const isSubActive = isNavigationActive(pathname, child.href);
                    return (
                      <Link
                        key={child.href}
                        href={child.href}
                        onClick={closeAndNavigate}
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
              onClick={closeAndNavigate}
              aria-current={isActive ? "page" : undefined}
              title={collapsed ? label : undefined}
              className={cn(
                "flex min-h-11 items-center rounded-xl text-sm font-medium transition-colors",
                collapsed ? "justify-center px-2" : "gap-3 px-3",
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
              {!collapsed ? (
                <span className="min-w-0 flex-1">{label}</span>
              ) : null}
            </Link>
          );
        })}
      </nav>

      {canAccessPos && showPosCta ? (
        <div className="mt-auto pt-6">
          <PosAccessCard onNavigate={closeAndNavigate} collapsed={collapsed} />
        </div>
      ) : null}
    </>
  );
}

export function AdminShell({
  children,
  user,
  notificationDrawerData,
}: {
  children: ReactNode;
  user: AdminShellUser;
  notificationDrawerData: AdminNotificationDrawerData;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const isDesktopSidebarCollapsed = useSyncExternalStore(
    subscribeSidebarPreference,
    getSidebarPreferenceSnapshot,
    getSidebarPreferenceServerSnapshot,
  );

  const toggleDesktopSidebar = useCallback(() => {
    const nextValue = !isDesktopSidebarCollapsed;
    window.localStorage.setItem(
      ADMIN_SIDEBAR_COLLAPSED_KEY,
      nextValue ? "1" : "0",
    );
    window.dispatchEvent(new Event(ADMIN_SIDEBAR_PREFERENCE_EVENT));
  }, [isDesktopSidebarCollapsed]);
  const refreshTimerRef = useRef<number | null>(null);
  const mainScrollRef = useRef<HTMLElement>(null);
  const previousPathnameRef = useRef(pathname);

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [notificationUnreadCount, setNotificationUnreadCount] = useState(
    notificationDrawerData.unreadCount,
  );

  const notificationDrawerVersion = [
    notificationDrawerData.unreadCount,
    notificationDrawerData.actionableCount,
    ...notificationDrawerData.latest.map(
      (notification) => `${notification.id}:${notification.status}`,
    ),
  ].join("|");

  const refreshDrawerData = useCallback(() => {
    if (refreshTimerRef.current) {
      window.clearTimeout(refreshTimerRef.current);
    }

    refreshTimerRef.current = window.setTimeout(() => {
      router.refresh();
      refreshTimerRef.current = null;
    }, 100);
  }, [router]);

  useLayoutEffect(() => {
    if (previousPathnameRef.current === pathname) return;

    previousPathnameRef.current = pathname;
    mainScrollRef.current?.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [pathname]);

  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const previousHtmlOverflow = html.style.overflow;
    const previousBodyOverflow = body.style.overflow;

    // AdminShell owns the vertical scroll through <main>. Keeping the document
    // locked prevents html/body from becoming a second scroll container on
    // long form pages.
    html.style.overflow = "hidden";
    body.style.overflow = "hidden";

    return () => {
      html.style.overflow = previousHtmlOverflow;
      body.style.overflow = previousBodyOverflow;
    };
  }, []);

  return (
    <div
      className={cn(
        "fixed inset-0 grid h-dvh min-h-0 w-full max-w-[100vw] overflow-hidden bg-[var(--background)]",
        isDesktopSidebarCollapsed
          ? "lg:grid-cols-[76px_minmax(0,1fr)]"
          : "lg:grid-cols-[280px_minmax(0,1fr)]",
      )}
    >
      {/* Sidebar desktop */}
      <aside
        className={cn(
          "relative z-[56] hidden h-dvh min-h-0 flex-col border-r border-[var(--border)] bg-white lg:flex",
          isDesktopSidebarCollapsed
            ? "overflow-visible p-3"
            : "overflow-y-auto p-5",
        )}
      >
        <SidebarContent
          key={pathname}
          pathname={pathname}
          canAccessPos={user.canAccessPos}
          canAccessAdministration={user.canAccessAdministration}
          canAccessProducts={user.canAccessProducts}
          canAccessInventory={user.canAccessInventory}
          canAccessMigration={user.canAccessMigration}
          canAccessBuybacks={user.canAccessBuybacks}
          canAccessSettings={user.canAccessSettings}
          collapsed={isDesktopSidebarCollapsed}
          onToggleCollapsed={toggleDesktopSidebar}
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
                canAccessMigration={user.canAccessMigration}
                canAccessBuybacks={user.canAccessBuybacks}
                canAccessSettings={user.canAccessSettings}
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
        <header className="relative z-50 flex h-20 w-full max-w-full min-w-0 shrink-0 items-center overflow-visible border-b border-[var(--border)] bg-white/95 px-1.5 backdrop-blur sm:px-6 lg:px-8">
          <button
            type="button"
            aria-label="Buka navigasi"
            onClick={() => setIsMobileMenuOpen(true)}
            className="grid size-7 shrink-0 place-items-center rounded-xl text-neutral-600 transition hover:bg-neutral-100 hover:text-neutral-950 lg:hidden"
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
                width={128}
                height={128}
                className="h-12 w-auto object-contain"
              />
            </span>

            <span className="min-w-0">
              <Image
                src="/logo/asihjaya-brand-text.png"
                alt="Asihjaya"
                width={128}
                height={128}
                className="h-6 w-auto object-contain"
              />
            </span>
          </Link>

          <div className="relative z-[60] ml-auto flex min-w-0 shrink-0 items-center sm:gap-1">
            <button
              type="button"
              aria-label="Notifikasi"
              onClick={() => setIsNotificationOpen(true)}
              className="relative grid size-9 place-items-center rounded-xl text-neutral-600 transition hover:bg-neutral-100 hover:text-neutral-950"
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

        <main
          ref={mainScrollRef}
          className="min-h-0 min-w-0 max-w-full flex-1 overflow-y-auto overflow-x-hidden overscroll-contain p-4 sm:p-6 lg:p-8"
        >
          {children}
        </main>
      </div>

      <AdminSoundEffects
        initialNotificationUnreadCount={notificationDrawerData.unreadCount}
        onCountsChange={({
          notificationUnreadCount: nextNotificationCount,
        }) => {
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

      <NotificationDrawer
        key={notificationDrawerVersion}
        isOpen={isNotificationOpen}
        onClose={() => setIsNotificationOpen(false)}
        onUnreadCountChange={setNotificationUnreadCount}
        data={notificationDrawerData}
      />
    </div>
  );
}
