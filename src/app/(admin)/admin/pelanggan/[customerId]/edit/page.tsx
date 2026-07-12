import {
  ArrowLeft,
  BadgeCheck,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Mail,
  Phone,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import Link from "next/link";

import { EditCustomerForm } from "@/components/customers/customer-form";
import { isUuid } from "@/features/customers/contracts";
import { getAdminCustomerFormData } from "@/features/customers/queries";
import { requirePermission } from "@/lib/auth/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const dateTimeFormatter = new Intl.DateTimeFormat("id-ID", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Jakarta",
});

function getInitials(fullName: string) {
  const nameParts = fullName.trim().split(/\s+/).filter(Boolean);
  const firstName = nameParts[0];

  if (!firstName) {
    return "?";
  }

  if (nameParts.length === 1) {
    return firstName.slice(0, 2).toUpperCase();
  }

  const lastName = nameParts.at(-1);

  return `${firstName.charAt(0)}${lastName?.charAt(0) ?? ""}`.toUpperCase();
}

function CustomerEditUnavailableState({
  customerId,
  reason,
}: {
  customerId: string;
  reason: "invalid" | "not-found";
}) {
  return (
    <div className="mx-auto flex w-full max-w-3xl min-w-0 flex-col gap-5 pb-6">
      <section className="rounded-3xl border border-[var(--border)] bg-white p-4 sm:p-5">
        <Link
          href="/admin/pelanggan"
          className="inline-flex h-10 w-fit items-center gap-2 bg-white px-3 text-sm font-medium text-neutral-700 transition hover:text-neutral-950"
        >
          <ArrowLeft className="size-4" />
          Kembali ke daftar pelanggan
        </Link>

        <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-center sm:p-7">
          <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-white text-amber-700">
            <UserRound className="size-7" />
          </div>
          <h1 className="mt-5 text-2xl font-semibold text-neutral-950">
            Form edit pelanggan tidak tersedia
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-amber-900/80">
            {reason === "invalid"
              ? "Parameter pelanggan pada URL tidak valid. Buka kembali form edit melalui halaman detail pelanggan."
              : "Data pelanggan tidak ditemukan untuk organisasi akun ini atau sudah tidak tersedia pada database aktif."}
          </p>

          <div className="mx-auto mt-5 max-w-xl rounded-xl border border-amber-200 bg-white px-4 py-3 text-left text-xs text-neutral-600">
            <span className="font-semibold text-neutral-800">Lookup:</span>{" "}
            <code className="break-all">{customerId}</code>
          </div>

          <Link
            href="/admin/pelanggan"
            className="mt-6 inline-flex h-11 items-center justify-center rounded-xl bg-[var(--accent)] px-5 text-sm font-semibold !text-white transition hover:brightness-95"
          >
            Buka daftar pelanggan
          </Link>
        </div>
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
    return (
      <CustomerEditUnavailableState customerId={customerId} reason="invalid" />
    );
  }

  const customer = await getAdminCustomerFormData({
    organizationId: auth.organization.id,
    customerId,
  });

  if (!customer) {
    return (
      <CustomerEditUnavailableState
        customerId={customerId}
        reason="not-found"
      />
    );
  }

  const statusLabel = customer.isActive ? "Aktif" : "Nonaktif";
  const statusClassName = customer.isActive
    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
    : "border-neutral-200 bg-neutral-100 text-neutral-600";

  return (
    <div className="mx-auto flex w-full max-w-7xl min-w-0 flex-col gap-5 overflow-x-clip pb-6">
      <section className="rounded-3xl border border-[var(--border)] bg-white p-4 sm:p-5">
        <Link
          href={`/admin/pelanggan/${customer.id}`}
          className="inline-flex h-10 w-fit items-center gap-2 bg-white px-3 text-sm font-medium text-neutral-700 transition hover:text-neutral-950"
        >
          <ArrowLeft className="size-4" />
          Kembali ke detail pelanggan
        </Link>

        <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_330px] xl:items-start">
          <div className="min-w-0">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
              <div className="grid size-56 shrink-0 place-items-center rounded-2xl bg-[var(--accent-soft)] text-xl font-semibold text-[var(--accent)]">
                {getInitials(customer.fullName)}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="break-words text-2xl font-semibold text-neutral-950 sm:text-3xl">
                    {customer.fullName}
                  </h1>
                  <span
                    className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${statusClassName}`}
                  >
                    {statusLabel}
                  </span>
                </div>

                <p className="mt-2 font-mono text-xs font-semibold text-[var(--accent)] sm:text-sm">
                  {customer.customerCode ?? "Kode pelanggan belum tersedia"}
                </p>

                <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--muted)]">
                  Perbarui identitas, kontak, status, alamat, dan catatan
                  internal tanpa memutus hubungan dengan histori transaksi
                  pelanggan.
                </p>

                <div className="mt-4 flex flex-wrap gap-2 text-xs text-neutral-700">
                  <span className="inline-flex min-w-0 items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-1.5">
                    <Phone className="size-3.5 shrink-0 text-[var(--accent)]" />
                    <span className="truncate">
                      {customer.phone ?? "Telepon belum diisi"}
                    </span>
                  </span>

                  <span className="inline-flex min-w-0 items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-1.5">
                    <Mail className="size-3.5 shrink-0 text-[var(--accent)]" />
                    <span className="truncate">
                      {customer.email ?? "Email belum diisi"}
                    </span>
                  </span>

                  <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-1.5">
                    <CalendarDays className="size-3.5 text-[var(--accent)]" />
                    Dibuat {dateTimeFormatter.format(customer.createdAt)}
                  </span>

                  <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-1.5">
                    <Clock3 className="size-3.5 text-[var(--accent)]" />
                    Diperbarui {dateTimeFormatter.format(customer.updatedAt)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <aside className="rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] p-4">
            <div className="flex items-start gap-3">
              <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-white text-[var(--accent)]">
                <ShieldCheck className="size-5" />
              </div>

              <div className="min-w-0">
                <p className="text-sm font-semibold text-neutral-950">
                  Pengelolaan profil
                </p>
                <p className="mt-2 text-xs leading-5 text-[var(--muted)]">
                  Perubahan profil langsung berlaku pada Admin dan pencarian
                  pelanggan di POS setelah disimpan.
                </p>
              </div>
            </div>

            <div className="mt-4 space-y-2 text-xs text-neutral-700">
              {[
                "Perbarui identitas dan kanal kontak pelanggan.",
                "Lengkapi alamat serta catatan pelayanan internal.",
                "Atur status tanpa menghapus histori transaksi.",
              ].map((item) => (
                <div key={item} className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" />
                  <span className="leading-5">{item}</span>
                </div>
              ))}
            </div>

            <div className="mt-4 flex items-start gap-3 rounded-xl border border-[var(--border)] bg-white px-3.5 py-3">
              <BadgeCheck className="mt-0.5 size-4 shrink-0 text-[var(--accent)]" />
              <p className="text-xs leading-5 text-[var(--muted)]">
                Kode pelanggan bersifat permanen dan tetap terhubung dengan
                seluruh histori transaksi.
              </p>
            </div>
          </aside>
        </div>
      </section>

      <EditCustomerForm customer={customer} />
    </div>
  );
}
