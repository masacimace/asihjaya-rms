import { ArrowLeft, CircleAlert, UserPlus } from "lucide-react";
import Link from "next/link";

export const runtime = "nodejs";

export default function CustomerCreatePlaceholderPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <nav>
        <Link
          href="/admin/pelanggan"
          className="inline-flex items-center gap-2 text-sm font-medium text-neutral-500 transition hover:text-neutral-950"
        >
          <ArrowLeft className="size-4" />
          Kembali ke daftar pelanggan
        </Link>
      </nav>

      <section className="rounded-3xl border border-[var(--border)] bg-white p-6 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-blue-50 text-blue-600">
            <UserPlus className="size-5" />
          </div>
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-neutral-950">
              Tambah Pelanggan
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">
              Route ini sudah disiapkan supaya alur tombol dari halaman pelanggan tidak mentok.
              Form create/edit sebenarnya akan dihubungkan ke data riil pada tahap implementasi berikutnya.
            </p>
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <div className="flex items-start gap-3">
            <CircleAlert className="mt-0.5 size-4 shrink-0" />
            <p>
              Saat ini halaman masih berupa placeholder. Begitu kita masuk ke tahap CRUD,
              bagian ini akan diubah menjadi form create customer yang terhubung ke database.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
