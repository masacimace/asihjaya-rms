# Product Batch Import — Test Matrix 2B.9

Status: implementation gate sebelum 2B.10 Local Acceptance Rehearsal.

Dokumen ini hanya membahas Product Batch Import. Database integration test wajib memakai PostgreSQL 17 disposable dan storage lokal khusus test; jangan arahkan runner ke database development/production yang menyimpan data bisnis.

## Automated integration suite

Command utama:

```powershell
npm run test:product-batch:local
```

Runner membuat PostgreSQL 17 sementara melalui `compose.product-batch-test.yaml`, menjalankan seluruh migration, menjalankan integration suite, lalu menghapus container + volume test.

Suite `tests/integration/product-batch-import-suite.ts` mencakup:

| Kasus | Bukti utama |
| --- | --- |
| 1 Product Master + 1 Product Item | session ready → completed; master/item generated identity tersimpan |
| 1 master + banyak item | physical image, master fallback, draft, available |
| Multiple Product Masters | count exact dan Product Master code unik |
| Existing `PM-000001` collision | generator melewati code existing dan tidak memakai `MAX()+1` |
| Item available | `goods_receipt` dibuat |
| Item draft | tidak membuat opening movement |
| Barcode registry | `source=system_generated`, primary + active |
| POS barcode scan | barcode hasil commit menghasilkan status `found` |
| Label selected/all/reprint | `print_label_sato`, exact target agent, request-id idempotency |
| Invalid category | validation error tersimpan, product tables tidak disentuh |
| Invalid/inaccessible outlet | validation error tersimpan |
| Duplicate `master_key` | invalid staging row |
| Duplicate `row_key` | invalid staging row |
| Invalid money/weight | `NUMERIC_VALUE_INVALID` |
| Missing image | package ditolak sebelum session staging |
| Corrupt image | package ditolak sebelum session staging |
| Duplicate upload | organization-scoped duplicate hash guard |
| Cross-organization | same hash boleh di tenant lain; preview/commit session tenant lain ditolak |
| Failure after media promotion | no partial product + compensating media cleanup |
| Failure after identifier allocation | no partial master/item/barcode; sequence gap diperbolehkan |
| Concurrent double commit | tepat satu commit sukses, satu `SESSION_NOT_READY` |

## Parser/security coverage

Integration suite bukan pengganti parser/security fixtures 2B.3. Jalankan juga:

```powershell
npm run check:product-batch-security
npm run check:product-batch-parser
```

Keduanya tetap menjadi source of truth untuk corrupt ZIP/XLSX, zip slip, duplicate archive entry, archive bomb, formula/hyperlink, macro/active content, unsupported template, row limits, MIME/image validation, dan archive layout contract.

## Database/atomic coverage

Jalankan:

```powershell
npm run check:product-batch-database
npm run check:product-batch-staging
npm run check:product-batch-commit
npm run check:product-batch-results
npm run check:product-batch-maintenance
```

Untuk database development lokal yang memang dipakai smoke test sebelumnya, checker live per-session masih dapat digunakan. Integration suite 2B.9 sendiri tidak membutuhkan UUID session manual karena membuat fixture disposable sendiri.

## Regression gates

Command ringkas:

```powershell
npm run check:product-batch-regression
```

Mencakup minimum:

```text
check:xlsx-security
check:legacy-product-migration
check:settlement-import
check:inventory-label
check:camera-scanner
check:pos-stage-1c
check:database-deployment
```

Selain itu final static gate tetap:

```powershell
npm run typecheck
npm run lint
npm run routes:check
npm run build
```

Manual Product Master create dan manual Product Item create tetap perlu smoke test browser pada 2B.10 karena action tersebut bergantung pada session/UI nyata. Effective-image regression manual harus memastikan item available tanpa physical image tetap valid jika Product Master mempunyai primary image.

## Manual browser/hardware checks

2B.9 automated suite membuktikan label hardware job dibuat dengan target/capability yang benar, tetapi tidak menggantikan acceptance Hardware Hub process nyata. Sebelum 2B.10 ditutup, ulangi minimum:

1. Upload valid ZIP dari halaman admin dan refresh preview.
2. Commit batch kecil.
3. Scan minimal satu barcode `available` melalui POS.
4. `Print selected` dan `Print all eligible` harus menghasilkan `print_label_sato` yang di-claim Hardware Agent/fake adapter.
5. Download result XLSX dan buka di Microsoft Excel.
6. Buka history completed session setelah maintenance dry-run/cleanup.
7. Buat Product Master manual dan Product Item manual untuk memastikan flow lama tetap berfungsi.

Printer SATO fisik tidak diperlukan untuk membuktikan claim/job lifecycle bila fake adapter digunakan. Printer fisik diperlukan pada physical acceptance untuk ukuran label, sensor/gap, darkness, dan readability barcode.

## Exit criteria 2B.9

2B.9 dianggap lulus bila:

- `npm run check:product-batch-import` lulus;
- `npm run test:product-batch:local` lulus seluruh case;
- `npm run check:product-batch-regression` lulus;
- `typecheck`, `lint`, `routes:check`, dan `build` lulus;
- tidak ada migration/schema baru dari tahap testing;
- tidak ada perubahan barcode/legacy migration/hardware protocol untuk sekadar membuat test lulus;
- manual smoke test yang membutuhkan browser/Hardware Hub tidak menunjukkan regression.

Setelah itu lanjut 2B.10 menggunakan database lokal fresh dan existing sesuai roadmap.
