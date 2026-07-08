# Roadmap & Status `/admin` Halaman Admin - Asihjaya RMS

Dokumen ini memantau progres implementasi halaman `/admin` yang terintegrasi dengan database riil (PostgreSQL + Drizzle ORM).

**Ringkasan Progres Halaman Admin:**

- **Selesai (Real Data/Query):** Produk (R4), Inventaris (R5), Shift Kasir (R7), Administrasi (R12), Hardware Hub (Operasional), Penjualan (R3 - list & detail).
- **Belum Selesai (Masih Mockup/Draft):** Pelanggan (R6), Pergerakan Kas (R8), Approval Workflow (R9), Laporan Outlet (R11), Pengaturan Sistem (R13), Aksi Void/Refund (R3C).

---

### [ ] ADMIN-R3 — Penjualan Real Data (`Partially Completed`)

- **Status Halaman:** `/admin/penjualan` dan `/admin/penjualan/[transactionId]` sudah terhubung dengan query riil dari database.
- **Detail Progres:**
  - [x] List transaksi real-data POS dengan filter range waktu, outlet, status, dan metode pembayaran.
  - [x] Detail transaksi POS dengan item perhiasan, subtotal/diskon/biaya, payment breakdown, customer, dan timeline audit.
  - [x] Print log integrasi dengan Hardware Hub & reprint nota.
  - [ ] `ADMIN-R3C` Void/refund transaksi + audit action (saat ini tombol masih ter-disable dengan catatan masuk subfase R3C setelah approval guard siap).

---

### [x] ADMIN-R4 — Produk Master Management (`Completed`)

- **Status Halaman:** `/admin/produk` & `/admin/produk/[productId]` terhubung 100% ke database riil.
- **Detail Progres:**
  - [x] List master product riil.
  - [x] Create/edit master product dengan category, brand, material, collection, status (draft/active/inactive), deskripsi, dan foto katalog.
  - [x] Pengelolaan kategori perhiasan (`/admin/produk/kategori`).
  - [x] Search & filter kategori/status produk.
  - [x] Detail master product yang menampilkan list item perhiasan fisik (serialized) di bawahnya.

---

### [x] ADMIN-R5 — Product Item / Inventory Item Management (`Completed`)

- **Status Halaman:** `/admin/inventaris` & `/admin/inventaris/item/[itemId]` terhubung 100% ke database riil.
- **Detail Progres:**
  - [x] List item fisik riil (serialized).
  - [x] Create/edit item product (SKU, barcode, berat aktual, kadar, kadar tukar, harga label, harga modal, lokasi outlet, kondisi, foto aktual, catatan internal).
  - [x] Barcode/QR value generator & print label via Hardware Agent.
  - [x] Movement history list (riwayat pergerakan stok append-only).

---

### [ ] ADMIN-R6 — Pelanggan Real Data (`Mockup`)

- **Status Halaman:** `/admin/pelanggan` masih menggunakan data statis (`MOCK_CUSTOMERS`).
- **Detail Progres:**
  - [ ] List customer dari database riil.
  - [ ] Create/edit customer form.
  - [ ] Search nama/kode/telepon WhatsApp.
  - [ ] Halaman detail customer terhubung dengan riwayat transaksi & total belanja riil.

---

### [x] ADMIN-R7 — Operasional Shift Kasir (`Completed`)

- **Status Halaman:** `/admin/operasional/shift` terhubung 100% ke database riil.
- **Detail Progres:**
  - [x] List shift aktif dan riwayat shift outlet (40 shift terakhir).
  - [x] Detail saldo expected cash, modal awal, dan cash sales aktif.
  - [x] Form penutupan shift kasir (input kas fisik aktual & catatan selisih/variance).

---

### [ ] ADMIN-R8 — Pergerakan Kas Petty Cash (`Mockup`)

- **Status Halaman:** `/admin/operasional/kas` masih menggunakan data statis (`MOCK_CASH_MOVEMENTS`).
- **Detail Progres:**
  - [ ] List petty cash movement riil (cash in / cash out / setoran).
  - [ ] Form pencatatan kas baru (nominal, kategori/tipe, alasan/catatan).
  - [ ] Summary cash movement harian.

---

### [ ] ADMIN-R9 — Approval Workflow (`Mockup`)

- **Status Halaman:** `/admin/operasional/approval` dan komponen `ApprovalDrawer` di sidebar masih menggunakan data statis (`MOCK_APPROVALS`).
- **Detail Progres:**
  - [ ] List request approval aktif (diskon khusus, void receipt, stock adjustment).
  - [ ] Integrasi aksi Approve / Reject dengan database & websocket update.
  - [ ] Audit trail approval log.

---

### [ ] ADMIN-R11 — Laporan Outlet (`Mockup`)

- **Status Halaman:** `/admin/laporan` dan `/admin/laporan/penjualan` masih menggunakan data statis (`chartData` & `MOCK_SALES`).
- **Detail Progres:**
  - [ ] Laporan tren omzet penjualan realtime.
  - [ ] Laporan kuantitas item terjual, gramasi emas terjual, dan laba kotor.
  - [ ] Detail laporan penjualan per outlet/metode bayar dengan ekspor CSV/XLSX riil.

---

### [x] ADMIN-R12 — Administrasi User, Role, Outlet (`Completed`)

- **Status Halaman:** Halaman di bawah `/admin/administrasi` terhubung 100% ke database riil.
- **Detail Progres:**
  - [x] Staff management (tambah staff, atur outlet utama, edit akun).
  - [x] Role & Permission management (kelola peran sistem, hak akses modul).
  - [x] Outlet & Register management (tambah lokasi toko dan mapping perangkat register).

---

### [ ] ADMIN-R13 — Pengaturan Sistem (`Pending`)

- **Status Halaman:** `/admin/pengaturan` belum memiliki modul khusus (masih jatuh ke fallback `[section]/page.tsx`).

---

## Urutan Development Rekomendasi (Terupdate)

1.  **ADMIN-R6 Pelanggan Real Data** (Karena data pelanggan esensial untuk melengkapi checkout penjualan POS dan pencatatan transaksi).
2.  **ADMIN-R8 Pergerakan Kas Petty Cash** (Untuk mencatat kas masuk/keluar di kasir secara akurat).
3.  **ADMIN-R9 Approval Workflow** (Sebagai gerbang keamanan untuk diskon besar di POS dan void/refund).
4.  **ADMIN-R3C Void/Refund Transaksi** (Setelah approval workflow siap, admin bisa melakukan void nota bermasalah).
5.  **ADMIN-R11 Laporan Outlet** (Untuk visualisasi performa toko dari data riil).
6.  **ADMIN-R13 Pengaturan & Rilis** (Finishing profil toko dan printer behavior).
