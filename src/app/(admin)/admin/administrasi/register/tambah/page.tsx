import {
  ArrowLeft,
  CheckCircle2,
  MonitorSmartphone,
  Store,
} from "lucide-react";
import Link from "next/link";

import { CreateRegisterForm } from "@/components/administration/outlet-register-forms";
import { getRegisterOutletOptions } from "@/features/administration/queries";
import { requirePermission } from "@/lib/auth/session";

export const metadata = {
  title: "Tambah Register",
};

export default async function CreateRegisterPage({
  searchParams,
}: {
  searchParams: Promise<{
    outletId?: string;
  }>;
}) {
  const auth = await requirePermission("outlets.manage");
  const query = await searchParams;
  const outletOptions = await getRegisterOutletOptions(auth.organization.id);
  const requestedOutletExists = outletOptions.some(
    (outlet) => outlet.id === query.outletId,
  );
  const defaultOutletId = requestedOutletExists
    ? query.outletId
    : outletOptions[0]?.id;
  const outletWithHubCount = outletOptions.filter(
    (outlet) => outlet.hardwareHub,
  ).length;

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
                  <span className="inline-flex w-fit rounded-full bg-[var(--accent-soft)] px-3 py-1 text-xs font-semibold text-[var(--accent)]">
                    Register baru
                  </span>
                  <span className="inline-flex w-fit rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                    Siap dikonfigurasi
                  </span>
                </div>

                <h1 className="mt-3 text-2xl font-semibold text-neutral-950 sm:text-3xl">
                  Tambah Register
                </h1>

                <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--muted)]">
                  Daftarkan terminal kasir pada outlet, tentukan kesiapan
                  operasional, dan pilih apakah perangkat ini menjadi hardware
                  hub untuk printer serta cash drawer.
                </p>

                <div className="mt-4 flex flex-wrap gap-2 text-xs text-neutral-700">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-1.5">
                    <Store className="size-3.5 text-[var(--accent)]" />
                    {outletOptions.length} outlet aktif tersedia
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-1.5">
                    <MonitorSmartphone className="size-3.5 text-[var(--accent)]" />
                    {outletWithHubCount} outlet sudah memiliki hardware hub
                  </span>
                </div>
              </div>
            </div>
          </div>

          <aside className="rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] p-4">
            <p className="text-sm font-semibold text-neutral-950">
              Alur konfigurasi
            </p>
            <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
              Register menjadi identitas terminal POS dan penghubung perangkat
              lokal pada outlet.
            </p>

            <div className="mt-4 space-y-2 text-xs text-neutral-700">
              {[
                "Pilih outlet penempatan terminal.",
                "Tentukan kode dan nama register.",
                "Atur status aktif serta peran hardware hub.",
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

      {outletOptions.length === 0 ? (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <div className="flex items-start gap-3">
            <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-white text-amber-700">
              <Store className="size-5" />
            </div>

            <div className="min-w-0 flex-1">
              <h2 className="font-semibold text-amber-950">
                Outlet aktif belum tersedia
              </h2>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-amber-800">
                Register harus terhubung ke outlet aktif. Buat outlet baru atau
                aktifkan outlet yang sudah ada sebelum mendaftarkan terminal.
              </p>

              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                <Link
                  href="/admin/administrasi/outlet/tambah"
                  className="inline-flex h-10 items-center justify-center rounded-xl bg-amber-950 px-4 text-sm font-semibold text-white transition hover:bg-amber-900"
                >
                  Buat Outlet Baru
                </Link>
                <Link
                  href="/admin/administrasi/outlet"
                  className="inline-flex h-10 items-center justify-center rounded-xl border border-amber-300 bg-white px-4 text-sm font-semibold text-amber-900 transition hover:bg-amber-100"
                >
                  Kelola Outlet
                </Link>
              </div>
            </div>
          </div>
        </section>
      ) : (
        <CreateRegisterForm
          outlets={outletOptions}
          defaultOutletId={defaultOutletId}
        />
      )}
    </div>
  );
}
