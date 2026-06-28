import {
  ArrowLeft,
  Calendar,
  Edit2,
  MapPin,
  MessageCircle,
  Phone,
  RefreshCw,
  ShoppingBag,
} from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

export const runtime = "nodejs";

const MOCK_TRANSACTIONS = [
  {
    id: "trx-1",
    receiptNo: "RCP-260620-001",
    date: "2026-06-20T10:30:00Z",
    type: "purchase",
    items: "Cincin Anak Solitare (2.5g), Kalung Emas Polos (5g)",
    total: 8500000,
    outlet: "Cabang Pusat Ciledug",
    staffName: "Mbak Rini",
  },
  {
    id: "trx-2",
    receiptNo: "RCP-260115-045",
    date: "2026-01-15T14:20:00Z",
    type: "buyback",
    items: "Gelang Keroncong Anak (3g)",
    total: -2800000,
    outlet: "Cabang Pusat Ciledug",
    staffName: "Mas Danang",
  },
  {
    id: "trx-3",
    receiptNo: "RCP-251110-012",
    date: "2025-11-10T09:15:00Z",
    type: "purchase",
    items: "Anting Tindik Bayi (1g)",
    total: 1200000,
    outlet: "Cabang Pusat Ciledug",
    staffName: "Mbak Rini",
  },
];

function formatMoney(value: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Math.abs(value));
}

function formatDate(isoString: string) {
  const date = new Date(isoString);
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ customerId: string }>;
}) {
  const { customerId } = await params;

  // Simulate finding customer
  if (!customerId.startsWith("cus-")) {
    notFound();
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* Top Nav */}
      <nav>
        <Link
          href="/admin/pelanggan"
          className="inline-flex items-center gap-2 text-sm font-medium text-neutral-500 hover:text-neutral-950"
        >
          <ArrowLeft className="size-4" />
          Kembali ke Daftar Pelanggan
        </Link>
      </nav>

      {/* Header Profile */}
      <section className="flex flex-col items-start gap-6 rounded-3xl border border-[var(--border)] bg-white p-6 sm:flex-row sm:items-center">
        <div className="grid size-20 shrink-0 place-items-center rounded-full bg-neutral-100 text-3xl font-medium text-neutral-400">
          I
        </div>

        <div className="flex-1">
          <h1 className="text-2xl font-bold text-neutral-950">
            Ibu Siti Aminah
          </h1>
          <div className="mt-2 flex flex-wrap gap-4 text-sm text-neutral-600">
            <span className="flex items-center gap-1.5">
              <Phone className="size-4 text-neutral-400" />
              0812-3456-7890
            </span>
            <span className="flex items-center gap-1.5">
              <MapPin className="size-4 text-neutral-400" />
              Jl. Melati No. 15, Ciledug
            </span>
            <span className="flex items-center gap-1.5">
              <Calendar className="size-4 text-neutral-400" />
              Bergabung sejak Nov 2025
            </span>
          </div>
        </div>

        <div className="flex shrink-0 flex-col gap-2 sm:items-end">
          <Link
            href={`https://wa.me/6281234567890`}
            target="_blank"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-green-500 px-4 text-sm font-medium !text-white transition hover:bg-green-600 [&_svg]:!text-white"
          >
            <MessageCircle className="size-4" />
            Chat WhatsApp
          </Link>
          <button className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-white px-4 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50">
            <Edit2 className="size-4" />
            Edit Profil
          </button>
        </div>
      </section>

      {/* Analytics/Summary Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <article className="rounded-2xl border border-[var(--border)] bg-white p-5">
          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm font-medium text-[var(--muted)]">
              Total Pembelian
            </p>
            <div className="rounded-lg bg-emerald-50 p-2 text-emerald-600">
              <ShoppingBag className="size-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-neutral-950">Rp 45.000.000</p>
          <p className="mt-1 text-xs text-neutral-500">Dari 8 barang dibeli</p>
        </article>

        <article className="rounded-2xl border border-[var(--border)] bg-white p-5">
          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm font-medium text-[var(--muted)]">
              Total Buyback (Dijual Balik)
            </p>
            <div className="rounded-lg bg-amber-50 p-2 text-amber-600">
              <RefreshCw className="size-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-neutral-950">Rp 2.800.000</p>
          <p className="mt-1 text-xs text-neutral-500">Dari 1 barang</p>
        </article>

        <article className="rounded-2xl border border-red-200 bg-red-50 p-5">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-medium text-red-800">Catatan Internal</p>
          </div>
          <p className="text-sm font-medium text-red-900">
            Pelanggan ini menawar sangat agresif. Periksa barang buyback secara
            teliti, pernah ada kasus permata lepas.
          </p>
        </article>
      </div>

      {/* Transaction History */}
      <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-white">
        <div className="border-b border-[var(--border)] px-5 py-4">
          <h2 className="font-semibold text-neutral-950">Riwayat Transaksi</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-neutral-600">
            <thead className="border-b border-[var(--border)] bg-neutral-50/50 text-xs text-neutral-500">
              <tr>
                <th className="whitespace-nowrap px-5 py-4 font-medium">
                  Waktu & No. Nota
                </th>
                <th className="whitespace-nowrap px-5 py-4 font-medium">
                  Jenis
                </th>
                <th className="px-5 py-4 font-medium">Barang</th>
                <th className="whitespace-nowrap px-5 py-4 font-medium">
                  Dilayani Oleh
                </th>
                <th className="whitespace-nowrap px-5 py-4 font-medium text-right">
                  Total (Rp)
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {MOCK_TRANSACTIONS.map((trx) => (
                <tr
                  key={trx.id}
                  className="transition-colors hover:bg-neutral-50/50"
                >
                  <td className="whitespace-nowrap px-5 py-4">
                    <p className="font-medium text-neutral-950">
                      {formatDate(trx.date)}
                    </p>
                    <p className="text-xs text-neutral-500">{trx.receiptNo}</p>
                  </td>
                  <td className="px-5 py-4">
                    {trx.type === "purchase" ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                        Beli Baru
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
                        Buyback
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-4">
                    <p className="line-clamp-2">{trx.items}</p>
                    <p className="mt-0.5 text-xs text-neutral-500">
                      {trx.outlet}
                    </p>
                  </td>
                  <td className="whitespace-nowrap px-5 py-4">
                    <span className="inline-flex items-center gap-1.5 rounded-md bg-neutral-100 px-2 py-1 text-xs font-medium text-neutral-600">
                      {trx.staffName}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-5 py-4 text-right">
                    <p
                      className={`font-semibold ${
                        trx.type === "buyback"
                          ? "text-amber-700"
                          : "text-neutral-950"
                      }`}
                    >
                      {trx.type === "buyback" ? "-" : ""}
                      {formatMoney(trx.total)}
                    </p>
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
