import { ArrowLeft, Check, ClipboardCheck, X } from "lucide-react";
import Link from "next/link";

export const runtime = "nodejs";

const MOCK_APPROVALS = [
  {
    id: "appr-01",
    date: "2026-06-25T14:30:00Z",
    type: "discount",
    status: "pending",
    requestedBy: "Hanita",
    referenceId: "ORD/06/2026/440",
    requestData: {
      item: "Gelang Keroncong 24K (20g)",
      price: 25000000,
      discountRequested: 500000,
      reason: "Pelanggan VIP lama, beli banyak",
    },
  },
  {
    id: "appr-02",
    date: "2026-06-25T09:15:00Z",
    type: "void_receipt",
    status: "approved",
    requestedBy: "Rini",
    referenceId: "ORD/06/2026/421",
    requestData: {
      reason: "Salah input metode pembayaran (harusnya Transfer BCA tapi klik Cash)",
    },
  },
];

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
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export default function ApprovalPage() {
  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-2">
            <Link
              href="/admin"
              className="inline-flex items-center gap-2 text-sm font-medium text-neutral-500 hover:text-[var(--accent)]"
            >
              <ArrowLeft className="size-4" />
              Kembali
            </Link>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-neutral-950 sm:text-3xl">
            Kotak Masuk Approval
          </h1>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
            Tinjau dan berikan persetujuan untuk tindakan khusus yang dilakukan kasir.
          </p>
        </div>
      </header>

      <section className="grid gap-4">
        {MOCK_APPROVALS.map((approval) => (
          <article
            key={approval.id}
            className={`flex flex-col gap-4 rounded-2xl border bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between ${
              approval.status === "pending"
                ? "border-amber-200 ring-1 ring-amber-100"
                : "border-[var(--border)]"
            }`}
          >
            <div className="flex items-start gap-4">
              <div
                className={`grid size-12 shrink-0 place-items-center rounded-full ${
                  approval.status === "pending"
                    ? "bg-amber-100 text-amber-600"
                    : "bg-neutral-100 text-neutral-500"
                }`}
              >
                <ClipboardCheck className="size-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-neutral-950">
                    {approval.type === "discount"
                      ? "Permintaan Diskon Khusus"
                      : "Pembatalan Nota (Void)"}
                  </h2>
                  {approval.status === "pending" && (
                    <span className="inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-700">
                      Menunggu
                    </span>
                  )}
                  {approval.status === "approved" && (
                    <span className="inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-700">
                      Disetujui
                    </span>
                  )}
                </div>
                <p className="mt-1 text-sm text-neutral-600">
                  Diminta oleh <span className="font-medium text-neutral-900">{approval.requestedBy}</span> untuk Nota{" "}
                  <span className="font-medium text-neutral-900">{approval.referenceId}</span> pada {formatDate(approval.date)}
                </p>

                <div className="mt-3 rounded-lg bg-neutral-50 p-3 text-sm text-neutral-700">
                  {approval.type === "discount" ? (
                    <div className="space-y-1">
                      <p>
                        <span className="text-neutral-500">Item:</span>{" "}
                        <span className="font-medium">{approval.requestData.item}</span>
                      </p>
                      <p>
                        <span className="text-neutral-500">Nominal Diskon:</span>{" "}
                        <span className="font-bold text-red-600">
                          {formatMoney(approval.requestData.discountRequested || 0)}
                        </span>
                      </p>
                      <p>
                        <span className="text-neutral-500">Alasan:</span>{" "}
                        <span className="italic">{approval.requestData.reason}</span>
                      </p>
                    </div>
                  ) : (
                    <p>
                      <span className="text-neutral-500">Alasan Pembatalan:</span>{" "}
                      <span className="italic">{approval.requestData.reason}</span>
                    </p>
                  )}
                </div>
              </div>
            </div>

            {approval.status === "pending" && (
              <div className="flex shrink-0 gap-2 sm:flex-col">
                <button className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-medium text-white hover:bg-emerald-700">
                  <Check className="size-4" />
                  Setujui (Approve)
                </button>
                <button className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 text-sm font-medium text-red-600 hover:bg-red-100">
                  <X className="size-4" />
                  Tolak
                </button>
              </div>
            )}
          </article>
        ))}
      </section>
    </div>
  );
}
