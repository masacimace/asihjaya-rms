# Notification Center V1-E — Full Notification Page

## Status

Implemented.

## Objective

Provide a complete admin notification workspace at `/admin/notifikasi` while keeping the notification drawer as a compact quick-access surface.

## Access model

- Requires `admin.access`.
- Every query is restricted to the authenticated user recipient row.
- Organization scope is always enforced.
- Outlet-scoped events are limited to outlets assigned to the authenticated user.
- Bulk mutations re-check recipient ownership, organization, and outlet scope on the server.
- Client-selected recipient IDs are capped at 100 per request.

## Page capabilities

### Search

Searches notification:

- title
- summary
- event type
- entity identifier
- outlet code
- outlet name

### Filters

- Status: active, unread, read, actionable, resolved, archived
- Category: sales, payment, shift/cash, return/inventory, hardware, security, system, approval result
- Severity: info, success, warning, critical
- Outlet
- Date presets: today, 7, 30, 90 days, all time
- Custom start/end date in Asia/Jakarta operational time

### Summary cards

Summary counts respect search, category, severity, outlet, and period filters while remaining independent from the selected status tab:

- Active notifications
- Unread
- Actionable
- Resolved
- Archived

### Pagination

- 20 recipient notifications per page
- Server-side pagination
- Query filters are preserved when navigating pages

### Bulk actions

- Mark selected notifications read
- Mark selected notifications unread when eligible
- Archive selected notifications
- Select all rows on the current page

Archive is a recipient-only visibility state. It does not delete shared notification events or related audit/financial records.

## Shared card UI

The expandable notification card is now shared between:

- Notification Drawer
- Full Notification Page

This keeps category icons, severity colors, safe payload details, payment breakdowns, contextual CTA labels, read/unread actions, and archive behavior consistent.

## Drawer integration

The drawer footer now includes:

- `Lihat semua notifikasi` → `/admin/notifikasi`
- `Tandai semua dibaca`

The Approval Drawer remains separate and unchanged.

## Database impact

No schema, enum, index, constraint, or migration changes.

Do not run `db:migrate` or `db:seed` specifically for V1-E.

## Validation

```bash
npm run check:notifications:v1a
npm run check:notifications:v1b
npm run check:notifications:v1c
npm run check:notifications:v1d
npm run check:notifications:v1e
npm run typecheck
npm run lint
npm run routes:check
npm run db:generate
npm run build
```

## UAT checklist

1. Open Notification Drawer and click `Lihat semua notifikasi`.
2. Confirm `/admin/notifikasi` loads only recipient notifications for the logged-in user.
3. Search by invoice, title, event type, and outlet.
4. Test category, severity, status, outlet, and period filters.
5. Test custom date start/end filters.
6. Expand cards and inspect safe details and payment breakdown.
7. Open a contextual CTA and verify the correct entity page.
8. Select one or multiple rows and mark them read.
9. Mark eligible rows unread.
10. Archive selected rows and verify they disappear from active views.
11. Filter status to `Diarsipkan` and verify archived rows are visible.
12. Verify archived rows cannot be archived again.
13. Verify pagination preserves all active filters.
14. Verify unread badge in Admin Shell refreshes after mutations.
15. Verify another user recipient is unaffected by the current user's read/archive changes.
16. Verify Approval Drawer still operates independently.
