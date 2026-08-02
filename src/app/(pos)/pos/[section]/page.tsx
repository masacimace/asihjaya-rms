import { LayoutPanelTop } from "lucide-react";

import { PosPageContainer, PosPageHeader } from "@/components/layout/pos-page";

export const metadata = {
  title: "POS",
};

const sectionNames: Record<string, string> = {
  transaksi: "Transaksi",
  pelanggan: "Pelanggan",
  ditahan: "Transaksi Ditahan",
  shift: "Shift Saat Ini",
};

export default async function PosSectionPage({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;

  const title = sectionNames[section] ?? "Modul POS";

  return (
    <PosPageContainer>
      <PosPageHeader
        title={title}
        description="Halaman ini sudah tersedia dalam navigasi dasar dan akan dikembangkan sesuai kebutuhan operasional POS."
        icon={<LayoutPanelTop className="size-5 sm:size-6" />}
      />
    </PosPageContainer>
  );
}
