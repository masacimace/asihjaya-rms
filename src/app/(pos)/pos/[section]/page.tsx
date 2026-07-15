export const metadata = {
  title: "POS",
};

const sectionNames: Record<string, string> = {
  transaksi: "Transaksi",
  pelanggan: "Pelanggan",
  ditahan: "Transaksi Ditahan",
  shift: "Shift Saat Ini",
};

export default async function PosSectionPage({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;

  const title = sectionNames[section] ?? "Modul POS";

  return (
    <main className="p-4 sm:p-6">
      <section className="mx-auto max-w-5xl rounded-2xl border border-[var(--border)] bg-white p-6">
        <p className="text-sm text-[var(--muted)]">Aplikasi POS</p>

        <h1 className="mt-1 text-2xl font-semibold text-neutral-950">
          {title}
        </h1>

        <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--muted)]">
          Halaman ini sudah tersedia dalam navigasi dasar dan akan dikembangkan
          pada milestone berikutnya.
        </p>
      </section>
    </main>
  );
}
