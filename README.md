# Asihjaya Retail Management System

Cloud-hosted retail management system untuk operasional jewelry Asihjaya. Project ini berisi **Admin Dashboard** dan **POS Web App** dengan fondasi PostgreSQL/Drizzle, autentikasi custom, role-based access control, manajemen administrasi, produk, inventaris, foto produk/item, dan starter queue untuk cetak label SATO melalui local Hardware Hub.

> Status: masih tahap development. Beberapa modul sudah memakai real database, sementara POS, penjualan, pelanggan, operasional, laporan, dan dashboard utama masih perlu dihubungkan ke backend secara bertahap.

## Stack

- Next.js App Router + TypeScript strict
- React + Tailwind CSS
- PostgreSQL lokal melalui Docker Compose
- Drizzle ORM dan migration
- Custom auth/session berbasis cookie + database session
- Role dan permission per organization
- Local/S3-compatible image storage
- Starter Asihjaya Hardware Hub untuk silent print label SATO

## Persyaratan lokal

- Windows 10/11, macOS, atau Linux
- Node.js 22 atau 24 LTS
- npm
- Docker Desktop / Docker Engine dengan Compose
- Git

## Setup local development

```bash
# 1. Masuk ke folder project
cd asihjaya-rms

# 2. Buat file environment lokal
cp .env.example .env

# 3. Jalankan PostgreSQL
docker compose up -d db

# 4. Install dependency
npm install

# 5. Jalankan migration
npm run db:migrate

# 6. Seed data development
npm run db:seed

# 7. Jalankan aplikasi
npm run dev
```

Untuk Windows PowerShell, salin env dengan:

```powershell
Copy-Item .env.example .env
```

Buka:

- `http://localhost:3000/login`
- `http://localhost:3000/admin`
- `http://localhost:3000/pos`
- `http://localhost:3000/api/health`
- `http://localhost:3000/api/health/database`

## Pemeriksaan sebelum commit

npm run routes:check
npm run typecheck
npm run lint
npm run build
