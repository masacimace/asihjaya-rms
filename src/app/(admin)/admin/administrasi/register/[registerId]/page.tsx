import {
  Activity,
  ArrowLeft,
  CheckCircle2,
  Clock3,
  Cpu,
  MonitorSmartphone,
  ReceiptText,
  Store,
} from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { EditRegisterForm } from "@/components/administration/outlet-register-forms";
import {
  getRegisterDetail,
  getRegisterOutletOptions,
} from "@/features/administration/queries";
import { requirePermission } from "@/lib/auth/session";

export const metadata = {
  title: "Detail Register",
};

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

  const deviceRoleLabel = register.isHardwareHub
    ? "Hardware Hub"
    : "Terminal POS";
  const readinessLabel = register.isActive
    ? register.activeShiftCount > 0
      ? "Sedang digunakan untuk operasional"
      : "Siap digunakan untuk operasional"
    : "Tidak menerima operasional baru";

  const overviewItems = [
    {
      label: "Total shift",
      value: register.shiftCount,
      helper:
        register.shiftCount > 0
          ? "Riwayat shift pada terminal ini"
          : "Belum memiliki riwayat shift",
      icon: Clock3,
    },
    {
      label: "Shift aktif",
      value: register.activeShiftCount,
      helper:
        register.activeShiftCount > 0
          ? "Perlu diselesaikan sebelum dinonaktifkan"
          : "Tidak ada shift yang sedang berjalan",
      icon: Activity,
    },
    {
      label: "Total transaksi",
      value: register.saleCount,
      helper:
        register.saleCount > 0
          ? "Transaksi tercatat melalui register ini"
          : "Belum memiliki transaksi",
      icon: ReceiptText,
    },
    {
      label: "Peran perangkat",
      value: deviceRoleLabel,
      helper: register.isHardwareHub
        ? "Mengendalikan perangkat lokal outlet"
        : "Digunakan sebagai terminal kasir biasa",
      icon: Cpu,
    },
  ];

  return (
    <div className="mx-auto flex w-full max-w-7xl min-w-0 flex-col gap-5 overflow-x-clip pb-6">
      <section className="rounded-3xl border border-[var(--border)] bg-white p-4 sm:p-5">
        <Link
          href="/admin/administrasi/register"
          className="inline-flex h-10 w-fit items-center gap-2 bg-white px-3 text-sm font-medium text-neutral-700 transition hover:text-neutral-950"
        >
          <ArrowLeft className="size-4" />
          Kembali ke daftar register
        </Link>

        <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_330px] xl:items-start">
          <div className="min-w-0">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
              <div className="grid size-16 shrink-0 place-items-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent)]">
                <MonitorSmartphone className="size-7" />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="break-words text-2xl font-semibold text-neutral-950 sm:text-3xl">
                    {register.name}
                  </h1>

                  <span
                    className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${
                      register.isActive
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                        : "border-neutral-200 bg-neutral-100 text-neutral-600"
                    }`}
                  >
                    {register.isActive ? "Aktif" : "Nonaktif"}
                  </span>

                  <span
                    className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${
                      register.isHardwareHub
                        ? "border-blue-200 bg-blue-50 text-blue-700"
                        : "border-[var(--border)] bg-[var(--surface-muted)] text-neutral-700"
                    }`}
                  >
                    {deviceRoleLabel}
                  </span>
                </div>

                <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                  Kelola identitas terminal, status operasional, dan peran perangkat
                  register pada outlet.
                </p>

                <div className="mt-4 flex flex-wrap gap-2 text-xs text-neutral-700">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-1.5 font-mono">
                    <MonitorSmartphone className="size-3.5 text-[var(--accent)]" />
                    {register.code}
                  </span>

                  <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-1.5">
                    <Store className="size-3.5 text-[var(--accent)]" />
                    {register.outletName} · {register.outletCode}
                  </span>

                  <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-1.5">
                    <CheckCircle2
                      className={`size-3.5 ${
                        register.isActive
                          ? "text-emerald-600"
                          : "text-neutral-500"
                      }`}
                    />
                    {readinessLabel}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <aside className="rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] p-4">
            <div className="flex items-start gap-3">
              <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-white text-[var(--accent)]">
                <Cpu className="size-5" />
              </div>

              <div className="min-w-0">
                <p className="text-sm font-semibold text-neutral-950">
                  Pengelolaan terminal
                </p>
                <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
                  Perubahan status dan hardware hub dapat memengaruhi shift, POS,
                  printer, cash drawer, serta perangkat lokal outlet.
                </p>
              </div>
            </div>

            <div className="mt-4 space-y-2 text-xs text-neutral-700">
              {[
                "Pastikan shift aktif sudah diselesaikan sebelum menonaktifkan register.",
                "Satu outlet hanya dapat memiliki satu hardware hub aktif.",
                "Kode register dan outlet penempatan bersifat permanen.",
              ].map((item) => (
                <div key={item} className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" />
                  <span className="leading-5">{item}</span>
                </div>
              ))}
            </div>
          </aside>
        </div>
      </section>

      {query.created === "1" ? (
        <div className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          <CheckCircle2 className="mt-0.5 size-5 shrink-0" />
          <div>
            <p className="font-semibold">Register berhasil dibuat</p>
            <p className="mt-0.5 text-xs leading-5 text-emerald-700/90">
              Register sudah terhubung ke outlet. Periksa status hardware hub dan
              lanjutkan konfigurasi printer atau perangkat lokal bila diperlukan.
            </p>
          </div>
        </div>
      ) : null}

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        {overviewItems.map((item) => {
          const Icon = item.icon;

          return (
            <article
              key={item.label}
              className="min-w-0 rounded-2xl border border-[var(--border)] bg-white p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-[var(--surface-muted)] text-[var(--accent)]">
                  <Icon className="size-5" />
                </div>
              </div>

              <p className="mt-4 break-words text-xl font-semibold text-neutral-950">
                {item.value}
              </p>
              <p className="mt-1 text-xs font-medium text-neutral-700">
                {item.label}
              </p>
              <p className="mt-1 hidden text-xs leading-5 text-[var(--muted)] sm:block">
                {item.helper}
              </p>
            </article>
          );
        })}
      </section>

      <EditRegisterForm
        outlets={outletOptions}
        register={register}
        operationalSummary={{
          shiftCount: register.shiftCount,
          saleCount: register.saleCount,
          activeShiftCount: register.activeShiftCount,
        }}
      />
    </div>
  );
}
