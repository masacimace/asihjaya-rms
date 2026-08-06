# Deployment and rollback automation

Dokumen ini menetapkan kontrak Tahap 1D.7 untuk deployment aplikasi ASIHJAYA RMS. Model operasinya adalah **manual approval, automated execution**: operator memilih commit dan memulai deployment, sedangkan backup, migration, aktivasi image, health check, pencatatan release, dan rollback aplikasi dijalankan oleh automation.

Tahap 1D.7B membangun identitas release, metadata, dan deployment lock; 1D.7C menambahkan operations image serta exact pre-deployment backup; 1D.7D menambahkan deployment orchestration; dan 1D.7E menambahkan explicit application rollback beserta schema compatibility guard.

## Identitas release

Tiga nilai berikut memiliki fungsi berbeda:

- `APP_RELEASE_ID`: ID release immutable dengan format `YYYYMMDDTHHMMSSZ-<12-char-git-sha>`.
- `APP_REVISION`: Git commit hexadecimal yang menjadi sumber build.
- `APP_BUILD_DATE`: timestamp ISO UTC saat release dibuat.

Contoh:

```text
APP_RELEASE_ID=20260806T010203Z-0123456789ab
APP_REVISION=0123456789abcdef0123456789abcdef01234567
APP_BUILD_DATE=2026-08-06T01:02:03.000Z
```

Application, migrator, dan operations image harus memakai release ID yang sama:

```text
asihjaya-rms:20260806T010203Z-0123456789ab
asihjaya-rms-migrator:20260806T010203Z-0123456789ab
asihjaya-rms-operations:20260806T010203Z-0123456789ab
```

Tag mutable seperti `latest` dan `production` tidak boleh menjadi identitas deployment resmi. Tag tersebut masih dapat dipertahankan sementara untuk preview lama, tetapi deployment automation akan menolaknya.

Health endpoint menampilkan `releaseId`, `revision`, dan `buildDate`. Deployment health verification nanti harus membandingkan nilai tersebut dengan release yang sedang diaktifkan, bukan hanya memeriksa HTTP 200.

## Release metadata

Default deployment state root yang akan digunakan di VPS:

```text
/var/lib/asihjaya-rms/deployments/
├── current.json
├── previous.json
├── history/
├── failed/
├── rollbacks/
└── rollback-work/
```

Metadata mencatat release ID, commit, source ref, image application dan migrator, operator, hostname, waktu deployment, previous release, status migration, backup terverifikasi, health checks, failure stage, serta keputusan compatibility rollback.

Penulisan file dilakukan secara atomic: file sementara ditulis di directory yang sama, disinkronkan, lalu di-rename. `current.json` hanya boleh menunjuk release berstatus `healthy`. Saat release kedua dipromosikan, current release lama disalin ke `previous.json`.

Perintah contract lokal:

```bash
npm run deployment:contract -- plan \
  --revision 0123456789abcdef0123456789abcdef01234567 \
  --source-ref origin/main \
  --created-at 2026-08-06T01:02:03.000Z
```

Validasi metadata:

```bash
npm run deployment:contract -- validate --file /path/to/release.json
```

## Deployment lock

Migration advisory lock hanya melindungi migration database. Deployment dan rollback memakai process-wide `flock` melalui:

```text
ops/scripts/ajsystem-deployment-lock
```

Default path:

```text
/run/lock/asihjaya-rms/deployment.lock
/run/lock/asihjaya-rms/deployment.lock.owner
```

Wrapper menolak proses kedua dengan exit code `75`, menampilkan metadata owner yang aman, dan melepas lock otomatis saat process selesai atau terputus. Owner metadata tidak menyimpan seluruh command argument agar secret tidak bocor.

Contoh contract test:

```bash
ASIHJAYA_DEPLOYMENT_OPERATION=deploy \
APP_RELEASE_ID=20260806T010203Z-0123456789ab \
ops/scripts/ajsystem-deployment-lock -- bash -c 'echo lock-active'
```

Script `ajsystem-deploy` dan `ajsystem-rollback` pada tahap orchestration wajib menjalankan seluruh operasinya di dalam lock yang sama.

## Rollback boundary

Database tidak di-rollback otomatis. Rollback hanya mengganti application image ke successful release sebelumnya dan hanya boleh dilakukan setelah compatibility terhadap schema terbaru dapat dibuktikan.

Aturan minimum:

1. Bila tidak ada migration baru, rollback aplikasi dapat dianggap compatible setelah image dan health contract diverifikasi.
2. Bila migration baru diterapkan, compatibility harus ditandai eksplisit sebagai `compatible`; status `not-evaluated`, `approval-required`, atau `incompatible` menolak automatic rollback.
3. Destructive migration tidak boleh dianggap compatible tanpa change reference dan prosedur recovery khusus.
4. `previous.json` bukan izin rollback otomatis; file itu hanya pointer ke release sukses sebelumnya.
5. Backup pre-deployment dan off-site verification tetap menjadi prerequisite sebelum migration.

## Quality gate

Jalankan:

```bash
npm run check:deployment
```

Pemeriksaan ini menguji format release ID, penolakan mutable image, validasi metadata, atomic state promotion, permission file, lock contention, cleanup owner metadata, Docker/Compose identity, health route identity, dan dokumentasi kontrak.


## Tahap 1D.7C — operations image dan bukti backup

Database backup tidak lagi bergantung pada image manual `asihjaya-rms-tools:backup`. Dockerfile menyediakan target `operations` yang dibangun dari dependency lock repository, berjalan sebagai user non-root, dan membawa OCI label release yang sama dengan app serta migrator. Compose mengekspos target ini melalui profile `operations`, sehingga service tidak ikut `docker compose up` normal tetapi tetap dapat dibangun secara deterministik.

Wrapper VPS membaca `ASIHJAYA_OPERATIONS_IMAGE`, menolak tag mutable `latest` dan `production`, lalu memeriksa label `org.opencontainers.image.version` serta `org.opencontainers.image.revision` sebelum container dijalankan. Pada pre-deployment, label version wajib sama dengan candidate release ID.

Pre-deployment backup resmi dijalankan melalui:

```bash
npm run db:backup:pre-deployment:verified -- \
  --release-id 20260806T010203Z-0123456789ab \
  --result-file /var/lib/asihjaya-rms/backup-runner/pre-deployment-20260806T010203Z-0123456789ab.json
```

Alurnya selalu:

```text
backup lokal verified untuk candidate release
→ upload metadata path yang persis baru dibuat
→ Backblaze B2 Object Lock
→ full SHA-256 read-back verification
→ receipt lokal dan remote
→ result JSON atomic untuk deployment
```

Automation tidak menggunakan `--upload-latest` untuk pre-deployment. Backup ID, release ID, metadata path, receipt path, receipt key, dan waktu verifikasi harus cocok sebelum migration boleh dimulai. Database bootstrap yang benar-benar kosong menghasilkan status `skipped-uninitialized`; status ini bukan kegagalan karena belum ada data aplikasi yang dapat dibackup.

Penambahan operations image menaikkan `deployment state schemaVersion` menjadi `2`. Metadata eksperimen 1D.7B yang masih memakai schemaVersion 1 harus dibuat ulang; belum ada metadata production yang perlu dimigrasikan pada fase preview ini.

## Tahap 1D.7D — production deployment orchestration

Tahap 1D.7D menyediakan orchestrator source-side berikut:

```text
ops/scripts/ajsystem-deploy
```

Script ini belum dianggap aktif pada VPS sampai installation dan rehearsal Tahap 1D.7F selesai. Setelah dipasang, operator memicu deployment secara manual dengan Git ref eksplisit atau default `origin/main`:

```bash
ajsystem-deploy origin/main
```

Deployment selalu berjalan di dalam `ajsystem-deployment-lock`. Working tree VPS harus bersih; script melakukan `git fetch --prune origin`, resolve commit immutable, lalu checkout detached ke commit tersebut. ZIP, SCP, FileZilla, dan copy source manual bukan bagian workflow resmi.

Urutan fail-fast yang diterapkan:

```text
process-wide flock
→ disk dan Git preflight
→ resolve immutable Git revision
→ build operations image
→ validate production environment dengan candidate identity
→ buat candidate release metadata
→ build app dan migrator image
→ verifikasi OCI label dan image ID
→ pastikan PostgreSQL aktif
→ exact pre-deployment backup
→ full off-site verification
→ guarded migration dengan result JSON
→ candidate container pada loopback port 3001
→ candidate release-aware health check
→ recreate production app
→ local dan public release-aware health check
→ tandai healthy
→ promote current.json/previous.json
→ tulis generated current.env
```

Candidate container bergabung hanya ke network backend, bind ke `127.0.0.1`, memakai uploads volume read-only, cache volume sementara, read-only root filesystem, dan tidak menerima traffic dari Caddy. Bila candidate health check gagal, application lama tetap aktif dan release dicatat gagal.

Setelah candidate lulus, container production direcreate dengan immutable app image. Health verifier memeriksa `/api/health`, `/api/health/database`, dan halaman login serta memastikan response membawa `releaseId` dan `revision` candidate. HTTP 200 dari release lama tidak dianggap sukses.

Bila health production gagal dan migration result membuktikan **schema tidak berubah**, orchestrator mencoba memulihkan application image sebelumnya dan memverifikasinya kembali. Bila schema berubah atau identitas release sebelumnya tidak dapat dibuktikan, automatic restore ditolak. Database tidak di-rollback otomatis.

Bukti deployment disimpan di:

```text
/var/lib/asihjaya-rms/deployments/
├── current.json
├── previous.json
├── current.env
├── history/
├── failed/
├── evidence/<release-id>/
└── work/
```

`current.env` tidak mengandung secret. File ini hanya menyimpan release ID, revision, build date, serta tiga immutable image references. Backup timer membaca operations image dari file tersebut sehingga daily/weekly job tetap memakai tool image release aktif. Secret tetap berada di `/etc/asihjaya-rms/production.env`.

Quality gate tahap ini:

```bash
npm run check:deployment-orchestration
npm run check:deployment
npm run check:operations-image
npm run check:database-deployment
npm run check:database-backup
npm run check:database-backup-offsite
```

## Tahap 1D.7E — explicit application rollback dan schema compatibility guard

Rollback production memakai command terpisah:

```text
ops/scripts/ajsystem-rollback
```

Command ini tidak melakukan Git checkout, build image, migration, restore database, atau `docker compose down`. Rollback hanya boleh menuju **previous healthy release** yang ditunjuk konsisten oleh `current.json`, `current.previousReleaseId`, dan `previous.json`. Release historis lain tidak dapat dipilih langsung agar keputusan compatibility hanya mencakup transisi schema dari deployment terakhir.

Sebelum eksekusi, lihat target dan keputusan guard:

```bash
ajsystem-rollback check
```

Operator dapat mengunci ekspektasi target agar perubahan pointer tidak diterima diam-diam:

```bash
ajsystem-rollback check 20260806T010203Z-0123456789ab
```

Bila deployment current tidak mengubah schema, migration result otomatis memberi keputusan `compatible` dengan reference `no-schema-change`. Bila deployment current mengubah schema, status awal adalah `approval-required` dan rollback ditolak. Compatibility hanya boleh diset setelah review expand-and-contract atau bukti bahwa previous application tetap dapat berjalan pada schema terbaru:

```bash
ajsystem-rollback approve CHANGE-1234-expand-contract
```

Untuk mencatat bahwa rollback tidak aman:

```bash
ajsystem-rollback deny CHANGE-1234-breaking-schema
```

Reference harus menunjuk ticket, change request, atau dokumen review yang dapat diaudit. Approval tidak menggantikan test runtime: target previous release tetap harus lulus candidate smoke test terhadap database dengan schema saat ini.

Eksekusi eksplisit:

```bash
ajsystem-rollback execute
```

Atau dengan target yang diharapkan:

```bash
ajsystem-rollback execute 20260806T010203Z-0123456789ab
```

Urutan rollback:

```text
process-wide deployment lock
→ guard current/previous metadata
→ cocokkan current.env dengan current release metadata
→ verifikasi digest dan OCI identity current/target images
→ verifikasi target operations runtime
→ preflight local/public health current release
→ candidate previous app pada 127.0.0.1:3001
→ candidate health terhadap schema database saat ini
→ recreate service app saja dengan target image
→ local/public production health target
→ promote target sebagai current active snapshot
→ simpan rollback audit dan current.env secara atomic
```

Database tidak di-rollback. Service `migrate` tidak dijalankan. App, migrator, dan operations image untuk release asal maupun target harus masih tersedia secara lokal serta memiliki digest dan OCI label yang sama dengan metadata release. `current.env` wajib cocok dengan identitas current release sebelum aktivasi. Target operations image juga harus membawa runtime contract 1D.7E agar backup timer dan rollback berikutnya tetap operasional setelah promotion. Karena itu, rollback menuju release yang dibuat sebelum 1D.7E sengaja ditolak. Pada bootstrap 1D.7F, rehearsal harus membentuk setidaknya dua healthy release yang sama-sama membawa contract 1D.7E sebelum rollback pertama diuji.

Jika candidate gagal, current application tidak disentuh. Jika production health target gagal setelah activation, automation mengembalikan outgoing application image dan menjalankan recovery health check. Jika state sudah berhasil dipromosikan tetapi update `current.env` gagal, automation tidak memutar balik database atau state secara diam-diam; operator mengikuti evidence dan audit rollback untuk recovery.

Rollback audit mencatat operator, hostname VPS, compatibility reference, serta enam image identity asal/target. Setiap percobaan disimpan di:

```text
/var/lib/asihjaya-rms/deployments/
├── rollbacks/<rollback-id>.json
├── rollback-work/
└── evidence/<rollback-id>/
```

Setelah rollback sukses, `current.json` menjadi active snapshot target dengan `previousReleaseId` menunjuk outgoing release. Karena rollback sendiri tidak mengubah schema, reverse rollback ke outgoing release dapat diperiksa sebagai transisi application-only dengan reference `no-schema-change`. Historical release metadata tetap tersedia di `history/`, sedangkan detail keputusan dan health evidence berada pada rollback audit.

Quality gate tahap ini:

```bash
npm run check:application-rollback
npm run check:deployment
npm run check:deployment-orchestration
npm run typecheck
npm run lint
```

## Tahap 1D.7F — instalasi command dan rehearsal VPS preview

Source menyediakan installer dan preflight berikut:

```text
ops/scripts/ajsystem-install-deployment-automation
ops/scripts/ajsystem-deployment-preflight
```

Installer wajib dijalankan dengan `sudo`, membuat backup command host lama, memasang lima command dengan owner `root:ubuntu` mode `0750`, membuat deployment state directory milik `ubuntu`, memverifikasi hash source/installed, dan menyediakan restore berdasarkan backup ID. Runtime deployment, rollback, preflight, dan backup dijalankan sebagai user `ubuntu` tanpa sudo agar ownership evidence konsisten dengan systemd backup job.

Installer memasang tmpfiles policy untuk membuat `/run/lock/asihjaya-rms` pada setiap boot; lock helper tidak pernah mengubah permission shared parent `/run/lock`.

Sebelum immutable `current.env` pertama tersedia, timer backup dihentikan sementara. Service backup juga memiliki `ConditionPathExists=/var/lib/asihjaya-rms/deployments/current.env` agar bootstrap tidak menjalankan operations image mutable. Production environment memakai owner `root:ubuntu` dan mode `0640`; nilainya tidak pernah dicetak atau disalin ke repository.

Rehearsal membentuk dua healthy release yang sama-sama membawa contract 1D.7E/1D.7F, menjalankan application rollback dari release kedua ke release pertama, lalu reverse rollback agar release kedua kembali aktif. Database tidak pernah diturunkan. Runbook lengkap tersedia di `docs/development/deployment-rollback-vps-rehearsal.md`.

Quality gate:

```bash
npm run check:deployment-installation
npm run check:application-rollback
npm run check:deployment-orchestration
npm run check:deployment
```
