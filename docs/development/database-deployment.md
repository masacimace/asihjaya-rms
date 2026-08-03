# Database Deployment dan Migration Safety

Tahap 1D.3 menetapkan satu jalur resmi untuk menerapkan migration PostgreSQL production. Aplikasi tidak boleh menjalankan `drizzle-kit migrate` secara langsung saat deployment.

## Tujuan

- menunggu PostgreSQL benar-benar siap;
- memastikan hanya satu migration runner aktif melalui advisory lock PostgreSQL;
- menolak release lama ketika database sudah memiliki migration lebih baru;
- mendeteksi perubahan pada SQL migration yang sudah pernah diterapkan;
- memblokir migration destruktif tanpa backup, review, dan approval reference eksplisit;
- menjalankan migration sebelum application container dimulai;
- membuat deployment ulang menjadi idempotent no-op;
- memberi timeout pada database readiness, advisory lock, DDL lock, dan statement migration.

## Command resmi

Preflight dan apply menggunakan runner yang sama:

```powershell
npm run db:deploy
```

Deployment lokal dengan `.env.production`:

```powershell
npm run db:deploy:production
```

Preflight tanpa menerapkan migration:

```powershell
npm run db:deploy -- --check-only
```

`npm run db:migrate` tetap tersedia sebagai primitive internal untuk runner dan pengembangan. Jangan memakainya langsung pada runbook production.

## Urutan deployment database

Runner melakukan urutan berikut:

1. Membaca journal dan seluruh SQL migration lokal.
2. Menunggu koneksi PostgreSQL 17.
3. Mengambil session-level advisory lock khusus migration.
4. Membaca `drizzle.__drizzle_migrations`.
5. Memastikan jumlah, timestamp, dan hash migration yang sudah diterapkan cocok dengan release.
6. Memindai hanya migration pending untuk operasi destruktif.
7. Menjalankan `drizzle-kit migrate` dengan DDL lock timeout dan statement timeout.
8. Membaca ulang migration history dan memastikan tidak ada migration tertinggal.
9. Melepas advisory lock pada blok `finally`.

Session-level advisory lock dipertahankan oleh satu koneksi selama child process Drizzle menerapkan migration. Deployment kedua akan menunggu, lalu menjadi no-op setelah deployment pertama selesai.

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

Runner memblokir migration pending yang mengandung operasi seperti:

- `DROP SCHEMA`, `DROP TABLE`, `DROP COLUMN`, atau `DROP TYPE`;
- `TRUNCATE`;
- `DELETE FROM`;
- perubahan tipe kolom;
- penghapusan constraint.

Approval hanya boleh diaktifkan setelah:

1. backup pre-deployment berhasil;
2. backup diverifikasi dan dapat direstore;
3. SQL direview;
4. dampak downtime dan data loss disetujui;
5. rollback atau forward-fix plan tersedia.

Environment sementara untuk release tersebut:

```dotenv
DATABASE_MIGRATION_ALLOW_DESTRUCTIVE=true
DATABASE_MIGRATION_APPROVAL_REFERENCE=CHANGE-2026-001
```

Kembalikan `DATABASE_MIGRATION_ALLOW_DESTRUCTIVE=false` setelah deployment. Approval reference bukan secret, tetapi harus menunjuk change request atau persetujuan yang dapat diaudit.

## Environment migration

```dotenv
ASIHJAYA_MIGRATOR_IMAGE=asihjaya-rms-migrator:production
DATABASE_MIGRATION_LOCK_KEY=718143293674
DATABASE_MIGRATION_READY_TIMEOUT_MS=120000
DATABASE_MIGRATION_LOCK_TIMEOUT_MS=120000
DATABASE_MIGRATION_DDL_LOCK_TIMEOUT_MS=30000
DATABASE_MIGRATION_STATEMENT_TIMEOUT_MS=900000
DATABASE_MIGRATION_ALLOW_DESTRUCTIVE=false
DATABASE_MIGRATION_APPROVAL_REFERENCE=
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
- dua runner concurrent diserialisasi advisory lock;
- seluruh migration diterapkan;
- deployment kedua menjadi no-op;
- schema hasil migration sesuai kontrak;
- history drift ditolak;
- migration destruktif ditolak tanpa approval;
- approval eksplisit hanya membuka preflight yang memang disetujui;
- container dan volume test dibersihkan pada blok `finally`.

## Prosedur ketika migration gagal

1. Jangan menjalankan ulang secara membabi buta.
2. Biarkan app versi lama tetap aktif bila deployment strategy masih memungkinkan.
3. Simpan log service `migrate` tanpa membagikan secret.
4. Identifikasi apakah kegagalan terjadi sebelum atau sesudah statement tertentu diterapkan.
5. Periksa migration history dan schema aktual.
6. Pilih forward-fix sebagai default.
7. Restore database hanya berdasarkan runbook backup/restore dan persetujuan operasional.
8. Jangan mengedit migration lama agar terlihat lulus.

Migration DDL PostgreSQL umumnya transactional, tetapi migration custom dapat memuat operasi yang memiliki karakteristik berbeda. Selalu review SQL generated sebelum release.

## Exit criteria 1D.3

Tahap 1D.3 selesai ketika:

- `npm run check:database-deployment` lulus;
- `npm run test:database-deployment:local` lulus;
- production container smoke tetap lulus dengan service migrate;
- dua runner concurrent tidak menerapkan migration secara bersamaan;
- migration history drift dan release lama ditolak;
- destructive migration memerlukan approval eksplisit;
- app hanya start setelah migration service exit `0`;
- CI memakai `db:deploy`, bukan primitive migration langsung.
