# Notification Center V1-B — Transaction Notifications

Status: implemented

## Objective

Mengaktifkan event Notification Center untuk transaksi POS tanpa menduplikasi
transaksi, membocorkan data customer sensitif, atau mengirim notifikasi ke semua
admin secara indiscriminatif.

Tahap ini menggunakan tabel `notification_events` dan
`notification_recipients` dari Notification Center V1-A. Tidak ada migration
schema baru pada V1-B.

## Event `sale.completed`

Event dibuat di transaction database checkout yang sama setelah:

- sale berstatus `completed`;
- payment berstatus `paid`;
- inventory berhasil berubah menjadi sold/customer;
- cash movement dan audit log berhasil dicatat.

Jika checkout rollback, event juga rollback.

Deduplication key:

```text
sale.completed:<saleId>
```

### Penerima default

- `owner` dan `system_admin` aktif pada organization;
- `manager` aktif yang mempunyai assignment ke outlet transaksi;
- cashier pembuat transaksi dikecualikan.

Finance, stock admin, dan cashier lain tidak menerima event transaksi normal
secara default.

### Payload snapshot

Payload menyimpan data minimum untuk drawer modern:

- invoice, outlet, register, shift;
- cashier;
- subtotal, discount, dan total;
- jumlah item dan total berat;
- daftar metode pembayaran dan nominal;
- flag split payment;
- flag transaksi bernilai besar.

Payload tidak menyimpan nomor telepon, email, alamat, atau evidence pembayaran
customer.

## High-value transaction

Threshold awal:

```text
Rp30.000.000
```

Transaksi pada atau di atas threshold tetap memakai event `sale.completed`,
tetapi:

- severity menjadi `warning`;
- title menjadi `Transaksi bernilai besar berhasil`;
- payload `isHighValue` menjadi `true`.

Tidak dibuat card kedua sehingga satu sale tetap menghasilkan satu notification
utama.

## Split payment

Split payment tidak membuat event terpisah. Payload `sale.completed` menyimpan:

```text
isSplitPayment = true
payments = [...]
```

Detail tersebut akan ditampilkan ketika card diperluas pada Notification Center
V1-D.

## Event `sale.recovery_completed`

Event warning dibuat ketika sale berhasil ditemukan melalui recovery atau replay
idempotency.

Deduplication key:

```text
sale.recovery_completed:<saleId>
```

Recovery reason yang didukung:

- `legacy_sale_without_attempt`;
- `completed_attempt_replayed`;
- `attempt_repaired`;
- `checkout_retry`;
- `post_commit_recovery`.

Kegagalan menerbitkan event recovery tidak mengubah hasil recovery checkout.
Kegagalan dicatat ke server log karena sale sudah menjadi source of truth.

## Recipient targeting extension

Notification event service sekarang mendukung:

- `organizationRoleCodes`: role aktif pada seluruh organization;
- `outletRoleCodes`: role aktif yang ditambah validasi assignment outlet;
- `excludeUserIds`: mengecualikan actor/cashier.

Selector permission dan explicit user dari V1-A tetap didukung.

## UAT

1. Checkout normal membuat tepat satu event `sale.completed`.
2. Owner menerima event meskipun tidak mempunyai assignment outlet khusus.
3. Manager hanya menerima transaksi outlet yang ditugaskan kepadanya.
4. Cashier pembuat transaksi tidak menerima event miliknya sendiri.
5. Finance dan stock admin tidak menerima transaksi normal.
6. Transaksi di bawah Rp30 juta memiliki severity `info`.
7. Transaksi minimal Rp30 juta memiliki severity `warning`.
8. Split payment tersimpan sebagai satu event dengan dua payment snapshot.
9. Retry dengan sale yang sama tidak membuat duplicate `sale.completed`.
10. Recovery menghasilkan maksimal satu `sale.recovery_completed` per sale.
11. Rollback checkout tidak meninggalkan event notification.
12. Badge unread admin bertambah melalui polling yang sudah tersedia.

## Validation

```bash
npm run check:notifications:v1a
npm run check:notifications:v1b
npm run typecheck
npm run lint
npm run routes:check
npm run build
```

Tidak perlu menjalankan `npm run db:migrate` atau `npm run db:seed` untuk V1-B
karena tidak ada perubahan schema.
