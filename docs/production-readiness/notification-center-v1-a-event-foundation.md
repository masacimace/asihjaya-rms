# Notification Center V1-A — Data Model & Event Foundation

## Status

Implemented. This stage intentionally keeps the existing Approval Drawer and
Notification Drawer UI unchanged.

## Goals

- Separate a shared operational event from each recipient's personal state.
- Make read/archive/resolution lifecycle possible without duplicating payloads.
- Target recipients by permission and outlet rather than role name.
- Prevent duplicate active events with a deterministic deduplication key.
- Provide a single publishing service for every module.
- Preserve existing notification history and current drawer behavior.

## New model

### `notification_events`

One row represents one operational event:

- organization and optional outlet scope
- category and event type
- severity
- title and summary
- entity reference
- internal action URL
- structured payload
- `requires_action`
- active-event deduplication key
- occurrence and resolution timestamps

Categories:

- `sales`
- `payment`
- `cash_shift`
- `inventory_return`
- `hardware`
- `security`
- `system`
- `approval_result`

### `notification_recipients`

One row represents one user's state for an event:

- `unread`
- `read`
- `acknowledged`
- `resolved`
- `archived`

The unique `(event_id, user_id)` constraint prevents duplicate delivery to the
same user.

## Recipient targeting

`publishNotificationEvent` supports:

- explicit user IDs
- any-of permission codes
- outlet scope
- excluded users

An outlet-scoped event is only delivered to active users who are assigned to
that outlet. A generic event defaults to users with `admin.access`.

## Deduplication

Active events may provide a key such as:

```text
sale.completed:<saleId>
hardware.agent.offline:<agentId>
payment.mismatch:<paymentId>
```

The database only allows one unresolved event with the same organization and
key. PostgreSQL advisory locks also serialize concurrent publishers.

## Existing notification compatibility

Migration `0023_notification_center_v1a_foundation.sql`:

1. Creates event and recipient tables.
2. Backfills every existing `notifications` row as an event.
3. Preserves direct user recipients.
4. Expands organization/outlet notifications to active users with
   `admin.access` and the correct outlet assignment.
5. Preserves legacy read state per generated recipient.
6. Keeps the old `notifications` table for rollback/history compatibility.

New application reads and writes use the event/recipient model. The legacy
model is no longer used by current producers.

## Current producers migrated

- POS sale-completed notification
- Hardware job and Hardware Hub notifications
- Shift variance notifications
- Manual cash movement notifications

The POS event is written in the same database transaction as the sale and uses:

```text
sale.completed:<saleId>
```

This preserves checkout idempotency and prevents duplicate notifications.

## Existing UI compatibility

The current drawer still receives the same presentation fields. Its row ID now
represents `notification_recipients.id`, not the shared event ID. Therefore,
marking a notification as read affects only the current user.

The latest uploaded `admin-shell.tsx` was reviewed and intentionally left
unchanged in V1-A. Its unread badge, polling, sound hook, and drawer props remain
compatible with the new query contract.

## Rollout

### 1. Backup

Back up the database before migration.

### 2. Preflight

```bash
npm run db:preflight:notifications:v1a
```

Expected:

```text
[OK] admin_access_permission
[OK] legacy_notification_outlet_scope
[OK] legacy_notification_user_scope
```

### 3. Schema comparison

```bash
npm run db:generate
```

Expected after applying this patch:

```text
No schema changes, nothing to migrate
```

### 4. Migration

```bash
npm run db:migrate
```

Migration:

```text
0023_notification_center_v1a_foundation.sql
```

### 5. Validation

```bash
npm run typecheck
npm run lint
npm run routes:check
npm run check:notifications:v1a
npm run build
```

## UAT

1. Existing notification history remains visible after migration.
2. A global unread notification appears for each eligible admin independently.
3. User A marking a notification read does not mark User B's recipient read.
4. Outlet A notification is not delivered to users scoped only to Outlet B.
5. Hardware offline polling does not create duplicate unresolved events.
6. Hardware recovery resolves the offline event and emits one recovery event.
7. POS checkout creates one `sale.completed` event and one recipient per eligible admin.
8. Retrying the same checkout does not create a second sale event.
9. Live unread count matches the current user's unread recipient rows.
10. Approval Drawer behavior is unchanged and remains separate.

## Next stage

Notification Center V1-B:

- refine transaction recipients to owner/manager outlet
- high-value transaction event
- split-payment transaction event
- checkout recovery event
- notification preferences and thresholds
