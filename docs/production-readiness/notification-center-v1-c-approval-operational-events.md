# Notification Center V1-C — Approval Result & Operational Events

## Status

Implemented.

V1-C menjaga pemisahan berikut:

- **Approval Drawer** tetap menjadi kotak masuk keputusan approve/reject.
- **Notification Center** menerima hasil approval, tugas setelah approval, kegagalan eksekusi, dan kejadian operasional.
- Pending approval tidak diduplikasi ke Notification Center.

## Approval result events

| Event type | Penerima | Actionable |
|---|---|---:|
| `approval.approved` | Requester | Tidak |
| `approval.rejected` | Requester | Tidak |
| `approval.execution_ready` | Requester dan user dengan permission execute | Ya |
| `approval.execution_failed` | Requester, approver, executor, dan user execute | Ya |
| `approval.void_completed` | Requester, approver, executor | Tidak |
| `approval.refund_completed` | Requester, approver, executor | Tidak |

Approval void/refund yang disetujui menggunakan satu shared event `approval.execution_ready`, sehingga requester dan executor tidak menerima card duplikat terpisah.

## Return workflow events

| Event type | Trigger | Penerima |
|---|---|---|
| `return.awaiting_receipt` | Refund selesai dan return case dibuat | `returns.receive` |
| `return.pending_inspection` | Seluruh item sudah diterima | `returns.inspect` |
| `return.completed` | Seluruh item selesai diperiksa | `returns.view`, atau inventory/inspection untuk hasil bermasalah |

Lifecycle otomatis:

```text
return.awaiting_receipt
→ resolved ketika seluruh item diterima
→ return.pending_inspection
→ resolved ketika seluruh item selesai diperiksa
→ return.completed
```

## Reconciliation events

- `payment.reconciliation_mismatch`
- `payment.reconciliation_not_found`
- `settlement_import.completed_with_issues`
- `settlement_import.completed`

Mismatch/not-found otomatis menjadi resolved ketika payment dipindahkan ke status yang tidak lagi bermasalah. Import issue tetap satu event aktif selama batch masih mempunyai unresolved rows dan menjadi resolved ketika semua row selesai.

## Existing operational producers modernized

- `shift.cash_variance`
- `cash.manual_movement`
- `hardware.job_failed`
- `hardware.agent_offline`
- `hardware.agent_recovered`
- `hardware.jobs_recovered`

Producer tersebut sekarang mempunyai event type eksplisit, deep link, recipient targeting, actionable state, dan deduplication key yang stabil.

## Transaction consistency

Event berikut dibuat di transaction database yang sama dengan perubahan bisnis:

- Approval approved/rejected
- Void/refund completed
- Return case created
- Return receipt transition
- Return inspection transition
- Manual payment reconciliation
- Settlement import completion state

Jika transaksi bisnis rollback, event terkait ikut rollback.

`approval.execution_failed` dibuat setelah rollback agar kegagalan tetap tercatat tanpa mengubah hasil transaksi finansial.

## Database impact

V1-C tidak menambah tabel, enum, kolom, index, atau migration baru. Schema V1-A sudah mencukupi.

```text
npm run db:migrate → tidak diperlukan
npm run db:seed    → tidak diperlukan
```

## Validation

```bash
npm run check:notifications:v1a
npm run check:notifications:v1b
npm run check:notifications:v1c
npm run typecheck
npm run lint
npm run routes:check
npm run build
```

## UAT checklist

1. Approve discount/manual payment menghasilkan notification untuk requester.
2. Reject approval menghasilkan warning dengan catatan penolakan.
3. Approve void/refund menghasilkan satu `approval.execution_ready`.
4. Eksekusi void/refund menyelesaikan event ready dan membuat completed event.
5. Eksekusi gagal membuat critical notification tanpa mengubah sale/payment.
6. Refund sukses membuat `return.awaiting_receipt`.
7. Penerimaan item terakhir memindahkan lifecycle ke `return.pending_inspection`.
8. Pemeriksaan item terakhir menghasilkan `return.completed`.
9. Reconciliation mismatch/not-found membuat actionable notification.
10. Reconciled/waived menyelesaikan issue notification.
11. Settlement import dengan issue menghasilkan satu event aktif, bukan satu event per row.
12. Pending approval tidak muncul sebagai notification biasa.
