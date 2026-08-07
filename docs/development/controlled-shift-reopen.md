# Controlled Shift Reopen

## Tujuan

Recovery operasional ketika shift outlet tidak sengaja ditutup tetapi toko masih beroperasi pada business date yang sama.

Kontrak tetap: **1 outlet + 1 business date = 1 shift**. Reopen tidak membuat shift kedua, tidak membuat modal/opening balance baru, dan tidak menghapus audit penutupan sebelumnya.

## Permission

`shifts.reopen` hanya diberikan default kepada `system_admin`, `owner`, dan `manager`. Role `cashier` tetap dapat membuka/menutup shift melalui `shifts.manage`, tetapi tidak dapat reopen.

## Finance

`finance_closing_snapshots` menjadi revisioned immutable history. Snapshot yang tidak lagi final diberi `superseded_at`, `superseded_by_user_id`, dan `superseded_reason`. Closing berikutnya membuat revision baru; snapshot lama tidak diubah atau dihapus.

Weekly/monthly hanya mengagregasi snapshot yang belum superseded.

## Telegram

- pending/retry/failed closing/periodic delivery yang terdampak dibatalkan saat reopen;
- `processing` memblokir reopen sementara untuk menghindari hasil send yang ambigu;
- delivery yang sudah `sent` tidak diubah;
- jika ada laporan yang sudah terkirim, outbox `shift_reopened` dibuat sebagai koreksi;
- closing berikutnya memakai event key revision baru (`...:r2`, dst.);
- weekly/monthly corrected report memakai fingerprint source revision agar idempotency tetap benar.

Tidak ada HTTP Telegram di transaksi reopen; pengiriman tetap melalui outbox worker.

## Acceptance

1. Manager/owner melihat `Buka Kembali Shift` untuk closed shift pada business date hari ini.
2. Kasir melihat arahan menghubungi manager/owner dan tidak mendapat tombol reopen.
3. Reopen mempertahankan `shift_id`, `business_date`, `opening_cash`, dan cash movements.
4. Snapshot penutupan lama menjadi superseded.
5. Pending closing delivery menjadi cancelled.
6. Jika closing sebelumnya sudah terkirim, Telegram menerima notifikasi reopen.
7. Closing berikutnya membuat finance snapshot revision baru dan corrected daily report.
8. Reopen lintas business date ditolak.
