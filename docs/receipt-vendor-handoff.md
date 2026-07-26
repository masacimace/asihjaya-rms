# Asihjaya Receipt Vendor Handoff

Dokumen ini dipakai untuk menyerahkan desain nota pre-printed ke vendor percetakan dan memastikan hasil cetak vendor dapat dipakai dengan mode overlay dari aplikasi.

## Output yang perlu diserahkan ke vendor

1. **Static artwork PDF**
   - URL preview lokal: `/api/sales/receipt-certificate-preview?mode=vendor_static_artwork`
   - Isi PDF: halaman depan static dan halaman belakang static.
   - Data transaksi, nominal, foto produk, dan QR dibuat kosong/placeholder agar nanti dicetak aplikasi sebagai overlay.

2. **Full design preview PDF**
   - URL preview lokal: `/api/sales/receipt-certificate-preview?mode=full_design`
   - Dipakai sebagai referensi visual final agar vendor memahami tampilan akhir nota setelah overlay dicetak.

3. **Overlay proof PDF**
   - URL preview lokal: `/api/sales/receipt-certificate-preview?mode=preprinted_overlay`
   - Dipakai internal outlet untuk tes posisi cetak di atas kertas yang sudah dicetak vendor.

## Ukuran dan profil kertas

Default production memakai profile dari env `RECEIPT_DOCUMENT_PROFILE_ID`.

Profile yang tersedia:

- `receipt_a4_landscape_v1` — A4 Landscape, target utama saat ini.
- `receipt_a5_landscape_v1` — A5 Landscape, legacy/fallback jika client ingin pindah ukuran.

URL dapat dioverride manual dengan query `profile`, contoh:

- `/api/sales/receipt-certificate-preview?profile=receipt_a4_landscape_v1&mode=vendor_static_artwork`
- `/api/sales/receipt-certificate-preview?profile=receipt_a5_landscape_v1&mode=vendor_static_artwork`


## Static outlet copy untuk vendor

Static artwork vendor membaca copy outlet dari env khusus berikut:

```env
RECEIPT_VENDOR_OUTLET_NAME=Pasar Bantar Gebang
RECEIPT_VENDOR_OUTLET_ADDRESS=Pasar Bantar Gebang, LT dasar Blok H8, H9, H10
RECEIPT_VENDOR_OUTLET_PHONE=0821 1806 8889
RECEIPT_VENDOR_OUTLET_INSTAGRAM=@asihjaya.bantargebang
```

Gunakan env ini untuk menyesuaikan nama outlet, alamat, Whatsapp, dan Instagram yang dicetak vendor pada static artwork. Jika env vendor kosong, preview memakai data sample/outlet preview sebagai fallback.

Receipt transaksi real tetap memakai data outlet dari database untuk nama, alamat, dan nomor Whatsapp. Karena database outlet belum punya field Instagram, Instagram full-design memakai env `RECEIPT_OUTLET_INSTAGRAM`.

## Static content yang dicetak vendor

### Halaman depan

- Border luar nota.
- Watermark/logo background.
- Logo dan nama brand.
- Alamat, Whatsapp, Instagram outlet jika kertas dibuat khusus outlet.
- Label metadata: No. Order, Item, Tanggal, Sales, Outlet.
- Label customer: Konsumen, Telepon.
- Header table item dan frame table.
- Frame foto produk.
- Support payment dan logo EDC.
- Area tanda tangan outlet.
- Label summary pembayaran.
- Frame QR dan label riwayat transaksi.

### Halaman belakang

- Informasi & Ketentuan.
- Ketentuan Transaksi.
- Perawatan Perhiasan.
- Layanan Asihjaya.
- Icon, border, watermark, dan background.

## Dynamic content yang dicetak aplikasi

Mode aplikasi `preprinted_overlay` hanya mencetak:

- No. Order.
- Item ke-n.
- Tanggal.
- Sales.
- Outlet jika diperlukan di metadata transaksi.
- Konsumen.
- Telepon.
- Kode produk.
- Foto produk.
- Nama produk.
- Kadar.
- Gram.
- Potongan/gram.
- Diskon.
- Harga.
- Dana Titip.
- Gunakan Saldo.
- Harga Item.
- Total Pembayaran.
- Total Item.
- QR code.

## Proof print wajib sebelum produksi massal

Sebelum vendor mencetak banyak lembar:

1. Cetak proof 5–10 lembar terlebih dahulu.
2. Test reprint dari aplikasi memakai mode `preprinted_overlay`.
3. Cek posisi area berikut:
   - No. Order, tanggal, sales, outlet.
   - Konsumen dan telepon.
   - Foto produk.
   - Detail produk dan nominal.
   - QR code dan kemampuan scan.
4. Jika posisi overlay bergeser, kalibrasi dengan env:
   - `RECEIPT_OVERLAY_OFFSET_X_MM`
   - `RECEIPT_OVERLAY_OFFSET_Y_MM`
   - `RECEIPT_OVERLAY_SCALE`

## Panduan kalibrasi overlay

- Print terlalu kiri → naikkan `RECEIPT_OVERLAY_OFFSET_X_MM`.
- Print terlalu kanan → turunkan `RECEIPT_OVERLAY_OFFSET_X_MM`.
- Print terlalu atas → naikkan `RECEIPT_OVERLAY_OFFSET_Y_MM`.
- Print terlalu bawah → turunkan `RECEIPT_OVERLAY_OFFSET_Y_MM`.
- Ukuran overlay terlalu kecil → naikkan `RECEIPT_OVERLAY_SCALE` sedikit.
- Ukuran overlay terlalu besar → turunkan `RECEIPT_OVERLAY_SCALE` sedikit.

Contoh:

```env
RECEIPT_OVERLAY_OFFSET_X_MM=1.5
RECEIPT_OVERLAY_OFFSET_Y_MM=-0.8
RECEIPT_OVERLAY_SCALE=1
```

## Catatan untuk vendor

- Jangan mengubah proporsi artwork tanpa konfirmasi.
- Jangan menambahkan margin otomatis.
- Cetak sesuai ukuran final profile yang dipakai.
- Gunakan hasil proof untuk memastikan area overlay tetap kosong dan tidak tertutup desain static.
- Jika vendor membutuhkan CMYK/final artwork editable, gunakan PDF static sebagai referensi final layout, lalu vendor dapat melakukan konversi produksi dengan menjaga ukuran dan posisi area overlay.
