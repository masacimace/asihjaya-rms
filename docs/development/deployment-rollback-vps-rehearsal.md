# 1D.7F — Instalasi dan Rehearsal Deployment/Rollback di VPS Preview

Dokumen ini adalah runbook satu kali untuk mengaktifkan workflow deployment dan rollback pada VPS preview `ajsystem-prod`. Setelah tahap ini selesai, source tidak lagi dikirim melalui ZIP/SCP. Operator cukup push Git lalu menjalankan `ajsystem-deploy <git-ref>` sebagai user `ubuntu`.

## Batas tahap

Tahap ini melakukan:

- one-time checkout source contract terbaru pada working copy Git VPS;
- instalasi command host secara atomic ke `/usr/local/sbin`;
- backup command host lama dan menyediakan restore installer;
- permission alignment untuk user deployment `ubuntu`;
- bootstrap snapshot image aplikasi yang sedang aktif;
- lock contention rehearsal;
- dua healthy release dengan contract 1D.7E/1D.7F;
- rollback release kedua ke release pertama;
- reverse rollback agar release kedua kembali aktif;
- aktivasi ulang timer backup.

Tahap ini tidak melakukan database rollback, restore database, `docker compose down`, penghapusan volume, atau image prune.

## Prinsip user dan permission

Gunakan dua konteks:

```text
sudo/root : hanya untuk install command, ownership, dan systemd
ubuntu    : deploy, rollback, preflight, Docker, dan Git
```

Jalankan `ajsystem-deploy`, `ajsystem-rollback`, `ajsystem-db-backup`, dan `ajsystem-deployment-preflight` sebagai user `ubuntu` **tanpa sudo**. Script akan menolak runtime root agar metadata deployment, backup evidence, dan rollback audit tidak bercampur owner.

`production.env` perlu dapat dibaca oleh trusted deployment group:

```text
owner root:ubuntu
mode  0640
```

User `ubuntu` sudah merupakan anggota grup `docker`, sehingga secara operasional ia sudah memiliki privilege tinggi pada host. Secret tetap tidak boleh masuk Git, terminal output, atau bundle source.

## 1. Persiapan dari local workstation

Pastikan seluruh quality gate 1D.7F lulus dan commit sudah dipush. Catat full commit SHA:

```powershell
npm run check:deployment-installation
npm run check:application-rollback
npm run check:deployment-orchestration
npm run check:deployment
npm run typecheck
npm run lint
git status --short
git rev-parse HEAD
```

Simpan hasil `git rev-parse HEAD` sebagai `REHEARSAL_COMMIT`. Jangan memakai short SHA untuk bootstrap VPS.

## 2. Snapshot kondisi awal VPS

Login sebagai `ubuntu`, lalu jalankan read-only evidence:

```bash
hostname
whoami
cd /opt/asihjaya-rms/app
git status --short
git rev-parse HEAD
docker compose --env-file /etc/asihjaya-rms/production.env -f compose.production.yaml ps
docker inspect --format '{{.Config.Image}} | {{.Image}}' "$(docker compose --env-file /etc/asihjaya-rms/production.env -f compose.production.yaml ps -q app)"
systemctl list-timers 'ajsystem-*' --all --no-pager
curl -fsS http://127.0.0.1:3000/api/health
curl -fsS https://ajsystem.id/api/health
```

Jika working tree tidak bersih, hentikan tahap dan audit perubahan lokal. Jangan memakai `git reset --hard` sebelum perubahan tersebut dipahami.

## 3. Hentikan sementara timer backup

Window bootstrap mengganti backup wrapper sebelum `current.env` immutable pertama tersedia. Hentikan timer agar tidak ada job terjadwal yang masuk di tengah instalasi:

```bash
sudo systemctl stop \
  ajsystem-db-backup-daily.timer \
  ajsystem-db-backup-weekly.timer \
  ajsystem-db-backup-verify.timer

systemctl is-active ajsystem-db-backup-daily.timer || true
systemctl is-active ajsystem-db-backup-weekly.timer || true
systemctl is-active ajsystem-db-backup-verify.timer || true
```

Jangan menonaktifkan container app, database, Caddy, atau monitor.

## 4. One-time Git checkout contract terbaru

Ganti `<REHEARSAL_COMMIT>` dengan full SHA dari workstation:

```bash
cd /opt/asihjaya-rms/app
git fetch --prune origin
git cat-file -e '<REHEARSAL_COMMIT>^{commit}'
git checkout --detach --force '<REHEARSAL_COMMIT>'
test "$(git rev-parse HEAD)" = '<REHEARSAL_COMMIT>'
test -z "$(git status --porcelain --untracked-files=all)"
```

Ini adalah satu-satunya checkout manual untuk bootstrap automation. Deployment berikutnya melakukan fetch dan detached checkout sendiri.

## 5. Align permission production environment

Periksa metadata tanpa mencetak isi file:

```bash
sudo stat -c '%U:%G %a %n' /etc/asihjaya-rms/production.env
```

Atur permission yang dibutuhkan automation:

```bash
sudo chown root:ubuntu /etc/asihjaya-rms/production.env
sudo chmod 0640 /etc/asihjaya-rms/production.env
sudo -u ubuntu test -r /etc/asihjaya-rms/production.env
sudo stat -c '%U:%G %a %n' /etc/asihjaya-rms/production.env
```

Output akhir harus `root:ubuntu 640`. Jangan menjalankan `cat`, `grep` tanpa filter aman, atau menyalin file tersebut.

## 6. Install command host secara atomic

Jalankan installer dari source checkout terbaru:

```bash
cd /opt/asihjaya-rms/app
sudo ./ops/scripts/ajsystem-install-deployment-automation install
sudo ./ops/scripts/ajsystem-install-deployment-automation verify
```

Installer memasang:

```text
/usr/local/sbin/ajsystem-deployment-lock
/usr/local/sbin/ajsystem-db-backup
/usr/local/sbin/ajsystem-deploy
/usr/local/sbin/ajsystem-rollback
/usr/local/sbin/ajsystem-deployment-preflight
```

File installed dimiliki `root:ubuntu`, mode `0750`, dan hash-nya harus sama dengan source. Catat `backup-id` yang dicetak installer.

Installer juga memasang `ajsystem-db-backup@.service` secara atomic, menyimpan versi lama dalam backup ID yang sama, menjalankan `systemctl daemon-reload`, dan memverifikasi unit dengan `systemd-analyze verify`.
Installer juga memasang `/etc/tmpfiles.d/asihjaya-rms-deployment.conf` dan menjalankan `systemd-tmpfiles --create`. Konfigurasi ini membuat ulang `/run/lock/asihjaya-rms` sebagai `ubuntu:ubuntu` mode `0750` setelah reboot, sehingga deployment lock tetap tersedia pada setiap boot.

Service backup sekarang memiliki `ConditionPathExists=/var/lib/asihjaya-rms/deployments/current.env`, sehingga job terjadwal tidak berjalan sebelum immutable release pertama dipromosikan.

## 7. Preflight dan bootstrap snapshot

Kembali ke user `ubuntu`; command berikut dijalankan tanpa sudo:

```bash
ajsystem-deployment-preflight check
ajsystem-deployment-preflight status
ajsystem-deployment-preflight snapshot
ajsystem-deployment-preflight lock-test
```

Snapshot memberi tag lokal berbentuk:

```text
asihjaya-rms-bootstrap:<timestamp>
```

Metadata non-secret disimpan di:

```text
/var/lib/asihjaya-rms/deployments/bootstrap/<timestamp>/bootstrap.env
```

Bootstrap image bukan target rollback automation resmi. Ia hanya emergency evidence untuk release pertama sebelum dua release contract baru tersedia.

## 8. Deploy healthy release pertama

Gunakan commit yang sama:

```bash
ajsystem-deploy '<REHEARSAL_COMMIT>' |& tee "$HOME/ajsystem-1d7f-release-1.log"
```

Deployment wajib membuktikan:

```text
backup lokal verified
full off-site verification
migration completed/no-op
candidate health passed
production health passed
current.json dan current.env dipromosikan
```

Validasi:

```bash
ajsystem-deployment-preflight status
python3 -m json.tool /var/lib/asihjaya-rms/deployments/current.json
sed -n -E '/^(APP_RELEASE_ID|APP_REVISION|APP_BUILD_DATE|ASIHJAYA_(IMAGE|MIGRATOR_IMAGE|OPERATIONS_IMAGE))=/p' \
  /var/lib/asihjaya-rms/deployments/current.env
curl -fsS http://127.0.0.1:3000/api/health
curl -fsS https://ajsystem.id/api/health
```

Catat release ID sebagai `RELEASE_1`.

## 9. Deploy healthy release kedua

Tunggu minimal dua detik agar timestamp release berbeda, lalu deploy commit yang sama. Tujuannya membentuk dua healthy release yang sama-sama membawa runtime contract 1D.7E/1D.7F tanpa menambah perubahan schema:

```bash
sleep 2
ajsystem-deploy '<REHEARSAL_COMMIT>' |& tee "$HOME/ajsystem-1d7f-release-2.log"
ajsystem-deployment-preflight status
```

Catat active release sebagai `RELEASE_2` dan previous release sebagai `RELEASE_1`. Frasa **dua healthy release** pada tahap ini berarti kedua metadata tersedia, semua image identity masih lokal, dan health evidence keduanya lulus.

## 10. Rollback rehearsal

Periksa target sebelum eksekusi:

```bash
ajsystem-rollback check
```

Karena deployment kedua tidak mengubah schema, guard seharusnya menunjukkan compatibility `no-schema-change`; approval manual tidak diperlukan.

Kunci target menggunakan release ID pertama:

```bash
ajsystem-rollback execute '<RELEASE_1>' |& tee "$HOME/ajsystem-1d7f-rollback.log"
ajsystem-deployment-preflight status
curl -fsS http://127.0.0.1:3000/api/health
curl -fsS https://ajsystem.id/api/health
```

Database tidak boleh berubah dan service migrator tidak boleh dijalankan oleh rollback.

## 11. Reverse rollback

Setelah rollback sukses, outgoing `RELEASE_2` menjadi previous release. Jalankan **reverse rollback** agar preview kembali ke release kedua:

```bash
ajsystem-rollback check '<RELEASE_2>'
ajsystem-rollback execute '<RELEASE_2>' |& tee "$HOME/ajsystem-1d7f-reverse-rollback.log"
ajsystem-deployment-preflight status
```

Periksa audit terbaru:

```bash
ls -lt /var/lib/asihjaya-rms/deployments/rollbacks | head
python3 -m json.tool "$(find /var/lib/asihjaya-rms/deployments/rollbacks -maxdepth 1 -type f -name '*.json' -printf '%T@ %p\n' | sort -nr | head -n 1 | cut -d' ' -f2-)"
```

## 12. Aktifkan kembali timer backup

Setelah `current.env` tersedia dan operations image active release telah diverifikasi:

```bash
sudo systemctl enable --now \
  ajsystem-db-backup-daily.timer \
  ajsystem-db-backup-weekly.timer \
  ajsystem-db-backup-verify.timer

sudo systemctl start ajsystem-db-backup@verify.service
sudo systemctl status ajsystem-db-backup@verify.service --no-pager
systemctl list-timers 'ajsystem-db-backup-*' --all --no-pager
```

Service oneshot dapat kembali menjadi `inactive (dead)` setelah sukses. Exit status harus `0` dan journal tidak boleh memuat error.

## 13. Validasi akhir

```bash
ajsystem-deployment-preflight check
ajsystem-deployment-preflight status
docker compose --env-file /etc/asihjaya-rms/production.env -f /opt/asihjaya-rms/app/compose.production.yaml ps
sudo systemctl --failed --no-pager
sudo journalctl -u 'ajsystem-db-backup@*.service' --since '2 hours ago' --no-pager
sudo journalctl -u ajsystem-monitor.service --since '30 minutes ago' --no-pager
curl -fsS https://ajsystem.id/api/health
curl -fsS https://ajsystem.id/api/health/database
```

Kriteria lulus 1D.7F:

- command installed sama dengan source dan permission benar;
- preflight dan lock-test lulus;
- release pertama dan kedua healthy;
- rollback dan reverse rollback healthy;
- database tidak di-rollback;
- current/previous metadata konsisten;
- backup timer aktif kembali;
- off-site verification terbaru sehat;
- tidak ada failed systemd unit baru.

## Rollback instalasi command host

Jika installer atau installed command bermasalah sebelum deployment dijalankan, gunakan `backup-id` dari installer:

```bash
cd /opt/asihjaya-rms/app
sudo ./ops/scripts/ajsystem-install-deployment-automation restore '<backup-id>'
sudo systemctl daemon-reload
```

Setelah restore, jangan meneruskan deployment sampai penyebabnya diaudit.

## Emergency bootstrap recovery

Bootstrap image hanya dipakai jika release pertama gagal setelah application activation dan migration evidence secara eksplisit menunjukkan `schemaChanged: false`. Jangan pulihkan image bootstrap setelah schema berubah.

Lihat metadata:

```bash
cat /var/lib/asihjaya-rms/deployments/bootstrap/latest.env
```

Ambil `bootstrap_image`, `app_release_id`, `app_revision`, dan `app_build_date`, lalu jalankan application-only recreate dengan nilai tersebut. Jangan menjalankan migration atau restore database. Setelah recovery, validasi local/public health dan hentikan rehearsal untuk audit.
