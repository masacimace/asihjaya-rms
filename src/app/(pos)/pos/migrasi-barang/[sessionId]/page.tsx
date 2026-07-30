import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

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
    <div className="mx-auto w-full max-w-4xl p-4 sm:p-6 lg:p-8">
      <Link
        href="/pos/migrasi-barang"
        className="mb-4 inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-neutral-900 transition hover:bg-white"
      >
        <ArrowLeft className="size-4" />
        Kembali ke daftar sesi
      </Link>

      <MobileMigrationScanner
        session={data.session}
        productMasters={data.productMasters}
        recentVerifications={data.recentVerifications}
        summary={data.summary}
      />
    </div>
  );
}
