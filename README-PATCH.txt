ASIHJAYA RMS — P0-A DATABASE SAFETY PATCH

Salin file di archive ini ke root project dengan struktur folder yang sama.
Sebelum migration:
  npm ci
  npm run db:preflight:p0a

Jika preflight lulus:
  npm run db:migrate

Baca docs/production-readiness/p0-a-database-safety.md sebelum rollout.
