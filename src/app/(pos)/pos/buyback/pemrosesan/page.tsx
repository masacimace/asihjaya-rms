import { ArrowLeft, PackageCheck, Store, Wrench } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { BuybackProcessingWorkspace } from "@/components/buybacks/buyback-processing-workspace";
import { PosPageContainer, PosPageHeader } from "@/components/layout/pos-page";
import type {
  BuybackProcessingListFilters,
} from "@/features/buybacks/processing-contracts";
import { getBuybackProcessingData } from "@/features/buybacks/processing-queries";
import { getActiveGoldPriceRates } from "@/features/pricing/metal-price-rates";
import {
  getActiveProductMasterOptions,
  getProductMasterCategoryOptions,
} from "@/features/products/product-master-queries";
import { getActiveProductColorPresetOptions } from "@/features/settings/product-color-presets";
import { hasPermission, requirePermission } from "@/lib/auth/session";

export const metadata = {
  title: "Pemrosesan Buyback | POS",
};

export const runtime = "nodejs";

const COMPLETED_PAGE_SIZE = 10;

type PageProps = {
  searchParams: Promise<{
    page?: string;
    q?: string;
    status?: string;
    type?: string;
  }>;
};

function normalizePage(value: string | undefined) {
  const parsed = Number.parseInt(value ?? "1", 10);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : 1;
}

function normalizeStatus(value: string | undefined) {
  return value === "completed" ? "completed" : "pending";
}

function normalizeProcessingType(value: string | undefined) {
  return value === "cleaning" || value === "recondition" ? value : "all";
}

function buildProcessingHref({
  page,
  search,
  status,
  processingType,
}: {
  page: number;
  search: string;
  status: BuybackProcessingListFilters["status"];
  processingType: BuybackProcessingListFilters["processingType"];
}) {
  const params = new URLSearchParams();

  if (search) params.set("q", search);
  if (processingType !== "all") params.set("type", processingType);
  if (status === "completed") params.set("status", status);
  if (status === "completed" && page > 1) params.set("page", String(page));

  const query = params.toString();
  return query
    ? `/pos/buyback/pemrosesan?${query}`
    : "/pos/buyback/pemrosesan";
}

export default async function BuybackProcessingPage({
  searchParams,
}: PageProps) {
  const [auth, query] = await Promise.all([
    requirePermission("buybacks.view"),
    searchParams,
  ]);

  if (!hasPermission(auth, "pos.access")) {
    redirect("/akses-ditolak");
  }

  const primaryOutlet =
    auth.outlets.find((outlet) => outlet.isPrimary) ?? auth.outlets[0] ?? null;

  if (!primaryOutlet) {
    redirect("/akses-ditolak");
  }

  const filters: BuybackProcessingListFilters = {
    search: String(query.q ?? "").trim().slice(0, 160),
    status: normalizeStatus(query.status),
    processingType: normalizeProcessingType(query.type),
  };
  const requestedPage = normalizePage(query.page);

  const [data, categories, productMasters, activeRates, colorPresets] =
    await Promise.all([
      getBuybackProcessingData({
        organizationId: auth.organization.id,
        outletId: primaryOutlet.id,
        search: filters.search,
        status: filters.status,
        processingType: filters.processingType,
        page: requestedPage,
        pageSize: COMPLETED_PAGE_SIZE,
        paginateCompleted: true,
        limit: filters.status === "pending" ? null : undefined,
      }),
      getProductMasterCategoryOptions(auth.organization.id),
      getActiveProductMasterOptions(auth.organization.id),
      getActiveGoldPriceRates({ organizationId: auth.organization.id }),
      getActiveProductColorPresetOptions(auth.organization.id),
    ]);

  if (
    filters.status === "completed" &&
    data.pagination &&
    data.pagination.page !== requestedPage
  ) {
    redirect(
      buildProcessingHref({
        page: data.pagination.page,
        search: filters.search,
        status: filters.status,
        processingType: filters.processingType,
      }),
    );
  }

  return (
    <PosPageContainer>
      <PosPageHeader
        eyebrow="Buyback · Inventory admission"
        title="Pemrosesan Cuci / Rongsok"
        description="Selesaikan pekerjaan fisik, catat hasil barang, lalu item langsung masuk inventory saleable. Tidak ada approval atau aktivasi tambahan."
        icon={<Wrench className="size-5" />}
        actions={
          <div className="w-full rounded-[22px] border border-[var(--border)] bg-neutral-50 p-4 sm:p-5 lg:w-[560px] xl:w-[500px]">
            <div className="mt-2 grid gap-2.5 sm:grid-cols-2">
              <div className="min-w-0 rounded-2xl border border-[var(--border)] bg-white/80 p-3.5">
                <div className="flex items-start gap-2 text-[11px] font-medium text-[var(--muted)]">
                  <Store className="size-3.5 shrink-0 text-[var(--accent)]" />
                  Outlet aktif
                </div>
                <p className="mt-2 truncate text-sm font-semibold text-neutral-950">
                  {primaryOutlet.name}
                </p>
                <p className="mt-1 text-xs text-[var(--muted)]">
                  {data.pendingCount} item menunggu proses
                </p>
              </div>

              <div className="min-w-0 rounded-2xl border border-[var(--border)] bg-white/80 p-3.5">
                <div className="flex items-start gap-2 text-[11px] font-medium text-[var(--muted)]">
                  <PackageCheck className="size-3.5 shrink-0 text-[var(--accent)]" />
                  Hasil pemrosesan
                </div>
                <p className="mt-2 text-sm font-semibold text-neutral-950">
                  Submit = Siap Jual
                </p>
                <p className="mt-1 text-xs text-[var(--muted)]">
                  Langsung tersedia di inventory dan POS
                </p>
              </div>
            </div>

            <Link
              href="/pos/buyback"
              className="mt-3 mb-2 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-neutral-950 px-4 text-sm font-semibold !text-white transition hover:bg-neutral-800"
            >
              <ArrowLeft className="size-4" />
              Kembali ke Buyback
            </Link>
          </div>
        }
      />

      <BuybackProcessingWorkspace
        key={`processing:${filters.status}:${filters.processingType}:${filters.search}:${data.pagination?.page ?? 1}`}
        data={data}
        filters={filters}
        categories={categories}
        productMasters={productMasters}
        colorPresets={colorPresets}
        priceRates={activeRates.map((rate) => ({
          purityKey: rate.purityKey,
          purityPercent: rate.purityPercent,
          ratePerGram: rate.ratePerGram,
        }))}
        canProcess={hasPermission(auth, "buybacks.create")}
        canPrintLabel={hasPermission(auth, "inventory.print_label")}
        canViewInventory={
          hasPermission(auth, "inventory.view") ||
          hasPermission(auth, "inventory.receive") ||
          hasPermission(auth, "inventory.adjust") ||
          hasPermission(auth, "inventory.transfer") ||
          hasPermission(auth, "inventory.manage")
        }
      />
    </PosPageContainer>
  );
}
