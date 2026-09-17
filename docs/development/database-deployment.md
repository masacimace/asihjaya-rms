# Database Deployment dan Migration Safety

Tahap 1D.3 menetapkan satu jalur resmi untuk menerapkan migration PostgreSQL production. Aplikasi tidak boleh menjalankan `drizzle-kit migrate` secara langsung saat deployment.

## Tujuan

- menunggu PostgreSQL benar-benar siap;
- memastikan hanya satu migration runner aktif melalui advisory lock PostgreSQL;
- menolak release lama ketika database sudah memiliki migration lebih baru;
- mendeteksi perubahan pada SQL migration yang sudah pernah diterapkan;
- menerapkan migration satu file per transaction/commit boundary;
- mengizinkan historical destructive DDL secara otomatis hanya pada fresh database;
- memblokir destructive migration pada existing database tanpa review, backup, dan one-shot CLI opt-in;
- menjalankan migration sebelum application container dimulai;
- membuat deployment ulang menjadi idempotent no-op;
- memberi timeout pada database readiness, advisory lock, DDL lock, dan statement migration.

## Command resmi

Preflight dan apply menggunakan runner yang sama:

```powershell
npm run db:deploy
```

Deployment production dengan backup terverifikasi terlebih dahulu:

```powershell
npm run db:deploy:production
```

Preflight tanpa menerapkan migration:

```powershell
npm run db:deploy -- --check-only
```

Existing database dengan destructive pending migration hanya boleh dibuka untuk satu invocation setelah review dan verified backup:

```powershell
npm run db:deploy -- --allow-destructive
```

Tidak ada permanent destructive-migration permission di `.env`. `--allow-destructive` adalah one-shot CLI opt-in untuk invocation tersebut.

`npm run db:migrate` tetap tersedia sebagai primitive pengembangan/legacy package script, tetapi bukan jalur deployment production.

## Urutan deployment database

Runner melakukan urutan berikut:

1. Membaca journal dan seluruh SQL migration lokal.
2. Menunggu koneksi PostgreSQL 17.
3. Mengambil session-level advisory lock khusus migration.
4. Memastikan tabel history `drizzle.__drizzle_migrations` tersedia.
5. Membaca dan memvalidasi jumlah, timestamp, serta hash migration yang sudah diterapkan.
6. Memindai hanya migration pending untuk operasi destruktif.
7. Menentukan destructive policy dari state database:
   - `appliedCount === 0`: fresh database, historical destructive DDL otomatis diizinkan;
   - existing database tanpa destructive pending: lanjut normal;
   - existing database dengan destructive pending: fail closed kecuali invocation memakai `--allow-destructive`.
8. Untuk setiap file pending secara berurutan:
   - `BEGIN`;
   - set DDL lock timeout dan statement timeout;
   - jalankan SQL migration file;
   - insert migration history;
   - `COMMIT`;
   - jika file tersebut gagal, `ROLLBACK` hanya transaction file itu dan hentikan deployment.
9. Membaca ulang migration history dan memastikan tidak ada migration tertinggal.
10. Melepas advisory lock pada blok `finally`.

Per-file commit boundary penting untuk historical PostgreSQL enum: enum yang ditambahkan migration sebelumnya sudah committed sebelum migration berikutnya memakai enum tersebut. Historical SQL/hash tidak perlu diubah.

Session-level advisory lock dipertahankan oleh satu koneksi selama seluruh migration replay. Deployment kedua akan menunggu, lalu menjadi no-op setelah deployment pertama selesai.

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
- tidak menyimpan destructive permission permanen pada environment;
- memakai `restart: "no"` agar kegagalan migration terlihat jelas dan tidak berulang tanpa kontrol.

Jika migration gagal, `app` tidak akan dimulai. Periksa log:

```powershell
docker compose --env-file .env.production -f compose.production.yaml logs --tail 200 migrate
```

## Migration destructive

Runner memblokir migration pending yang mengandung operasi seperti:

- `DROP SCHEMA`, `DROP TABLE`, `DROP COLUMN`, atau `DROP TYPE`;
- `TRUNCATE`;
- `DELETE FROM`;
- perubahan tipe kolom;
- penghapusan constraint.

### Fresh database

Jika belum ada migration applied (`appliedCount === 0`), runner mengizinkan historical destructive DDL secara otomatis. Ini diperlukan agar fresh PostgreSQL dapat replay seluruh history yang valid tanpa menyimpan bypass permanen.

Fresh database tidak membutuhkan approval reference dan tidak membutuhkan `--allow-destructive`.

### Existing database

Jika destructive migration pending terdeteksi pada database yang sudah memiliki history, default selalu fail closed.

Sebelum rerun:

1. pastikan pre-deployment backup berhasil dan terverifikasi;
2. review SQL pending dan dampak data loss/downtime;
3. pastikan rollback atau forward-fix plan tersedia;
4. rerun invocation yang memang direview dengan `--allow-destructive`.

Contoh preflight:

```powershell
npm run db:deploy -- --check-only --allow-destructive
```

Untuk production, backup-first tetap wajib. Jangan menambahkan destructive permission permanen ke `.env.production`.

Restore-production approval/reference adalah concern berbeda pada restore runner dan tetap dipertahankan.

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
- Compatibility residue seperti historical enum tetap dipertahankan bila menghapusnya akan memerlukan rewrite migration lama.

## Rehearsal lokal

Docker Desktop harus aktif:

```powershell
npm run check:database-deployment
npm run test:database-deployment:local
```

Rehearsal disposable memverifikasi:

- PostgreSQL 17 readiness;
- dua runner concurrent diserialisasi advisory lock;
- seluruh migration fresh diterapkan tanpa destructive env bypass;
- deployment kedua menjadi no-op;
- schema hasil migration sesuai kontrak;
- history drift ditolak;
- existing-DB destructive migration ditolak tanpa opt-in;
- one-shot `--allow-destructive` hanya membuka invocation yang memang eksplisit;
- migration file yang gagal di-rollback tanpa merusak history release stabil;
- container dan volume test dibersihkan pada blok `finally`.

## Prosedur ketika migration gagal

1. Jangan menjalankan ulang secara membabi buta.
2. Biarkan app versi lama tetap aktif bila deployment strategy masih memungkinkan.
3. Simpan log service `migrate` tanpa membagikan secret.
4. Identifikasi migration file yang gagal.
5. Periksa migration history dan schema aktual.
6. Pilih forward-fix sebagai default.
7. Restore database hanya berdasarkan runbook backup/restore dan persetujuan operasional.
8. Jangan mengedit migration lama agar terlihat lulus.

Migration DDL PostgreSQL umumnya transactional, tetapi migration custom tetap harus direview sebelum release.

## Exit criteria 1D.3

Tahap 1D.3 selesai ketika:

- `npm run check:database-deployment` lulus;
- `npm run test:database-deployment:local` lulus;
- production container smoke tetap lulus dengan service migrate;
- dua runner concurrent tidak menerapkan migration secara bersamaan;
- migration history drift dan release lama ditolak;
- fresh DB dapat replay historical migrations dari nol;
- existing DB destructive migration memerlukan one-shot CLI opt-in;
- app hanya start setelah migration service exit `0`;
- CI memakai `db:deploy`, bukan primitive migration langsung.

## Integrasi backup Tahap 1D.4

Migration production manual wajib melalui:

```powershell
npm run db:deploy:production
```

Command tersebut menjalankan `db:backup:pre-deployment:verified` sebelum migration runner. Jika backup, checksum, archive verification, atau disk guard gagal, migration tidak dijalankan.

`compose.production.yaml` tetap menyediakan service `migrate` sebagai primitive. Orchestrator `ops/scripts/ajsystem-deploy` menjalankan exact pre-deployment backup, full off-site verification, guarded migration, candidate smoke, dan release-aware health check. `db:migrate` bukan jalur release production.

Runbook lengkap terdapat di `docs/development/database-backup-restore.md`.
