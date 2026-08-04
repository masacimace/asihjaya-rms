# Production Container Foundation

Dokumen ini menjelaskan fondasi container production Asihjaya RMS untuk target VPS Ubuntu 24.04, 2 vCPU, RAM 4 GB, dan storage 100 GB.

Tahap ini belum melakukan deployment internet, konfigurasi Cloudflare, migration production, atau backup. Seluruh validasi awal dapat dijalankan melalui Docker Desktop di lokal.

## File utama

- `Dockerfile` — multi-stage production image dengan runtime Playwright/Chromium.
- `compose.production.yaml` — stack application dan PostgreSQL production.
- `src/app/api/health/route.ts` — liveness aplikasi tanpa akses database.
- `src/app/api/health/database/route.ts` — readiness aplikasi dan PostgreSQL.
- `scripts/check-production-container.ts` — kontrak static container.
- `scripts/run-production-container-smoke.ts` — rehearsal disposable di lokal.

## Boundary runtime

Production runtime memiliki karakteristik berikut:

- proses aplikasi berjalan sebagai user `nextjs` non-root dengan UID/GID `10001`;
- root filesystem aplikasi read-only;
- lokasi writable dibatasi pada upload volume, cache Next.js, dan `/tmp`;
- port aplikasi bind ke `127.0.0.1` secara default;
- PostgreSQL tidak mempublikasikan port ke host;
- application dan database memiliki health check terpisah;
- application menunggu database healthy sebelum start;
- restart policy menggunakan `unless-stopped`;
- log Docker dirotasi maksimal lima file berukuran 10 MB per service;
- CPU, memory, PID, shared memory, dan graceful shutdown memiliki batas awal untuk VPS 4 GB;
- batas PID ditempatkan di `deploy.resources.limits.pids` agar kompatibel dengan Docker Compose modern dan tidak bercampur dengan legacy `pids_limit`;
- Chromium tetap memakai browser resmi yang cocok dengan versi Playwright project.

Nilai resource merupakan baseline awal dan harus dievaluasi kembali melalui monitoring pada Tahap 1D.6.

## Persistent volume

Compose production membuat tiga named volume:

| Volume | Mount | Fungsi |
|---|---|---|
| `postgres_data` | `/var/lib/postgresql/data` | data PostgreSQL |
| `app_uploads` | `/app/.data/uploads` | media ketika storage driver masih `local` |
| `app_next_cache` | `/app/.next/cache` | cache runtime Next.js |

Jangan menghapus volume production dengan `docker compose down --volumes`. Opsi tersebut hanya digunakan oleh smoke test disposable dengan project name terpisah.

## Menyiapkan environment lokal

Tahap 1D.2 menyediakan template dan generator production khusus:

```powershell
npm run env:prepare:production
npm run env:validate:production
```

Generator membuat `.env.production` dari `.env.production.example`, mengisi secret acak, menyinkronkan credential PostgreSQL pada `DATABASE_URL`, dan tidak mencetak nilai secret.

Untuk rehearsal loopback tanpa reverse proxy, ubah hanya nilai berikut setelah file dibuat:

```dotenv
APP_URL=http://127.0.0.1:3000
NEXT_PUBLIC_APP_URL=http://127.0.0.1:3000
TRUST_PROXY=false
TRUST_PROXY_HOPS=1
```

Jalankan kembali validator deployment setelah perubahan. Runbook lengkap tersedia di `docs/development/production-environment.md`.

## Validasi static

```powershell
npm run check:production-container
npm run container:production:config
```

`container:production:config` harus gagal bila variable PostgreSQL wajib belum tersedia. Kegagalan ini disengaja agar deployment tidak membuat database dengan credential kosong.

## Build dan menjalankan stack

```powershell
npm run container:production:build
npm run container:production:up

docker compose --env-file .env.production -f compose.production.yaml ps
docker compose --env-file .env.production -f compose.production.yaml logs --tail 100 app
```

Endpoint lokal:

- liveness: `http://127.0.0.1:3000/api/health`
- database readiness: `http://127.0.0.1:3000/api/health/database`

Menghentikan stack tanpa menghapus data:

```powershell
npm run container:production:down
```

## Smoke test disposable otomatis

Command berikut membuat environment sementara, memilih port loopback kosong, membangun image, menyalakan database dan aplikasi disposable, lalu memeriksa:

- liveness dan database readiness;
- runtime non-root;
- root filesystem read-only;
- upload, cache, dan `/tmp` tetap writable;
- CPU dan memory limit aktif;
- restart otomatis setelah proses aplikasi utama (child dari init) dibunuh dengan `SIGKILL`;
- cleanup container, network, volume, dan environment sementara.

```powershell
npm run test:container:production:local
```

Smoke test memakai project Compose terpisah dan menghapus volumenya pada blok `finally`. Command ini tidak memakai database development dari `compose.yaml`.

## Pemeriksaan manual tambahan

Setelah stack healthy:

```powershell
docker compose --env-file .env.production -f compose.production.yaml exec -T app id
docker compose --env-file .env.production -f compose.production.yaml exec -T app sh -lc "touch /app/probe"
```

Command `id` harus menunjukkan UID selain `0`. Percobaan menulis `/app/probe` harus gagal karena root filesystem read-only.

Pada Tahap 1D.1, smoke otomatis hanya membuktikan boundary container dan koneksi PostgreSQL ringan. Smoke UI login/POS serta receipt PDF dilakukan setelah workflow migration production tersedia pada Tahap 1D.3, atau memakai database test yang sudah dimigrasikan secara eksplisit. Jangan memakai database production untuk rehearsal ini.

## Troubleshooting

### App unhealthy tetapi database healthy

```powershell
docker compose --env-file .env.production -f compose.production.yaml logs --tail 200 app
```

Periksa environment fail-fast, health endpoint, permission volume, dan memory limit.

### Database unhealthy

```powershell
docker compose --env-file .env.production -f compose.production.yaml logs --tail 200 db
docker compose --env-file .env.production -f compose.production.yaml exec -T db sh -lc 'pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
```

### Cache atau upload permission denied

Named volume mungkin berasal dari rehearsal lama dengan ownership berbeda. Pastikan volume tersebut bukan volume production berisi data penting sebelum menghapusnya.

### Build menggunakan source atau secret yang tidak seharusnya

Periksa `.dockerignore`. File `.env*`, `.data`, backup, metadata Git, dan Hardware Hub tidak boleh masuk build context.

## Exit criteria 1D.1

Tahap 1D.1 selesai ketika:

- `npm run check:production-container` lulus;
- `npm run test:container:production:local` lulus;
- production image dapat dibangun ulang;
- app dan database berstatus healthy;
- app berjalan non-root dengan read-only root filesystem;
- restart policy, resource limit, log rotation, dan persistent volume terverifikasi;
- container dapat berkomunikasi dengan PostgreSQL melalui readiness check;
- smoke UI dan receipt PDF dijadwalkan setelah migration workflow Tahap 1D.3 tersedia.

## Database migrator service

Mulai Tahap 1D.3, production stack memiliki image dan service `migrate` terpisah. Application menunggu PostgreSQL healthy dan migration service selesai sukses sebelum start. `container:production:build` membangun target `app` dan `migrate` sekaligus.

Lihat `docs/development/database-deployment.md` untuk advisory lock, migration history validation, destructive-operation approval, rehearsal, dan failure handling.
