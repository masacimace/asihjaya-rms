import {
  ArrowLeft,
  Boxes,
  CheckCircle2,
  ChevronRight,
  CircleOff,
  Clock3,
  Cpu,
  MapPinned,
  MonitorSmartphone,
  Phone,
  Plus,
  Store,
  UsersRound,
} from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { EditOutletForm } from "@/components/administration/outlet-register-forms";
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

  const hasGoogleMaps = Boolean(outlet.googleMapsEmbedUrl);
  const hardwareHubCount = outlet.hardwareHub ? 1 : 0;

  const operationalStats = [
    {
      label: "Register aktif",
      value: outlet.activeRegisterCount,
      helper: `${outlet.activeRegisterCount} dari ${outlet.registerCount} register siap digunakan`,
      icon: MonitorSmartphone,
      iconClassName: "bg-[var(--accent-soft)] text-[var(--accent)]",
    },
    {
      label: "Staff terhubung",
      value: outlet.assignedStaffCount,
      helper:
        outlet.assignedStaffCount > 0
          ? "Memiliki akses ke outlet ini"
          : "Belum ada staff yang terhubung",
      icon: UsersRound,
      iconClassName: "bg-blue-50 text-blue-700",
    },
    {
      label: "Inventaris fisik",
      value: outlet.inventoryItemCount,
      helper:
        outlet.inventoryItemCount > 0
          ? "Item aktif berada di lokasi outlet"
          : "Belum ada item fisik aktif",
      icon: Boxes,
      iconClassName: "bg-amber-50 text-amber-700",
    },
    {
      label: "Shift aktif",
      value: outlet.activeShiftCount,
      helper:
        outlet.activeShiftCount > 0
          ? "Operasional sedang berlangsung"
          : "Tidak ada shift yang sedang berjalan",
      icon: Clock3,
      iconClassName: "bg-violet-50 text-violet-700",
    },
  ];

  return (
    <div className="mx-auto flex w-full max-w-7xl min-w-0 flex-col gap-5 overflow-x-clip pb-6">
      <section className="rounded-3xl border border-[var(--border)] bg-white p-4 sm:p-5">
        <Link
          href="/admin/administrasi/outlet"
          className="inline-flex h-10 w-fit items-center gap-2 bg-white px-3 text-sm font-medium text-neutral-700 transition hover:text-neutral-950"
        >
          <ArrowLeft className="size-4" />
          Kembali ke daftar outlet
        </Link>

        <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_330px] xl:items-start">
          <div className="min-w-0">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
              <div className="grid size-16 shrink-0 place-items-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent)]">
                <Store className="size-7" />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="break-words text-2xl font-semibold text-neutral-950 sm:text-3xl">
                    {outlet.name}
                  </h1>

                  <span
                    className={
                      outlet.isActive
                        ? "inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700"
                        : "inline-flex rounded-full border border-neutral-200 bg-neutral-100 px-3 py-1 text-xs font-semibold text-neutral-600"
                    }
                  >
                    {outlet.isActive ? "Aktif" : "Nonaktif"}
                  </span>
                </div>

                <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--muted)]">
                  Kelola identitas, lokasi, status operasional, dan register yang
                  terhubung ke outlet ini.
                </p>

                <div className="mt-4 flex flex-wrap gap-2 text-xs text-neutral-700">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-1.5 font-mono">
                    <Store className="size-3.5 text-[var(--accent)]" />
                    {outlet.code}
                  </span>

                  <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-1.5">
                    <Phone className="size-3.5 text-[var(--accent)]" />
                    {outlet.phone ?? "Nomor telepon belum diisi"}
                  </span>

                  <span
                    className={
                      hasGoogleMaps
                        ? "inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-emerald-700"
                        : "inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-1.5 text-neutral-600"
                    }
                  >
                    <MapPinned className="size-3.5" />
                    {hasGoogleMaps ? "Google Maps tersedia" : "Google Maps belum diatur"}
                  </span>
                </div>

                <div className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] px-3.5 py-3">
                  <p className="text-xs font-medium text-neutral-700">
                    Alamat outlet
                  </p>
                  <p className="mt-1 break-words text-sm leading-6 text-[var(--muted)]">
                    {outlet.address ?? "Alamat lengkap belum diisi."}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <aside className="rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] p-4">
            <div className="flex items-start gap-3">
              <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-white text-[var(--accent)]">
                <Store className="size-5" />
              </div>

              <div className="min-w-0">
                <p className="text-sm font-semibold text-neutral-950">
                  Pengelolaan outlet
                </p>
                <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
                  Pastikan data lokasi dan perangkat operasional selalu sesuai
                  dengan kondisi outlet saat ini.
                </p>
              </div>
            </div>

            <div className="mt-4 space-y-2 text-xs text-neutral-700">
              {[
                "Perbarui identitas, kontak, alamat, dan titik Google Maps.",
                "Pantau staff, inventaris, shift, serta register aktif.",
                "Tentukan satu register aktif sebagai hardware hub outlet.",
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
            <p className="font-semibold">Outlet berhasil dibuat</p>
            <p className="mt-0.5 text-xs leading-5 text-emerald-700/90">
              Lengkapi register, tentukan hardware hub, dan hubungkan staff agar
              outlet siap digunakan untuk operasional.
            </p>
          </div>
        </div>
      ) : null}

      <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {operationalStats.map((stat) => {
          const Icon = stat.icon;

          return (
            <article
              key={stat.label}
              className="min-w-0 rounded-2xl border border-[var(--border)] bg-white p-3.5 sm:p-4"
            >
              <div
                className={`grid size-10 place-items-center rounded-xl ${stat.iconClassName}`}
              >
                <Icon className="size-5" />
              </div>

              <p className="mt-4 text-xl font-semibold text-neutral-950 sm:text-2xl">
                {stat.value}
              </p>
              <p className="mt-1 text-xs font-semibold text-neutral-800">
                {stat.label}
              </p>
              <p className="mt-1 hidden text-xs leading-5 text-[var(--muted)] sm:block">
                {stat.helper}
              </p>
            </article>
          );
        })}
      </section>

      <EditOutletForm
        outlet={outlet}
        operationalSummary={{
          activeRegisterCount: outlet.activeRegisterCount,
          assignedStaffCount: outlet.assignedStaffCount,
          inventoryItemCount: outlet.inventoryItemCount,
          activeShiftCount: outlet.activeShiftCount,
        }}
      />

      <section className="rounded-2xl border border-[var(--border)] bg-white p-4 sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex items-start gap-3">
              <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]">
                <MonitorSmartphone className="size-5" />
              </div>

              <div className="min-w-0">
                <h2 className="font-semibold text-neutral-950">
                  Register Outlet
                </h2>
                <p className="mt-1 max-w-2xl text-xs leading-5 text-[var(--muted)]">
                  Kelola terminal kasir dan perangkat hardware hub yang digunakan
                  pada lokasi ini.
                </p>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2 text-xs">
              <span className="rounded-full border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-1.5 text-neutral-700">
                {outlet.registerCount} register terdaftar
              </span>
              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-emerald-700">
                {outlet.activeRegisterCount} aktif
              </span>
              <span
                className={
                  hardwareHubCount > 0
                    ? "rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-blue-700"
                    : "rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-amber-700"
                }
              >
                {hardwareHubCount > 0
                  ? "Hardware hub tersedia"
                  : "Hardware hub belum ditentukan"}
              </span>
            </div>
          </div>

          {outlet.isActive ? (
            <Link
              href={`/admin/administrasi/register/tambah?outletId=${outlet.id}`}
              className="inline-flex h-11 w-full shrink-0 items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-white px-4 text-sm font-semibold text-neutral-800 transition hover:border-[var(--accent)] hover:bg-[var(--accent-soft)] hover:text-[var(--accent)] sm:w-fit"
            >
              <Plus className="size-4" />
              Tambah Register
            </Link>
          ) : null}
        </div>

        {!outlet.isActive ? (
          <div className="mt-5 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-800">
            <CircleOff className="mt-0.5 size-4 shrink-0" />
            <div className="min-w-0">
              <p className="text-xs font-semibold">Outlet sedang nonaktif</p>
              <p className="mt-1 text-xs leading-5">
                Aktifkan kembali outlet sebelum menambahkan register baru.
                Register yang sudah ada tetap dapat dilihat dan dikelola.
              </p>
            </div>
          </div>
        ) : null}

        <div className="mt-5 space-y-3">
          {outlet.registers.length === 0 ? (
            <div className="flex min-h-56 flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface-muted)] px-5 py-8 text-center">
              <div className="grid size-12 place-items-center rounded-2xl border border-[var(--border)] bg-white text-neutral-400">
                <MonitorSmartphone className="size-5" />
              </div>
              <p className="mt-3 text-sm font-semibold text-neutral-900">
                Belum ada register
              </p>
              <p className="mt-1 max-w-md text-xs leading-5 text-[var(--muted)]">
                Register mewakili perangkat atau terminal kasir. Tambahkan
                register pertama dan tentukan hardware hub untuk menghubungkan
                printer serta perangkat outlet.
              </p>

              {outlet.isActive ? (
                <Link
                  href={`/admin/administrasi/register/tambah?outletId=${outlet.id}`}
                  className="mt-4 inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-4 text-sm font-semibold text-white transition hover:brightness-95"
                >
                  <Plus className="size-4" />
                  Tambah Register Pertama
                </Link>
              ) : null}
            </div>
          ) : (
            outlet.registers.map((register) => (
              <Link
                key={register.id}
                href={`/admin/administrasi/register/${register.id}`}
                className="group flex min-w-0 flex-col gap-3 rounded-2xl border border-[var(--border)] bg-white p-4 transition hover:border-[var(--accent)] hover:bg-[var(--accent-soft)] sm:flex-row sm:items-center"
              >
                <div
                  className={`grid size-11 shrink-0 place-items-center rounded-xl ${
                    register.isHardwareHub
                      ? "bg-blue-50 text-blue-700"
                      : "bg-[var(--accent-soft)] text-[var(--accent)]"
                  }`}
                >
                  {register.isHardwareHub ? (
                    <Cpu className="size-5" />
                  ) : (
                    <MonitorSmartphone className="size-5" />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <p className="break-words font-semibold text-neutral-950">
                    {register.name}
                  </p>
                  <p className="mt-1 font-mono text-xs text-[var(--muted)]">
                    {register.code}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                  {register.isHardwareHub ? (
                    <span className="rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
                      Hardware hub
                    </span>
                  ) : null}

                  <span
                    className={
                      register.isActive
                        ? "rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700"
                        : "rounded-full border border-neutral-200 bg-neutral-100 px-2.5 py-1 text-xs font-semibold text-neutral-600"
                    }
                  >
                    {register.isActive ? "Aktif" : "Nonaktif"}
                  </span>

                  <ChevronRight className="size-4 text-neutral-400 transition group-hover:translate-x-0.5 group-hover:text-[var(--accent)]" />
                </div>
              </Link>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
