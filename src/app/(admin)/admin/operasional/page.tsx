import { Banknote, ClipboardCheck, Clock3, Cpu } from "lucide-react";
import { requirePermission } from "@/lib/auth/session";
import Link from "next/link";

const plannedModules = [
  {
    title: "Shift Kasir",
    description:
      "Pantau shift aktif, register yang digunakan, saldo awal, dan proses penutupan kasir.",
    icon: Clock3,
    href: "/admin/operasional/shift",
    isReady: true,
  },
  {
    title: "Pergerakan Kas",
    description:
      "Kelola kas masuk, kas keluar, setoran, dan biaya operasional outlet.",
    icon: Banknote,
    href: "/admin/operasional/kas",
    isReady: true,
  },

  {
    title: "Hardware Hub",
    description:
      "Pantau Mini PC outlet, status agent, antrean cetak, serta test printer label, dokumen, dan cash drawer.",
    icon: Cpu,
    href: "/admin/operasional/hardware",
    isReady: true,
  },
  {
    title: "Riwayat Aproval Operasional",
    description:
      "Tinjau permintaan diskon, koreksi stok, pembatalan, dan tindakan khusus.",
    icon: ClipboardCheck,
    href: "/admin/operasional/approval",
    isReady: true,
  },
] as const;

export default async function OperationalPage() {
  await requirePermission("admin.access");

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-medium text-[var(--accent)]">Operasional </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-neutral-950 sm:text-3xl">
          Aktivitas Operasional
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">
          Pusat pemantauan aktivitas harian outlet, shift kasir, pergerakan kas,
          stok, dan approval operasional.
        </p>
      </header>

      <section className="grid gap-4 md:grid-cols-2">
        {plannedModules.map(
          ({ title, description, icon: Icon, href, isReady }) => {
            const content = (
              <>
                <div className="grid size-11 place-items-center rounded-xl bg-[var(--surface-muted)] text-neutral-600 transition-colors group-hover:bg-[var(--accent-soft)] group-hover:text-[var(--accent)]">
                  <Icon className="size-5" />
                </div>
                <h2 className="mt-4 font-semibold text-neutral-950 group-hover:text-[var(--accent)] transition-colors">
                  {title}
                </h2>
                <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                  {description}
                </p>
                {!isReady && (
                  <span className="mt-4 inline-flex rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-medium text-neutral-600">
                    Segera hadir
                  </span>
                )}
              </>
            );

            if (isReady && href) {
              return (
                <Link
                  key={title}
                  href={href}
                  className="group rounded-2xl border border-[var(--border)] bg-white p-5 transition hover:shadow-md"
                >
                  {content}
                </Link>
              );
            }

            return (
              <article
                key={title}
                className="rounded-2xl border border-[var(--border)] bg-white p-5"
              >
                {content}
              </article>
            );
          },
        )}
      </section>
    </div>
  );
}
