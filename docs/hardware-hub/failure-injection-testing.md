# Hardware Hub v2 — Fake Adapter & Failure Injection Testing

**Status:** Implemented for development and automated simulation  
**Physical hardware validation:** Pending outlet test

## Tujuan

Test harness memungkinkan pengembangan Hardware Hub selesai tanpa SATO, Epson, atau cash drawer fisik. Simulasi tetap memakai komponen production berikut:

- Protocol v2 claim dan lease.
- Canonical payload hash.
- SQLite execution journal.
- Store-before-dispatch marker.
- Event sequence dan idempotency.
- PDF download allowlist, MIME, size, dan SHA-256 validation.
- Submitted/acknowledged handshake.
- Startup recovery.

Tindakan fisik diganti dengan artifact file per attempt.

## Menjalankan test otomatis

Dari root repository:

```bash
npm run check:hardware:v2-simulation
```

Atau dari folder agent:

```bash
cd hardware-hub
npm run check:simulation
```

Harness memakai temporary directory dan membersihkannya setelah semua assertion lulus.

Untuk mempertahankan artifact:

```bash
cd hardware-hub
npm run simulate:v2
```

Report tersedia di:

```text
hardware-hub/data/simulation-<timestamp>/simulation-report.json
```

## Artifact contract

Satu dispatch menghasilkan tepat satu directory:

```text
{outputDir}/{deviceType}/{jobId}/{attemptId}/
```

Label:

```text
label.sbpl
artifact.json
```

Document:

```text
document.pdf
artifact.json
```

Cash drawer:

```text
drawer.json
```

Artifact memakai exclusive file creation. File yang sudah ada dianggap bukti bahwa dispatch yang sama telah dijalankan sebelumnya dan menghasilkan error:

```text
FAKE_DUPLICATE_DISPATCH_DETECTED
```

## Skenario

### `success`

Artifact dibuat, event `submitted` dikirim, kemudian attempt menjadi `acknowledged` dan job menjadi `completed`.

### `fail_before_dispatch`

Preparation gagal sebelum `dispatch_started_at`. Tidak ada artifact. Job dapat mengikuti retry-safe policy.

### `timeout_before_dispatch`

Simulasi timeout sebelum dispatch. Tidak ada artifact dan error diklasifikasikan retry-safe.

### `printer_not_found`

Simulasi perangkat tidak ditemukan sebelum dispatch. Tidak ada artifact.

### `slow_execution`

Dispatch ditunda sesuai `FAKE_HARDWARE_DELAY_MS`, kemudian sukses.

### `unknown_after_dispatch`

Artifact dibuat, lalu adapter melaporkan hasil tidak pasti. Attempt menjadi `unknown_after_dispatch` dan job menjadi `unknown_outcome`. Tidak ada automatic retry.

### `crash_after_dispatch`

Artifact dibuat setelah local dispatch marker, lalu adapter melempar `SIMULATED_AGENT_CRASH`. Journal tetap berada pada state dispatching. Setelah runner/agent dijalankan kembali, recovery melaporkan `unknown_after_dispatch` tanpa membuat artifact kedua.

### `success_then_ack_lost`

Server menerima dan menyimpan event `submitted`, tetapi response disimulasikan hilang. Marker injection disimpan ke disk agar setelah restart response hanya hilang satu kali. Recovery mengirim ulang event idempotent tanpa dispatch ulang.

## Plan file

`hardware-hub/fake-plan.example.json` menunjukkan struktur:

```json
{
  "defaultScenario": "success",
  "delayMs": 250,
  "devices": {
    "label_printer": "success"
  },
  "jobTypes": {
    "test_label_printer": "slow_execution"
  },
  "jobs": {
    "job-uuid": "success_then_ack_lost"
  }
}
```

Prioritas resolusi skenario:

```text
jobs[jobId]
→ jobTypes[jobType]
→ devices[deviceType]
→ environment override per device
→ defaultScenario
→ FAKE_HARDWARE_SCENARIO
```

Plan dibaca ulang berdasarkan modification time.

## Multi-agent test

Harness membuat dua runner dengan:

- SQLite journal terpisah.
- Secret protector terpisah.
- Agent ID berbeda.
- Cloud queue simulasi yang sama.

Assertion memastikan:

1. Hanya satu agent memperoleh job non-targeted.
2. Hanya satu artifact dihasilkan.
3. Job dengan `targetAgentId` hanya dapat diklaim agent tujuan.

Concurrency database PostgreSQL tetap diuji oleh claim API integration pada environment aplikasi; harness ini memvalidasi perilaku end-to-end agent saat menerima hasil claim.

## Status validasi

Gunakan status berikut pada roadmap:

| Area | Implemented | Simulated | Physical |
|---|---:|---:|---:|
| Claim/lease lifecycle | Ya | Ya | Tidak diperlukan |
| Duplicate recovery | Ya | Ya | Pending outlet |
| SATO command artifact | Ya | Ya | Pending outlet |
| PDF download/artifact | Ya | Ya | Pending outlet |
| Cash drawer intent | Ya | Ya | Pending pemilihan hardware |
| Driver, media, margin, sensor | Sebagian | Tidak | Pending outlet |

Lulus simulasi tidak menggantikan physical hardware acceptance test. SATO calibration, barcode scanability, Epson driver scaling, dan cash drawer pulse tetap harus divalidasi di outlet.
