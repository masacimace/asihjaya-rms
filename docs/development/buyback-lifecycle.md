# Buyback Lifecycle — Current Contract

This document is the engineering source-of-truth for the current ASIHJAYA RMS Buyback lifecycle after B1–B4 stabilization.

Status:

```text
B1 Data Model & Lifecycle              DONE
B2 Simplified Acquisition              DONE
B3 Cuci / Rongsok Processing           DONE
UI/UX Refinement                       DONE
B4 POS + Historical Identity Audit     DONE
```

Related migrations:

```text
0022_buyback_processing_lifecycle
0023_buyback_simplified_acquisition
```

## 1. Core Invariant

```text
Buyback completed != saleable inventory
```

A completed Buyback acquisition creates a processing obligation.

The item only becomes saleable after Cuci/Rongsok completion records the physical result.

## 2. Lifecycle

```text
Sale / external physical item
        ↓
Buyback acquisition
        ↓
pending processing
        ↓
Cuci or Rongsok
        ↓
processing completed
        ↓
used + available + outlet
        ↓
POS saleable
```

Processing types:

```text
cleaning     → UI: Cuci
recondition  → UI: Rongsok
```

Processing status:

```text
pending
completed
```

## 3. Acquisition Contract

Buyback intake records acquisition facts.

Operator-facing fields include:

- source;
- product/display name;
- processing type;
- category;
- color;
- purity;
- weight;
- final Total Harga;
- acquisition photo.

Quantity is effectively one physical item per Buyback item.

The final Buyback amount is entered as the agreed acquisition amount. The simplified intake does not require a Buyback price-per-gram workflow.

## 4. Existing ASIHJAYA Item

An existing ASIHJAYA item is a previously known Physical Product Item.

On Buyback acquisition:

```text
same Product Item ID
same SKU
same barcode / QR identity

availability → processing
```

The Buyback must not generate a replacement Physical Product Item only because the same object changed ownership/lifecycle.

During processing completion:

- result Product Master/current display identity may be updated;
- result weight may change;
- result purity may change;
- result color may change;
- result photo becomes current inventory image;
- acquisition cost becomes the final Buyback amount;
- availability becomes `available`;
- condition becomes `used`;
- location becomes `outlet`.

Stable physical identity remains preserved.

## 5. External Buyback

External Buyback has no pre-existing ASIHJAYA Product Item.

At acquisition:

```text
buyback_items.product_item_id = NULL
```

No Product Master mapping is required at intake.

At Cuci/Rongsok completion:

1. operator selects an existing compatible Product Master or creates one through supported quick-create flow;
2. Product Item is created atomically;
3. identifiers are generated;
4. result attributes are stored;
5. acquisition cost is set from Buyback final amount;
6. item becomes `used + available + outlet`.

The external item does not become a saleable Product Item before this completion.

## 6. No Extra Approval Layer

Current final flow intentionally does not add:

- processing approval;
- manager PIN for completion;
- manual inventory activation after completion;
- reopen/cancel workflow after normal completion.

Operator decisions are intentionally limited to:

1. Cuci vs Rongsok during Buyback;
2. physical result during processing completion.

Authorization still applies through existing backend permissions.

## 7. Historical Identity Model

The same physical object can have different valid identities at different events.

These perspectives must not be collapsed.

### Sale Snapshot

Truth at Sale time:

```text
sale_items.snapshot
cost_amount_snapshot
transaction pricing snapshot
```

Used by historical Sale read paths, receipts, reporting, refund/return expectations, and customer history.

### Buyback Snapshot

Truth at Buyback acquisition time:

```text
buyback_items acquisition fields
buyback_items.snapshot
acquisition photo
```

A later processing result must not rewrite this perspective.

### Processing Snapshot

Truth around physical work:

```text
source snapshot
result snapshot
processed_by
processed_at
```

Source and result may differ.

### Current Inventory

Truth now:

```text
product_items
Product Master current relation
current item image
current weight/purity/color
current availability/location/condition
```

Current inventory is not a substitute for historical event snapshots.

## 8. Example Identity Timeline

```text
SALE #1
Name   Gelang Lama
Weight 3.440 gr
Purity 43%

        ↓ Buyback

BUYBACK SNAPSHOT
Name   Gelang Lama
Weight 3.440 gr
Purity 43%

        ↓ Rongsok

PROCESSING RESULT
Name   Gelang Rekondisi
Weight 3.200 gr
Purity 45%

        ↓ available

CURRENT INVENTORY
Name   Gelang Rekondisi
Weight 3.200 gr
Purity 45%

        ↓ Sale #2

SALE #1 HISTORY
must still show:
Gelang Lama / 3.440 / 43%

SALE #2 HISTORY
shows:
Gelang Rekondisi / 3.200 / 45%
```

## 9. POS Sale Gate

A processing item cannot be sold.

Sale gate requires current state compatible with:

```text
availability = available
condition    = good | used
location     = outlet
is_active    = true
Product Master active
category active
correct outlet
not locked by held cart
```

This makes the invariant structural, not merely a UI warning.

## 10. Current Routes

### Acquisition

```text
/pos/buyback
```

Responsibilities:

- create Buyback acquisition;
- search eligible existing ASIHJAYA sold item;
- capture external item;
- classify Cuci/Rongsok;
- show five latest transactions;
- link to full history and processing.

### Processing

```text
/pos/buyback/pemrosesan
```

Responsibilities:

- pending/completed queue;
- filter all/Cuci/Rongsok;
- complete physical processing;
- responsive desktop drawer;
- fullscreen processing workspace on responsive view.

### History

```text
/pos/buyback/riwayat
```

Responsibilities:

- complete historical list;
- search;
- processing filter;
- payout filter;
- ten transactions per page;
- desktop table;
- responsive/mobile cards.

## 11. History Read Rules

### Sale

Prefer transaction snapshot.

Current Product Item fields are only compatibility fallback for incomplete legacy snapshot data.

### Buyback

Prefer acquisition snapshot.

Current item identity is fallback only where old data does not contain an acquisition snapshot value.

### Processing

Show source and result as two event-time perspectives.

### Inventory

Show current Product Item only.

## 12. Receipt Contract

Buyback receipt must read Buyback acquisition facts.

Sale receipt must read Sale snapshot facts.

A Buyback/processing mutation must never make an old Sale receipt describe the newly reconditioned identity.

## 13. Cost Contract

Existing and external item result cost after Buyback processing is the Buyback acquisition final amount.

Historical Sale margin remains based on the immutable Sale cost snapshot captured during that Sale.

## 14. Concurrency / Replay Contract

Processing completion is transactional and protected against unsafe replay/double submit.

Existing item mutation and external Product Item creation occur inside the completion transaction.

Do not split inventory admission into a later non-transactional activation step.

## 15. UI Contract

Current UX intentionally keeps the workflow simple.

### Main Buyback page

- operational header card;
- acquisition workspace;
- five-item history preview;
- dedicated link to processing/history.

### Processing page

- queue summary;
- no-wrap important table cells;
- processing shell:
  - desktop: right drawer;
  - mobile/tablet: fullscreen.

### History

- desktop: table;
- responsive: transaction cards;
- dedicated pagination rather than growing the main Buyback page indefinitely.

## 16. Regression Checklist

Before changing Buyback lifecycle, verify at minimum:

```text
Existing ASIHJAYA:
Sale #1
→ Buyback
→ processing
→ Cuci/Rongsok
→ available
→ Sale #2

External:
Buyback
→ processing
→ Product Item creation
→ available
→ Sale
```

Then verify:

```text
Sale #1 snapshot unchanged
Buyback snapshot unchanged
Processing before/result distinct
Current Inventory correct
Sale #2 captures new identity
```

Targeted checkers currently include:

```powershell
npx tsx scripts/check-buyback-b1-data-model.ts
npx tsx scripts/check-buyback-b2-simplification.ts
npx tsx scripts/check-buyback-b3-processing.ts
npx tsx scripts/check-buyback-b4-final-audit.ts
```

Run normal project quality gates after targeted checks.

## 17. Change Policy

Any future Buyback change must explicitly answer:

- Does Buyback completion remain non-saleable until processing?
- Does existing physical identity remain stable?
- Does external item creation still happen at processing completion?
- Does historical Sale remain immutable?
- Does Buyback acquisition history remain immutable?
- Are processing source/result snapshots preserved?
- Does POS sale gate still reject `processing`?

If the answer to any item changes intentionally, update this document and README in the same feature branch/commit.
