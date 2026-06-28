import { ArrowLeft, Building2 } from "lucide-react";
import Link from "next/link";

import { OutletForm } from "@/components/administration/outlet-register-forms";
import { requirePermission } from "@/lib/auth/session";

export default async function CreateOutletPage() {
  await requirePermission("outlets.manage");

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header>
        <Link
          href="/admin/administrasi/outlet"
          className="inline-flex items-center gap-2 text-sm font-medium text-[var(--muted)] hover:text-neutral-950"
        >
          <ArrowLeft className="size-4" />
          Kembali ke daftar outlet
        </Link>

        <div className="mt-5 flex items-center gap-4">
          <div className="grid size-12 place-items-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent)]">
            <Building2 className="size-5" />
          </div>

          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-neutral-950">
              Tambah Outlet
            </h1>

            <p className="mt-1 text-sm text-[var(--muted)]">
              Daftarkan lokasi operasional baru.
            </p>
          </div>
        </div>
      </header>

      <OutletForm mode="create" />
    </div>
  );
}
