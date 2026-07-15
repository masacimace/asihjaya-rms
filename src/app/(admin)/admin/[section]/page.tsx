import { notFound } from "next/navigation";

export const metadata = {
  title: "Admin",
};

const sectionNames: Record<string, string> = {
  penjualan: "Penjualan",
  inventaris: "Inventaris",
  pelanggan: "Pelanggan",
  laporan: "Laporan",
  administrasi: "Administrasi",
  pengaturan: "Pengaturan",
};

export default async function AdminSectionPage({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;
  if (section === "operasional") {
    notFound();
  }

  const title = sectionNames[section] ?? "Modul";

  return (
    <section className="rounded-2xl border border-[var(--border)] bg-white p-6">
      <p className="text-sm text-[var(--muted)]">Dashboard Admin</p>
      <h1 className="mt-1 text-2xl font-semibold">{title}</h1>
      <p className="mt-3 max-w-2xl text-sm text-[var(--muted)]">
        Halaman ini sudah disiapkan dalam struktur navigasi awal dan akan dikembangkan
        sesuai milestone project.
      </p>
    </section>
  );
}
