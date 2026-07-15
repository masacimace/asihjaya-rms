# ASIHJAYA RMS — Settings Center Roadmap

> Status: **PLANNED**
>
> Dokumen ini menjadi acuan pengembangan halaman `/admin/pengaturan` sebagai satu pusat konfigurasi, tanpa submenu tambahan pada navbar.
>
> Terakhir diperbarui: 2026-07-16

---

## Objective

Membangun **Settings Center** yang:

- Menyatukan seluruh konfigurasi penting pada satu halaman `/admin/pengaturan`.
- Tetap menggunakan satu menu **Pengaturan** pada navbar.
- Memisahkan konfigurasi dari aktivitas operasional.
- Mendukung scope organisasi, outlet, register, dan user.
- Memiliki permission, validasi, audit log, serta proteksi tindakan sensitif.
- Menjadi fondasi untuk Cloud Storage, Backup Destination, dan Telegram.
- Tetap kompatibel dengan Profile Pembayaran yang sudah tersedia.

---

## Scope Settings Center

Section utama yang disepakati:

1. Umum
2. Profil Pembayaran
3. Notifikasi
4. Keamanan & Sesi
5. Integrasi

Subsection Integrasi:

- Cloud Storage — wajib dibuat
- Backup Destination
- Telegram
- Midtrans — hold
- WhatsApp — hold
- Email — hold

---

## Navigation Principle

Navbar tetap sederhana:

```text
Pengaturan
```

Seluruh navigasi section berada di dalam route:

```text
/admin/pengaturan
```

Deep link menggunakan query parameter:

```text
/admin/pengaturan?section=general
/admin/pengaturan?section=payments
/admin/pengaturan?section=notifications
/admin/pengaturan?section=security
/admin/pengaturan?section=integrations
```

Query parameter digunakan untuk navigasi internal, bukan untuk membuat submenu navbar.

---

## Recommended Page Layout

### Desktop

```text
┌───────────────────────┬────────────────────────────────────┐
│ Umum                  │ Judul section                      │
│ Profil Pembayaran     │ Deskripsi scope                    │
│ Notifikasi            │                                    │
│ Keamanan & Sesi       │ Form dan konfigurasi               │
│ Integrasi             │                                    │
│                       │                     [Simpan]       │
└───────────────────────┴────────────────────────────────────┘
```

Navigasi internal menggunakan sidebar sticky.

### Mobile

Navigasi internal berubah menjadi:

- Select section, atau
- Horizontal scroll tabs

Form tetap satu kolom dan tombol simpan dibuat mudah dijangkau.

---

# Development Order

```text
Settings Center V1-A — Layout & Foundation
        ↓
Settings Center V1-B — General Settings
        ↓
Settings Center V1-C — Notification Settings
        ↓
Settings Center V1-D — Security & Session
        ↓
Settings Center V1-E — Cloud Storage
        ↓
Settings Center V1-F — Backup Destination
        ↓
Settings Center V1-G — Telegram Delivery
```

Tahapan yang tetap ditahan:

```text
Midtrans
WhatsApp
Email
```

---

# Settings Center V1-A — Layout & Foundation

## Objective

Membuat fondasi UI, routing, permission, scope, audit, dan pola penyimpanan pengaturan sebelum menambahkan banyak konfigurasi baru.

## Scope

### Layout

- Sidebar atau tab navigasi internal.
- Active section berdasarkan query parameter.
- Responsive desktop dan mobile.
- Header section.
- Scope badge.
- Save bar konsisten.
- Loading, success, error, dan empty states.
- Unsaved changes warning.
- Reset form ke nilai tersimpan.

### Existing Profile Pembayaran

Integrasikan tampilan Profile Pembayaran yang sudah tersedia ke section:

```text
/admin/pengaturan?section=payments
```

Business logic berikut tidak boleh berubah:

- Profile per outlet.
- Provider.
- Reference requirement.
- Evidence requirement.
- Approval code requirement.
- Verification threshold.
- Active/inactive.
- Permission dan audit yang sudah ada.

### Settings Access

Permission awal yang direkomendasikan:

```text
settings.view
settings.general.manage
settings.payments.manage
settings.notifications.manage
settings.security.manage
settings.integrations.manage
```

Role default:

| Permission | System Admin | Owner | Manager |
|---|---:|---:|---:|
| `settings.view` | Ya | Ya | Ya |
| `settings.general.manage` | Ya | Ya | Terbatas |
| `settings.payments.manage` | Ya | Ya | Sesuai outlet |
| `settings.notifications.manage` | Ya | Ya | Sesuai outlet |
| `settings.security.manage` | Ya | Ya | Tidak |
| `settings.integrations.manage` | Ya | Ya | Tidak |

### Settings Data Model

Gunakan model yang jelas dan tervalidasi. Hindari menyimpan semua konfigurasi sebagai JSON bebas tanpa schema.

Rekomendasi pendekatan:

```text
organization_settings
user_notification_preferences
security_settings
storage_integrations
backup_destinations
telegram_integrations
```

Jika digunakan JSONB untuk kelompok setting tertentu:

- Harus memiliki TypeScript schema.
- Harus memiliki version field.
- Harus divalidasi server-side.
- Tidak boleh menerima arbitrary keys dari browser.

### Scope

Setiap setting harus memiliki scope eksplisit:

```text
organization
outlet
register
user
```

UI harus menunjukkan scope agar user memahami dampak perubahan.

### Audit

Setiap perubahan menyimpan:

- Actor.
- Timestamp.
- Organization/outlet scope.
- Setting key.
- Nilai lama yang aman.
- Nilai baru yang aman.
- Source/IP bila tersedia.
- Alasan perubahan untuk setting sensitif.

Secret tidak boleh disimpan ke audit log dalam bentuk plaintext.

## Exit Criteria

- `/admin/pengaturan` memiliki layout internal yang stabil.
- Semua section dapat diakses melalui query parameter.
- Profile Pembayaran tetap berfungsi.
- Permission section bekerja.
- User tanpa akses mendapatkan halaman akses ditolak.
- Perubahan setting menghasilkan audit log.
- Unsaved changes tidak hilang tanpa peringatan.
- Mobile layout dapat digunakan.
- Tidak ada submenu baru di navbar.

---

# Settings Center V1-B — General Settings

## Objective

Menjadikan pengaturan umum sebagai sumber identitas organisasi.

## Scope

### Organization Identity

- Nama bisnis.
- Nama legal atau nama pada nota.
- Nomor telepon.
- Email bisnis.
- Alamat.
- Logo.
- Nama penanggung jawab.

### Regional Settings

- Zona waktu.
- Mata uang.
- Locale.
- Format tanggal.
- Format waktu.

Rekomendasi awal:

```text
Timezone: Asia/Jakarta
Currency: IDR
Locale: id-ID
```

Mata uang dapat dikunci ke IDR pada versi awal.

### Receipt Identity

- Nama yang ditampilkan pada nota.
- Alamat outlet atau organisasi.
- Footer nota.
- Informasi retur singkat.
- Tampilkan logo pada nota.

Pengaturan perilaku printer tetap dikembangkan terpisah bila dibutuhkan.

## Validation

- Nama bisnis wajib.
- Zona waktu harus dari allowlist.
- Logo harus lolos MIME dan ukuran file.
- Nomor telepon dinormalisasi.
- Footer nota memiliki batas karakter.
- HTML dan script tidak diterima pada text field.

## Audit Sensitivity

Perubahan berikut dianggap sensitif:

- Nama bisnis.
- Zona waktu.
- Identitas nota.
- Logo.
- Informasi kontak resmi.

## Exit Criteria

- Identitas organisasi tersimpan dan ditampilkan konsisten.
- Zona waktu digunakan untuk tampilan Settings Center.
- Upload logo aman.
- Perubahan tercatat dalam audit log.
- Nilai default aman tersedia untuk organisasi lama.

---

# Settings Center V1-C — Notification Settings

## Objective

Memindahkan threshold dan preference Notification Center ke UI terkelola.

## Organization Rules

### Transaction

- Threshold transaksi bernilai besar.
- Aktif/nonaktif notifikasi transaksi normal.
- Aktif/nonaktif notifikasi split payment.
- Aktif/nonaktif notifikasi recovery.

### Operational Thresholds

- Cash variance warning.
- Cash variance critical.
- Shift overdue.
- Reconciliation overdue.
- Return inspection overdue.
- Hardware offline threshold.

### Lifecycle

- Auto-resolve success.
- Auto-resolve info.
- Auto-resolve warning.
- Auto-archive resolved.
- Anti-spam window.
- Maintenance interval.

Nilai awal mengikuti default Notification Center V1-F:

```text
Success auto-resolve: 7 hari
Info auto-resolve: 14 hari
Warning auto-resolve: 30 hari
Resolved auto-archive: 30 hari
Anti-spam window: 15 menit
Maintenance interval: 5 menit
```

## User Preferences

- Transaksi berhasil.
- Transaksi bernilai besar.
- Keuangan.
- Retur dan inventory.
- Shift dan kas.
- Hardware.
- Hasil approval.
- Bunyi notification.
- Bunyi transaksi normal.
- Bunyi critical alert.

## Mandatory Notifications

Kategori berikut tidak boleh dimatikan sepenuhnya oleh user biasa:

- Security alert.
- Refund execution failure.
- Settlement mismatch critical.
- Backup failure.
- Storage failure.
- Critical cash variance.

## Implementation Notes

- Event producer membaca setting melalui service terpusat.
- Hindari query setting berulang dalam satu request.
- Tambahkan cache dengan invalidasi setelah save.
- Default setting harus tetap bekerja sebelum user melakukan konfigurasi.
- Environment variable V1-F tetap menjadi fallback sementara selama migrasi.

## Exit Criteria

- Threshold transaksi besar dapat diubah dari UI.
- Notification preferences berbeda per user.
- Mandatory critical notification tetap dikirim.
- V1-F maintenance membaca setting organisasi.
- Perubahan preference segera memengaruhi delivery baru.
- Histori notification lama tidak berubah.

---

# Settings Center V1-D — Security & Session

## Objective

Memberikan kontrol keamanan dan sesi yang layak untuk penggunaan production.

## Session Policy

- Durasi sesi login.
- Idle timeout.
- Absolute session lifetime.
- Remember device policy.
- Session refresh policy.

## Login Protection

- Maksimum login gagal.
- Account lock duration.
- Reset failed login counter.
- Alert login gagal berulang.
- Optional delay setelah kegagalan berulang.

## Active Sessions

- Daftar sesi aktif.
- Device/browser summary.
- IP terakhir.
- Waktu login.
- Aktivitas terakhir.
- Logout satu sesi.
- Logout seluruh sesi user.
- Force logout seluruh organisasi.

## Sensitive Action Re-authentication

Re-authentication diwajibkan untuk:

- Mengubah role/permission.
- Menonaktifkan user.
- Mengubah security settings.
- Mengubah storage credential.
- Mengubah backup destination.
- Menjalankan backup manual.
- Memulai restore.
- Mengubah payment integration credential.

## Password Policy

- Panjang minimum.
- Batas maksimum yang aman.
- Proteksi common password.
- Password confirmation untuk tindakan sensitif.
- Optional password expiration hanya bila benar-benar dibutuhkan.

## Security Boundaries

- Manager tidak dapat mengubah Security & Session.
- Hanya Owner dan System Administrator.
- Tidak boleh menurunkan setting di bawah batas minimum aplikasi.
- Seluruh perubahan menghasilkan audit event critical.
- Secret/token session tidak pernah ditampilkan.

## Exit Criteria

- Idle logout bekerja.
- Force logout memutus sesi yang ditargetkan.
- Login lockout dapat diuji.
- Re-authentication bekerja untuk aksi sensitif.
- Session list tidak membuka token.
- Security settings terlindungi permission.
- Semua perubahan memiliki audit trail.

---

# Settings Center V1-E — Cloud Storage

## Objective

Menyediakan private cloud storage untuk file operasional production.

## Storage Use Cases

- Payment evidence.
- Settlement import source.
- Foto retur/damaged.
- Logo organisasi.
- Export laporan.
- Dokumen operasional.
- Backup artifact sementara.

## Architecture

Gunakan abstraction:

```text
StorageProvider
├── LocalStorageProvider
└── S3CompatibleStorageProvider
```

Business module tidak boleh bergantung langsung pada SDK provider tertentu.

## Provider Compatibility

Target awal:

- AWS S3.
- Cloudflare R2.
- MinIO.
- S3-compatible provider lainnya.

Provider spesifik dapat ditambahkan melalui adapter.

## Configuration

- Provider type.
- Endpoint.
- Region.
- Bucket.
- Access key.
- Secret key.
- Path prefix.
- Force path style bila diperlukan.
- Encryption mode.
- Connection status.
- Last tested at.

## Security

- Private-by-default.
- Tidak ada public bucket requirement.
- Protected download route atau signed URL berumur pendek.
- Organization path isolation.
- Outlet-aware authorization.
- MIME validation.
- File size validation.
- Randomized object key.
- Filename sanitization.
- Secret encrypted at rest atau berasal dari secret manager.
- Secret tidak dikirim kembali ke browser.
- Secret tidak masuk log/audit.

## Test Connection Workflow

```text
Validate configuration
→ upload test object
→ read test object
→ verify checksum/content
→ delete test object
→ store connection status
```

Test connection tidak boleh meninggalkan test object.

## Migration Strategy

- Local storage tetap tersedia untuk development.
- File lama tidak langsung dipindahkan tanpa migration job.
- Tambahkan migration plan local-to-cloud.
- Sediakan dry run.
- Sediakan checksum verification.
- Jangan menghapus file lokal sebelum upload diverifikasi.

## Exit Criteria

- Test connection berhasil.
- Upload/read/delete test object berhasil.
- File baru dapat disimpan ke cloud.
- Download membutuhkan authorization.
- Cross-organization access ditolak.
- Credential tersimpan aman.
- Local provider tetap berfungsi pada development.
- Failure menghasilkan notification critical.

---

# Settings Center V1-F — Backup Destination

## Objective

Menyimpan backup database di lokasi terpisah dari server aplikasi.

## Dependency

Tahap ini bergantung pada:

```text
Settings Center V1-E — Cloud Storage
```

Backup destination menggunakan storage abstraction yang sama, tetapi konfigurasi dan prefix terpisah.

## Backup Lifecycle

```text
Create database dump
→ compute checksum
→ encrypt backup
→ upload
→ verify remote object
→ persist backup record
→ apply retention
→ notification
```

## Backup Metadata

Simpan:

- Backup ID.
- Started at.
- Completed at.
- Trigger type.
- Triggered by.
- Database name.
- File size.
- Checksum.
- Encryption status.
- Destination.
- Object key.
- Status.
- Failure reason.
- Verification status.

## Backup Settings

- Destination provider.
- Prefix/folder.
- Schedule.
- Retention harian.
- Retention mingguan.
- Retention bulanan.
- Encryption required.
- Notification recipients.
- Backup timeout.
- Maximum retained size.

## Manual Backup

Tombol:

```text
Backup sekarang
```

harus memerlukan:

- Permission.
- Re-authentication.
- Confirmation.
- Audit log.

Request UI tidak boleh menunggu proses dump sampai selesai. Gunakan background job.

## Restore Safety

Restore tidak menjadi fitur biasa pada V1-F.

Minimal yang disediakan:

- Download backup yang berizin.
- Verify checksum.
- Dokumentasi restore.
- Restore drill ke database disposable.

Ketika restore UI dikembangkan nanti:

- Wajib re-authentication.
- Wajib maintenance mode.
- Wajib backup pre-restore.
- Wajib konfirmasi berlapis.
- Tidak boleh restore langsung melalui request browser biasa.

## Retention

Contoh default:

```text
Daily: 7
Weekly: 4
Monthly: 3
```

Retention hanya menghapus backup setelah:

- Backup baru sudah verified.
- Minimum safe backup count tetap tersedia.
- Delete remote object berhasil.
- Delete action tercatat.

## Notification Events

- Backup berhasil.
- Backup gagal.
- Verifikasi checksum gagal.
- Upload gagal.
- Retention gagal.
- Backup overdue.

Backup failure harus critical dan tidak dapat dimute oleh user biasa.

## Exit Criteria

- Backup manual berhasil.
- Backup terjadwal dapat dijalankan.
- File terenkripsi sebelum upload.
- Checksum diverifikasi.
- Backup tersimpan di destination terpisah.
- Failure masuk Notification Center.
- Retention dapat diuji.
- Restore drill disposable terdokumentasi dan berhasil.

---

# Settings Center V1-G — Telegram Delivery

## Objective

Menjadikan Telegram sebagai delivery channel pertama untuk event Notification Center.

## Dependency

- Notification Center V1-F selesai.
- Settings Center foundation selesai.
- Security settings tersedia.
- Background job/retry mechanism tersedia.

## Architecture

Telegram tidak membuat business event baru.

```text
Notification Event
→ Notification Recipient
→ Delivery Rule
→ Telegram Delivery Job
→ Delivery Attempt
```

In-app notification tetap menjadi source of truth.

## Configuration

- Bot token.
- Bot username.
- Chat/group ID.
- Enabled status.
- Minimum severity.
- Category allowlist.
- Quiet hours.
- Test message.
- Last delivery status.
- Last error.

Bot token:

- Tidak ditampilkan kembali.
- Tidak masuk log.
- Tidak masuk audit sebagai plaintext.
- Memerlukan re-authentication saat diganti.

## Default Delivery Policy

```text
Transaksi normal: Tidak
Transaksi besar: Opsional
Settlement mismatch: Ya
Refund gagal: Ya
Cash variance critical: Ya
Hardware offline: Ya
Backup gagal: Ya
Storage gagal: Ya
Security alert: Ya
```

## Delivery Reliability

- Background job.
- Retry dengan exponential backoff.
- Idempotency key.
- Delivery attempt log.
- Rate limit handling.
- Anti-spam aggregation.
- Dead-letter status.
- Manual retry untuk admin.

## Quiet Hours

Critical alert dapat melewati quiet hours.

Info/warning biasa:

- Ditahan.
- Dikirim setelah quiet hours, atau
- Diringkas menjadi digest.

## Exit Criteria

- Test message berhasil.
- Critical notification terkirim.
- Event yang sama tidak dikirim dua kali.
- Failure dan retry tercatat.
- Bot token aman.
- Quiet hours bekerja.
- In-app notification tetap berfungsi ketika Telegram gagal.

---

# Held Integrations

## Midtrans — ON HOLD

Dilanjutkan hanya setelah roadmap payment production diaktifkan kembali:

```text
P1-D Automated Payment & Concurrency Tests
→ P2-A Midtrans Foundation
→ P2-B Webhook & Recovery
→ P2-C Refund & Reconciliation
→ Production Readiness Review
```

Jangan menambahkan credential production sebelum payment roadmap dilanjutkan.

## WhatsApp — ON HOLD

Hal yang perlu diputuskan nanti:

- Provider resmi.
- Template message.
- Opt-in.
- Delivery cost.
- Rate limit.
- Privacy.
- Customer vs internal messaging.

## Email — ON HOLD

Hal yang perlu diputuskan nanti:

- Provider SMTP/API.
- Domain authentication.
- Retry.
- Bounce handling.
- Template.
- Digest.
- Security alert delivery.

Pada Settings Center, ketiga integrasi ini dapat:

- Disembunyikan, atau
- Ditampilkan sebagai `Belum tersedia`

Jangan tampilkan form konfigurasi palsu yang belum berfungsi.

---

# Cross-Cutting Requirements

## Permission

Setiap server action harus memeriksa permission dan scope.

UI visibility bukan authorization.

## Validation

- Server-side validation wajib.
- Client validation hanya untuk UX.
- Nilai numeric memiliki minimum dan maksimum.
- URL/endpoint tervalidasi.
- Secret tidak pernah diterima melalui query parameter.

## Audit

Setiap perubahan setting sensitif wajib tercatat.

## Concurrency

Gunakan optimistic locking atau version field untuk mencegah silent overwrite saat dua admin mengubah setting bersamaan.

## Cache

- Settings boleh dicache.
- Cache harus scoped per organization/user.
- Cache harus diinvalidasi setelah perubahan.
- Critical security settings tidak boleh stale terlalu lama.

## Migration

- Semua schema change memakai migration baru.
- Jangan mengedit migration yang sudah diterapkan.
- Jalankan preflight.
- Uji migration dari database kosong/disposable.
- Tidak perlu membuat database development baru untuk setiap fitur.
- `db:seed` hanya untuk database baru atau reset yang disengaja.

## Secret Management

Prioritas:

```text
Secret manager / environment
→ encrypted database value bila benar-benar diperlukan
```

Jangan menyimpan secret plaintext tanpa encryption.

## Notification

Storage, backup, dan security harus menghasilkan event Notification Center.

## Failure Handling

Kegagalan integrasi tidak boleh merusak transaksi utama.

Contoh:

```text
Upload notification gagal
≠
Transaksi POS dibatalkan
```

Namun kegagalan menyimpan evidence yang diwajibkan harus mengikuti aturan business transaction terkait.

---

# Suggested Route Structure

```text
src/app/(admin)/admin/pengaturan/page.tsx
src/components/settings/settings-center.tsx
src/components/settings/settings-navigation.tsx
src/components/settings/general-settings-form.tsx
src/components/settings/payment-profile-settings.tsx
src/components/settings/notification-settings-form.tsx
src/components/settings/security-settings-form.tsx
src/components/settings/integration-settings.tsx
```

Feature modules:

```text
src/features/settings/
src/features/security/
src/features/storage/
src/features/backups/
src/features/telegram/
```

Server actions:

```text
src/app/actions/settings.ts
src/app/actions/security-settings.ts
src/app/actions/storage-settings.ts
src/app/actions/backup-settings.ts
src/app/actions/telegram-settings.ts
```

Struktur akhir harus mengikuti pola project aktual ketika implementasi dimulai.

---

# Recommended Quality Gates

Setiap tahap minimal menjalankan:

```bash
npm run typecheck
npm run lint
npm run routes:check
npm run build
```

Jika ada perubahan database:

```bash
npm run db:preflight:<stage>
npm run db:generate
npm run db:migrate
npm run check:settings:<stage>
```

Jika menyangkut storage atau backup:

```bash
npm run test:storage
npm run test:backup
```

Jika menyangkut security/session:

```bash
npm run test:security
npm run test:sessions
```

---

# Resume Checklist

Ketika pengembangan Settings Center dimulai:

1. Pastikan branch dan migration history bersih.
2. Backup database development.
3. Jalankan seluruh existing check.
4. Mulai dari V1-A.
5. Jangan mengubah business logic Profile Pembayaran saat memindahkan layout.
6. Tetapkan permission per section.
7. Tetapkan scope setiap setting.
8. Audit perubahan sensitif.
9. Jangan mulai Backup Destination sebelum Cloud Storage stabil.
10. Jangan mulai Telegram sebelum delivery job dan secret handling siap.
11. Midtrans, WhatsApp, dan Email tetap hold sampai roadmap masing-masing diaktifkan.

---

# Definition of Done

Settings Center roadmap dianggap selesai ketika:

- Semua section utama tersedia dalam `/admin/pengaturan`.
- Navbar tetap hanya memiliki satu menu Pengaturan.
- Profile Pembayaran tetap stabil.
- Pengaturan umum aktif.
- Notification settings aktif.
- Security & Session aktif.
- Cloud Storage aktif.
- Backup Destination aktif dan telah melalui restore drill.
- Telegram delivery aktif.
- Midtrans, WhatsApp, dan Email tetap ditandai hold tanpa konfigurasi palsu.
- Permission, audit, secret handling, dan failure notification telah diuji.
