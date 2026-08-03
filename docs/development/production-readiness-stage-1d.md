# ASIHJAYA FINISHING — Roadmap Tahap 1D

## Production Readiness & Deployment Foundation

**Project:** ASIHJAYA FINISHING RMS + POS  
**Target produksi:** Ubuntu 24.04 LTS, Docker, 2 vCPU, 4 GB RAM, 100 GB storage, region Jakarta  
**Domain:** `ajsystem.id` melalui Cloudflare  
**Strategi branch:** satu branch untuk seluruh Tahap 1D  
**Branch yang disarankan:** `infra/production-readiness-stage-1d`

---

## Tujuan Tahap 1D

Tahap 1D menyiapkan aplikasi agar aman dan dapat dioperasikan di lingkungan produksi. Fokusnya bukan menambah fitur bisnis atau mengubah UI/UX, melainkan memastikan bahwa aplikasi:

- dapat dibangun dan dijalankan secara konsisten;
- gagal dengan aman ketika konfigurasi atau dependency tidak siap;
- memiliki proses migration yang terkendali;
- memiliki backup yang dapat dipulihkan;
- dapat di-deploy dan di-rollback dengan prosedur yang jelas;
- memiliki logging, health check, dan monitoring dasar;
- dapat dioperasikan pada VPS target dengan resource terbatas;
- memiliki dokumentasi operasional dan disaster-recovery yang dapat diikuti.

---

## Prinsip Pelaksanaan

1. Seluruh perubahan dibuat pada branch `infra/production-readiness-stage-1d`.
2. Setiap sub-tahap memiliki satu commit checkpoint yang terpisah.
3. Perubahan infrastruktur tidak boleh diselipkan bersama perubahan fitur bisnis.
4. Data transaksi production tidak digunakan selama tahap awal pengujian.
5. Backup belum dianggap selesai sebelum restore berhasil diuji.
6. Deployment belum dianggap selesai sebelum rollback berhasil diuji.
7. Environment production harus fail-fast apabila secret atau konfigurasi wajib tidak tersedia.
8. Satu Pull Request dibuat ke `main` setelah seluruh Tahap 1D selesai dan tervalidasi.

---

## Ringkasan Tahapan

| Tahap | Fokus                           | Lokasi utama pengujian | Output utama                                | Status |
| ----- | ------------------------------- | ---------------------- | ------------------------------------------- | ------ |
| 1D.1  | Production container foundation | Lokal                  | Image dan Compose production                | (DONE) |
| 1D.2  | Environment dan secrets         | Lokal                  | Template, validator, dan secret policy      | (DONE) |
| 1D.3  | Migration safety                | Lokal                  | Migration runner yang aman                  | (DONE) |
| 1D.4  | Backup dan restore              | Lokal                  | Backup, retention, dan restore rehearsal    |
| 1D.5  | Reverse proxy dan Cloudflare    | VPS                    | HTTPS, proxy, firewall, origin protection   |
| 1D.6  | Logging dan monitoring          | Lokal + VPS            | Log rotation, health, dan monitoring ringan |
| 1D.7  | Deployment dan rollback         | VPS                    | Script deploy dan rollback teruji           |
| 1D.8  | Production rehearsal            | VPS                    | Simulasi operasional dan runbook final      |

---

# 1D.1 — Production Container Foundation (DONE)

## Tujuan

Menyediakan image dan Docker Compose production yang konsisten, lebih ramping, aman, dan sesuai dengan kapasitas VPS 2 vCPU serta RAM 4 GB.

## Ruang lingkup

- Meninjau Dockerfile production saat ini.
- Memisahkan kebutuhan development, test, build, migration, dan runtime.
- Menggunakan multi-stage build.
- Menjalankan aplikasi sebagai user non-root.
- Memastikan hanya artifact runtime yang masuk ke image akhir.
- Menentukan apakah dependency Playwright perlu berada di image aplikasi utama atau dipisahkan.
- Menambahkan health check aplikasi.
- Menambahkan readiness check database bila diperlukan.
- Menambahkan restart policy.
- Menambahkan resource limit dan reservation yang realistis.
- Menetapkan volume persistent untuk data yang memang harus bertahan.
- Menambahkan log rotation pada service Docker.
- Membuat Compose khusus production yang tidak bergantung pada konfigurasi development.
- Memastikan secret tidak tersalin ke image.

## Deliverable yang diharapkan

- `Dockerfile` atau Dockerfile production yang diperbarui.
- Compose production, misalnya `compose.production.yml`.
- Health-check endpoint atau script health check.
- `.dockerignore` yang aman dan efisien.
- Dokumentasi cara build dan menjalankan production stack secara lokal.
- Quality check untuk memastikan baseline container tidak berubah tanpa sengaja.

## Validasi lokal

- Clean image build berhasil.
- Container berjalan sebagai non-root.
- Health check berubah menjadi healthy.
- Container restart otomatis setelah dihentikan secara tidak normal.
- Aplikasi gagal start ketika environment wajib tidak tersedia.
- Aplikasi dapat berkomunikasi dengan PostgreSQL container.
- Tidak ada `.env`, credential, backup, atau source yang tidak diperlukan di image runtime.
- Batas memory dan CPU tidak menyebabkan aplikasi gagal pada smoke test dasar.

## Exit criteria

- Image production dapat dibangun ulang secara deterministik.
- Compose production dapat start dan stop tanpa langkah manual tambahan.
- Health check dapat membedakan aplikasi sehat dan tidak sehat.
- Runtime tidak berjalan sebagai root.
- Konfigurasi container terdokumentasi.

## Commit checkpoint

```text
infra: add production container foundation
```

---

# 1D.2 — Environment & Secret Management (DONE)

## Tujuan

Memastikan seluruh konfigurasi production tervalidasi, terdokumentasi, tidak bocor ke Git atau image, dan dapat dirotasi secara aman.

## Ruang lingkup

- Membuat `.env.production.example` tanpa nilai secret asli.
- Mengelompokkan variable berdasarkan domain:
  - aplikasi;
  - database;
  - authentication/session;
  - object storage;
  - Hardware Hub;
  - receipt/printing;
  - observability;
  - reverse proxy dan deployment.
- Memastikan validator environment production dijalankan saat startup.
- Membedakan variable wajib, opsional, dan memiliki default aman.
- Menentukan minimum length dan format secret.
- Menambahkan generator secret lokal.
- Menentukan lokasi penyimpanan `.env.production` di VPS.
- Menetapkan file permission yang aman.
- Mencegah environment production masuk ke Git, build context, log, dan artifact CI.
- Menyusun prosedur rotasi secret.
- Menyusun prosedur penggantian credential database dan storage.

## Deliverable yang diharapkan

- `.env.production.example`.
- Environment validator yang mencakup semua variable production.
- Secret-generation script.
- Dokumentasi konfigurasi dan rotasi secret.
- Quality check untuk mendeteksi variable penting yang belum terdokumentasi.

## Validasi lokal

- Startup gagal dengan pesan jelas ketika variable wajib kosong.
- Nilai placeholder atau contoh tidak diterima sebagai secret production.
- Secret tidak muncul di output build atau log.
- Generator menghasilkan nilai dengan entropy dan format yang sesuai.
- `.env.production` ter-ignore oleh Git dan Docker build context.

## Exit criteria

- Semua variable production tercatat dalam template.
- Tidak ada secret asli pada repository.
- Environment invalid menyebabkan fail-fast.
- Prosedur rotasi secret tersedia.

## Commit checkpoint

```text
infra: harden production environment and secrets
```

---

# 1D.3 — Database Deployment & Migration Safety

## Tujuan

Membuat migration production dapat dijalankan secara konsisten, satu kali, terkontrol, dan berhenti dengan aman ketika terjadi kegagalan.

## Ruang lingkup

- Menambahkan database readiness check.
- Menambahkan preflight sebelum migration.
- Menjalankan migration sebagai job atau command terpisah dari application runtime.
- Mencegah dua deployment menjalankan migration bersamaan.
- Menggunakan advisory lock atau mekanisme locking yang sesuai.
- Menetapkan timeout dan retry untuk database readiness.
- Menghentikan deployment ketika migration gagal.
- Mendeteksi migration yang berpotensi destructive.
- Menambahkan backup otomatis sebelum migration production.
- Menentukan aturan expand-and-contract untuk perubahan schema yang tidak backward-compatible.
- Menyusun strategi rollback aplikasi ketika schema sudah berubah.
- Mendokumentasikan kapan rollback database diperbolehkan dan kapan harus memakai forward fix.

## Deliverable yang diharapkan

- Migration runner production.
- Database wait/readiness script.
- Migration locking mechanism.
- Pre-deployment database checks.
- Dokumentasi migration policy.
- Quality check atau guard untuk migration berisiko tinggi.

## Validasi lokal

- Migration berjalan pada PostgreSQL disposable.
- Dua migration runner bersamaan tidak menjalankan migration secara ganda.
- Deployment berhenti ketika database tidak siap.
- Deployment berhenti ketika migration gagal.
- Aplikasi tidak menggunakan schema yang belum siap.
- Backup pre-migration dipanggil ketika mode production aktif.

## Exit criteria

- Migration hanya berjalan satu kali untuk satu deployment.
- Kegagalan migration tidak dilanjutkan menjadi restart aplikasi yang tidak sehat.
- Prosedur migration dan rollback terdokumentasi.

## Commit checkpoint

```text
infra: add safe production migration workflow
```

---

# 1D.4 — PostgreSQL Backup, Retention & Restore

## Tujuan

Melindungi data transaksi dengan backup terjadwal yang memiliki checksum, retention, verifikasi, dan prosedur restore yang sudah dibuktikan.

## Ruang lingkup

- Membuat script backup PostgreSQL menggunakan format yang sesuai.
- Memberi nama backup dengan timestamp dan identitas environment.
- Menggunakan compression.
- Membuat checksum.
- Menyimpan metadata backup:
  - waktu dibuat;
  - database sumber;
  - versi PostgreSQL;
  - ukuran;
  - checksum;
  - status verifikasi.
- Menentukan retention harian dan mingguan.
- Menghapus backup lama secara aman.
- Menambahkan backup sebelum deployment dan migration.
- Membuat restore script yang menolak target berbahaya secara default.
- Menambahkan disposable restore rehearsal.
- Memverifikasi schema dan data kritis setelah restore.
- Menyusun opsi penyimpanan backup di luar VPS.
- Menambahkan pemeriksaan kapasitas disk sebelum backup.
- Menambahkan proteksi agar password tidak tampil pada command history atau log.

## Contoh kebijakan retention awal

- Backup harian: 7 hari.
- Backup mingguan: 4 minggu.
- Backup sebelum deployment: sejumlah release terakhir.
- Backup off-site: minimal satu salinan terpisah dari VPS produksi.

Kebijakan final dapat disesuaikan setelah ukuran database aktual diketahui.

## Deliverable yang diharapkan

- Script backup.
- Script checksum dan verification.
- Script retention cleanup.
- Script restore.
- Script restore rehearsal dengan PostgreSQL disposable.
- Dokumentasi disaster recovery.

## Validasi lokal

- Backup berhasil dibuat.
- Checksum valid.
- Backup dapat dipulihkan ke database kosong.
- Tabel dan constraint kritis tersedia setelah restore.
- Data dummy transaksi dapat dibaca kembali.
- Backup rusak ditolak.
- Retention tidak menghapus backup terbaru atau backup yang dilindungi.

## Exit criteria

- Backup dapat dibuat tanpa langkah manual.
- Restore rehearsal berhasil.
- Checksum dan metadata tersedia.
- Retention policy berjalan aman.
- Prosedur recovery terdokumentasi.

## Commit checkpoint

```text
infra: add verified PostgreSQL backup and restore
```

---

# 1D.5 — Reverse Proxy, Domain & Cloudflare

## Prasyarat

Tahap ini mulai membutuhkan VPS dan akses ke DNS Cloudflare untuk `ajsystem.id`.

## Tujuan

Menyediakan akses HTTPS yang aman, origin yang terlindungi, proxy header yang benar, serta konfigurasi jaringan yang sesuai untuk aplikasi produksi.

## Ruang lingkup

- Memilih reverse proxy yang sesuai dengan resource VPS.
- Menghubungkan `ajsystem.id` atau subdomain aplikasi ke VPS.
- Mengatur DNS Cloudflare.
- Mengatur mode SSL yang aman.
- Menyiapkan origin certificate bila digunakan.
- Membatasi akses langsung ke origin bila memungkinkan.
- Mengatur firewall VPS.
- Memastikan trusted proxy dan forwarded headers benar.
- Menetapkan upload body limit.
- Menetapkan proxy timeout untuk upload, import, receipt, dan proses lain yang relevan.
- Menambahkan security headers.
- Menambahkan rate limit untuk endpoint sensitif.
- Mencegah health endpoint membocorkan informasi internal.
- Menetapkan redirect HTTP ke HTTPS.
- Memastikan WebSocket atau streaming tetap bekerja bila digunakan.

## Deliverable yang diharapkan

- Konfigurasi reverse proxy.
- Konfigurasi firewall dasar.
- Dokumentasi DNS dan SSL Cloudflare.
- Health endpoint melalui HTTPS.
- Checklist origin protection.

## Validasi VPS

- Domain mengarah ke server yang benar.
- HTTPS valid dari jaringan publik.
- HTTP dialihkan ke HTTPS.
- Request host dan IP forwarding terbaca benar.
- Akses langsung ke port aplikasi tidak terbuka ke publik.
- Upload dan receipt bekerja melalui proxy.
- Security header terpasang.
- Rate limit tidak mengganggu alur normal kasir.

## Exit criteria

- Aplikasi hanya diakses melalui endpoint HTTPS resmi.
- Origin tidak mengekspos service internal.
- Proxy dan timeout cocok untuk seluruh alur penting.
- Dokumentasi Cloudflare dan firewall tersedia.

## Commit checkpoint

```text
infra: add reverse proxy and Cloudflare foundation
```

---

# 1D.6 — Logging, Health & Lightweight Monitoring

## Tujuan

Memberikan visibilitas operasional tanpa memasang observability stack yang terlalu berat untuk VPS 4 GB.

## Ruang lingkup

- Menentukan format log aplikasi.
- Memastikan request ID atau correlation ID tersedia bila dibutuhkan.
- Menghindari secret dan data sensitif masuk log.
- Menambahkan Docker log rotation.
- Menambahkan health check aplikasi.
- Menambahkan health check PostgreSQL.
- Memantau status container.
- Memantau CPU, RAM, disk, dan inode.
- Memantau umur backup terakhir.
- Memantau kegagalan backup.
- Memantau container restart loop.
- Menambahkan disk-space threshold.
- Menyediakan command diagnosis cepat.
- Menyiapkan alert ringan atau laporan status sesuai kebutuhan.
- Menambahkan log cleanup dan retention.

## Deliverable yang diharapkan

- Konfigurasi log rotation.
- Health/status script.
- Monitoring script atau service ringan.
- Backup-age check.
- Disk-space check.
- Troubleshooting guide.

## Validasi lokal dan VPS

- Log tidak tumbuh tanpa batas.
- Secret tidak muncul pada log.
- Health check gagal ketika aplikasi atau database tidak tersedia.
- Disk warning muncul pada threshold uji.
- Backup warning muncul ketika backup terlalu lama.
- Restart loop dapat terdeteksi.
- Monitoring tidak menghabiskan resource secara berlebihan.

## Exit criteria

- Operator dapat mengetahui status aplikasi, database, disk, dan backup.
- Log memiliki retention yang jelas.
- Kondisi kritis dasar dapat terdeteksi sebelum menjadi outage besar.

## Commit checkpoint

```text
infra: add production logging and lightweight monitoring
```

---

# 1D.7 — Deployment & Rollback Automation

## Prasyarat

- Container production stabil.
- Environment production tersedia.
- Migration workflow aman.
- Backup dan restore sudah diuji.
- Reverse proxy tersedia di VPS.

## Tujuan

Membuat proses deploy dan rollback konsisten, dapat diaudit, dan tidak bergantung pada urutan command manual.

## Alur deployment target

```text
preflight
→ cek disk dan environment
→ backup database
→ pull atau siapkan release
→ build image
→ jalankan migration
→ start/restart service
→ tunggu health check
→ jalankan smoke test
→ tandai release berhasil
```

## Alur rollback target

```text
pilih image/release sebelumnya
→ hentikan release gagal
→ jalankan image sebelumnya
→ tunggu health check
→ jalankan smoke test
→ catat rollback
```

Rollback database tidak dilakukan otomatis kecuali prosedurnya sudah dinyatakan aman. Untuk migration yang tidak backward-compatible, strategi release harus memakai expand-and-contract atau forward fix.

## Ruang lingkup

- Membuat deployment script fail-fast.
- Menambahkan release identifier.
- Menyimpan image sebelumnya.
- Menambahkan deployment lock.
- Menambahkan pre-deployment backup.
- Menjalankan migration hanya melalui workflow resmi.
- Menunggu health check dengan timeout.
- Menjalankan smoke test otomatis.
- Menambahkan rollback image.
- Mencatat deployment log.
- Menambahkan dry-run mode bila memungkinkan.
- Menentukan aturan manual approval untuk production.

## Deliverable yang diharapkan

- Deployment script.
- Rollback script.
- Release metadata.
- Deployment lock.
- Health verification script.
- Smoke-test script.
- Deployment runbook.

## Validasi VPS

- Deployment release baru berhasil.
- Deployment dihentikan ketika backup gagal.
- Deployment dihentikan ketika migration gagal.
- Deployment dihentikan ketika health check gagal.
- Image sebelumnya dapat dijalankan kembali.
- Dua deployment bersamaan ditolak.
- Release dan rollback tercatat.

## Exit criteria

- Deployment dapat dijalankan dengan satu workflow resmi.
- Rollback aplikasi berhasil diuji.
- Kegagalan tidak meninggalkan service dalam kondisi ambigu.
- Operator memiliki runbook yang jelas.

## Commit checkpoint

```text
infra: automate production deployment and rollback
```

---

# 1D.8 — Production Rehearsal & Operational Runbook

## Tujuan

Menguji seluruh fondasi dalam kondisi yang menyerupai operasi nyata sebelum data transaksi production digunakan.

## Skenario rehearsal

### Container dan host

- Restart container aplikasi.
- Restart PostgreSQL container.
- Restart Docker daemon.
- Restart VPS.
- Pastikan seluruh service kembali dalam urutan yang benar.

### Database

- PostgreSQL belum siap saat aplikasi start.
- Migration gagal.
- Migration runner dijalankan bersamaan.
- Backup sebelum deployment gagal.
- Restore backup ke database disposable.

### Deployment

- Build image gagal.
- Health check release baru gagal.
- Smoke test release baru gagal.
- Rollback ke image sebelumnya.
- Deployment lock tertinggal setelah proses abnormal.

### Resource

- Disk mendekati penuh.
- Log tumbuh cepat.
- Backup storage tidak cukup.
- Memory mendekati batas.
- Container restart loop.

### Network dan domain

- DNS belum propagasi.
- Reverse proxy tidak dapat menjangkau aplikasi.
- HTTPS atau origin certificate bermasalah.
- Cloudflare proxy dinonaktifkan sementara untuk diagnosis.

### Fitur operasional

- Login dan authorization.
- Buka shift.
- Scan atau cari produk.
- Tambah dan hapus cart.
- Customer dan held cart.
- Diskon dan approval.
- Checkout Cash.
- Checkout EDC.
- Dana Titip.
- Receipt dan print queue.
- Recovery checkout setelah refresh atau koneksi terputus.
- Tutup shift.

## Deliverable yang diharapkan

- Production runbook final.
- Deployment checklist.
- Rollback checklist.
- Backup/restore checklist.
- Incident-response checklist.
- Daftar contact dan ownership operasional.
- Known limitations.
- Hasil rehearsal dan bukti validasi.
- Final production readiness command atau checklist.

## Exit criteria

- Seluruh skenario kritis diuji atau diberi mitigasi tertulis.
- Backup dan restore rehearsal berhasil.
- Deployment dan rollback rehearsal berhasil.
- Restart VPS tidak menyebabkan kehilangan konfigurasi atau volume.
- Domain dan HTTPS bekerja.
- Smoke test bisnis berhasil.
- Runbook dapat diikuti tanpa bergantung pada ingatan developer.

## Commit checkpoint

```text
chore: finalize production readiness rehearsal and runbook
```

---

# Urutan Pelaksanaan yang Direkomendasikan

```text
1D.1 Production container foundation            [Lokal] (DONE)
  ↓
1D.2 Environment dan secrets                    [Lokal] (DONE)
  ↓
1D.3 Migration safety                           [Lokal] (DONE)
  ↓
1D.4 Backup dan restore                         [Lokal]
  ↓
Siapkan VPS Ubuntu 24.04
  ↓
1D.5 Reverse proxy dan Cloudflare               [VPS]
  ↓
1D.6 Logging dan monitoring                     [Lokal + VPS]
  ↓
1D.7 Deployment dan rollback                    [VPS]
  ↓
1D.8 Production rehearsal                       [VPS]
  ↓
Satu Pull Request ke main
```

---

# Checklist Status

## 1D.1 — Production Container Foundation (DONE)

- [+] Branch Tahap 1D dibuat.
- [+] Multi-stage production image siap.
- [+] Runtime non-root.
- [+] Production Compose siap.
- [+] Health check aktif.
- [+] Restart policy aktif.
- [+] Resource limit ditentukan.
- [+] Log rotation container aktif.
- [+] Local production smoke test berhasil.

## 1D.2 — Environment & Secrets (DONE)

- [+] `.env.production.example` siap.
- [+] Semua variable production terdokumentasi.
- [+] Validator production fail-fast.
- [+] Generator secret tersedia.
- [+] Secret tidak masuk Git atau image.
- [+] File-permission policy terdokumentasi.
- [+] Secret-rotation runbook tersedia.

## 1D.3 — Migration Safety (DONE)

- [+] Database readiness check tersedia.
- [+] Migration runner tersedia.
- [+] Migration lock tersedia.
- [+] Concurrent migration test berhasil.
- [+] Migration failure test berhasil.
- [+] Pre-migration backup terhubung.
- [+] Migration policy terdokumentasi.

## 1D.4 — Backup & Restore

- [ ] Backup script tersedia.
- [ ] Compression dan checksum aktif.
- [ ] Retention policy aktif.
- [ ] Restore script tersedia.
- [ ] Disposable restore rehearsal berhasil.
- [ ] Backup rusak ditolak.
- [ ] Off-site backup plan tersedia.
- [ ] Disaster-recovery runbook tersedia.

## 1D.5 — Reverse Proxy & Cloudflare

- [ ] VPS tersedia.
- [ ] DNS domain diarahkan.
- [ ] Reverse proxy aktif.
- [ ] HTTPS aktif.
- [ ] Origin protection diterapkan.
- [ ] Firewall diterapkan.
- [ ] Upload limit dan timeout sesuai.
- [ ] Security headers aktif.
- [ ] Public HTTPS smoke test berhasil.

## 1D.6 — Logging & Monitoring

- [ ] Application log policy siap.
- [ ] Docker log rotation aktif.
- [ ] Application health check aktif.
- [ ] Database health check aktif.
- [ ] Disk monitoring aktif.
- [ ] Backup-age monitoring aktif.
- [ ] Restart-loop detection tersedia.
- [ ] Troubleshooting guide tersedia.

## 1D.7 — Deployment & Rollback

- [ ] Deployment script tersedia.
- [ ] Deployment lock aktif.
- [ ] Pre-deployment backup aktif.
- [ ] Migration terintegrasi.
- [ ] Health verification terintegrasi.
- [ ] Smoke test terintegrasi.
- [ ] Rollback image berhasil diuji.
- [ ] Deployment runbook tersedia.

## 1D.8 — Production Rehearsal

- [ ] Restart container rehearsal berhasil.
- [ ] Restart Docker rehearsal berhasil.
- [ ] Restart VPS rehearsal berhasil.
- [ ] Migration failure rehearsal berhasil.
- [ ] Backup/restore rehearsal berhasil.
- [ ] Deployment failure rehearsal berhasil.
- [ ] Rollback rehearsal berhasil.
- [ ] Disk-pressure scenario ditinjau.
- [ ] Full POS smoke test berhasil.
- [ ] Production runbook final tersedia.

---

# Final Quality Gate Tahap 1D

Sebelum membuat Pull Request ke `main`, seluruh quality gate aplikasi harus tetap hijau:

```powershell
npm ci
npm run check:stabilization
npm run test:financial:local
npm run check:hardware-app
npm run build:clean
npm run typecheck
npm run lint
```

Tambahkan command khusus Tahap 1D ketika runner production-readiness sudah dibuat.

---

# Strategi Pull Request

Setelah 1D.1 sampai 1D.8 selesai:

```text
base: main
compare: infra/production-readiness-stage-1d
```

Judul yang disarankan:

```text
infra: establish production deployment and recovery foundation
```

Gunakan satu Pull Request akhir. Pertahankan commit per sub-tahap agar review dan rollback lebih mudah.

---

# Hasil Akhir yang Diharapkan

Setelah Tahap 1D selesai, ASIHJAYA FINISHING memiliki:

- image dan Compose production yang aman;
- environment dan secret policy yang jelas;
- migration deployment yang terkendali;
- backup yang dapat dipulihkan;
- akses HTTPS melalui domain resmi;
- logging dan monitoring dasar;
- deployment dan rollback otomatis;
- runbook operasional dan disaster recovery;
- baseline production yang siap menjadi fondasi penambahan fitur berikutnya.
