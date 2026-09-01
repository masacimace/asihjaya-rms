# SATO Jewelry Label V3 — Final / Frozen

Status: **CLIENT APPROVED / PHYSICAL ACCEPTANCE PASSED**  
Acceptance date: **28 August 2026**

## Production identity

- Template: `jewelry_barbell_inter_v3`
- Template version: `3`
- Printer profile: `sato_cg408_jewelry_barbell_inter_v3`
- Renderer: `host_inter_bmp_v3`
- Printer: SATO CG408
- Resolution: 203 dpi
- Media: 80 mm × 24 mm jewelry/barbell label
- Text target: Inter Medium via `SATO_LABEL_FONT_PATH`
- Barcode: native CODE128 Set B

## Final content

Front:
1. Product Master Name
2. Barcode
3. Barcode Number

Back:
1. Weight
2. Physical Item Name

Purity is intentionally not printed.

## Visual source of truth

The active fine-tuned JSON config is the visual source of truth. Exact coordinates, font sizes, and scale are **not duplicated in documentation or static tests**.

Run:

```powershell
npm --prefix hardware-hub run label:freeze-v3
```

The freeze command preserves every tuned layout value, sets `physicalValidation=accepted`, and generates `hardware-hub/config/sato-jewelry-barbell-inter-v3.lock.json` containing the SHA-256 of the accepted config.

After freeze, Hardware Hub rejects the label config if its bytes no longer match that lock. This prevents accidental visual drift.

## Acceptance gate

```powershell
npm --prefix hardware-hub run check:sato
npm --prefix hardware-hub run check:v2
npm --prefix hardware-hub run check:simulation
npm --prefix hardware-hub run check:operations
```

Then perform one physical label print. If all checks and the print are green, Label V3 remains frozen. Any later visual change requires explicit client acceptance and a deliberate re-freeze/new design revision.

## Compatibility note

The runtime config filename `sato-jewelry-barbell-host-bold.json` is retained to avoid breaking existing `SATO_LABEL_CONFIG_PATH` values on development/preview Mini PCs. The production contract is identified by the V3 template/profile IDs above, not by the legacy-compatible filename.
