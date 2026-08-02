## Ringkasan

Jelaskan tujuan perubahan dan area aplikasi yang terdampak.

## Jenis perubahan

- [ ] Refactor tanpa perubahan behavior
- [ ] Perbaikan bug
- [ ] Fitur baru
- [ ] Infrastruktur / dokumentasi

## Kontrak yang dipertahankan

- [ ] Tidak mengubah route atau public Server Action tanpa dokumentasi eksplisit
- [ ] Tidak mengubah payload checkout atau formula finansial tanpa test baru
- [ ] Tidak mengubah transaction boundary atau migration tanpa review khusus
- [ ] Tidak mengubah UI/UX tanpa screenshot dan penjelasan

## Validasi otomatis

- [ ] `npm run verify:pos-stage-1c:local` (untuk perubahan POS Stage 1C)
- [ ] GitHub Actions hijau
- [ ] Tidak ada warning ESLint atau error TypeScript

## Smoke test manual

Tuliskan skenario yang diuji dan hasilnya. Untuk perubahan POS, periksa minimal scan/search, cart, customer, hold/resume, discount approval, payment, checkout recovery, receipt, serta shift.

## Database dan deployment

- Migration: tidak ada / ada (jelaskan)
- Environment variable baru: tidak ada / ada (jelaskan)
- Langkah deployment khusus: tidak ada / ada (jelaskan)

## Risiko dan rollback

Jelaskan risiko utama, area yang perlu diperhatikan reviewer, dan cara rollback yang aman.
