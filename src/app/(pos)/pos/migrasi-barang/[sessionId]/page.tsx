import { ArrowLeft, ScanBarcode } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PosPageContainer, PosPageHeader } from "@/components/layout/pos-page";
import { MobileMigrationScanner } from "@/features/legacy-migration/components/mobile-migration-scanner";
import { getLegacyMigrationScannerSession } from "@/features/legacy-migration/verification-queries";
import { requirePermission } from "@/lib/auth/session";

export const metadata = { title: "Scanner Migrasi Barang" };
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function LegacyMigrationScannerPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const auth = await requirePermission("migration.scan");
  const { sessionId } = await params;
  const data = await getLegacyMigrationScannerSession(auth, sessionId);
  if (!data) notFound();

  return (
    <PosPageContainer>
      <PosPageHeader
        eyebrow="Scanner migrasi"
        title="Verifikasi Fisik Barang"
        description="Scan barcode, periksa kondisi fisik, lalu kirim verification ke manager tanpa keluar dari workspace sesi."
        icon={<ScanBarcode className="size-5 sm:size-6" />}
        actions={
          <Link
            href="/pos/migrasi-barang"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-white px-4 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-50"
          >
            <ArrowLeft className="size-4" />
            Kembali ke daftar sesi
          </Link>
        }
      />

      <MobileMigrationScanner
        session={data.session}
        productMasters={data.productMasters}
        recentVerifications={data.recentVerifications}
        summary={data.summary}
      />
    </PosPageContainer>
  );
}
