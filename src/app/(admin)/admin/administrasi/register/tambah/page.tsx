import { ArrowLeft, MonitorSmartphone } from "lucide-react";
import Link from "next/link";

import { RegisterForm } from "@/components/administration/outlet-register-forms";
import { getRegisterOutletOptions } from "@/features/administration/queries";
import { requirePermission } from "@/lib/auth/session";

export default async function CreateRegisterPage({
  searchParams,
}: {
  searchParams: Promise<{
    outletId?: string;
  }>;
}) {
  const auth = await requirePermission("outlets.manage");

  const query = await searchParams;

  const outletOptions = await getRegisterOutletOptions(auth.organization.id);

  const requestedOutletExists = outletOptions.some(
    (outlet) => outlet.id === query.outletId,
  );

  const defaultOutletId = requestedOutletExists
    ? query.outletId
    : outletOptions[0]?.id;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header>
        <Link
          href="/admin/administrasi/register"
          className="inline-flex items-center gap-2 text-sm font-medium text-[var(--muted)] hover:text-neutral-950"
        >
          <ArrowLeft className="size-4" />
          Kembali ke daftar register
        </Link>

        <div className="mt-5 flex items-center gap-4">
          <div className="grid size-12 place-items-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent)]">
            <MonitorSmartphone className="size-5" />
          </div>

          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-neutral-950">
              Tambah Register
            </h1>

            <p className="mt-1 text-sm text-[var(--muted)]">
              Daftarkan terminal kasir pada outlet.
            </p>
          </div>
        </div>
      </header>

      {outletOptions.length === 0 ? (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">
          Belum tersedia outlet aktif. Aktifkan atau buat outlet terlebih
          dahulu.
        </section>
      ) : (
        <RegisterForm
          mode="create"
          outlets={outletOptions}
          defaultOutletId={defaultOutletId}
        />
      )}
    </div>
  );
}
