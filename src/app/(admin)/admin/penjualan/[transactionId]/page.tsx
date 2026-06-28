import {
  ArrowLeft,
  Download,
  Printer,
  QrCode,
} from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

export const runtime = "nodejs";

const MOCK_RECEIPT = {
  id: "trx-001",
  receiptNo: "ORD/06/2026/440",
  date: "2026-06-25T14:30:00Z",
  type: "purchase",
  customer: {
    name: "Kiki",
    phone: "088881100209",
  },
  staff: "Hanita",
  store: {
    name: "Toko Emas Asih Jaya Pasar Bantar Gebang",
    address: "Pasar Bantar Gebang, LT dasar Blok H8, H9, H10",
    phone1: "021 8909 0178",
    phone2: "0821 1806 8889",
    ig: "@asihjaya.bantargebang",
  },
  items: [
    {
      id: "item-1",
      sku: "679109",
      name: "GELANG CARTIER OVAL",
      specs: "K.SAM 1X 6K/300",
      purityPercent: 30,
      weightGram: 3.76,
      discount: 0,
      fee: 0,
      cutPerGram: 30000,
      price: 3685000,
      imageUrl: "https://placehold.co/100x100/f3f4f6/1f2937?text=Gelang",
    },
    {
      id: "item-2",
      sku: "882104",
      name: "CINCIN KAWIN POLOS",
      specs: "K.SAM 1X 18K/750",
      purityPercent: 75,
      weightGram: 2.15,
      discount: 0,
      fee: 0,
      cutPerGram: 50000,
      price: 2150000,
      imageUrl: "https://placehold.co/100x100/f3f4f6/1f2937?text=Cincin",
    },
    {
      id: "item-3",
      sku: "991022",
      name: "KALUNG NURI ANAK",
      specs: "K.SAM 1X 8K/375",
      purityPercent: 37.5,
      weightGram: 1.5,
      discount: 0,
      fee: 0,
      cutPerGram: 25000,
      price: 1350000,
      imageUrl: "https://placehold.co/100x100/f3f4f6/1f2937?text=Kalung",
    },
  ],
  total: 7185000,
  depositAmount: 0,
};

function formatMoney(value: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(isoString: string) {
  const date = new Date(isoString);
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

export default async function CertificatePage({
  params,
}: {
  params: Promise<{ transactionId: string }>;
}) {
  const { transactionId } = await params;

  if (!transactionId.startsWith("trx-")) {
    notFound();
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Action Bar */}
      <nav className="flex items-center justify-between rounded-2xl bg-white p-4 shadow-sm ring-1 ring-[var(--border)]">
        <Link
          href="/admin/penjualan"
          className="inline-flex items-center gap-2 text-sm font-medium text-neutral-500 hover:text-[var(--accent)]"
        >
          <ArrowLeft className="size-4" />
          Kembali ke Riwayat
        </Link>
        <div className="flex items-center gap-3">
          <button className="inline-flex h-9 items-center gap-2 rounded-lg border border-[var(--border)] bg-white px-3 text-sm font-medium text-neutral-700 hover:bg-neutral-50">
            <Download className="size-4" />
            PDF WhatsApp
          </button>
          <button className="inline-flex h-9 items-center gap-2 rounded-lg bg-[var(--accent)] px-3 text-sm font-medium text-white hover:bg-[#8c5f1d]">
            <Printer className="size-4" />
            Cetak (A5)
          </button>
        </div>
      </nav>

      {/* A5 Certificate Container */}
      <div className="mx-auto w-full max-w-3xl rounded-md bg-white p-6 shadow-xl ring-1 ring-neutral-200 sm:p-10">
        <div className="relative flex min-h-[500px] flex-col justify-between rounded border-2 border-[var(--accent)] p-6">
          {/* Watermark Logo */}
          <div className="pointer-events-none absolute inset-0 grid place-items-center opacity-5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo/nota-logo.png"
              alt="Watermark"
              className="size-80 object-contain grayscale"
            />
          </div>

          {/* Header */}
          <header className="relative flex items-start justify-between border-b border-[var(--accent)]/20 pb-4">
            <div className="flex items-start gap-5">
              <div className="flex size-32 shrink-0 items-center justify-center overflow-hidden p-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/logo/nota-logo.png"
                  alt="Logo Asihjaya"
                  className="size-full object-contain"
                />
              </div>
              <div>
                <h1 className="text-xl font-bold uppercase tracking-wider text-[var(--accent)]">
                  {MOCK_RECEIPT.store.name}
                </h1>
                <p className="mt-1 text-xs font-medium text-neutral-500">
                  JUAL - BELI (PERHIASAN)
                </p>
                <div className="mt-2 flex flex-col gap-1 text-[10px] text-neutral-500">
                  <span className="font-semibold text-neutral-700">
                    {MOCK_RECEIPT.store.address}
                  </span>
                  <div className="flex gap-4">
                    <span>WA: {MOCK_RECEIPT.store.phone2}</span>
                    <span>IG: {MOCK_RECEIPT.store.ig}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="text-right text-xs">
              <p className="mb-2 text-sm font-bold text-neutral-900">
                SURAT JAMINAN
              </p>
              <div className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-1 text-left">
                <span className="text-neutral-500">No. Order:</span>
                <span className="font-semibold">{MOCK_RECEIPT.receiptNo}</span>
                <span className="text-neutral-500">Tanggal:</span>
                <span className="font-semibold">
                  {formatDate(MOCK_RECEIPT.date)}
                </span>
                <span className="text-neutral-500">Sales:</span>
                <span className="font-semibold">{MOCK_RECEIPT.staff}</span>
              </div>
            </div>
          </header>

          {/* Customer Info (Small Bar) */}
          <div className="relative mt-4 flex items-center justify-between rounded bg-amber-50/50 px-4 py-2 text-xs">
            <p>
              <span className="text-neutral-500">Konsumen: </span>
              <span className="font-semibold text-neutral-900">
                {MOCK_RECEIPT.customer.name}
              </span>
            </p>
            <p>
              <span className="text-neutral-500">Telepon: </span>
              <span className="font-semibold text-neutral-900">
                {MOCK_RECEIPT.customer.phone}
              </span>
            </p>
          </div>

          {/* Product Items Table */}
          <div className="relative mt-4 flex-1">
            <table className="w-full text-left text-xs text-neutral-800">
              <thead className="bg-[var(--accent)] text-white">
                <tr>
                  <th className="px-3 py-2 font-semibold">Kode</th>
                  <th className="px-3 py-2 font-semibold">Foto Produk</th>
                  <th className="px-3 py-2 font-semibold">Nama Perhiasan</th>
                  <th className="px-3 py-2 text-center font-semibold">Kadar</th>
                  <th className="px-3 py-2 text-center font-semibold">Gram</th>
                  <th className="px-3 py-2 text-right font-semibold">Harga</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {MOCK_RECEIPT.items.map((item) => (
                  <tr key={item.id}>
                    <td className="px-3 py-4 font-mono">{item.sku}</td>
                    <td className="px-3 py-4">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={item.imageUrl}
                        alt="Product"
                        className="h-12 w-12 rounded bg-neutral-100 object-cover ring-1 ring-neutral-200"
                      />
                    </td>
                    <td className="px-3 py-4">
                      <p className="font-bold text-neutral-900">{item.name}</p>
                      <p className="text-[10px] text-neutral-500">
                        {item.specs}
                      </p>
                    </td>
                    <td className="px-3 py-4 text-center font-medium">
                      {item.purityPercent}%
                    </td>
                    <td className="px-3 py-4 text-center font-medium">
                      {item.weightGram}g
                    </td>
                    <td className="px-3 py-4 text-right font-bold text-neutral-900">
                      {formatMoney(item.price)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Footer / T&C */}
          <footer className="relative mt-6 flex items-end justify-between border-t border-[var(--accent)]/20 pt-4">
            <div className="w-1/2 text-[9px] leading-relaxed text-neutral-600">
              <p className="mb-1 font-bold text-neutral-900">Perhatian:</p>
              <ol className="list-decimal pl-3">
                <li>
                  Barang tersebut di dalam nota sudah diperiksa, disetujui,
                  ditimbang & diterima oleh Pembeli.
                </li>
                <li>
                  Apabila dalam keadaan utuh, barang dapat dijual kembali,
                  dibawah harga pasaran & dipotong ongkos bikin serta susutnya.
                </li>
                <li>Barang Permata cacat / pecah, tidak diterima kembali.</li>
                <li>Perhiasan batu dll, hanya kami terima emasnya saja.</li>
                <li>
                  Nota pembelian ini harap dibawa pada saat hendak menjual, bila
                  surat hilang, barang dapat kami tolak.
                </li>
              </ol>
            </div>

            <div className="flex items-end gap-6 text-xs">
              <div className="text-right">
                <div className="mb-1 grid grid-cols-[1fr_auto] gap-x-4">
                  <span className="text-neutral-500">Dana Titip:</span>
                  <span className="font-semibold text-neutral-900">
                    {formatMoney(MOCK_RECEIPT.depositAmount)}
                  </span>
                </div>
                <div className="grid grid-cols-[1fr_auto] gap-x-4 border-t border-neutral-200 pt-1">
                  <span className="font-bold text-neutral-900">TOTAL:</span>
                  <span className="text-base font-bold text-[var(--accent)]">
                    {formatMoney(MOCK_RECEIPT.total)}
                  </span>
                </div>
              </div>

              <div className="flex flex-col items-center justify-end text-center text-[10px]">
                <QrCode className="mb-1 size-12 text-neutral-800" />
                <p className="text-neutral-500">Scan Keaslian</p>
              </div>
            </div>
          </footer>
        </div>
      </div>
    </div>
  );
}
