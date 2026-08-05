# Deployment and rollback automation

Dokumen ini menetapkan kontrak Tahap 1D.7 untuk deployment aplikasi ASIHJAYA RMS. Model operasinya adalah **manual approval, automated execution**: operator memilih commit dan memulai deployment, sedangkan backup, migration, aktivasi image, health check, pencatatan release, dan rollback aplikasi dijalankan oleh automation.

Tahap 1D.7B hanya membangun identitas release, metadata, dan deployment lock. Script deployment production penuh belum diaktifkan sampai orchestration, smoke test, dan rollback guard pada tahap berikutnya selesai.

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

Application dan migrator image harus memakai release ID yang sama:

```text
asihjaya-rms:20260806T010203Z-0123456789ab
asihjaya-rms-migrator:20260806T010203Z-0123456789ab
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
└── failed/
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
/run/lock/asihjaya-rms-deployment.lock
/run/lock/asihjaya-rms-deployment.lock.owner
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
