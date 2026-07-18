# SATO CG408TT Label Profile v1

**Status:** implemented + simulated; physical validation pending.

## Contract

Job label baru menggunakan:

```json
{
  "templateId": "jewelry_compact_v1",
  "templateVersion": 1,
  "printerProfileId": "sato_cg408tt_jewelry_v1"
}
```

`jewelry_compact` tanpa suffix tetap diterima sebagai alias job lama. Job baru selalu memakai ID canonical.

## Development profile

Profile awal:

```text
printer: SATO CG408TT
language: SBPL
dpi: 203
media: 400 x 300 dots
barcode: CODE39, uppercase, maksimum 40 karakter
physical validation: pending
```

Ukuran media, speed, darkness, sensor, dan offset final belum dianggap tervalidasi sampai label fisik di outlet diukur dan dipindai.

## Deterministic generator

Generator terpusat berada di:

```text
hardware-hub/lib/sato-sbpl-generator.js
```

Satu payload + profile + override yang sama harus menghasilkan byte SBPL dan SHA-256 yang sama. Browser tidak dapat mengirim raw SBPL atau command printer.

## Configuration

```env
LABEL_TEMPLATE_ID=jewelry_compact_v1
SATO_PRINTER_PROFILE=sato_cg408tt_jewelry_v1
SATO_COPIES=1
SATO_HORIZONTAL_OFFSET_DOTS=0
SATO_VERTICAL_OFFSET_DOTS=0
SATO_INCLUDE_PRICE=false
SATO_MEDIA_WIDTH_DOTS=400
SATO_MEDIA_HEIGHT_DOTS=300
SATO_PRINT_SPEED=
SATO_DARKNESS=
```

Legacy `LABEL_*` variables tetap dibaca sementara, tetapi menghasilkan warning.

`SATO_PRINT_SPEED` dan `SATO_DARKNESS` hanya dicatat dalam diagnostics. Generator belum memancarkan command device-control untuk keduanya sebelum physical validation.

## Golden files

```text
hardware-hub/test/golden/sato/
├── jewelry-standard.sbpl
├── jewelry-long-name.sbpl
├── jewelry-high-price.sbpl
├── jewelry-special-character.sbpl
└── jewelry-multiple-copies.sbpl
```

Jalankan:

```powershell
cd hardware-hub
npm run check:sato
```

Golden files hanya boleh diperbarui ketika perubahan layout memang disengaja:

```powershell
npm run update:golden:sato
```

Review binary diff dan fake artifact sebelum commit.

## Fake artifact

```text
data/fake-output/label_printer/{jobId}/{attemptId}/
├── label.sbpl
└── artifact.json
```

Metadata mencatat template, printer profile, DPI, media, offset, copies, normalized label fields, command SHA-256, byte count, dan `physicalValidation: pending`.

## Physical acceptance gate

Sebelum profile dinyatakan valid:

- Ukur label dan samakan `SATO_MEDIA_*_DOTS`.
- Kalibrasi gap sensor.
- Tune horizontal/vertical offset.
- Tentukan speed dan darkness.
- Uji 1, 10, dan 100 label.
- Scan barcode dengan seluruh Android POS.
- Uji ribbon/media habis, printer offline, USB terlepas, restart agent, dan ACK hilang.
- Catat nilai final di `hardware-hub/TODO-SATO-LABEL-PHYSICAL-TUNING.md`.
