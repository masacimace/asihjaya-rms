import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Cpu,
  MapPin,
  MapPinned,
  Phone,
  Plus,
  Store,
} from "lucide-react";
import Link from "next/link";

import { AdministrationTabs } from "@/components/administration/administration-tabs";
import { getAdministrationAccess } from "@/features/administration/access";
import { getOutletsWithRegisters } from "@/features/administration/queries";
import { requirePermission } from "@/lib/auth/session";

export const metadata = {
  title: "Outlet",
};

function getSafeGoogleMapsEmbedUrl(value: string | null) {
  if (!value) {
    return null;
  }

  try {
    const url = new URL(value);

    if (
      url.protocol === "https:" &&
      url.hostname === "www.google.com" &&
      url.pathname === "/maps/embed"
    ) {
      return value;
    }
  } catch {
    return null;
  }

  return null;
}

export default async function OutletPage() {
  const auth = await requirePermission("outlets.manage");
  const administrationAccess = getAdministrationAccess(auth);

  const outletList = await getOutletsWithRegisters(auth.organization.id);
  const activeOutletCount = outletList.filter(
    (outlet) => outlet.isActive,
  ).length;
  const totalRegisters = outletList.reduce(
    (total, outlet) => total + outlet.registers.length,
    0,
  );
  const activeRegisters = outletList.reduce(
    (total, outlet) =>
      total + outlet.registers.filter((register) => register.isActive).length,
    0,
  );

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-3xl border border-[var(--border)] bg-white">
        <div className="grid gap-6 p-6 lg:grid-cols-[1fr_22rem] lg:items-start lg:p-7">
          <div>
            <Link
              href="/admin"
              className="inline-flex items-center gap-2 bg-white px-3 py-2 text-sm font-semibold text-neutral-900"
            >
              <ArrowLeft className="size-4" />
              Kembali ke Dashboard
            </Link>
            <h1 className="mt-4 text-2xl font-semibold text-neutral-950 sm:text-3xl">
              Daftar Outlet
            </h1>

            <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--muted)]">
              Kelola lokasi operasional, kontak toko, register, dan hardware hub
              yang dipakai untuk transaksi POS di setiap outlet.
            </p>
          </div>

          <div className="rounded-2xl border border-[var(--border)] bg-neutral-50 p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-semibold text-neutral-700 ring-1 ring-[var(--border)]">
                  <Store className="size-3.5 text-[var(--accent)]" />
                  Status outlet
                </p>
                <p className="mt-2 text-2xl font-semibold text-neutral-950">
                  {activeOutletCount} lokasi
                </p>
                <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
                  {activeRegisters} dari {totalRegisters} register aktif dan
                  siap dipakai di seluruh outlet.
                </p>
              </div>
            </div>

            <Link
              href="/admin/administrasi/outlet/tambah"
              className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-neutral-950 px-4 text-sm font-semibold !text-white transition hover:bg-neutral-800 [&_svg]:!text-white"
            >
              <Plus className="size-4" />
              Tambah Outlet
            </Link>
          </div>
        </div>
      </section>

      <AdministrationTabs active="outlets" access={administrationAccess} />

      <section className="grid gap-4 lg:grid-cols-2">
        {outletList.map((outlet) => {
          const hardwareHub = outlet.registers.find(
            (register) => register.isHardwareHub,
          );

          const safeMapsEmbedUrl = getSafeGoogleMapsEmbedUrl(
            outlet.googleMapsEmbedUrl,
          );

          return (
            <article
              key={outlet.id}
              className="flex flex-col rounded-2xl border border-[var(--border)] bg-white p-5 transition hover:border-[var(--accent)]/50 hover:bg-[var(--accent-soft)]/10"
            >
              <div className="flex items-start gap-4">
                <div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent)] ring-1 ring-amber-100">
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
                          ? "rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 ring-1 ring-emerald-100"
                          : "rounded-full bg-neutral-100 px-2.5 py-1 text-[11px] font-semibold text-neutral-600 ring-1 ring-neutral-200"
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

              <div className="mt-5 overflow-hidden rounded-2xl border border-[var(--border)] bg-neutral-50">
                {safeMapsEmbedUrl ? (
                  <iframe
                    src={safeMapsEmbedUrl}
                    title={`Lokasi outlet ${outlet.name}`}
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                    className="h-52 w-full border-0"
                    allowFullScreen
                  />
                ) : (
                  <div className="flex min-h-52 flex-col items-center justify-center px-5 py-8 text-center">
                    <div className="grid size-11 place-items-center rounded-2xl bg-white text-neutral-400 ring-1 ring-[var(--border)]">
                      <MapPinned className="size-5" />
                    </div>

                    <p className="mt-3 text-sm font-semibold text-neutral-900">
                      Maps belum diatur
                    </p>

                    <p className="mt-1 max-w-xs text-xs leading-5 text-[var(--muted)]">
                      Tambahkan Google Maps Embed URL di detail outlet agar
                      lokasi toko tampil di card ini.
                    </p>
                  </div>
                )}
              </div>

              <div className="mt-5 grid grid-cols-2 gap-3">
                <div className="rounded-2xl border border-[var(--border)] bg-neutral-50 p-4">
                  <p className="text-xs text-[var(--muted)]">Register</p>

                  <p className="mt-1 text-xl font-semibold text-neutral-950">
                    {outlet.registers.length}
                  </p>
                </div>

                <div className="rounded-2xl border border-[var(--border)] bg-neutral-50 p-4">
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
                className="group mt-5 flex items-center justify-between border-t border-[var(--border)] pt-4 text-sm font-semibold text-[var(--accent)]"
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
