# PostgreSQL Backup, Retention, dan Restore

Tahap 1D.4 menetapkan jalur resmi untuk backup PostgreSQL 17, checksum, retention, dan restore rehearsal. Backup belum dianggap valid hanya karena `pg_dump` selesai; archive harus memiliki checksum, metadata, dapat dibaca `pg_restore`, dan berhasil dipulihkan ke database kosong.

## Prinsip keselamatan

- Backup memakai PostgreSQL custom format agar terkompresi dan dapat diverifikasi dengan `pg_restore --list`.
- Password tidak diteruskan melalui command line. Script menjalankan `pg_dump`, `psql`, dan `pg_restore` di dalam service database Compose yang sudah memiliki environment sendiri.
- Archive dibuat sebagai file `.partial` lalu di-rename atomik setelah dump, checksum, dan metadata selesai.
- Restore selalu memverifikasi checksum sebelum membuat atau menghapus target database.
- Target database aktif ditolak secara default.
- Retention hanya menghapus pasangan artifact yang lengkap dan metadata-nya valid.
- Backup manual dan backup berflag `protected` tidak pernah dipangkas otomatis.
- Minimal satu salinan off-site tetap wajib sebelum production go-live. Backup pada disk VPS yang sama tidak cukup untuk disaster recovery.

## Artifact backup

Setiap backup terdiri dari tiga file dengan nama dasar yang sama:

```text
asihjaya-production-daily-20260803T050000Z-12345678.dump
asihjaya-production-daily-20260803T050000Z-12345678.sha256
asihjaya-production-daily-20260803T050000Z-12345678.json
```

Metadata JSON menyimpan:

- backup ID dan timestamp;
- environment, jenis, label, release ID, dan status protected;
- nama database sumber;
- versi PostgreSQL dan `pg_dump`;
- ukuran database dan archive;
- SHA-256;
- jumlah entry archive;
- jumlah migration;
- observasi row count sebelum dump dan constraint count tabel kritis;
- waktu verifikasi.

Direktori default:

```text
.data/backups/postgres
```

Direktori tersebut di-ignore Git dan tidak masuk Docker build context.

## Environment

```dotenv
DATABASE_BACKUP_ROOT=.data/backups/postgres
DATABASE_BACKUP_ENVIRONMENT=production
DATABASE_BACKUP_KIND=daily
DATABASE_BACKUP_COMPRESSION_LEVEL=6
DATABASE_BACKUP_MIN_FREE_BYTES=1073741824
DATABASE_BACKUP_FREE_SPACE_FACTOR=2
DATABASE_BACKUP_DAILY_RETENTION_DAYS=7
DATABASE_BACKUP_WEEKLY_RETENTION_WEEKS=4
DATABASE_BACKUP_PRE_DEPLOYMENT_RETENTION_COUNT=5
DATABASE_RESTORE_ALLOW_PRODUCTION=false
DATABASE_RESTORE_APPROVAL_REFERENCE=
```

Disk guard membutuhkan ruang tersedia sebesar:

```text
DATABASE_BACKUP_MIN_FREE_BYTES + database_size × DATABASE_BACKUP_FREE_SPACE_FACTOR
```

Nilai awal sengaja konservatif sampai ukuran database production diketahui.

## Command backup

Backup harian production sekaligus retention:

```powershell
npm run db:backup:production
```

Backup mingguan:

```powershell
npm run db:backup:weekly
```

Backup sebelum migration/deployment:

```powershell
npm run db:backup:pre-deployment
```

Pada bootstrap pertama, command ini hanya melewati backup ketika database benar-benar belum memiliki migration history **dan** belum memiliki tabel public. Database yang berisi tabel tanpa migration history tetap ditolak.

Backup manual yang dilindungi:

```powershell
npm run db:backup -- --env-file .env.production --kind manual --label before-maintenance --protect
```

Verifikasi ulang sebuah backup:

```powershell
npm run db:backup:verify -- --verify .data/backups/postgres/<backup>.json
```

Menjalankan retention tanpa membuat backup baru:

```powershell
npm run db:backup:prune
```

`db:deploy:production` sekarang menjalankan backup pre-deployment terlebih dahulu. Deployment automation penuh baru diselesaikan pada Tahap 1D.7, tetapi migration production manual tidak boleh melewati command resmi tersebut.

## Kebijakan retention awal

- `daily`: backup yang masih berumur maksimal 7 hari dipertahankan; backup terbaru tetap dipertahankan walaupun timestamp policy tidak biasa.
- `weekly`: backup yang masih berumur maksimal 4 minggu dipertahankan.
- `pre-deployment`: 5 backup terbaru dipertahankan.
- `manual`: tidak dihapus otomatis.
- `protected=true`: tidak dihapus otomatis.
- Metadata rusak atau pasangan artifact tidak lengkap: tidak dihapus otomatis dan dilaporkan sebagai `SKIP` agar operator memeriksanya.

Retention bukan pengganti off-site replication. Automation Backblaze B2 tersedia melalui Tahap 1D.4B dan didokumentasikan pada `database-backup-offsite.md`. Alert umur backup akan memakai status off-site pada Tahap 1D.6.

## Restore ke database baru

Baca `backupId` dari metadata JSON, lalu bangun token:

```text
RESTORE:<target_database>:<backupId>
```

Contoh:

```powershell
npm run db:restore:production -- `
  --backup .data/backups/postgres/<backup>.json `
  --target-database asihjaya_rms_restore_check `
  --confirm RESTORE:asihjaya_rms_restore_check:<backupId>
```

Jika target sudah ada, tambahkan `--replace-existing` hanya setelah target diperiksa. Script memakai database administratif `postgres`, memutus koneksi target, menghapus target, membuat database kosong, restore archive, lalu memverifikasi migration, tabel kritis, row count yang valid, dan constraint count. Row count pada metadata adalah observasi sebelum `pg_dump` dan tidak digunakan sebagai equality guard karena transaksi dapat berubah di antara observasi dan snapshot dump. Rehearsal disposable tetap memverifikasi invoice serta nominal pembayaran secara eksplisit.

## Restore database aktif

Restore langsung ke `POSTGRES_DB` adalah operasi darurat dan selalu ditolak kecuali seluruh guard aktif:

1. aplikasi dihentikan atau maintenance mode aktif;
2. backup sudah diverifikasi di database terpisah;
3. incident/change approval tersedia;
4. `.env.production` sementara berisi:

```dotenv
DATABASE_RESTORE_ALLOW_PRODUCTION=true
DATABASE_RESTORE_APPROVAL_REFERENCE=INCIDENT-2026-001
```

5. command memakai `--allow-production-target`;
6. token konfirmasi memakai format:

```text
RESTORE-PRODUCTION:<target_database>:<backupId>
```

Contoh struktur command:

```powershell
npm run db:restore:production -- `
  --backup .data/backups/postgres/<backup>.json `
  --target-database asihjaya_rms `
  --replace-existing `
  --allow-production-target `
  --confirm RESTORE-PRODUCTION:asihjaya_rms:<backupId>
```

Jangan menjalankan command tersebut pada data nyata sebelum rehearsal VPS Tahap 1D.8. Setelah recovery selesai, kembalikan `DATABASE_RESTORE_ALLOW_PRODUCTION=false` dan kosongkan approval reference.

## Rehearsal lokal disposable

Docker Desktop harus aktif:

```powershell
npm run check:database-backup
npm run test:database-backup:local
```

Rehearsal otomatis:

1. menyalakan PostgreSQL 17 disposable;
2. menjalankan seluruh migration;
3. menulis organisasi, customer, item, sale, sale item, dan payment dummy;
4. membuat custom-format backup;
5. memverifikasi checksum dan archive list;
6. merusak archive dan membuktikan checksum menolaknya;
7. memulihkan ke database kosong;
8. memverifikasi migration, tabel, constraint, invoice, dan nominal pembayaran;
9. membuktikan target database aktif ditolak;
10. menguji retention untuk backup terbaru, lama, manual, protected, dan pre-deployment;
11. menghapus container, volume, dan artifact sementara.

Tidak ada database development atau production yang digunakan oleh rehearsal ini.

## Pemeriksaan manual backup

Daftar artifact:

```powershell
Get-ChildItem .\.data\backups\postgres
```

Verifikasi metadata dan archive melalui script, bukan hanya membuka file JSON:

```powershell
npm run db:backup:verify -- --verify .data/backups/postgres/<backup>.json
```

Pada Linux, batasi permission:

```bash
chmod 700 .data/backups/postgres
chmod 600 .data/backups/postgres/*
```

## Off-site copy minimum

Implementasi resmi memakai Backblaze B2 S3-Compatible API, Object Lock, full SHA-256 read-back verification, receipt remote, retention terpisah, dan download untuk restore rehearsal. Ikuti `docs/development/database-backup-offsite.md`.

Sebelum go-live, gunakan satu lokasi terpisah dari VPS, misalnya object storage private atau server backup. Syarat minimum:

- transport terenkripsi;
- encryption at rest;
- bucket/container private;
- credential hanya memiliki akses prefix backup yang diperlukan;
- checksum dan metadata ikut disalin;
- lifecycle tidak lebih pendek dari retention lokal tanpa persetujuan;
- restore rehearsal berkala memakai salinan off-site, bukan hanya salinan lokal.

Jangan menyimpan credential off-site di repository, command history, atau metadata backup.

## Recovery checklist

1. Identifikasi backup verified terbaru sebelum insiden.
2. Salin archive, checksum, dan metadata ke lokasi kerja aman.
3. Jalankan `db:backup:verify`.
4. Restore ke database baru terlebih dahulu.
5. Verifikasi data bisnis penting dan invoice terbaru.
6. Catat backup ID, target, operator, approval, dan waktu restore.
7. Baru putuskan cutover atau restore database aktif.
8. Setelah recovery, buat backup baru dan salinan off-site.

## Exit criteria 1D.4

- `npm run check:database-backup` lulus.
- `npm run test:database-backup:local` lulus.
- Backup memiliki archive, checksum, dan metadata verified.
- Backup rusak ditolak.
- Restore ke database kosong mempertahankan data transaksi dummy dan constraint kritis.
- Target aktif memerlukan guard serta token eksplisit.
- Retention mempertahankan backup terbaru, manual, dan protected.
- Prosedur off-site dan disaster recovery terdokumentasi.
