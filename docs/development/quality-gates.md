# Quality Gates dan Continuous Integration

Dokumen ini menetapkan pemeriksaan minimum sebelum perubahan Asihjaya RMS digabungkan atau dideploy.

## Prinsip

- Dependency selalu dipasang dengan `npm ci` agar mengikuti `package-lock.json`.
- Command lokal dan GitHub Actions menggunakan npm script yang sama.
- Database CI selalu disposable dan tidak pernah memakai database development atau production.
- Secret CI hanya nilai dummy dengan entropy/panjang yang memenuhi validator aplikasi.
- Setiap check harus menguji perilaku atau kontrak aktif; check milestone berbasis pencarian teks dipensiunkan.

## Command lokal

Pemeriksaan lengkap tanpa mengubah database:

```bash
npm ci
npm run check:all
```

Kelompok pemeriksaan:

```bash
npm run check:quality
npm run check:static
npm run check:security
npm run check:transactions
npm run check:business
npm run check:hardware
npm run build
```

Financial/concurrency integration test menggunakan PostgreSQL disposable dan dijalankan terpisah:

```bash
npm run test:financial:local
```

Untuk database test yang sudah dimigrasikan, gunakan `npm run test:financial`. Dokumentasi lengkap tersedia di `docs/development/financial-concurrency-tests.md`.

`check:quality` mencakup konfigurasi quality gate, source hygiene, dan metadata migration. `check:static` mencakup ESLint, TypeScript, serta route contract.

## Rehearsal migration PostgreSQL 17

Gunakan database kosong/disposable. Jangan arahkan command ini ke database production.

```bash
npm run check:database
npm run db:migrate
npm run db:migrate
npm run check:database:live
```

Pemanggilan migration kedua harus menjadi no-op. Pemeriksaan live memvalidasi:

- PostgreSQL major version 17.
- Jumlah migration sesuai Drizzle journal.
- Tabel security, customer history, deposit, sales, dan Hardware Hub tersedia.
- Kolom kritis dari migration terbaru tersedia.

## Klasifikasi check script

Semua `scripts/check-*` harus tercatat pada `scripts/check-suite-manifest.json`.

- `blocking`: kontrak aktif yang wajib lulus pada pull request.
- `infrastructure`: pemeriksaan CI, source hygiene, dan migration.
- `manual`: kontrak aktif yang memerlukan runtime khusus, misalnya Chromium untuk rendering PDF.

Check lama berbasis milestone atau pencarian potongan source harus diganti dengan assertion perilaku, dipindahkan ke suite aktif, atau dipensiunkan secara eksplisit.

## Source hygiene

`npm run check:source-hygiene` memeriksa file yang dilacak Git dan menolak antara lain:

- `.env` dan credential lokal.
- `node_modules`, `.next`, report, dan test output.
- SQLite journal, key, log, serta artefak simulasi Hardware Hub.
- Database dump dan backup.
- Private key atau pola token berisiko tinggi.

`.env.example` dan `hardware-hub/.env.example` tetap diperbolehkan karena hanya berisi contoh.

## GitHub Actions

Workflow `.github/workflows/ci.yml` berjalan pada push, pull request, dan manual dispatch. Workflow membatalkan run lama ketika commit baru masuk pada ref yang sama.

Status check utama:

1. **Static Quality** — install, lint, typecheck, route check, dan production build.
2. **Security & Business Checks** — quality config, source hygiene, migration metadata, security contracts, business contracts, dan kontrak hardware sisi aplikasi.
3. **Database Migration** — PostgreSQL 17 disposable, migration dua kali, lalu schema verification.
4. **Hardware Hub Checks** — request signing, DPAPI mock, Protocol v2, failure injection, operations, PDF profile, dan SATO golden files.
5. **Financial & Concurrency Tests** — PostgreSQL 17 disposable, checkout race, Dana Titip, refund replay, settlement deduplication, hardware exactly-once, dan tenant isolation.

CI tidak melakukan print fisik, tidak mengakses perangkat outlet, dan tidak memakai credential production.

## Pemeriksaan manual sebelum release

Jalankan kontrak otomatis yang memerlukan Chromium melalui:

```bash
npm run check:manual
```

Pemeriksaan berikut tetap manual sampai workflow browser/hardware khusus tersedia:

- Kamera scanner pada browser target.
- PDF Playwright menggunakan Chromium production image dan hasil visualnya.
- Print Epson A4 pada kertas nyata.
- Alignment label SATO CG408TT.
- Startup task dan DPAPI nyata pada Windows outlet.
- End-to-end Hardware Hub dengan perangkat fisik.

## Branch protection yang disarankan

Setelah workflow stabil pada beberapa pull request, lindungi branch utama dan wajibkan status:

- Static Quality
- Security & Business Checks
- Database Migration
- Hardware Hub Checks
- Financial & Concurrency Tests

Nonaktifkan force push dan direct push ke branch production, lalu gunakan pull request untuk perubahan aplikasi.

## Troubleshooting

### CI lulus tetapi lokal gagal

Pastikan versi Node mengikuti `.nvmrc`, hapus `.next`, lalu ulangi `npm ci`.

### Migration rehearsal gagal

Periksa bahwa database benar-benar kosong, PostgreSQL versi 17, `DATABASE_URL` benar, dan file migration telah masuk ke `drizzle/meta/_journal.json`.

### Source hygiene gagal

Hapus file sensitif dari Git tracking, bukan hanya dari filesystem:

```bash
git rm --cached <file>
```

Kemudian pastikan pola yang sesuai sudah ada di `.gitignore`.
