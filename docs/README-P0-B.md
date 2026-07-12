# Asihjaya RMS — P0-B Transaction Service Patch

Apply this patch on top of the completed P0-A source.

## Files

- `src/features/sales/transaction-service.ts` — centralized atomic void/refund service.
- `src/features/sales/admin-actions.ts` — thin server-action wrappers.
- `src/features/sales/admin-queries.ts` — reads approval execution columns.
- `src/features/sales/admin-contracts.ts` — execution status contract.
- `src/components/sales/sale-sensitive-actions-card.tsx` — execution state UI.
- `docs/production-readiness/p0-b-transaction-service.md` — rollout and UAT guide.

## Migration

No database migration is required after P0-A.

## Verify

```bash
npm run typecheck
npm run lint
npm run routes:check
DATABASE_URL=postgresql://asihjaya:asihjaya_dev@localhost:5432/asihjaya_rms
npm run db:generate
```

`db:generate` must report: `No schema changes, nothing to migrate`.
