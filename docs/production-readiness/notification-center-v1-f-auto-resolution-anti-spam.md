# Notification Center V1-F — Auto Resolution & Anti-Spam

Status: implemented

## Objective

Menjaga Notification Center tetap relevan tanpa menghapus audit event. V1-F
menambahkan maintenance berbasis lifecycle, aggregation untuk event berulang,
dan auto-resolution ketika kondisi operasional telah pulih.

## Safety rules

- Event `requires_action = true` tidak pernah auto-resolve hanya karena umur.
- Event severity `critical` tidak pernah auto-resolve hanya karena umur.
- Shared `notification_events` tidak di-hard-delete.
- Auto-archive hanya mengubah status recipient menjadi `archived`.
- Business workflow tetap menjadi source of truth untuk approval, refund, retur,
  reconciliation, dan hardware state.

## Default lifecycle policy

| Event | Default |
|---|---:|
| Success non-actionable | Auto-resolve setelah 7 hari |
| Info non-actionable | Auto-resolve setelah 14 hari |
| Warning non-actionable | Auto-resolve setelah 30 hari |
| Resolved recipient | Auto-archive setelah 30 hari |
| Actionable atau critical | Tidak pernah auto-resolve berdasarkan umur |

Maintenance berjalan secara oportunistik ketika drawer, full notification page,
atau live-count endpoint dibaca. Eksekusi dibatasi sekali per organization per
5 menit pada process yang sama dan dilindungi PostgreSQL advisory transaction
lock untuk menghindari race antar-request.

## Configurable environment

```env
NOTIFICATION_SUCCESS_AUTO_RESOLVE_DAYS=7
NOTIFICATION_INFO_AUTO_RESOLVE_DAYS=14
NOTIFICATION_WARNING_AUTO_RESOLVE_DAYS=30
NOTIFICATION_RESOLVED_AUTO_ARCHIVE_DAYS=30
NOTIFICATION_MAINTENANCE_INTERVAL_MINUTES=5
NOTIFICATION_ANTI_SPAM_WINDOW_MINUTES=15
```

Nilai retention dibatasi 1–365 hari. Interval maintenance dibatasi 1–60 menit.
Window anti-spam dibatasi 1–120 menit.

## Generic aggregation

`PublishNotificationEventInput` sekarang mendukung:

```ts
antiSpam: {
  mode: "dedupe" | "aggregate";
  occurrenceId?: string;
  reNotifyRecipients?: boolean;
}
```

Pada mode aggregate:

- Satu active `deduplication_key` tetap menghasilkan satu card.
- Retry dengan `occurrenceId` yang sama tidak dihitung dua kali.
- Occurrence baru menambah `payload.occurrenceCount`.
- `firstOccurredAt` dan `lastOccurredAt` disimpan.
- Maksimal 50 occurrence ID terakhir disimpan untuk idempotency.
- Severity hanya dapat naik, tidak turun, selama event aktif.
- Recipient yang sudah read/archive dapat dibuka kembali hanya jika producer
  mengaktifkan `reNotifyRecipients`.

Drawer dan full page menampilkan badge `N kejadian` serta detail waktu pertama
dan terakhir.

## Hardware anti-spam

### Hardware job failed

Failure sekarang dikelompokkan berdasarkan:

```text
agent/register/outlet + device type
```

Beberapa print failure pada printer yang sama menghasilkan satu actionable card,
bukan satu card per job. Job ID menjadi occurrence ID agar PATCH retry tidak
menggandakan hitungan.

Ketika job pada device group tersebut berhasil `completed`, active failure card
otomatis berubah menjadi resolved. Notification legacy per-job juga ikut
diselesaikan untuk kompatibilitas data V1-C.

### Stale job recovery

Ringkasan recovery dikelompokkan per reason dalam window default 15 menit.
Summary recovery tidak actionable karena failed job sudah direpresentasikan oleh
card hardware failure yang teragregasi.

## Approval execution failure

Retry eksekusi refund/void yang gagal tetap menghasilkan satu card per approval.
Occurrence baru:

- Memperbarui error terbaru.
- Menambah occurrence count.
- Membuka kembali recipient menjadi unread.

Ketika eksekusi berhasil, lifecycle V1-C tetap menyelesaikan failure card.

## UAT

1. Buat dua hardware job gagal pada agent/device yang sama.
2. Pastikan hanya satu active `hardware.job_failed` card.
3. Expand card dan pastikan terdapat `2 kejadian`.
4. Kirim ulang status failed untuk job ID yang sama.
5. Pastikan count tidak bertambah.
6. Selesaikan satu job pada device group dengan status `completed`.
7. Pastikan card failure menjadi `Selesai`.
8. Gagalkan eksekusi refund dua kali untuk approval sama.
9. Pastikan satu card menampilkan occurrence count dan kembali unread.
10. Pastikan event actionable dan critical lama tidak auto-resolve berdasarkan umur.
11. Dengan retention pendek pada database test, pastikan success/info/warning
    non-actionable berubah menjadi resolved sesuai policy.
12. Pastikan resolved recipient lama berpindah ke filter `Diarsipkan` tanpa event
    terhapus.
13. Pastikan badge drawer dan live count tidak menghitung resolved/archived event
    sebagai unread.

## Migration

Tidak ada perubahan schema, enum, index, constraint, atau migration journal pada
V1-F. `db:migrate` dan `db:seed` tidak diperlukan.
