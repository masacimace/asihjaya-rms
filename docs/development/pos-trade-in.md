# Tukar Tambah POS

Tukar Tambah adalah pelunasan penjualan menggunakan nominal barang tukaran. Harga jual, diskon item, dan total penjualan tetap dihitung oleh pricing POS. Nilai Tukar Tambah disimpan sebagai baris `payments` dengan metode `trade_in`.

## Alur kasir

1. Pilih pelanggan terdaftar dan masukkan barang baru ke CART.
2. Buka pembayaran, pilih Tukar Tambah, dan masukkan nominal barang tukaran.
3. Tambahkan selisih melalui Cash, EDC, atau Transfer. Pembayaran penuh melalui Tukar Tambah juga didukung.
4. Selesaikan transaksi setelah total seluruh pelunasan sesuai tagihan.

Tukar Tambah tidak memerlukan preset akun/terminal. Nominal harus positif, tidak melebihi sisa pembayaran maupun nilai belanja setelah penggunaan saldo, dan tidak dapat mendanai deposit Dana Titip baru. Penerimaan serta pemrosesan fisik barang lama tetap manual pada tahap ini; checkout tidak membuat Buyback atau stok masuk otomatis.

## Nota dan customer portal

Untuk penjualan Rp5.000.000 dengan Tukar Tambah Rp2.000.000 dan Cash Rp3.000.000:

- kolom HARGA menampilkan harga dasar masing-masing item;
- Total Pembayaran dan TOTAL ITEM menampilkan total penjualan Rp5.000.000;
- CART, detail transaksi internal, dan customer portal menampilkan nominal Tukar Tambah Rp2.000.000 serta Cash Rp3.000.000.

Aturan total Nota berlaku pada full design, full design front only, serta overlay, termasuk jika pelanggan juga menggunakan saldo Dana Titip. Format QR dan akses portal tidak berubah. Portal hanya membuka transaksi pelanggan yang sesuai dengan sesi pelanggan yang sudah diverifikasi; rincian pelunasan tidak memuat catatan internal atau data rekening/terminal.

## Kas, laporan, dan koreksi

Kas shift hanya bertambah dari bagian pembayaran Cash. Nilai Tukar Tambah dilaporkan sebagai metode tersendiri dan termasuk ringkasan non-cash. Laporan pemasukan bank tetap memakai metode EDC/Transfer.

Void/refund mencatat pembalikan per metode asli. Nilai Tukar Tambah dibalik sebagai `trade_in`, sedangkan pengeluaran kas hanya mengikuti bagian Cash. Penyelesaian atau pengembalian fisik barang tukaran tetap dilakukan manual; fitur ini tidak membuat transaksi Buyback atau saldo Dana Titip pengganti.

## Database dan validasi

Migration `0031_pos_trade_in` hanya menambahkan nilai enum `payment_method.trade_in`. Tabel pembayaran, nominal, metadata, serta hubungan dengan penjualan menggunakan struktur yang sudah ada. Tidak ada reset database atau perubahan data transaksi lama.

Jalankan migration pada environment tujuan sebelum memakai aplikasi yang telah diperbarui, menggunakan prosedur backup dan deployment project. Untuk lokal: `npm run db:deploy -- --env-file .env`.

Validasi terkait:

- `npm run check:pos-stage-1c`
- `npm run check:pos-financials`
- `npm run check:receipt-pdf`
- `npm run check:current-business`
- `npm run test:financial:local`
