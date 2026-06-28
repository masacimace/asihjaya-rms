export const runtime = "nodejs";

import { AlertCircle, ArrowUp, ArrowDown } from "lucide-react";

export default function LaporanStokPage() {
  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-[var(--border)] bg-white p-5">
          <div className="flex items-center gap-3 text-emerald-600">
            <div className="rounded-lg bg-emerald-100 p-2">
              <ArrowUp className="size-5" />
            </div>
            <h3 className="font-semibold text-neutral-900">
              Barang Paling Laris (Fast Moving)
            </h3>
          </div>
          <div className="mt-4 space-y-4">
            {[
              { name: "Cincin Belah Rotan 70%", sold: 42, stock: 5 },
              { name: "Kalung Milano 75%", sold: 28, stock: 12 },
              { name: "Anting Gipsy 70%", sold: 25, stock: 2 },
            ].map((item, i) => (
              <div
                key={i}
                className="flex items-center justify-between border-b border-neutral-100 pb-2 last:border-0 last:pb-0"
              >
                <div>
                  <p className="text-sm font-medium text-neutral-900">
                    {item.name}
                  </p>
                  <p className="text-xs text-neutral-500">
                    Terjual: {item.sold} pcs minggu ini
                  </p>
                </div>
                <div className="text-right">
                  <span
                    className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ${
                      item.stock <= 5
                        ? "bg-red-100 text-red-700"
                        : "bg-neutral-100 text-neutral-700"
                    }`}
                  >
                    Sisa {item.stock}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-[var(--border)] bg-white p-5">
          <div className="flex items-center gap-3 text-red-600">
            <div className="rounded-lg bg-red-100 p-2">
              <ArrowDown className="size-5" />
            </div>
            <h3 className="font-semibold text-neutral-900">
              Barang Mandek (Slow Moving)
            </h3>
          </div>
          <div className="mt-4 space-y-4">
            {[
              { name: "Gelang Keroncong 75% Besar", days: 120, stock: 4 },
              { name: "Cincin Permata Merah Delima", days: 95, stock: 1 },
              { name: "Kalung Tambang Super Tebal", days: 88, stock: 2 },
            ].map((item, i) => (
              <div
                key={i}
                className="flex items-center justify-between border-b border-neutral-100 pb-2 last:border-0 last:pb-0"
              >
                <div>
                  <p className="text-sm font-medium text-neutral-900">
                    {item.name}
                  </p>
                  <p className="text-xs text-red-500">
                    Tersimpan: {item.days} hari
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-sm font-medium text-neutral-700">
                    Stok {item.stock}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Warning State */}
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
        <div className="flex items-start gap-4">
          <AlertCircle className="mt-0.5 size-5 text-amber-600 shrink-0" />
          <div>
            <h3 className="text-sm font-bold text-amber-900">
              Peringatan Stok Tipis
            </h3>
            <p className="mt-1 text-sm text-amber-800">
              Ada 12 model perhiasan yang stoknya kurang dari 3 pcs. Disarankan
              untuk segera melakukan *re-stock* sebelum kehabisan.
            </p>
            <button className="mt-3 text-sm font-semibold text-amber-700 hover:text-amber-900 underline underline-offset-4">
              Lihat Daftar Barang Tipis &rarr;
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
