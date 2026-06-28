"use client";

import { Download } from "lucide-react";
import * as XLSX from "xlsx";

type TransactionData = {
  id: string;
  receiptNo: string;
  date: string;
  type: string;
  customerName: string;
  staffName: string;
  totalItems: number;
  totalValue: number;
};

export function ExportExcelButton({ data }: { data: TransactionData[] }) {
  const handleExport = () => {
    // 1. Format the data to look good in Excel
    const formattedData = data.map((trx) => ({
      "Tanggal Waktu": new Date(trx.date).toLocaleString("id-ID", {
        timeZone: "Asia/Jakarta",
      }),
      "Nomor Nota": trx.receiptNo,
      "Jenis Transaksi": trx.type === "purchase" ? "Penjualan" : "Buyback",
      "Nama Pelanggan": trx.customerName,
      "Nama Kasir": trx.staffName,
      "Total Barang": trx.totalItems,
      "Nilai Rupiah": trx.totalValue,
    }));

    // 2. Create a new workbook and add the data
    const worksheet = XLSX.utils.json_to_sheet(formattedData);
    const workbook = XLSX.utils.book_new();

    // 3. Customize column widths
    const colWidths = [
      { wch: 20 }, // Tanggal Waktu
      { wch: 18 }, // Nomor Nota
      { wch: 15 }, // Jenis Transaksi
      { wch: 25 }, // Nama Pelanggan
      { wch: 15 }, // Nama Kasir
      { wch: 15 }, // Total Barang
      { wch: 20 }, // Nilai Rupiah
    ];
    worksheet["!cols"] = colWidths;

    XLSX.utils.book_append_sheet(workbook, worksheet, "Riwayat Penjualan");

    // 4. Generate the Excel file and trigger download
    XLSX.writeFile(workbook, "Riwayat_Penjualan_Asihjaya.xlsx");
  };

  return (
    <button
      onClick={handleExport}
      className="inline-flex h-10 items-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-medium text-white transition hover:bg-emerald-700"
    >
      <Download className="size-4" />
      Export Excel
    </button>
  );
}
