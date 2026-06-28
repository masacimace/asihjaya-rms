import { ArrowRight, Cpu, MonitorSmartphone, Plus } from "lucide-react";
import Link from "next/link";

import { AdministrationTabs } from "@/components/administration/administration-tabs";
import { getAdministrationAccess } from "@/features/administration/access";
import { getOutletsWithRegisters } from "@/features/administration/queries";
import { requirePermission } from "@/lib/auth/session";

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

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-[var(--accent)]">
            Administrasi
          </p>

          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-neutral-950">
            Register
          </h1>

          <p className="mt-2 text-sm text-[var(--muted)]">
            Kelola terminal kasir dan perangkat hardware hub.
          </p>
        </div>

        <Link
          href="/admin/administrasi/register/tambah"
          className="flex h-11 items-center justify-center gap-2 rounded-xl bg-neutral-950 px-4 text-sm font-semibold !text-white transition hover:bg-neutral-800 [&_svg]:!text-white"
        >
          <Plus className="size-4" />
          Tambah Register
        </Link>
      </header>

      <AdministrationTabs active="registers" access={administrationAccess} />

      <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-white">
        <div className="border-b border-[var(--border)] px-5 py-4">
          <h2 className="font-semibold text-neutral-950">Daftar Register</h2>

          <p className="mt-1 text-xs text-[var(--muted)]">
            {registerList.length} register terdaftar
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[880px] text-left">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--surface-muted)] text-xs text-[var(--muted)]">
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
                  className="border-b border-[var(--border)] last:border-b-0"
                >
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="grid size-10 place-items-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]">
                        {register.isHardwareHub ? (
                          <Cpu className="size-5" />
                        ) : (
                          <MonitorSmartphone className="size-5" />
                        )}
                      </div>

                      <div>
                        <p className="font-medium text-neutral-950">
                          {register.name}
                        </p>

                        <p className="mt-0.5 text-xs text-[var(--muted)]">
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
                      <span className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">
                        <Cpu className="size-3.5" />
                        Hardware hub
                      </span>
                    ) : (
                      <span className="text-sm text-[var(--muted)]">
                        Register biasa
                      </span>
                    )}
                  </td>

                  <td className="px-4 py-4">
                    <span
                      className={
                        register.isActive
                          ? "rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700"
                          : "rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-medium text-neutral-600"
                      }
                    >
                      {register.isActive ? "Aktif" : "Nonaktif"}
                    </span>
                  </td>

                  <td className="px-5 py-4 text-right">
                    <Link
                      href={`/admin/administrasi/register/${register.id}`}
                      className="inline-flex h-9 items-center gap-2 rounded-xl border border-[var(--border)] px-3 text-xs font-medium text-neutral-700 transition hover:border-[var(--accent)] hover:bg-[var(--accent-soft)] hover:text-[var(--accent)]"
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
      </section>
    </div>
  );
}
