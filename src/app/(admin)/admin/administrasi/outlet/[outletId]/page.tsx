import {
  ArrowLeft,
  Boxes,
  Clock3,
  Cpu,
  MonitorSmartphone,
  Plus,
  UsersRound,
} from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { OutletForm } from "@/components/administration/outlet-register-forms";
import { getOutletDetail } from "@/features/administration/queries";
import { requirePermission } from "@/lib/auth/session";

export default async function OutletDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{
    outletId: string;
  }>;

  searchParams: Promise<{
    created?: string;
  }>;
}) {
  const auth = await requirePermission("outlets.manage");

  const { outletId } = await params;

  const query = await searchParams;

  const outlet = await getOutletDetail(auth.organization.id, outletId);

  if (!outlet) {
    notFound();
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header>
        <Link
          href="/admin/administrasi/outlet"
          className="inline-flex items-center gap-2 text-sm font-medium text-[var(--muted)] hover:text-neutral-950"
        >
          <ArrowLeft className="size-4" />
          Kembali ke daftar outlet
        </Link>

        <div className="mt-5">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight text-neutral-950">
              {outlet.name}
            </h1>

            <span
              className={
                outlet.isActive
                  ? "rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700"
                  : "rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-medium text-neutral-600"
              }
            >
              {outlet.isActive ? "Aktif" : "Nonaktif"}
            </span>
          </div>

          <p className="mt-1 text-sm text-[var(--muted)]">
            Kode outlet: {outlet.code}
          </p>
        </div>
      </header>

      {query.created === "1" ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          Outlet berhasil dibuat.
        </div>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-2xl border border-[var(--border)] bg-white p-4">
          <MonitorSmartphone className="size-5 text-[var(--accent)]" />

          <p className="mt-4 text-xl font-semibold">
            {outlet.activeRegisterCount}
          </p>

          <p className="mt-1 text-xs text-[var(--muted)]">Register aktif</p>
        </article>

        <article className="rounded-2xl border border-[var(--border)] bg-white p-4">
          <UsersRound className="size-5 text-blue-700" />

          <p className="mt-4 text-xl font-semibold">
            {outlet.assignedStaffCount}
          </p>

          <p className="mt-1 text-xs text-[var(--muted)]">Staff terhubung</p>
        </article>

        <article className="rounded-2xl border border-[var(--border)] bg-white p-4">
          <Boxes className="size-5 text-amber-700" />

          <p className="mt-4 text-xl font-semibold">
            {outlet.inventoryItemCount}
          </p>

          <p className="mt-1 text-xs text-[var(--muted)]">
            Item fisik di outlet
          </p>
        </article>

        <article className="rounded-2xl border border-[var(--border)] bg-white p-4">
          <Clock3 className="size-5 text-violet-700" />

          <p className="mt-4 text-xl font-semibold">
            {outlet.activeShiftCount}
          </p>

          <p className="mt-1 text-xs text-[var(--muted)]">Shift aktif</p>
        </article>
      </section>

      <OutletForm mode="edit" outlet={outlet} />

      <section className="rounded-2xl border border-[var(--border)] bg-white p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-semibold text-neutral-950">Register Outlet</h2>

            <p className="mt-1 text-xs text-[var(--muted)]">
              {outlet.registerCount} register terdaftar
            </p>
          </div>

          {outlet.isActive ? (
            <Link
              href={`/admin/administrasi/register/tambah?outletId=${outlet.id}`}
              className="flex h-10 items-center justify-center gap-2 rounded-xl border border-[var(--border)] px-3 text-sm font-medium text-neutral-700 transition hover:border-[var(--accent)] hover:bg-[var(--accent-soft)] hover:text-[var(--accent)]"
            >
              <Plus className="size-4" />
              Tambah Register
            </Link>
          ) : null}
        </div>

        <div className="mt-5 divide-y divide-[var(--border)]">
          {outlet.registers.length === 0 ? (
            <p className="py-8 text-center text-sm text-[var(--muted)]">
              Belum ada register pada outlet ini.
            </p>
          ) : (
            outlet.registers.map((register) => (
              <Link
                key={register.id}
                href={`/admin/administrasi/register/${register.id}`}
                className="flex items-center gap-3 py-4 first:pt-0 last:pb-0"
              >
                <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]">
                  {register.isHardwareHub ? (
                    <Cpu className="size-5" />
                  ) : (
                    <MonitorSmartphone className="size-5" />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <p className="font-medium text-neutral-950">
                    {register.name}
                  </p>

                  <p className="mt-0.5 text-xs text-[var(--muted)]">
                    {register.code}
                  </p>
                </div>

                <div className="flex flex-wrap justify-end gap-2">
                  {register.isHardwareHub ? (
                    <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">
                      Hardware hub
                    </span>
                  ) : null}

                  <span
                    className={
                      register.isActive
                        ? "rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700"
                        : "rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-medium text-neutral-600"
                    }
                  >
                    {register.isActive ? "Aktif" : "Nonaktif"}
                  </span>
                </div>
              </Link>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
