# Notification Center V1-D — Modern Expandable Drawer UI

## Status

Implemented.

## Objective

Modernize the admin notification drawer without merging it with the Approval Drawer. The Notification Center remains an awareness and operational follow-up surface, while pending approval decisions remain in the dedicated Approval Drawer.

## UI behavior

The drawer now provides three client-side views:

- `Semua`
- `Perlu tindakan`
- `Belum dibaca`

Each notification is collapsed by default and can be expanded independently. The expanded view can display:

- Event summary and exact timestamp
- Outlet scope
- Safe structured payload fields
- Transaction and settlement amounts
- Item and import counts
- Split-payment details
- Contextual deep-link CTA
- Read/unread action
- Per-user archive action

Only one card is expanded at a time to keep the drawer compact on mobile screens.

## Recipient state actions

Supported actions:

- Mark one notification as read
- Mark one notification as unread
- Mark all accessible unread notifications as read
- Archive one notification for the current recipient

Archive is a per-recipient presentation state. It does not delete the shared event, financial record, approval, audit trail, or operational entity.

A resolved notification cannot be changed back to unread. It can still be archived from the drawer.

## Authorization and scope

Every server action verifies:

- Authenticated user has `admin.access`
- Recipient belongs to the authenticated user
- Event belongs to the authenticated organization
- Event is organization-wide or belongs to an accessible outlet

The client never mutates a shared event directly.

## Counts

The drawer query now returns:

- Global unread recipient count
- Global active actionable recipient count
- Up to 40 latest non-archived rows

An actionable row requires all of the following:

- Event has `requires_action = true`
- Event has not been resolved
- Recipient state is `unread`, `read`, or `acknowledged`

The Admin Shell synchronizes its bell badge after server refresh and also accepts optimistic unread-count updates from the drawer.

## Payload privacy

The drawer only renders selected safe payload keys. Internal UUIDs and arbitrary JSON values are not shown by the generic detail renderer. Transaction payment details display method, provider, and amount without exposing payment evidence or sensitive customer data.

## Database impact

No schema or migration changes are required. V1-D uses the event and recipient model introduced in V1-A.

Do not run `db:seed` for this feature.

## Validation

```bash
npm run check:notifications:v1a
npm run check:notifications:v1b
npm run check:notifications:v1c
npm run check:notifications:v1d
npm run typecheck
npm run lint
npm run routes:check
npm run db:generate
npm run build
```

`db:generate` should report no schema changes.

## UAT checklist

1. Bell opens Notification Center without opening Approval Drawer.
2. `Semua`, `Perlu tindakan`, and `Belum dibaca` filters show the correct rows.
3. Chevron expands and collapses a card.
4. Expanded sale card shows invoice, total, sales person, item count, and payment details when available.
5. Expanded operational card shows only safe relevant fields.
6. Mark read immediately decreases the bell badge.
7. Mark unread immediately increases the bell badge.
8. Mark all read clears all accessible unread rows.
9. Archive removes only the current user's recipient row from the drawer.
10. Another recipient still sees the same shared event.
11. Resolved notifications display `Selesai` and cannot be marked unread.
12. Active actionable notifications display `Perlu tindakan`.
13. Deep-link CTA closes the drawer and opens the correct page.
14. Escape key and backdrop close the drawer.
15. Approval pending requests remain only in Approval Drawer.
