# SATO CG408 Jewelry Label Production Profile

Production Hardware Hub hanya memakai satu label contract:

```json
{
  "schemaVersion": 1,
  "templateId": "jewelry_barbell_host_bold_v2",
  "templateVersion": 2,
  "printerProfileId": "sato_cg408_jewelry_barbell_host_bold_v2"
}
```

Renderer final:

- printer queue: `SATO CG408`;
- DPI: 203;
- text: host-rendered `Arial Narrow` + `Bold` menjadi monochrome BMP;
- barcode: native SATO `CODE128_B`;
- back panel: 180°;
- transport: RAW Winspool;
- physical validation: `accepted`.

Layout fisik authoritative ada di:

```text
hardware-hub/config/sato-jewelry-barbell-host-bold.json
```

Konfigurasi runtime minimal:

```env
LABEL_PRINTER_NAME=SATO CG408
LABEL_PRINTER_ADAPTER=fake
SATO_LABEL_CONFIG_PATH=./config/sato-jewelry-barbell-host-bold.json
SATO_COPIES=1
```

Jalankan contract check dengan `npm run check:sato`. Untuk real production, aktifkan `LABEL_PRINTER_ADAPTER=real` hanya setelah preflight SATO PASS. Renderer/profile XU, RD, compact, CODE39, dan alias template lama tidak lagi didukung.
