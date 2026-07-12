# P0-C — Authorization

Tahap ini memisahkan hak akses void/refund menjadi permission request, approve, dan execute serta menerapkan maker-checker di server.

## Permission baru

- `sales.void.request`
- `sales.void.approve`
- `sales.void.execute`
- `payments.refund.request`
- `payments.refund.approve`
- `payments.refund.execute`

## Assignment default

| Role | Void request | Void approve | Void execute | Refund request | Refund approve | Refund execute |
| --- | --- | --- | --- | --- | --- | --- |
| System Administrator | Ya | Ya | Ya | Ya | Ya | Ya |
| Owner | Ya | Ya | Ya | Ya | Ya | Ya |
| Manager | Ya | Ya | Ya | Ya | Ya | Ya |
| Cashier | Ya | Tidak | Tidak | Ya | Tidak | Tidak |
| Stock Admin | Tidak | Tidak | Tidak | Tidak | Tidak | Tidak |
| Finance | Tidak | Tidak | Tidak | Tidak | Ya | Ya |

Custom role tidak diberi permission baru secara otomatis. Owner/System Administrator harus meninjau dan mengaturnya lewat halaman role management.

## Aturan server-side

1. Request void/refund memerlukan permission request yang sesuai.
2. Approve dan reject memerlukan permission approve yang sesuai.
3. Requester tidak boleh approve atau reject request miliknya sendiri.
4. Penyelesaian approval memakai conditional update `status = pending`, sehingga dua keputusan bersamaan hanya menghasilkan satu pemenang.
5. Eksekusi void/refund memerlukan permission execute yang sesuai.
6. Approval lama dengan requester dan approver yang sama ditolak oleh transaction service.
7. Inbox, badge, live count, dashboard, dan report hanya menghitung tipe approval yang boleh dilihat user.
8. UI menyembunyikan form yang tidak diizinkan, tetapi server action tetap menjadi enforcement utama.

## Rollout

```bash
npm ci
npm run typecheck
npm run lint
npm run routes:check
DATABASE_URL='postgresql://user:pass@host:5432/database' npm run db:generate
npm run db:migrate
npm run build
```

Hasil `db:generate` yang diharapkan:

```text
No schema changes, nothing to migrate
```

Migration `0011_p0c_authorization.sql` tetap harus dijalankan melalui `db:migrate` karena migration tersebut berisi seed permission dan assignment role, bukan perubahan schema.

Setelah migration, user yang sedang login sebaiknya logout/login agar permission session dipastikan dimuat ulang.

## UAT wajib

1. Cashier dapat membuat request void dan refund tetapi tidak melihat tombol approve/execute.
2. Stock Admin dengan `sales.view` tidak melihat aksi void/refund.
3. Manager dapat approve request milik cashier.
4. Manager tidak dapat approve request yang dibuat oleh akun manager yang sama.
5. Dua manager approve/reject request yang sama secara bersamaan: hanya satu keputusan tersimpan.
6. Finance hanya melihat approval refund yang relevan dan dapat approve/execute refund.
7. Finance tidak dapat request atau mengeksekusi void.
8. User tanpa akses approval tidak melihat menu, drawer, badge, atau count approval.
9. Approved void hanya dapat dieksekusi user dengan `sales.void.execute`.
10. Approved refund hanya dapat dieksekusi user dengan `payments.refund.execute`.
11. Approval lama yang self-approved gagal dieksekusi dan meminta request baru.
12. Custom role tetap tidak mendapat permission baru sampai owner/admin menambahkannya secara eksplisit.

## Recovery

Jika migration sudah berjalan tetapi assignment default perlu dikoreksi, ubah permission role melalui halaman Administrasi → Role & Hak Akses. Jangan menghapus permission row karena audit dan role assignment dapat mereferensikannya.
