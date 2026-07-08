import { ArrowLeft, UserPlus } from "lucide-react";
import Link from "next/link";

import { CreateCustomerForm } from "@/components/customers/customer-form";
import { requirePermission } from "@/lib/auth/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function CreateCustomerPage() {
  await requirePermission("admin.access");

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header>
        <Link
          href="/admin/pelanggan"
          className="inline-flex items-center gap-2 text-sm font-medium text-[var(--muted)] hover:text-neutral-950"
        >
          <ArrowLeft className="size-4" />
          Kembali ke daftar pelanggan
        </Link>

        <div className="mt-5 flex items-center gap-4">
          <div className="grid size-12 place-items-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent)]">
            <UserPlus className="size-5" />
          </div>

          <div>
            <p className="text-sm font-medium text-[var(--accent)]">
              Customer Relationship
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-neutral-950">
              Tambah Pelanggan
            </h1>
            <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
              Buat profil pelanggan agar bisa dipilih saat checkout POS dan
              terhubung ke riwayat transaksi.
            </p>
          </div>
        </div>
      </header>

      <CreateCustomerForm />
    </div>
  );
}
