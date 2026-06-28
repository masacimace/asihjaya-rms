import {
  MapPin,
  Phone,
  Plus,
  Search,
  ShieldAlert,
  Users,
} from "lucide-react";
import Link from "next/link";

export const runtime = "nodejs";

// Mock Data
const MOCK_CUSTOMERS = [
  {
    id: "cus-1",
    name: "Ibu Siti Aminah",
    phone: "081234567890",
    address: "Jl. Melati No. 15, Ciledug",
    totalSpent: 45000000,
    lastTransactionDate: "2026-06-20T10:30:00Z",
    isBlacklisted: false,
    itemCount: 8,
  },
  {
    id: "cus-2",
    name: "Budi Santoso",
    phone: "085612341234",
    address: "Tangerang Selatan",
    totalSpent: 12500000,
    lastTransactionDate: "2026-06-15T14:20:00Z",
    isBlacklisted: false,
    itemCount: 2,
  },
  {
    id: "cus-3",
    name: "Nita Larasati",
    phone: "089988776655",
    address: "Bintaro Jaya Sektor 7",
    totalSpent: 75000000,
    lastTransactionDate: "2026-06-24T16:45:00Z",
    isBlacklisted: false,
    itemCount: 12,
  },
  {
    id: "cus-4",
    name: "H. Abdullah",
    phone: "081122334455",
    address: "Cipondoh",
    totalSpent: 120000000,
    lastTransactionDate: "2026-05-10T09:15:00Z",
    isBlacklisted: false,
    itemCount: 15,
  },
  {
    id: "cus-5",
    name: "Rina Kusuma (Fraud)",
    phone: "087766554433",
    address: "Tidak diketahui",
    totalSpent: 0,
    lastTransactionDate: null,
    isBlacklisted: true,
    itemCount: 0,
  },
  {
    id: "cus-6",
    name: "Ibu Desy",
    phone: "081987654321",
    address: "Pondok Aren",
    totalSpent: 3500000,
    lastTransactionDate: "2026-06-01T11:00:00Z",
    isBlacklisted: false,
    itemCount: 1,
  },
  {
    id: "cus-7",
    name: "Toni Wijaya",
    phone: "081211223344",
    address: "BSD City",
    totalSpent: 28500000,
    lastTransactionDate: "2026-04-20T13:30:00Z",
    isBlacklisted: false,
    itemCount: 4,
  },
  {
    id: "cus-8",
    name: "Siska Saraswati",
    phone: "085544332211",
    address: "Pamulang",
    totalSpent: 15800000,
    lastTransactionDate: "2026-06-22T15:10:00Z",
    isBlacklisted: false,
    itemCount: 3,
  },
  {
    id: "cus-9",
    name: "Agus Setiawan",
    phone: "089876543210",
    address: "Cikokol",
    totalSpent: 8900000,
    lastTransactionDate: "2026-05-28T10:05:00Z",
    isBlacklisted: false,
    itemCount: 2,
  },
  {
    id: "cus-10",
    name: "Ibu Ratna",
    phone: "081344556677",
    address: "Kebayoran Lama",
    totalSpent: 54000000,
    lastTransactionDate: "2026-06-18T12:50:00Z",
    isBlacklisted: false,
    itemCount: 9,
  },
];

function formatMoney(value: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(isoString: string | null) {
  if (!isoString) return "Belum pernah";
  const date = new Date(isoString);
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

export default function CustomerListPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-1 text-sm font-medium text-[var(--accent)]">
            Pelanggan
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-neutral-950 sm:text-3xl">
            Daftar Pelanggan
          </h1>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
            Kelola data pelanggan, pantau total belanja, dan lacak riwayat
            transaksi.
          </p>
        </div>
        <Link
          href="/admin/pelanggan/baru"
          className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-4 text-sm font-semibold !text-white transition hover:bg-[#8c5f1d] [&_svg]:!text-white"
        >
          <Plus className="size-4" />
          Pelanggan Baru
        </Link>
      </header>

      {/* Stats Mini */}
      <section className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <article className="rounded-2xl border border-[var(--border)] bg-white p-4">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-xl bg-blue-50 text-blue-600">
              <Users className="size-5" />
            </div>
            <div>
              <p className="text-2xl font-bold text-neutral-950">1,248</p>
              <p className="text-xs font-medium text-[var(--muted)]">
                Total Pelanggan
              </p>
            </div>
          </div>
        </article>
      </section>

      {/* Filter Form */}
      <section className="rounded-2xl border border-[var(--border)] bg-white p-4 sm:p-5">
        <form className="flex flex-col gap-3 sm:flex-row">
          <label className="flex h-11 flex-1 items-center gap-3 rounded-xl border border-[var(--border)] px-3">
            <Search className="size-4 shrink-0 text-neutral-400" />
            <input
              name="q"
              type="search"
              placeholder="Cari nama atau nomor WhatsApp..."
              className="min-w-0 flex-1 bg-transparent text-sm text-neutral-950 outline-none placeholder:text-neutral-400"
            />
          </label>
        </form>
      </section>

      {/* Table */}
      <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-neutral-600">
            <thead className="border-b border-[var(--border)] bg-neutral-50/50 text-xs text-neutral-500">
              <tr>
                <th className="whitespace-nowrap px-5 py-4 font-medium">
                  Nama Pelanggan
                </th>
                <th className="whitespace-nowrap px-5 py-4 font-medium">
                  Kontak
                </th>
                <th className="whitespace-nowrap px-5 py-4 font-medium text-right">
                  Total Belanja
                </th>
                <th className="whitespace-nowrap px-5 py-4 font-medium">
                  Terakhir Transaksi
                </th>
                <th className="px-5 py-4"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {MOCK_CUSTOMERS.map((customer) => (
                <tr
                  key={customer.id}
                  className="transition-colors hover:bg-neutral-50/50"
                >
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="grid size-10 shrink-0 place-items-center rounded-full bg-neutral-100 font-medium text-neutral-600">
                        {customer.name.charAt(0)}
                      </div>
                      <div>
                        <Link
                          href={`/admin/pelanggan/${customer.id}`}
                          className="font-medium text-neutral-950 hover:underline"
                        >
                          {customer.name}
                        </Link>
                        {customer.isBlacklisted && (
                          <span className="ml-2 inline-flex items-center gap-1 rounded-md bg-red-50 px-2 py-0.5 text-[10px] font-medium text-red-700">
                            <ShieldAlert className="size-3" />
                            Blacklist
                          </span>
                        )}
                        <p className="mt-0.5 flex items-center gap-1 text-xs text-neutral-500">
                          <MapPin className="size-3" />
                          {customer.address}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <p className="flex items-center gap-2 text-neutral-950">
                      <Phone className="size-3.5 text-neutral-400" />
                      {customer.phone}
                    </p>
                  </td>
                  <td className="px-5 py-4 text-right">
                    <p className="font-semibold text-neutral-950">
                      {formatMoney(customer.totalSpent)}
                    </p>
                    <p className="text-xs text-neutral-500">
                      {customer.itemCount} item
                    </p>
                  </td>
                  <td className="px-5 py-4 text-neutral-500">
                    {formatDate(customer.lastTransactionDate)}
                  </td>
                  <td className="px-5 py-4 text-right">
                    <Link
                      href={`/admin/pelanggan/${customer.id}`}
                      className="inline-flex h-8 items-center justify-center rounded-lg border border-[var(--border)] px-3 text-xs font-medium text-neutral-700 transition hover:bg-neutral-100"
                    >
                      Detail
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
