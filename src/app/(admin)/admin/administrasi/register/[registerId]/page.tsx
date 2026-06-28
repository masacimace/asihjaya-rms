import { ArrowLeft, Clock3, Cpu, ReceiptText } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { RegisterForm } from "@/components/administration/outlet-register-forms";
import {
  getRegisterDetail,
  getRegisterOutletOptions,
} from "@/features/administration/queries";
import { requirePermission } from "@/lib/auth/session";

export default async function RegisterDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{
    registerId: string;
  }>;

  searchParams: Promise<{
    created?: string;
  }>;
}) {
  const auth = await requirePermission("outlets.manage");

  const { registerId } = await params;

  const query = await searchParams;

  const [register, outletOptions] = await Promise.all([
    getRegisterDetail(auth.organization.id, registerId),

    getRegisterOutletOptions(auth.organization.id),
  ]);

  if (!register) {
    notFound();
  }

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

        <div className="mt-5">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight text-neutral-950">
              {register.name}
            </h1>

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

          <p className="mt-1 text-sm text-[var(--muted)]">
            {register.code} · {register.outletName}
          </p>
        </div>
      </header>

      {query.created === "1" ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          Register berhasil dibuat.
        </div>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-3">
        <article className="rounded-2xl border border-[var(--border)] bg-white p-4">
          <Clock3 className="size-5 text-violet-700" />

          <p className="mt-4 text-xl font-semibold">{register.shiftCount}</p>

          <p className="mt-1 text-xs text-[var(--muted)]">Total shift</p>
        </article>

        <article className="rounded-2xl border border-[var(--border)] bg-white p-4">
          <ReceiptText className="size-5 text-emerald-700" />

          <p className="mt-4 text-xl font-semibold">{register.saleCount}</p>

          <p className="mt-1 text-xs text-[var(--muted)]">Total transaksi</p>
        </article>

        <article className="rounded-2xl border border-[var(--border)] bg-white p-4">
          <Cpu className="size-5 text-blue-700" />

          <p className="mt-4 text-xl font-semibold">
            {register.activeShiftCount}
          </p>

          <p className="mt-1 text-xs text-[var(--muted)]">Shift aktif</p>
        </article>
      </section>

      <RegisterForm mode="edit" outlets={outletOptions} register={register} />
    </div>
  );
}
