# Decision Log

## D-001 — Modular monolith

Satu aplikasi Next.js dan satu PostgreSQL digunakan pada fase awal. Tidak memakai microservices atau Kubernetes.

## D-002 — Docker Compose

Docker Compose dipakai untuk environment dan deployment. Untuk development Windows, PostgreSQL berjalan di Docker sementara Next.js dapat berjalan langsung pada host agar hot reload lebih nyaman.

## D-003 — Serialized inventory

Satu item jewelry fisik sama dengan satu Product Item, satu SKU/barcode unik, dan quantity satu.

## D-004 — Varian bersifat opsional

Master dapat langsung mempunyai Item Produk atau melalui Varian Produk ketika kombinasi spesifikasi berulang memang berguna.

## D-005 — Admin dan POS terpisah secara layout

Dashboard Admin dan POS berada dalam satu codebase, tetapi memakai app shell dan workflow berbeda.

## D-006 — POS responsive/PWA

Mini PC adalah register/hardware hub. HP/tablet dapat scan, membuat draft sale, dan melayani customer. Printing dan cash drawer tetap dikoordinasikan melalui register.

## D-007 — Bahasa antarmuka

Seluruh interface menggunakan Bahasa Indonesia.

## D-008 — Dokumen customer gabungan

Satu dokumen A4 landscape berfungsi sebagai Surat Jaminan dan Bukti Transaksi. Thermal receipt tidak wajib untuk fase awal.

## D-009 — Payment gateway tidak wajib pada fase pertama

Core POS memakai pembayaran manual terstruktur. Integrasi Midtrans disiapkan secara provider-agnostic dan dapat ditambahkan untuk QRIS dinamis setelah core stabil.

## D-010 — Online checkout only

Versi pertama tidak mengizinkan checkout offline untuk mencegah duplicate sale dan konflik inventory.
