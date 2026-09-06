import { Pause, Store } from "lucide-react";

import { PosPageContainer, PosPageHeader } from "@/components/layout/pos-page";
import { HeldCartsClient } from "@/components/pos/held-carts-client";
import { getPosHeldCartListData } from "@/features/pos/queries";
import { requirePermission } from "@/lib/auth/session";
import { cn } from "@/lib/utils";

export const metadata = {
  title: "Transaksi Ditahan",
};

export const runtime = "nodejs";

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function getSearchParam(
  searchParams: Record<string, string | string[] | undefined>,
  key: string,
) {
  const value = searchParams[key];

  return Array.isArray(value) ? value[0] : value;
}

export default async function PosHeldCartsPage({ searchParams }: PageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const query = getSearchParam(resolvedSearchParams, "q") ?? "";

  const auth = await requirePermission("pos.access");
  const primaryOutlet =
    auth.outlets.find((outlet) => outlet.isPrimary) ?? auth.outlets[0];

  const data = await getPosHeldCartListData({
    organizationId: auth.organization.id,
    outletId: primaryOutlet?.id,
    query,
  });
  const isOutletOnline = data.outlet?.hardwareStatus === "online";

  return (
    <PosPageContainer>
      <PosPageHeader
        eyebrow="Transaksi POS"
        title="Transaksi Ditahan"
        description="Lanjutkan atau batalkan cart yang ditahan. Item pada hold aktif tetap terkunci sampai transaksi di-resume atau dibatalkan."
        icon={<Pause className="size-5 sm:size-6" />}
        actions={
          <div className="rounded-2xl border border-[var(--border)] bg-white px-4 py-3 text-sm">
            <div className="flex items-center gap-3">
              <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]">
                <Store className="size-5" />
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-xs font-semibold uppercase text-[var(--muted)]">
                    Outlet
                  </p>
                  <span
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold",
                      isOutletOnline
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-red-50 text-red-700",
                    )}
                  >
                    <span
                      className={cn(
                        "size-1.5 rounded-full",
                        isOutletOnline ? "bg-emerald-500" : "bg-red-500",
                      )}
                    />
                    {isOutletOnline ? "Online" : "Offline"}
                  </span>
                </div>
                <p className="mt-1 truncate font-semibold text-neutral-950">
                  {data.outlet?.name ?? "Outlet belum tersedia"}
                </p>
              </div>
            </div>
          </div>
        }
      />

      <HeldCartsClient data={data} />
    </PosPageContainer>
  );
}
