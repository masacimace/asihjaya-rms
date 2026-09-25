"use client";

import {
  Bell,
  ChevronRight,
  ListChevronsDownUp,
  Clock3,
  LayoutDashboard,
  PackagePlus,
  PanelLeftClose,
  PanelLeftOpen,
  Pause,
  Printer,
  ReceiptText,
  RefreshCcw,
  ScanBarcode,
  Search,
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
  useSyncExternalStore,
  type FormEvent,
  type ReactNode,
} from "react";
import { UserMenu } from "@/components/auth/user-menu";
import { CameraScannerModal } from "@/components/scanner/camera-scanner-modal";
import {
  POS_SHELL_STATUS_REFRESH_EVENT,
  requestPosShellStatusRefresh,
} from "@/features/pos/live-status";
import {
  normalizePosWorkspaceCommand,
  POS_PENDING_COMMAND_STORAGE_KEY,
  POS_WORKSPACE_COMMAND_EVENT,
  type PosWorkspaceCommand,
} from "@/features/pos/workspace-command";

import { cn } from "@/lib/utils";

type PosShellUser = {
  fullName: string;
  roleLabel: string;
  canAccessAdmin: boolean;
  outletName: string;
  canCreateProducts: boolean;
  canAccessBuybacks: boolean;
};

type PosShellStatus = {
  outletName: string;
  registerName: string | null;
  shift: {
    status: "open" | "closed" | "not_configured";
    openedAt: string | Date | null;
    openingCash: string | null;
    expectedCash: string | null;
    label: string;
  };
  hardware: {
    status: "online" | "stale" | "offline" | "disabled" | "not_configured";
    label: string;
    agentName: string | null;
    lastSeenAt: string | Date | null;
    hasConfigWarnings: boolean;
  };
  notifications?: PosShellNotification[];
};

type PosShellNotification = {
  id: string;
  title: string;
  description: string;
  href: string;
  actionLabel: string;
  tone: "info" | "warning" | "danger";
  icon: "held_cart" | "print" | "shift" | "hardware";
};

const POS_SHELL_STATUS_POLL_INTERVAL_MS = 5_000;
const POS_SIDEBAR_COLLAPSED_KEY = "asihjaya:pos-sidebar-collapsed";
const POS_SIDEBAR_PREFERENCE_EVENT = "asihjaya:pos-sidebar-preference";

function subscribePosSidebarPreference(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(POS_SIDEBAR_PREFERENCE_EVENT, callback);

  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(POS_SIDEBAR_PREFERENCE_EVENT, callback);
  };
}

function getPosSidebarPreferenceSnapshot() {
  return window.localStorage.getItem(POS_SIDEBAR_COLLAPSED_KEY) === "1";
}

function getPosSidebarPreferenceServerSnapshot() {
  return false;
}

const fallbackStatus: PosShellStatus = {
  outletName: "Outlet belum dipilih",
  registerName: null,
  shift: {
    status: "not_configured",
    openedAt: null,
    openingCash: null,
    expectedCash: null,
    label: "Shift belum dicek",
  },
  hardware: {
    status: "not_configured",
    label: "Hardware Hub belum dicek",
    agentName: null,
    lastSeenAt: null,
    hasConfigWarnings: false,
  },
  notifications: [],
};

const navigation = [
  { label: "Beranda", href: "/pos", icon: ShoppingBag },
  {
    label: "Tambah Produk",
    href: "/pos/produk/tambah",
    icon: PackagePlus,
    requiresProductCreate: true,
  },
  {
    label: "Buyback Pembelian",
    href: "/pos/buyback",
    icon: RefreshCcw,
    requiresBuybackAccess: true,
  },
  {
    label: "Transaksi Penjualan",
    href: "/pos/transaksi",
    icon: ReceiptText,
    children: [
      { label: "Daftar Transaksi", href: "/pos/transaksi", icon: ReceiptText },
      { label: "Transaksi Ditahan", href: "/pos/ditahan", icon: Pause },
    ],
  },
  { label: "Daftar Customer", href: "/pos/pelanggan", icon: UsersRound },
  { label: "Shift Kasir", href: "/pos/shift", icon: Clock3 },
] as const;

const mobilePrimaryNavigation = [
  { label: "Kasir", href: "/pos", icon: ShoppingBag },
  {
    label: "Pembelian",
    href: "/pos/buyback",
    icon: RefreshCcw,
    requiresBuybackAccess: true,
  },
  { label: "Riwayat", href: "/pos/transaksi", icon: ReceiptText },
] as const;

const mobileMoreNavigation = [
  {
    label: "Tambah Produk",
    href: "/pos/produk/tambah",
    icon: PackagePlus,
    requiresProductCreate: true,
  },
  {
    label: "Daftar Customer",
    href: "/pos/pelanggan",
    icon: UsersRound,
  },
  { label: "Transaksi Ditahan", href: "/pos/ditahan", icon: Pause },
  { label: "Operasional Kasir", href: "/pos/shift", icon: Clock3 },
] as const;

const mobileBottomNavigationItemClassName =
  "flex min-w-0 appearance-none flex-col items-center justify-center gap-1 border-0 !text-black bg-transparent px-1 !text-xs !font-semibold leading-none transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--accent)]";
const mobileBottomNavigationIconClassName = "size-[21px] shrink-0";

function getMobileBottomNavigationItemClassName(active: boolean) {
  return cn(
    mobileBottomNavigationItemClassName,
    active ? "text-[var(--accent)]" : "text-neutral-700",
  );
}

type SidebarContentProps = {
  pathname: string;
  canAccessAdmin: boolean;
  canCreateProducts: boolean;
  canAccessBuybacks: boolean;
  onNavigate?: () => void;
  collapsed?: boolean;
};

function isNavigationActive(pathname: string, href: string) {
  return href === "/pos" ? pathname === href : pathname.startsWith(href);
}

function isTransactionNavigationActive(pathname: string) {
  return (
    isNavigationActive(pathname, "/pos/transaksi") ||
    isNavigationActive(pathname, "/pos/ditahan")
  );
}

function formatStatusTime(value: string | Date | null) {
  if (!value) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function getShiftStatusLabel(status: PosShellStatus["shift"]) {
  if (status.status !== "open") {
    return status.label;
  }

  const openedAt = formatStatusTime(status.openedAt);

  return openedAt ? `Shift aktif sejak ${openedAt}` : status.label;
}

function getShiftStatusClassName(status: PosShellStatus["shift"]["status"]) {
  if (status === "open") {
    return "text-[var(--success)]";
  }

  if (status === "closed") {
    return "text-amber-700";
  }

  return "text-red-600";
}

function isPosShellStatus(value: unknown): value is PosShellStatus {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<PosShellStatus>;

  return (
    typeof candidate.outletName === "string" &&
    (typeof candidate.registerName === "string" ||
      candidate.registerName === null) &&
    Boolean(candidate.shift && typeof candidate.shift === "object") &&
    Boolean(candidate.hardware && typeof candidate.hardware === "object") &&
    (candidate.notifications === undefined ||
      Array.isArray(candidate.notifications))
  );
}

function getHardwareStatusClassName(
  status: PosShellStatus["hardware"]["status"],
) {
  if (status === "online") {
    return "text-[var(--success)]";
  }

  if (status === "stale") {
    return "text-amber-700";
  }

  return "text-red-600";
}
function getNotificationToneClassName(tone: PosShellNotification["tone"]) {
  if (tone === "danger") {
    return "border-red-100 bg-red-50 text-red-700";
  }

  if (tone === "warning") {
    return "border-amber-100 bg-amber-50 text-amber-700";
  }

  return "border-[var(--accent-soft)] bg-[var(--accent-soft)] text-[var(--accent)]";
}

function NotificationIcon({
  notification,
}: {
  notification: PosShellNotification;
}) {
  const iconClassName = "size-4";

  if (notification.icon === "held_cart") {
    return <Pause className={iconClassName} />;
  }

  if (notification.icon === "print" || notification.icon === "hardware") {
    return <Printer className={iconClassName} />;
  }

  return <Clock3 className={iconClassName} />;
}

function SidebarContent({
  pathname,
  canAccessAdmin,
  canCreateProducts,
  canAccessBuybacks,
  onNavigate,
  collapsed = false,
}: SidebarContentProps) {
  const [openNavigationGroups, setOpenNavigationGroups] = useState<
    Record<string, boolean>
  >({ "/pos/transaksi": true });
  const [openFlyout, setOpenFlyout] = useState<{
    href: string;
    top: number;
  } | null>(null);

  useEffect(() => {
    if (!collapsed || !openFlyout) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpenFlyout(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [collapsed, openFlyout]);

  function toggleNavigationGroup(href: string) {
    setOpenNavigationGroups((currentGroups) => ({
      ...currentGroups,
      [href]: !currentGroups[href],
    }));
  }

  const closeAndNavigate = () => {
    setOpenFlyout(null);
    onNavigate?.();
  };

  const visibleNavigation = navigation.filter((item) => {
    if ("requiresProductCreate" in item && item.requiresProductCreate) {
      return canCreateProducts;
    }

    if ("requiresBuybackAccess" in item && item.requiresBuybackAccess) {
      return canAccessBuybacks;
    }

    return true;
  });

  return (
    <>
      <Link
        href="/pos"
        onClick={closeAndNavigate}
        title={collapsed ? "AsihJaya Retail Sales Applications" : undefined}
        className={cn(
          "mb-6 flex items-center rounded-2xl transition hover:bg-neutral-50",
          collapsed ? "justify-center p-1" : "gap-2 px-1 py-1",
        )}
      >
        <span className="grid shrink-0 place-items-center">
          <Image
            src="/logo/asihjaya-brand-icon.png"
            alt="Asihjaya"
            width={128}
            height={128}
            className={cn(
              "w-auto object-contain",
              collapsed ? "h-10" : "mb-2 h-14",
            )}
          />
        </span>

        {!collapsed ? (
          <span className="min-w-0">
            <Image
              src="/logo/asihjaya-brand-text.png"
              alt="Asihjaya"
              width={128}
              height={128}
              className="h-7 w-auto object-contain"
            />
            <span className="mt-0.5 block truncate text-xs font-medium text-[var(--muted)]">
              Retail Sales Applications
            </span>
          </span>
        ) : null}
      </Link>

      <nav className="space-y-1">
        {visibleNavigation.map((item) => {
          const Icon = item.icon;
          const hasChildren = "children" in item;
          const active = hasChildren
            ? isTransactionNavigationActive(pathname)
            : isNavigationActive(pathname, item.href);
          const expanded = hasChildren
            ? Boolean(openNavigationGroups[item.href])
            : false;

          if (hasChildren && collapsed) {
            const isOpen = openFlyout?.href === item.href;

            return (
              <div key={item.href}>
                <button
                  type="button"
                  title={item.label}
                  aria-label={item.label}
                  aria-expanded={isOpen}
                  onClick={(event) => {
                    if (isOpen) {
                      setOpenFlyout(null);
                      return;
                    }

                    const rect = event.currentTarget.getBoundingClientRect();
                    const estimatedHeight = item.children.length * 42 + 48;

                    setOpenFlyout({
                      href: item.href,
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
                    "flex min-h-11 w-full items-center justify-center rounded-xl transition-colors",
                    active
                      ? "bg-[var(--accent-soft)] text-neutral-950"
                      : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-950",
                  )}
                >
                  <Icon
                    className={cn(
                      "size-[18px]",
                      active && "text-[var(--accent)]",
                    )}
                  />
                </button>

                {isOpen ? (
                  <>
                    <button
                      type="button"
                      aria-label="Tutup submenu transaksi"
                      onClick={() => setOpenFlyout(null)}
                      className="fixed inset-0 z-[55] cursor-default bg-transparent"
                    />
                    <div
                      className="fixed left-[76px] z-[60] ml-2 w-60 rounded-2xl border border-[var(--border)] bg-white p-2 shadow-xl"
                      style={{ top: openFlyout.top }}
                    >
                      <p className="px-3 pb-2 pt-1 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                        {item.label}
                      </p>

                      <div className="space-y-1">
                        {item.children.map((child) => {
                          const ChildIcon = child.icon;
                          const childActive = isNavigationActive(
                            pathname,
                            child.href,
                          );

                          return (
                            <Link
                              key={child.href}
                              href={child.href}
                              onClick={closeAndNavigate}
                              aria-current={childActive ? "page" : undefined}
                              className={cn(
                                "flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm transition-colors",
                                childActive
                                  ? "bg-[var(--accent-soft)] font-medium text-[var(--accent)]"
                                  : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-950",
                              )}
                            >
                              <ChildIcon className="size-4 shrink-0" />
                              <span>{child.label}</span>
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
            <div key={item.href}>
              {hasChildren ? (
                <button
                  type="button"
                  onClick={() => toggleNavigationGroup(item.href)}
                  aria-expanded={expanded}
                  className={cn(
                    "flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left !text-sm !font-medium transition-colors",
                    active
                      ? "bg-[var(--accent-soft)] text-neutral-950"
                      : "text-black hover:bg-neutral-100 hover:text-neutral-950",
                  )}
                >
                  <Icon
                    className={cn(
                      "size-[18px] shrink-0",
                      active && "text-[var(--accent)]",
                    )}
                  />

                  <span className="min-w-0 flex-1">{item.label}</span>

                  <ChevronRight
                    className={cn(
                      "size-4 shrink-0 text-neutral-400 transition-transform",
                      expanded && "rotate-90",
                      active && "text-[var(--accent)]",
                    )}
                  />
                </button>
              ) : (
                <Link
                  href={item.href}
                  onClick={closeAndNavigate}
                  aria-current={active ? "page" : undefined}
                  title={collapsed ? item.label : undefined}
                  className={cn(
                    "flex min-h-11 items-center rounded-xl text-sm font-medium transition-colors",
                    collapsed ? "justify-center px-2" : "gap-3 px-3",
                    active
                      ? "bg-[var(--accent-soft)] text-neutral-950"
                      : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-950",
                  )}
                >
                  <Icon
                    className={cn(
                      "size-[18px] shrink-0",
                      active && "text-[var(--accent)]",
                    )}
                  />

                  {!collapsed ? (
                    <span className="min-w-0 flex-1">{item.label}</span>
                  ) : null}
                </Link>
              )}

              {hasChildren && expanded ? (
                <div className="ml-[22px] mt-1 space-y-1 border-l border-[var(--border)] pl-3">
                  {item.children.map((child) => {
                    const ChildIcon = child.icon;
                    const childActive = isNavigationActive(
                      pathname,
                      child.href,
                    );

                    return (
                      <Link
                        key={child.href}
                        href={child.href}
                        onClick={closeAndNavigate}
                        aria-current={childActive ? "page" : undefined}
                        className={cn(
                          "flex min-h-9 items-center gap-2.5 rounded-lg px-3 text-xs font-semibold transition-colors",
                          childActive
                            ? "bg-white text-[var(--accent)] shadow-sm ring-1 ring-[var(--border)]"
                            : "text-neutral-500 hover:bg-neutral-50 hover:text-neutral-900",
                        )}
                      >
                        <ChildIcon className="size-4 shrink-0" />
                        <span>{child.label}</span>
                      </Link>
                    );
                  })}
                </div>
              ) : null}
            </div>
          );
        })}
      </nav>

      {canAccessAdmin ? (
        <div className="mt-auto pt-6">
          <Link
            href="/admin"
            onClick={closeAndNavigate}
            title={collapsed ? "Dashboard Admin" : undefined}
            className={cn(
              "group flex items-center rounded-2xl border border-[var(--accent)] bg-[var(--accent-soft)] transition-all hover:bg-[var(--accent-soft)]",
              collapsed ? "justify-center p-1" : "gap-3 p-3",
            )}
          >
            <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)] transition-transform group-hover:scale-105">
              <LayoutDashboard className="size-5" />
            </div>

            {!collapsed ? (
              <>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-neutral-950">
                    Dashboard Admin
                  </p>
                  <p className="truncate text-xs text-[var(--muted)]">
                    Kelola operasional
                  </p>
                </div>

                <ChevronRight className="size-4 shrink-0 text-neutral-400 transition-transform group-hover:translate-x-0.5 group-hover:text-[var(--accent)]" />
              </>
            ) : null}
          </Link>
        </div>
      ) : null}
    </>
  );
}

export function PosShell({
  children,
  user,
  status,
}: {
  children: ReactNode;
  user: PosShellUser;
  status?: PosShellStatus;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const isDesktopSidebarCollapsed = useSyncExternalStore(
    subscribePosSidebarPreference,
    getPosSidebarPreferenceSnapshot,
    getPosSidebarPreferenceServerSnapshot,
  );

  const toggleDesktopSidebar = useCallback(() => {
    const nextValue = !isDesktopSidebarCollapsed;
    window.localStorage.setItem(
      POS_SIDEBAR_COLLAPSED_KEY,
      nextValue ? "1" : "0",
    );
    window.dispatchEvent(new Event(POS_SIDEBAR_PREFERENCE_EVENT));
  }, [isDesktopSidebarCollapsed]);

  const [liveOperationalStatus, setLiveOperationalStatus] =
    useState<PosShellStatus | null>(null);
  const operationalStatus = liveOperationalStatus ?? status ?? fallbackStatus;
  const statusRequestInFlightRef = useRef(false);
  const shiftLabel = getShiftStatusLabel(operationalStatus.shift);
  const notifications = operationalStatus.notifications ?? [];
  const notificationCount = notifications.length;

  const [isNavigationOpen, setIsNavigationOpen] = useState(false);
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [topbarQuery, setTopbarQuery] = useState("");
  const isMoreNavigationActive =
    isMoreOpen ||
    mobileMoreNavigation.some(
      ({ href }) =>
        href !== "/pos/ditahan" && isNavigationActive(pathname, href),
    );

  useEffect(() => {
    let isDisposed = false;

    const refreshStatus = async () => {
      if (
        isDisposed ||
        statusRequestInFlightRef.current ||
        document.visibilityState === "hidden"
      ) {
        return;
      }

      statusRequestInFlightRef.current = true;

      try {
        const response = await fetch("/api/pos/shell-status", {
          cache: "no-store",
          credentials: "same-origin",
        });

        if (!response.ok) {
          return;
        }

        const payload = (await response.json()) as { status?: unknown };

        if (!isDisposed && isPosShellStatus(payload.status)) {
          setLiveOperationalStatus(payload.status);
        }
      } catch {
        // Keep the POS usable during a temporary network interruption.
      } finally {
        statusRequestInFlightRef.current = false;
      }
    };

    const handleWindowFocus = () => {
      void refreshStatus();
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void refreshStatus();
      }
    };
    const handleRefreshRequest = () => {
      void refreshStatus();
    };

    const intervalId = window.setInterval(
      () => void refreshStatus(),
      POS_SHELL_STATUS_POLL_INTERVAL_MS,
    );

    window.addEventListener("focus", handleWindowFocus);
    window.addEventListener(
      POS_SHELL_STATUS_REFRESH_EVENT,
      handleRefreshRequest,
    );
    document.addEventListener("visibilitychange", handleVisibilityChange);

    void refreshStatus();

    return () => {
      isDisposed = true;
      window.clearInterval(intervalId);
      window.removeEventListener("focus", handleWindowFocus);
      window.removeEventListener(
        POS_SHELL_STATUS_REFRESH_EVENT,
        handleRefreshRequest,
      );
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  function sendPosWorkspaceCommand(command: PosWorkspaceCommand) {
    const normalizedCommand = normalizePosWorkspaceCommand(command);

    if (!normalizedCommand) {
      return;
    }

    if (typeof window !== "undefined" && pathname === "/pos") {
      window.dispatchEvent(
        new CustomEvent(POS_WORKSPACE_COMMAND_EVENT, {
          detail: normalizedCommand,
        }),
      );
      return;
    }

    if (typeof window !== "undefined") {
      window.sessionStorage.setItem(
        POS_PENDING_COMMAND_STORAGE_KEY,
        JSON.stringify(normalizedCommand),
      );
    }

    router.push("/pos");
  }

  function handleTopbarSearchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    sendPosWorkspaceCommand({ type: "search", value: topbarQuery });
  }

  function clearTopbarSearch() {
    setTopbarQuery("");

    if (pathname === "/pos") {
      sendPosWorkspaceCommand({ type: "search", value: "" });
    }
  }

  return (
    <div
      className={cn(
        "h-dvh max-w-[100vw] overflow-hidden bg-[var(--background)] lg:grid",
        isDesktopSidebarCollapsed
          ? "lg:grid-cols-[76px_minmax(0,1fr)]"
          : "lg:grid-cols-[272px_minmax(0,1fr)]",
      )}
    >
      {/* Sidebar desktop */}
      <aside
        className={cn(
          "relative z-[56] hidden h-dvh min-h-0 flex-col border-r border-[var(--border)] bg-white lg:flex",
          isDesktopSidebarCollapsed
            ? "overflow-visible p-3"
            : "overflow-y-auto overflow-x-hidden p-5",
        )}
      >
        <SidebarContent
          key={pathname}
          pathname={pathname}
          canAccessAdmin={user.canAccessAdmin}
          canCreateProducts={user.canCreateProducts}
          canAccessBuybacks={user.canAccessBuybacks}
          collapsed={isDesktopSidebarCollapsed}
        />
      </aside>

      {/* Navigation drawer tablet/mobile */}
      {isNavigationOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Tutup navigasi"
            className="absolute inset-0 backdrop-blur-[1px]"
            onClick={() => setIsNavigationOpen(false)}
          />

          <aside className="relative z-10 flex h-full w-[min(86vw,300px)] max-w-[100vw] flex-col overflow-y-auto overflow-x-hidden border-r border-[var(--border)] bg-white p-5 shadow-2xl">
            <div className="mb-4 flex justify-end">
              <button
                type="button"
                aria-label="Tutup menu"
                onClick={() => setIsNavigationOpen(false)}
                className="grid size-10 place-items-center rounded-xl text-neutral-600 transition hover:bg-neutral-100 hover:text-neutral-950"
              >
                <X className="size-5" />
              </button>
            </div>

            <SidebarContent
              pathname={pathname}
              canAccessAdmin={user.canAccessAdmin}
              canCreateProducts={user.canCreateProducts}
              canAccessBuybacks={user.canAccessBuybacks}
              onNavigate={() => setIsNavigationOpen(false)}
            />
          </aside>
        </div>
      ) : null}

      {/* Menu lainnya mobile */}
      {isMoreOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Tutup menu lainnya"
            className="absolute inset-0 bg-black/30 backdrop-blur-[1px]"
            onClick={() => setIsMoreOpen(false)}
          />

          <section className="absolute inset-x-0 bottom-0 z-10 rounded-t-3xl bg-white p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-2xl">
            <div className="mx-auto mb-5 h-1.5 w-12 rounded-full bg-neutral-200" />

            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-neutral-950">Menu Lainnya</h2>
                <p className="mt-1 text-xs text-[var(--muted)]">
                  Akses fungsi pendukung POS.
                </p>
              </div>

              <button
                type="button"
                aria-label="Tutup"
                onClick={() => setIsMoreOpen(false)}
                className="grid size-10 place-items-center rounded-xl text-neutral-500 hover:bg-neutral-100"
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="mt-5 grid gap-3">
              {mobileMoreNavigation
                .filter((item) => {
                  if (
                    "requiresProductCreate" in item &&
                    item.requiresProductCreate
                  ) {
                    return user.canCreateProducts;
                  }

                  if (
                    "requiresBuybackAccess" in item &&
                    item.requiresBuybackAccess
                  ) {
                    return user.canAccessBuybacks;
                  }

                  return true;
                })
                .map(({ label, href, icon: Icon }) => {
                  const active = isNavigationActive(pathname, href);

                  return (
                    <Link
                      key={href}
                      href={href}
                      onClick={() => setIsMoreOpen(false)}
                      className={cn(
                        "flex items-center gap-3 rounded-2xl border p-4 transition",
                        active
                          ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]"
                          : "border-[var(--border)] text-neutral-700 hover:bg-neutral-50",
                      )}
                    >
                      <Icon className="size-5 shrink-0" />
                      <span className="text-sm font-medium">{label}</span>
                    </Link>
                  );
                })}
              {user.canAccessAdmin ? (
                <Link
                  href="/admin"
                  onClick={() => setIsMoreOpen(false)}
                  className="flex items-center gap-3 rounded-2xl border border-[var(--border)] p-4"
                >
                  <LayoutDashboard className="size-5 text-[var(--accent)]" />
                  <span className="text-sm font-medium">Dashboard Admin</span>
                </Link>
              ) : null}
            </div>
          </section>
        </div>
      ) : null}

      <div className="flex h-dvh min-h-0 min-w-0 flex-col overflow-hidden">
        {/* Topbar */}
        <header className="sticky top-0 z-40 flex h-[72px] shrink-0 items-center gap-3 overflow-visible border-b border-[var(--border)] bg-white/95 px-4 backdrop-blur sm:px-4 lg:px-4">
          <Link
            href="/pos"
            className="flex min-w-0 items-center gap-2 lg:hidden"
          >
            <span className="grid size-14 shrink-0 place-items-center">
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
              <span className="block truncate text-[12px] font-medium text-[var(--muted)]">
                Sales Retail Applications
              </span>
            </span>
          </Link>

          <button
            type="button"
            onClick={toggleDesktopSidebar}
            title={
              isDesktopSidebarCollapsed ? "Perluas sidebar" : "Ciutkan sidebar"
            }
            aria-label={
              isDesktopSidebarCollapsed ? "Perluas sidebar" : "Ciutkan sidebar"
            }
            className="hidden size-10 shrink-0 place-items-center rounded-xl bg-neutral-100 text-neutral-900 transition hover:bg-neutral-200 hover:text-neutral-950 lg:grid"
          >
            {isDesktopSidebarCollapsed ? (
              <PanelLeftOpen className="size-4" />
            ) : (
              <PanelLeftClose className="size-4" />
            )}
          </button>

          <form
            onSubmit={handleTopbarSearchSubmit}
            className="hidden h-11 w-full max-w-[560px] items-center gap-3 rounded-xl border border-[var(--border)] bg-white px-4 text-sm md:flex"
          >
            <Search className="size-4 shrink-0 text-neutral-400" />

            <input
              type="text"
              value={topbarQuery}
              onChange={(event) => setTopbarQuery(event.target.value)}
              placeholder="Cari SKU, barcode, nama, dan serial..."
              className="min-w-0 flex-1 bg-transparent text-neutral-950 outline-none placeholder:text-neutral-400"
            />

            {topbarQuery.trim() ? (
              <button
                type="button"
                onClick={clearTopbarSearch}
                aria-label="Hapus pencarian produk"
                className="grid size-7 shrink-0 place-items-center rounded-lg text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-700"
              >
                <X className="size-4" />
              </button>
            ) : null}

            <kbd className="hidden rounded-md border border-[var(--border)] bg-[var(--surface-muted)] px-2 py-1 text-[10px] text-[var(--muted)] xl:inline-flex">
              Enter
            </kbd>
          </form>

          <div className="relative z-50 ml-auto flex items-center gap-1.5 sm:gap-2">
            <button
              type="button"
              onClick={() => setIsScannerOpen(true)}
              className="hidden h-10 items-center gap-2 rounded-xl border border-[var(--border)] bg-white px-3 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50 sm:flex"
            >
              <ScanBarcode className="size-4" />
              <span className="hidden xl:inline">Scan Barcode</span>
            </button>

            <div className="relative">
              <button
                type="button"
                aria-label="Notifikasi POS"
                aria-expanded={isNotificationsOpen}
                onClick={() => {
                  setIsNotificationsOpen((isOpen) => {
                    const nextIsOpen = !isOpen;

                    if (nextIsOpen) {
                      requestPosShellStatusRefresh();
                    }

                    return nextIsOpen;
                  });
                }}
                className="relative grid size-10 place-items-center rounded-xl text-neutral-600 transition hover:bg-neutral-100 hover:text-neutral-950"
              >
                <Bell className="size-5" />

                {notificationCount > 0 ? (
                  <span className="absolute -right-1 -top-1 grid min-w-5 place-items-center rounded-full border-2 border-white bg-[var(--accent)] px-1 text-[10px] font-bold leading-4 text-white">
                    {notificationCount > 9 ? "9+" : notificationCount}
                  </span>
                ) : null}
              </button>

              {isNotificationsOpen ? (
                <div className="absolute right-[-50px] top-full z-50 mt-2 w-[min(360px,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-[var(--border)] bg-white">
                  <div className="border-b border-[var(--border)] px-4 py-3">
                    <p className="text-sm font-semibold text-neutral-950">
                      Notifikasi POS
                    </p>
                    <p className="mt-1 text-xs text-[var(--muted)]">
                      Ringkasan operasional kasir yang perlu dicek.
                    </p>
                  </div>

                  {notificationCount > 0 ? (
                    <div className="max-h-[420px] overflow-y-auto p-2">
                      {notifications.map((notification) => (
                        <Link
                          key={notification.id}
                          href={notification.href}
                          onClick={() => setIsNotificationsOpen(false)}
                          className="group flex gap-3 rounded-2xl p-3 transition hover:bg-neutral-50"
                        >
                          <span
                            className={cn(
                              "grid size-10 shrink-0 place-items-center rounded-xl border",
                              getNotificationToneClassName(notification.tone),
                            )}
                          >
                            <NotificationIcon notification={notification} />
                          </span>

                          <span className="min-w-0 flex-1">
                            <span className="block text-sm font-semibold text-neutral-950">
                              {notification.title}
                            </span>
                            <span className="mt-1 block text-xs leading-5 text-[var(--muted)]">
                              {notification.description}
                            </span>
                            <span className="mt-2 inline-flex text-xs font-semibold text-[var(--accent)] transition group-hover:translate-x-0.5">
                              {notification.actionLabel} →
                            </span>
                          </span>
                        </Link>
                      ))}
                    </div>
                  ) : (
                    <div className="px-4 py-6 text-center">
                      <div className="mx-auto grid size-12 place-items-center rounded-2xl bg-emerald-50 text-emerald-600">
                        <Bell className="size-5" />
                      </div>
                      <p className="mt-3 text-sm font-semibold text-neutral-950">
                        Tidak ada notifikasi
                      </p>
                      <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
                        Semua operasional POS dalam kondisi aman.
                      </p>
                    </div>
                  )}
                </div>
              ) : null}
            </div>

            <UserMenu
              fullName={user.fullName}
              roleLabel={user.roleLabel}
              currentArea="pos"
              canAccessAdmin={user.canAccessAdmin}
            />
          </div>
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden pb-[112px] lg:pb-0">
          {children}
        </main>

        {/* Status bar desktop */}
        <footer className="hidden h-12 shrink-0 items-center justify-between border-t border-[var(--border)] bg-white px-5 text-xs text-[var(--muted)] lg:flex lg:px-6">
          <div className="flex items-center gap-6">
            <span className="flex items-center gap-2 text-[var(--success)]">
              <span className="size-2 rounded-full bg-current shadow-[0_0_0_4px_rgba(31,138,85,0.12)]" />
              Online
            </span>

            <span className="flex items-center gap-2">
              <Store className="size-4" />
              {user.outletName}
            </span>

            <span
              className={cn(
                "flex items-center gap-2",
                getShiftStatusClassName(operationalStatus.shift.status),
              )}
            >
              <Clock3 className="size-4" />
              {shiftLabel}
            </span>
          </div>

          <span
            className={cn(
              "flex items-center gap-2",
              getHardwareStatusClassName(operationalStatus.hardware.status),
            )}
          >
            <Printer className="size-4" />
            {operationalStatus.hardware.label}
          </span>
        </footer>
      </div>

      {/* Status dan navigation mobile */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--border)] bg-white lg:hidden">
        <div className="flex h-9 items-center justify-between gap-3 border-b border-[var(--border)] px-4 text-[11px] text-[var(--muted)]">
          <span
            className={cn(
              "flex min-w-0 items-center gap-1.5",
              getHardwareStatusClassName(operationalStatus.hardware.status),
            )}
          >
            <Printer className="size-3.5 shrink-0" />
            <span className="truncate">{operationalStatus.hardware.label}</span>
          </span>

          <span className="min-w-0 shrink-0 truncate text-right">
            {operationalStatus.outletName || user.outletName} · {shiftLabel}
          </span>
        </div>

        <nav className="grid h-[62px] grid-cols-4 pb-[env(safe-area-inset-bottom)]">
          {mobilePrimaryNavigation.map(({ label, href, icon: Icon }) => {
            const active =
              href === "/pos/transaksi"
                ? isTransactionNavigationActive(pathname)
                : isNavigationActive(pathname, href);

            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={getMobileBottomNavigationItemClassName(active)}
              >
                <Icon
                  aria-hidden="true"
                  className={mobileBottomNavigationIconClassName}
                  strokeWidth={1.9}
                />
                <span>{label}</span>
              </Link>
            );
          })}

          <button
            type="button"
            aria-haspopup="dialog"
            aria-expanded={isMoreOpen}
            onClick={() => setIsMoreOpen(true)}
            className={getMobileBottomNavigationItemClassName(
              isMoreNavigationActive,
            )}
          >
            <ListChevronsDownUp
              aria-hidden="true"
              className={mobileBottomNavigationIconClassName}
              strokeWidth={2.1}
            />
            <span>Menu</span>
          </button>
        </nav>
      </div>

      <CameraScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScan={(result) => {
          setIsScannerOpen(false);
          sendPosWorkspaceCommand({ type: "scan", value: result });
        }}
      />
    </div>
  );
}
