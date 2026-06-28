# Permission Matrix Awal

Matrix ini adalah baseline dan akan dikonfirmasi dengan owner sebelum go-live.

| Kemampuan | Kasir | Admin Stok | Manager | Finance | Owner | System Admin |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| Login POS | ✓ |  | ✓ |  | ✓ | ✓ |
| Open/close shift | ✓ |  | ✓ |  | ✓ | ✓ |
| Membuat transaksi | ✓ |  | ✓ |  | ✓ | ✓ |
| Melihat transaksi shift sendiri | ✓ |  | ✓ |  | ✓ | ✓ |
| Mengajukan diskon | ✓ |  | ✓ |  | ✓ | ✓ |
| Menyetujui diskon |  |  | Terbatas |  | ✓ | ✓ |
| Mengajukan refund/void | ✓ |  | ✓ |  | ✓ | ✓ |
| Menyetujui refund/void |  |  | Terbatas | ✓ | ✓ | ✓ |
| Membuat master produk |  | Terbatas | ✓ |  | ✓ | ✓ |
| Membuat item produk draf |  | ✓ | ✓ |  | ✓ | ✓ |
| Mengaktifkan item |  | Terbatas | ✓ |  | ✓ | ✓ |
| Melihat harga modal |  | ✓ | ✓ | ✓ | ✓ | ✓ |
| Mengubah harga jual |  |  | ✓ |  | ✓ | ✓ |
| Stock adjustment |  | Ajukan | Setujui |  | ✓ | ✓ |
| Stock opname |  | ✓ | ✓ |  | ✓ | ✓ |
| Melihat laporan penjualan | Terbatas |  | ✓ | ✓ | ✓ | ✓ |
| Melihat laporan finance |  |  | Terbatas | ✓ | ✓ | ✓ |
| Mengelola staff |  |  | Terbatas |  | ✓ | ✓ |
| Mengelola role/permission |  |  |  |  | Terbatas | ✓ |
| Mengubah integrasi teknis |  |  |  |  |  | ✓ |
| Melihat audit log |  |  | Terbatas | Terbatas | ✓ | ✓ |

## Aturan

- Permission selalu divalidasi server-side.
- Setiap user memakai akun sendiri.
- User dinonaktifkan, bukan dihapus.
- Permission dapat dibatasi berdasarkan outlet.
- Tindakan sensitif dapat membutuhkan re-authentication atau approval pengguna kedua.
- Owner dan System Admin adalah role bawaan yang tidak dapat dihapus.
