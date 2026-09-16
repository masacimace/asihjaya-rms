# Database Deployment dan Migration Safety

Tahap 1D.3 menetapkan satu jalur resmi untuk menerapkan migration PostgreSQL production. Aplikasi tidak boleh menjalankan `drizzle-kit migrate` secara langsung saat deployment.

## Tujuan

- menunggu PostgreSQL benar-benar siap;
- memastikan hanya satu migration runner aktif melalui advisory lock PostgreSQL;
- menolak release lama ketika database sudah memiliki migration lebih baru;
- mendeteksi perubahan pada SQL migration yang sudah pernah diterapkan;
- mengizinkan historical destructive migration secara otomatis hanya pada fresh database;
- mewajibkan one-shot opt-in untuk destructive migration pada database existing;
- menjalankan setiap migration dalam commit boundary terpisah agar PostgreSQL enum additions dapat dipakai migration berikutnya;
- menjalankan migration sebelum application container dimulai;
- membuat deployment ulang menjadi idempotent no-op;
- memberi timeout pada database readiness, advisory lock, DDL lock, dan statement migration.

## Command resmi

Preflight dan apply menggunakan runner yang sama:

```powershell
npm run db:deploy
```

Deployment production dengan backup pre-deployment terverifikasi:

```powershell
npm run db:deploy:production
```

Preflight tanpa menerapkan migration:

```powershell
npm run db:deploy -- --check-only
```

Jika database existing memiliki pending migration yang destructive dan perubahan tersebut memang disengaja:

```powershell
npm run db:deploy -- --allow-destructive
```

Untuk jalur production yang tetap menjalankan verified pre-deployment backup lebih dulu:

```powershell
npm run db:deploy:production -- --allow-destructive
```

`--allow-destructive` berlaku hanya untuk invocation tersebut. Tidak ada approval-reference atau persistent destructive-approval environment variable yang diperlukan oleh migration runner.

`npm run db:migrate` tetap tersedia sebagai primitive internal untuk runner dan pengembangan. Jangan memakainya langsung pada runbook production.

## Urutan deployment database

Runner melakukan urutan berikut:

1. Membaca journal dan seluruh SQL migration lokal.
2. Menunggu koneksi PostgreSQL 17.
3. Mengambil session-level advisory lock khusus migration.
4. Membaca `drizzle.__drizzle_migrations`.
5. Memastikan jumlah, timestamp, dan hash migration yang sudah diterapkan cocok dengan release.
6. Memindai hanya migration pending untuk operasi destruktif.
7. Jika database masih fresh (`0` migration applied), historical destructive migration diizinkan otomatis.
8. Jika database existing memiliki destructive migration, runner berhenti kecuali invocation memakai `--allow-destructive`.
9. Membuat working migration directory sementara dan mengekspos journal satu migration pada satu waktu.
10. Menjalankan `drizzle-kit migrate` untuk migration tersebut dengan DDL lock timeout dan statement timeout.
11. Memastikan history bertambah tepat sampai checkpoint migration tersebut sebelum lanjut ke migration berikutnya.
12. Membaca ulang migration history dan memastikan tidak ada migration tertinggal.
13. Melepas advisory lock pada blok `finally`.

Session-level advisory lock dipertahankan oleh satu koneksi selama child process Drizzle menerapkan migration. Deployment kedua akan menunggu, lalu menjadi no-op setelah deployment pertama selesai.

### Mengapa satu migration = satu commit boundary

Beberapa historical migration menambahkan PostgreSQL enum value dengan `ALTER TYPE ... ADD VALUE`, lalu migration berikutnya memakai enum value tersebut. PostgreSQL baru mengizinkan value baru dipakai setelah transaction yang menambahkannya sudah commit.

Karena itu runner tidak lagi meminta Drizzle menerapkan seluruh pending history dalam satu transaction besar. Journal sementara dibuat bertahap sehingga:

```text
0007 ADD migration_hold
COMMIT

0008 memakai migration_hold
COMMIT

0009 ADD migration_opening
COMMIT

0011 memakai migration_opening
COMMIT
```

Historical SQL dan hash migration tidak perlu diedit.

## Compose production

`compose.production.yaml` memiliki service sekali-jalan bernama `migrate`:

```text
db healthy
→ migrate selesai dengan exit code 0
→ app boleh dimulai
```

Service `migrate`:

- memakai image target `migrator` terpisah;
- berjalan sebagai user non-root;
- memakai root filesystem read-only;
- hanya terhubung ke network backend;
- memiliki CPU, RAM, PID, log rotation, dan graceful-shutdown limit;
- memakai `restart: "no"` agar kegagalan migration terlihat jelas dan tidak berulang tanpa kontrol.

Jika migration gagal, `app` tidak akan dimulai. Periksa log:

```powershell
docker compose --env-file .env.production -f compose.production.yaml logs --tail 200 migrate
```

## Migration destructive

Runner mendeteksi migration pending yang mengandung operasi seperti:

- `DROP SCHEMA`, `DROP TABLE`, `DROP COLUMN`, atau `DROP TYPE`;
- `TRUNCATE`;
- `DELETE FROM`;
- perubahan tipe kolom;
- penghapusan constraint.

### Fresh database

Jika belum ada migration yang applied, historical destructive migration diizinkan otomatis. Ini berlaku untuk use case seperti:

- CI disposable PostgreSQL;
- fresh preview VPS database;
- fresh production install;
- database rehearsal baru.

Pada database kosong, historical cleanup seperti `DROP TABLE` tidak berisiko menghapus data operasional existing karena seluruh object tersebut baru saja dibuat oleh historical migration sebelumnya dalam chain yang sama.

### Existing database

Jika sudah ada satu atau lebih migration applied, destructive migration tetap fail-closed. Setelah SQL direview dan backup tersedia, developer menjalankan ulang secara eksplisit:

```powershell
npm run db:deploy -- --allow-destructive
```

Untuk production, gunakan command yang tetap menjalankan verified pre-deployment backup:

```powershell
npm run db:deploy:production -- --allow-destructive
```

Tidak perlu mengubah `.env.production`, menyalakan boolean permanen, atau membuat approval reference dummy. Izin destructive selesai bersama process tersebut.

## Environment migration

```dotenv
ASIHJAYA_MIGRATOR_IMAGE=asihjaya-rms-migrator:production
DATABASE_MIGRATION_LOCK_KEY=718143293674
DATABASE_MIGRATION_READY_TIMEOUT_MS=120000
DATABASE_MIGRATION_LOCK_TIMEOUT_MS=120000
DATABASE_MIGRATION_DDL_LOCK_TIMEOUT_MS=30000
DATABASE_MIGRATION_STATEMENT_TIMEOUT_MS=900000
```

Gunakan lock key yang sama untuk semua instance yang menunjuk database production yang sama. Mengubah lock key dapat membuat dua deployment berbeda tidak saling mengunci.

## Aturan migration history

- Migration yang sudah diterapkan tidak boleh diedit, dihapus, atau diurutkan ulang.
- File SQL memakai LF melalui `.gitattributes` agar hash konsisten antara Windows, CI, dan Linux.
- Perubahan schema baru selalu dibuat sebagai migration baru.
- Release dengan journal lebih lama daripada database ditolak. Gunakan release yang kompatibel atau forward-fix; jangan menghapus baris migration history.
- Jangan memodifikasi `drizzle.__drizzle_migrations` secara manual kecuali dalam prosedur recovery yang telah direview.

## Rehearsal lokal

Docker Desktop harus aktif:

```powershell
npm run check:database-deployment
npm run test:database-deployment:local
```

Rehearsal disposable memverifikasi:

- PostgreSQL 17 readiness;
- fresh DB mengizinkan historical destructive migration tanpa approval manual;
- migration enum-sensitive seperti `0007 → 0008` dan `0009 → 0011` berjalan dengan commit boundary terpisah;
- dua runner concurrent diserialisasi advisory lock;
- seluruh migration diterapkan;
- deployment kedua menjadi no-op;
- schema hasil migration sesuai kontrak;
- history drift ditolak;
- migration destructive pada existing DB ditolak tanpa `--allow-destructive`;
- one-shot `--allow-destructive` membuka preflight existing DB hanya untuk invocation tersebut;
- container dan volume test dibersihkan pada blok `finally`.

## Prosedur ketika migration gagal

1. Jangan menjalankan ulang secara membabi buta.
2. Biarkan app versi lama tetap aktif bila deployment strategy masih memungkinkan.
3. Simpan log service `migrate` tanpa membagikan secret.
4. Identifikasi migration terakhir yang berhasil dan migration yang gagal.
5. Periksa migration history dan schema aktual.
6. Ingat bahwa migration sebelumnya dalam batch dapat sudah committed karena setiap migration memiliki commit boundary sendiri.
7. Pilih forward-fix sebagai default; setelah penyebab diperbaiki, runner akan melanjutkan dari migration pending berikutnya.
8. Restore database hanya berdasarkan runbook backup/restore dan persetujuan operasional.
9. Jangan mengedit migration lama yang sudah applied agar terlihat lulus.

Migration DDL PostgreSQL umumnya transactional per migration, tetapi migration custom dapat memuat operasi yang memiliki karakteristik berbeda. Selalu review SQL generated sebelum release.

## Exit criteria 1D.3

Tahap 1D.3 selesai ketika:

- `npm run check:database-deployment` lulus;
- `npm run test:database-deployment:local` lulus;
- production container smoke tetap lulus dengan service migrate;
- dua runner concurrent tidak menerapkan migration secara bersamaan;
- migration history drift dan release lama ditolak;
- fresh DB dapat replay seluruh historical migration tanpa approval manual;
- destructive migration existing DB memerlukan one-shot `--allow-destructive`;
- app hanya start setelah migration service exit `0`;
- CI memakai `db:deploy`, bukan primitive migration langsung.

## Integrasi backup Tahap 1D.4

Migration production manual sekarang wajib melalui:

```powershell
npm run db:deploy:production
```

Command tersebut menjalankan `db:backup:pre-deployment:verified` sebelum migration runner. Jika backup, checksum, archive verification, atau disk guard gagal, migration tidak dijalankan.

Untuk destructive migration existing production database, gunakan:

```powershell
npm run db:deploy:production -- --allow-destructive
```

`compose.production.yaml` masih menyediakan service `migrate` sebagai primitive. Orchestrator `ops/scripts/ajsystem-deploy` sekarang menjalankan exact pre-deployment backup, full off-site verification, guarded migration, candidate smoke, dan release-aware health check. Script baru dianggap aktif setelah installation/rehearsal VPS; `db:migrate` tetap primitive internal dan tidak boleh dipanggil langsung untuk release production.

Runbook lengkap terdapat di `docs/development/database-backup-restore.md`.
