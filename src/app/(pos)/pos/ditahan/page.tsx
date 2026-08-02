import { ArrowLeft, Pause } from "lucide-react";
import Link from "next/link";

import { PosPageContainer, PosPageHeader } from "@/components/layout/pos-page";
import { HeldCartsClient } from "@/components/pos/held-carts-client";
import { getPosHeldCartListData } from "@/features/pos/queries";
import { requirePermission } from "@/lib/auth/session";

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

  return (
    <PosPageContainer>
      <PosPageHeader
        eyebrow="Transaksi POS"
        title="Transaksi Ditahan"
        description="Lanjutkan atau batalkan cart yang ditahan. Item pada hold aktif tetap terkunci sampai transaksi di-resume atau dibatalkan."
        icon={<Pause className="size-5 sm:size-6" />}
        actions={
          <Link
            href="/pos"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-white px-4 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-50"
          >
            <ArrowLeft className="size-4" />
            Kembali ke POS
          </Link>
        }
      />

      <HeldCartsClient data={data} />
    </PosPageContainer>
  );
}
