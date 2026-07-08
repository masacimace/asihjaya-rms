import { ArrowLeft, Edit2, UserRound } from "lucide-react";
import Link from "next/link";

import { EditCustomerForm } from "@/components/customers/customer-form";
import { isUuid } from "@/features/customers/contracts";
import { getAdminCustomerFormData } from "@/features/customers/queries";
import { requirePermission } from "@/lib/auth/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function CustomerEditUnavailableState({
  customerId,
  reason,
}: {
  customerId: string;
  reason: "invalid" | "not-found";
}) {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <nav>
        <Link
          href="/admin/pelanggan"
          className="inline-flex items-center gap-2 text-sm font-medium text-[var(--muted)] hover:text-neutral-950"
        >
          <ArrowLeft className="size-4" />
          Kembali ke daftar pelanggan
        </Link>
      </nav>

      <section className="rounded-3xl border border-[var(--border)] bg-white p-6 text-center sm:p-8">
        <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-amber-50 text-amber-600">
          <UserRound className="size-7" />
        </div>
        <h1 className="mt-5 text-2xl font-semibold tracking-tight text-neutral-950">
          Form edit pelanggan tidak tersedia
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-[var(--muted)]">
          {reason === "invalid"
            ? "Parameter pelanggan pada URL tidak valid. Buka ulang form edit dari halaman detail pelanggan."
            : "Data pelanggan tidak ditemukan untuk organisasi akun ini, atau data sudah tidak tersedia di database yang sedang dipakai aplikasi."}
        </p>
        <div className="mt-5 rounded-2xl bg-neutral-50 px-4 py-3 text-left text-xs text-neutral-600">
          <span className="font-semibold text-neutral-800">Lookup:</span>{" "}
          <code className="break-all">{customerId}</code>
        </div>
        <Link
          href="/admin/pelanggan"
          className="mt-6 inline-flex h-11 items-center justify-center rounded-xl bg-[var(--accent)] px-5 text-sm font-semibold !text-white transition hover:opacity-90"
        >
          Buka daftar pelanggan
        </Link>
      </section>
    </div>
  );
}

export default async function EditCustomerPage({
  params,
}: {
  params: Promise<{ customerId: string }>;
}) {
  const auth = await requirePermission("admin.access");
  const { customerId } = await params;

  if (!isUuid(customerId)) {
    return <CustomerEditUnavailableState customerId={customerId} reason="invalid" />;
  }

  const customer = await getAdminCustomerFormData({
    organizationId: auth.organization.id,
    customerId,
  });

  if (!customer) {
    return <CustomerEditUnavailableState customerId={customerId} reason="not-found" />;
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header>
        <Link
          href={`/admin/pelanggan/${customer.id}`}
          className="inline-flex items-center gap-2 text-sm font-medium text-[var(--muted)] hover:text-neutral-950"
        >
          <ArrowLeft className="size-4" />
          Kembali ke detail pelanggan
        </Link>

        <div className="mt-5 flex items-center gap-4">
          <div className="grid size-12 place-items-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent)]">
            <Edit2 className="size-5" />
          </div>

          <div className="min-w-0">
            <p className="text-sm font-medium text-[var(--accent)]">
              Customer Relationship
            </p>
            <h1 className="mt-1 truncate text-2xl font-semibold tracking-tight text-neutral-950">
              Edit {customer.fullName}
            </h1>
            <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
              Perbarui profil, kontak, status, dan catatan internal pelanggan.
            </p>
          </div>
        </div>
      </header>

      <EditCustomerForm customer={customer} />
    </div>
  );
}
