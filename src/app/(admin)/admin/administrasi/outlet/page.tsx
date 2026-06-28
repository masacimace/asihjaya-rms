import { ArrowRight, Building2, Cpu, MapPin, Phone, Plus } from "lucide-react";
import Link from "next/link";

import { AdministrationTabs } from "@/components/administration/administration-tabs";
import { getAdministrationAccess } from "@/features/administration/access";
import { getOutletsWithRegisters } from "@/features/administration/queries";
import { requirePermission } from "@/lib/auth/session";

export default async function OutletPage() {
  const auth = await requirePermission("outlets.manage");
  const administrationAccess = getAdministrationAccess(auth);

  const outletList = await getOutletsWithRegisters(auth.organization.id);

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-[var(--accent)]">
            Administrasi
          </p>

          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-neutral-950">
            Outlet
          </h1>

          <p className="mt-2 text-sm text-[var(--muted)]">
            Kelola lokasi operasional yang berada di bawah organisasi.
          </p>
        </div>

        <Link
          href="/admin/administrasi/outlet/tambah"
          className="flex h-11 items-center justify-center gap-2 rounded-xl bg-neutral-950 px-4 text-sm font-semibold !text-white transition hover:bg-neutral-800 [&_svg]:!text-white"
        >
          <Plus className="size-4" />
          Tambah Outlet
        </Link>
      </header>

      <AdministrationTabs active="outlets" access={administrationAccess} />

      <section className="grid gap-4 lg:grid-cols-2">
        {outletList.map((outlet) => {
          const hardwareHub = outlet.registers.find(
            (register) => register.isHardwareHub,
          );

          return (
            <article
              key={outlet.id}
              className="flex flex-col rounded-2xl border border-[var(--border)] bg-white p-5"
            >
              <div className="flex items-start gap-4">
                <div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent)]">
                  <Building2 className="size-5" />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-semibold text-neutral-950">
                      {outlet.name}
                    </h2>

                    <span
                      className={
                        outlet.isActive
                          ? "rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-700"
                          : "rounded-full bg-neutral-100 px-2.5 py-1 text-[11px] font-medium text-neutral-600"
                      }
                    >
                      {outlet.isActive ? "Aktif" : "Nonaktif"}
                    </span>
                  </div>

                  <p className="mt-1 text-xs font-medium text-[var(--muted)]">
                    Kode: {outlet.code}
                  </p>
                </div>
              </div>

              <div className="mt-5 space-y-3 border-t border-[var(--border)] pt-4 text-sm text-neutral-700">
                <div className="flex items-start gap-3">
                  <MapPin className="mt-0.5 size-4 shrink-0 text-neutral-400" />

                  <span>{outlet.address ?? "Alamat belum diisi"}</span>
                </div>

                <div className="flex items-center gap-3">
                  <Phone className="size-4 shrink-0 text-neutral-400" />

                  <span>{outlet.phone ?? "Nomor telepon belum diisi"}</span>
                </div>

                <div className="flex items-center gap-3">
                  <Cpu className="size-4 shrink-0 text-neutral-400" />

                  <span>
                    {hardwareHub
                      ? `Hub: ${hardwareHub.name}`
                      : "Hardware hub belum ditentukan"}
                  </span>
                </div>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-[var(--surface-muted)] p-4">
                  <p className="text-xs text-[var(--muted)]">Register</p>

                  <p className="mt-1 text-xl font-semibold text-neutral-950">
                    {outlet.registers.length}
                  </p>
                </div>

                <div className="rounded-xl bg-[var(--surface-muted)] p-4">
                  <p className="text-xs text-[var(--muted)]">Register aktif</p>

                  <p className="mt-1 text-xl font-semibold text-neutral-950">
                    {
                      outlet.registers.filter((register) => register.isActive)
                        .length
                    }
                  </p>
                </div>
              </div>

              <Link
                href={`/admin/administrasi/outlet/${outlet.id}`}
                className="group mt-5 flex items-center justify-between border-t border-[var(--border)] pt-4 text-sm font-medium text-[var(--accent)]"
              >
                <span>Kelola outlet</span>

                <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </article>
          );
        })}
      </section>
    </div>
  );
}
