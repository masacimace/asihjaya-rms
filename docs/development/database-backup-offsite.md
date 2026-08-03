# Automated Off-site Backup — Backblaze B2

Tahap 1D.4B menambahkan salinan otomatis backup PostgreSQL verified ke Backblaze B2 melalui S3-Compatible API. Backup lokal pada disk VPS tetap dipertahankan, tetapi bukan satu-satunya salinan disaster recovery.

## Boundary keselamatan

- Bucket wajib private dan khusus backup PostgreSQL.
- Gunakan application key terpisah yang dibatasi ke satu bucket dan prefix backup.
- Jangan gunakan master application key; S3-Compatible API Backblaze B2 membutuhkan application key yang dibuat khusus.
- Aktifkan Object Lock pada bucket sebelum upload production. Setelah Object Lock diaktifkan pada bucket, konfigurasi tersebut tidak dapat dinonaktifkan.
- Default project memakai mode `COMPLIANCE` selama 14 hari; Backblaze menerima retention Object Lock 1–3.000 hari. Object yang masih terkunci tidak dapat dihapus oleh retention automation.
- Credential hanya berada di `.env.production`, tidak di Git, Dockerfile, image, metadata backup, receipt, atau output command.
- Upload dianggap lengkap hanya setelah archive, checksum, metadata, dan receipt remote terverifikasi.
- Receipt diunggah terakhir agar daftar receipt hanya mewakili backup lengkap.

## Konfigurasi bucket Backblaze B2

Buat bucket private, misalnya:

```text
asihjaya-rms-postgres-backups
```

Aktifkan Object Lock pada bucket. Gunakan region dan endpoint yang ditampilkan Backblaze, dengan pola:

```text
region: us-east-005
endpoint: https://s3.us-east-005.backblazeb2.com
```

Buat application key yang dibatasi ke bucket tersebut dan, bila tersedia, prefix `asihjaya-rms/postgres`. Kebutuhan capability:

- list bucket names untuk kompatibilitas SDK pada key yang dibatasi bucket;
- list/read files;
- write files;
- delete files untuk retention version-aware setelah Object Lock kedaluwarsa;
- read file retentions untuk verifikasi Object Lock;
- write file retentions untuk menerapkan retention per object.

Jangan berikan capability bypass governance. Mode `COMPLIANCE` direkomendasikan agar penghapusan tidak dapat melewati retention period.

## Environment

Template aman tetap menonaktifkan off-site sampai bucket dan credential benar-benar tersedia:

```dotenv
DATABASE_BACKUP_OFFSITE_ENABLED=false
DATABASE_BACKUP_OFFSITE_PROVIDER=backblaze-b2
DATABASE_BACKUP_OFFSITE_ENDPOINT=CHANGE_ME
DATABASE_BACKUP_OFFSITE_REGION=CHANGE_ME
DATABASE_BACKUP_OFFSITE_BUCKET=CHANGE_ME
DATABASE_BACKUP_OFFSITE_PREFIX=asihjaya-rms/postgres
DATABASE_BACKUP_OFFSITE_ACCESS_KEY_ID=CHANGE_ME
DATABASE_BACKUP_OFFSITE_SECRET_ACCESS_KEY=CHANGE_ME
DATABASE_BACKUP_OFFSITE_OBJECT_LOCK_MODE=COMPLIANCE
DATABASE_BACKUP_OFFSITE_OBJECT_LOCK_DAYS=14
DATABASE_BACKUP_OFFSITE_FULL_VERIFY=true
DATABASE_BACKUP_OFFSITE_MAX_ARCHIVE_BYTES=5368709120
DATABASE_BACKUP_OFFSITE_STATUS_PATH=.data/backups/offsite-status/latest.json
DATABASE_BACKUP_OFFSITE_DAILY_RETENTION_DAYS=14
DATABASE_BACKUP_OFFSITE_WEEKLY_RETENTION_WEEKS=4
DATABASE_BACKUP_OFFSITE_PRE_DEPLOYMENT_RETENTION_COUNT=5
```

Setelah bucket dan application key siap, isi endpoint, region, bucket, key ID, secret key, lalu ubah `DATABASE_BACKUP_OFFSITE_ENABLED=true`. Jangan menempelkan credential ke terminal history, issue, pull request, screenshot, atau chat.

`DATABASE_BACKUP_OFFSITE_MAX_ARCHIVE_BYTES` dibatasi maksimal 5 GiB karena implementasi awal memakai single-object upload. Ketika archive mendekati batas tersebut, upgrade ke multipart upload harus dilakukan sebelum backup berikutnya.

## Struktur object

Setiap backup disimpan dalam prefix terisolasi:

```text
asihjaya-rms/postgres/<environment>/backups/<backupId>/
├── <backup>.dump
├── <backup>.sha256
├── <backup>.json
└── <backup>.offsite.json
```

Receipt menyimpan:

- backup ID, kind, environment, dan timestamp;
- bucket, endpoint, region, dan prefix;
- key, ukuran, dan SHA-256 setiap artifact;
- mode serta tanggal berakhir Object Lock;
- waktu upload dan verifikasi;
- apakah full remote download verification dijalankan.

Receipt lokal disimpan di sebelah metadata backup dengan suffix `.offsite.json`. Status terbaru tersedia di:

```text
.data/backups/offsite-status/latest.json
```

Status tersebut akan menjadi input monitoring Tahap 1D.6.

## Command

Jalankan kontrak dan rehearsal lokal tanpa akun B2:

```powershell
npm run check:database-backup-offsite
npm run test:database-backup-offsite:local
```

Buat backup daily lokal lalu upload, full-verify, dan prune remote:

```powershell
npm run db:backup:production:offsite
```

Backup weekly:

```powershell
npm run db:backup:weekly:offsite
```

Backup pre-deployment:

```powershell
npm run db:backup:pre-deployment:offsite
```

Upload backup lokal verified terbaru:

```powershell
npm run db:backup:offsite
```

Upload metadata tertentu:

```powershell
npm run db:backup:offsite -- --metadata .data/backups/postgres/<backup>.json
```

Verifikasi ulang backup remote terbaru:

```powershell
npm run db:backup:offsite:verify
```

Prune remote sesuai policy dan Object Lock:

```powershell
npm run db:backup:offsite:prune
```

Download backup untuk restore rehearsal:

```powershell
npm run db:backup:offsite:download -- `
  --backup-id <backupId> `
  --download-dir .data/backups/offsite-restore/<backupId>
```

Setelah download, jalankan verifikasi lokal dan restore ke database disposable menggunakan runbook `database-backup-restore.md`.

## Full verification

Ketika `DATABASE_BACKUP_OFFSITE_FULL_VERIFY=true`, script membaca kembali seluruh object remote sebagai stream dan menghitung SHA-256. Ini lebih kuat daripada hanya memeriksa ETag atau metadata dan sengaja menjadi default awal.

Full verification menggandakan transfer untuk archive yang baru di-upload. Pantau ukuran archive dan durasi. Jangan menonaktifkannya tanpa review risiko dan restore rehearsal berkala.

## Retention remote

Default:

- daily: 14 hari;
- weekly: 4 minggu;
- pre-deployment: 5 backup terbaru;
- manual: tidak dihapus otomatis;
- protected: tidak dihapus otomatis;
- backup terbaru dari setiap kind: selalu dipertahankan;
- Object Lock belum kedaluwarsa: tidak pernah dicoba dihapus.

Remote retention terpisah dari retention lokal. Penghapusan memakai version ID agar data object lama benar-benar dilepas, bukan hanya membuat delete marker. Upload gagal atau prune gagal tidak menghapus backup lokal.

## Rehearsal restore off-site

Minimal setiap bulan dan sebelum go-live:

1. pilih receipt remote verified terbaru;
2. download melalui `db:backup:offsite:download`;
3. cocokkan SHA-256 archive, checksum, dan metadata;
4. restore ke database disposable baru;
5. verifikasi migration, constraint, invoice, payment, dan data bisnis kritis;
6. catat backup ID, durasi download, durasi restore, dan hasil verifikasi;
7. hapus database rehearsal setelah bukti dicatat.

Backup off-site belum dianggap operasional hanya karena upload sukses. Restore rehearsal dari object remote adalah bukti utama.

## Rotasi credential

1. Buat application key baru dengan bucket/prefix dan capability yang sama.
2. Simpan key baru di password manager.
3. Update `.env.production` tanpa mencetak secret.
4. Jalankan `db:backup:offsite:verify` dan upload backup kecil/terbaru.
5. Setelah verifikasi berhasil, hapus application key lama.
6. Catat waktu rotasi dan operator.

Jangan menghapus key lama sebelum key baru berhasil membaca, menulis, memverifikasi Object Lock, dan menjalankan list pada prefix yang benar.

## Exit criteria 1D.4B

- Contract check dan in-memory rehearsal lulus.
- Bucket private Backblaze B2 dibuat dengan Object Lock aktif.
- Application key dibatasi ke bucket/prefix backup.
- Backup verified berhasil di-upload sebagai empat object.
- Full remote SHA-256 verification berhasil.
- Receipt dan status lokal tercatat tanpa credential.
- Retention remote menghormati Object Lock, manual, protected, dan latest-per-kind.
- Backup dapat di-download dan diverifikasi untuk restore rehearsal.
