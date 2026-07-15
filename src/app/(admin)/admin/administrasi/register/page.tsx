import {
  ArrowLeft,
  ArrowRight,
  Cpu,
  MonitorSmartphone,
  Plus,
} from "lucide-react";
import Link from "next/link";

import { AdministrationTabs } from "@/components/administration/administration-tabs";
import { getAdministrationAccess } from "@/features/administration/access";
import { getOutletsWithRegisters } from "@/features/administration/queries";
import { requirePermission } from "@/lib/auth/session";

export const metadata = {
  title: "Register",
};

export default async function RegisterPage() {
  const auth = await requirePermission("outlets.manage");
  const administrationAccess = getAdministrationAccess(auth);

  const outletList = await getOutletsWithRegisters(auth.organization.id);

  const registerList = outletList.flatMap((outlet) =>
    outlet.registers.map((register) => ({
      ...register,
      outletCode: outlet.code,
      outletName: outlet.name,
    })),
  );

  const activeRegisterCount = registerList.filter(
    (register) => register.isActive,
  ).length;
  const hardwareHubCount = registerList.filter(
    (register) => register.isHardwareHub,
  ).length;
  const inactiveRegisterCount = registerList.length - activeRegisterCount;

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-3xl border border-[var(--border)] bg-white">
        <div className="grid gap-6 p-6 lg:grid-cols-[1fr_22rem] lg:items-end lg:p-7">
          <div>
            <Link
              href="/admin"
              className="inline-flex items-center gap-2 bg-white px-3 py-2 text-sm font-semibold text-neutral-900 transition hover:border-[var(--accent)] hover:bg-[var(--accent-soft)]/40"
            >
              <ArrowLeft className="size-4" />
              Kembali ke Dashboard
            </Link>

            <h1 className="mt-4 text-2xl font-semibold text-neutral-950 sm:text-3xl">
              Daftar Register
            </h1>

            <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--muted)]">
              Kelola terminal kasir, mapping outlet, dan register hardware hub
              yang dipakai untuk transaksi POS, printer, dan perangkat toko.
            </p>
          </div>

          <div className="rounded-2xl border border-[var(--border)] bg-neutral-50 p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-semibold text-neutral-700 ring-1 ring-[var(--border)]">
                  <MonitorSmartphone className="size-3.5 text-[var(--accent)]" />
                  Status register
                </p>
                <p className="mt-2 text-2xl font-semibold text-neutral-950">
                  {activeRegisterCount} terminal
                </p>
                <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
                  {hardwareHubCount} hardware hub tersedia dari total{" "}
                  {registerList.length} register.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <AdministrationTabs active="registers" access={administrationAccess} />

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-2xl border border-[var(--border)] bg-white p-4">
          <p className="text-xs font-medium text-[var(--muted)]">
            Total register
          </p>
          <p className="mt-2 text-2xl font-semibold text-neutral-950">
            {registerList.length}
          </p>
        </div>

        <div className="rounded-2xl border border-[var(--border)] bg-white p-4">
          <p className="text-xs font-medium text-[var(--muted)]">
            Register aktif
          </p>
          <p className="mt-2 text-2xl font-semibold text-emerald-700">
            {activeRegisterCount}
          </p>
        </div>

        <div className="rounded-2xl border border-[var(--border)] bg-white p-4">
          <p className="text-xs font-medium text-[var(--muted)]">
            Hardware hub
          </p>
          <p className="mt-2 text-2xl font-semibold text-blue-700">
            {hardwareHubCount}
          </p>
        </div>

        <div className="rounded-2xl border border-[var(--border)] bg-white p-4">
          <p className="text-xs font-medium text-[var(--muted)]">Nonaktif</p>
          <p className="mt-2 text-2xl font-semibold text-neutral-700">
            {inactiveRegisterCount}
          </p>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-white">
        <div className="flex flex-col gap-4 border-b border-[var(--border)] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-neutral-100 px-3 py-1 text-xs font-semibold text-neutral-700">
              <MonitorSmartphone className="size-3.5" />
              Register Hardware
            </div>
            <h2 className="font-semibold text-neutral-950 mt-3">
              Daftar Register
            </h2>

            <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
              {registerList.length} register terdaftar untuk semua outlet.
            </p>
          </div>

          <Link
            href="/admin/administrasi/register/tambah"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-white px-4 text-sm font-semibold text-neutral-900 transition hover:border-[var(--accent)] hover:bg-[var(--accent-soft)]/40"
          >
            <Plus className="size-4" />
            Tambah Register
          </Link>
        </div>

        <div className="hidden overflow-x-auto lg:block">
          <table className="w-full min-w-[920px] text-left">
            <thead>
              <tr className="border-b border-[var(--border)] bg-neutral-50 text-xs text-[var(--muted)]">
                <th className="px-5 py-3 font-medium">Register</th>

                <th className="px-4 py-3 font-medium">Outlet</th>

                <th className="px-4 py-3 font-medium">Fungsi</th>

                <th className="px-4 py-3 font-medium">Status</th>

                <th className="px-5 py-3 text-right font-medium">Aksi</th>
              </tr>
            </thead>

            <tbody>
              {registerList.map((register) => (
                <tr
                  key={register.id}
                  className="border-b border-[var(--border)] transition last:border-b-0 hover:bg-[var(--accent-soft)]/10"
                >
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="grid size-10 place-items-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent)] ring-1 ring-amber-100">
                        {register.isHardwareHub ? (
                          <Cpu className="size-5" />
                        ) : (
                          <MonitorSmartphone className="size-5" />
                        )}
                      </div>

                      <div className="min-w-0">
                        <p className="truncate font-medium text-neutral-950">
                          {register.name}
                        </p>

                        <p className="mt-0.5 truncate text-xs text-[var(--muted)]">
                          {register.code}
                        </p>
                      </div>
                    </div>
                  </td>

                  <td className="px-4 py-4">
                    <p className="text-sm font-medium text-neutral-800">
                      {register.outletName}
                    </p>

                    <p className="mt-0.5 text-xs text-[var(--muted)]">
                      {register.outletCode}
                    </p>
                  </td>

                  <td className="px-4 py-4">
                    {register.isHardwareHub ? (
                      <span className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 ring-1 ring-blue-100">
                        <Cpu className="size-3.5" />
                        Hardware hub
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-2 rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-semibold text-neutral-600 ring-1 ring-neutral-200">
                        <MonitorSmartphone className="size-3.5" />
                        Register biasa
                      </span>
                    )}
                  </td>

                  <td className="px-4 py-4">
                    <span
                      className={
                        register.isActive
                          ? "rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-100"
                          : "rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-semibold text-neutral-600 ring-1 ring-neutral-200"
                      }
                    >
                      {register.isActive ? "Aktif" : "Nonaktif"}
                    </span>
                  </td>

                  <td className="px-5 py-4 text-right">
                    <Link
                      href={`/admin/administrasi/register/${register.id}`}
                      className="inline-flex h-9 items-center gap-2 rounded-xl border border-[var(--border)] px-3 text-xs font-semibold text-neutral-700 transition hover:border-[var(--accent)] hover:bg-[var(--accent-soft)]/40 hover:text-[var(--accent)]"
                    >
                      Kelola
                      <ArrowRight className="size-3.5" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="grid gap-3 p-4 lg:hidden">
          {registerList.map((register) => (
            <Link
              key={register.id}
              href={`/admin/administrasi/register/${register.id}`}
              className="rounded-2xl border border-[var(--border)] bg-white p-4 transition hover:border-[var(--accent)] hover:bg-[var(--accent-soft)]/10"
            >
              <div className="flex items-start gap-3">
                <div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent)] ring-1 ring-amber-100">
                  {register.isHardwareHub ? (
                    <Cpu className="size-5" />
                  ) : (
                    <MonitorSmartphone className="size-5" />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-neutral-950">
                      {register.name}
                    </p>

                    <span
                      className={
                        register.isActive
                          ? "rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 ring-1 ring-emerald-100"
                          : "rounded-full bg-neutral-100 px-2.5 py-1 text-[11px] font-semibold text-neutral-600 ring-1 ring-neutral-200"
                      }
                    >
                      {register.isActive ? "Aktif" : "Nonaktif"}
                    </span>
                  </div>

                  <p className="mt-1 text-xs text-[var(--muted)]">
                    {register.code}
                  </p>
                </div>

                <ArrowRight className="mt-1 size-4 shrink-0 text-neutral-400" />
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3 border-t border-[var(--border)] pt-4 text-sm">
                <div>
                  <p className="text-xs text-[var(--muted)]">Outlet</p>
                  <p className="mt-1 font-medium text-neutral-900">
                    {register.outletName}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-[var(--muted)]">Fungsi</p>
                  <p className="mt-1 font-medium text-neutral-900">
                    {register.isHardwareHub ? "Hardware hub" : "Register biasa"}
                  </p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
