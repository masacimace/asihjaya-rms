# Hardware Job Protocol v2

**Project:** ASIHJAYA RMS + POS  
**Status:** Draft v0.1  
**Target:** Cloud API (Next.js/PostgreSQL) dan Windows Hardware Hub Agent  
**Primary goal:** Mencapai *effectively-once execution* untuk pekerjaan hardware dengan audit, recovery, dan routing yang dapat dipercaya.

---

## 1. Latar belakang

Hardware Job Protocol v1 telah menyediakan queue, polling agent, claim job, status proses, retry manual, dan stale recovery. Namun, model saat ini masih memiliki risiko utama:

- Perintah berhasil dikirim ke printer, tetapi ACK ke cloud gagal sehingga job dapat dicetak ulang.
- Update status hanya dibatasi oleh `agentId`, tanpa attempt token atau lease.
- Respons terlambat dari attempt lama dapat mengubah state job yang sudah diproses ulang.
- Pending job tidak memiliki expiry.
- Claim belum mempertimbangkan capability dan target agent.
- Tidak ada local execution journal yang bertahan setelah agent restart.

Protocol v2 mempertahankan pola cloud queue + polling agent, tetapi memperkuat state machine, attempt isolation, local persistence, expiry, dan delivery semantics.

---

## 2. Sasaran

Protocol v2 harus menjamin:

1. Satu intent bisnis direpresentasikan oleh satu `hardware_job`.
2. Setiap percobaan eksekusi direpresentasikan oleh satu `hardware_job_attempt`.
3. Hanya attempt aktif dengan lease token valid yang dapat memperbarui job.
4. Job yang mungkin sudah dikirim ke printer tidak boleh otomatis dicetak ulang.
5. Agent restart atau putus internet tidak menghapus riwayat eksekusi lokal.
6. Job hanya diklaim oleh agent dengan capability yang sesuai.
7. Job yang sudah kedaluwarsa tidak boleh dieksekusi.
8. Delayed callback dari attempt lama tidak boleh merusak attempt baru.
9. Payload sensitif dibentuk dan divalidasi oleh server.
10. Semua retry berisiko harus melalui keputusan operator dan audit log.

---

## 3. Non-goals

Protocol v2 tidak menjamin bahwa hasil fisik pasti keluar dengan sempurna karena sebagian printer tidak memberikan status dua arah yang dapat dipercaya.

Definisi `completed` adalah:

> Cloud menerima konfirmasi final bahwa agent telah menyerahkan command ke OS spooler atau perangkat, dan agent telah menerima ACK dari cloud.

`completed` tidak berarti:

- Kertas pasti keluar.
- Label pasti terbaca scanner.
- Printer tidak kehabisan media setelah command diterima.
- Hasil cetak tidak rusak secara mekanis.

Physical verification dan printer telemetry adalah concern terpisah.

---

## 4. Prinsip keselamatan

### 4.1 Effectively-once, bukan exactly-once

Exactly-once tidak dapat dijamin secara matematis tanpa transactional printer. Protocol mengurangi duplicate print melalui:

- Attempt lease.
- Local SQLite journal.
- Idempotent status update.
- Pemisahan error sebelum dan sesudah dispatch.
- Larangan automatic retry setelah dispatch dimulai.
- Manual resolution untuk outcome yang tidak diketahui.

### 4.2 Safety lebih penting daripada automatic retry

Apabila agent tidak dapat memastikan apakah command sudah diterima printer, job harus masuk `unknown_outcome`.

Sistem tidak boleh otomatis mencetak ulang job tersebut.

### 4.3 Server adalah sumber intent, agent adalah sumber execution evidence

Server menentukan:

- Job type.
- Canonical payload.
- Expiry.
- Required capability.
- Target agent.
- Idempotency key.
- Retry policy.

Agent melaporkan:

- Attempt lifecycle.
- Dispatch timing.
- Local journal evidence.
- Process exit information.
- Printer/spooler metadata.
- Error code.

---

## 5. Terminologi

### Hardware job

Intent bisnis untuk melakukan satu tindakan hardware, misalnya:

- Mencetak label barang.
- Mencetak receipt/certificate.
- Membuka cash drawer.
- Menjalankan test device.

### Hardware job attempt

Satu percobaan eksekusi job oleh satu agent.

Satu job dapat memiliki beberapa attempt, tetapi hanya satu attempt aktif pada satu waktu.

### Lease

Hak sementara untuk memproses attempt. Lease terdiri dari:

- `attemptId`
- secret `leaseToken`
- `leaseExpiresAt`

### Dispatch

Titik saat agent mulai menyerahkan command ke process, Windows spooler, atau perangkat.

Setelah dispatch dimulai, hasil dapat menjadi ambigu bila agent crash.

### Submitted

Agent memiliki bukti lokal bahwa command selesai diserahkan ke runner/spooler sesuai kontrak adapter.

### Unknown outcome

Agent atau server tidak dapat memastikan apakah tindakan hardware sudah terjadi. Job tidak boleh otomatis di-retry.

---

## 6. Versioning

Semua request v2 menggunakan:

```http
X-Hardware-Protocol-Version: 2
X-Hardware-Agent-Id: <agent-id>
X-Hardware-Agent-Secret: <agent-secret>
```

Endpoint v2 menggunakan namespace terpisah:

```text
/api/hardware/v2/heartbeat
/api/hardware/v2/jobs/claim
/api/hardware/v2/jobs/{jobId}/attempts/{attemptId}
/api/hardware/v2/jobs/{jobId}/attempts/{attemptId}/lease
```

Endpoint v1 tetap tersedia selama masa transisi, tetapi job v2 tidak boleh diklaim melalui endpoint v1.

---

## 7. Capability model

Capability direpresentasikan sebagai string stabil:

```text
print_label_sato
print_document_pdf
open_cash_drawer
```

Test job menggunakan capability perangkat yang sama, bukan capability terpisah.

Contoh heartbeat:

```json
{
  "protocolVersion": 2,
  "agentVersion": "2.0.0",
  "capabilities": [
    "print_label_sato",
    "print_document_pdf"
  ],
  "devices": {
    "labelPrinter": {
      "configured": true,
      "name": "SATO CG408TT"
    },
    "documentPrinter": {
      "configured": true,
      "name": "EPSON L3250 Series"
    },
    "cashDrawer": {
      "configured": false
    }
  }
}
```

Server menyimpan capability yang terakhir dilaporkan. Claim harus memakai capability server-side tersebut.

---

## 8. Data model

## 8.1 `hardware_jobs`

Field minimum:

```text
id
organization_id
outlet_id
register_id
created_by_user_id
job_type
device_type
required_capability
target_agent_id nullable
current_attempt_id nullable
status
priority
max_attempts
payload
payload_hash
result
last_error_code
last_error_message
idempotency_key
source_type
source_id
available_at
expires_at
claimed_at
processing_at
submitted_at
completed_at
failed_at
unknown_at
expired_at
cancelled_at
created_at
updated_at
```

### Job status

```text
pending
claimed
processing
submitted
completed
failed
unknown_outcome
expired
cancelled
```

### Catatan

- `target_agent_id` adalah agent tujuan yang diminta.
- `current_attempt_id` adalah attempt aktif.
- `payload_hash` adalah SHA-256 dari canonical JSON payload.
- `expires_at` wajib untuk semua job.
- `idempotency_key` wajib untuk production job; test/manual reprint boleh memakai request UUID yang disengaja.

## 8.2 `hardware_job_attempts`

Field minimum:

```text
id
job_id
agent_id
attempt_number
status
lease_token_hash
lease_expires_at
payload_hash
dispatch_started_at
submitted_at
server_acknowledged_at
finished_at
error_code
error_message
retry_safe
result
created_at
updated_at
```

### Attempt status

```text
claimed
processing
dispatching
submitted
acknowledged
failed_before_dispatch
unknown_after_dispatch
lease_expired
cancelled
```

### Constraint

- Unique `(job_id, attempt_number)`.
- Hanya satu attempt aktif per job.
- `attempt_number <= hardware_jobs.max_attempts`.
- `lease_token` mentah tidak pernah disimpan.
- `payload_hash` attempt harus sama dengan payload hash job.

---

## 9. State machine

## 9.1 Job transitions

```text
pending -> claimed
pending -> expired
pending -> cancelled

claimed -> processing
claimed -> pending
claimed -> failed
claimed -> cancelled

processing -> submitted
processing -> pending
processing -> failed
processing -> unknown_outcome
processing -> cancelled, hanya jika dispatch belum dimulai

submitted -> completed
submitted -> unknown_outcome

unknown_outcome -> pending, hanya melalui manual audited retry
unknown_outcome -> completed, melalui operator resolution
unknown_outcome -> cancelled, melalui operator resolution

failed -> pending, melalui retry policy atau manual retry
```

Terminal status:

```text
completed
expired
cancelled
```

`failed` dan `unknown_outcome` dapat di-resolve secara manual, tetapi tidak berubah otomatis tanpa policy.

## 9.2 Attempt transitions

```text
claimed -> processing
claimed -> failed_before_dispatch
claimed -> lease_expired

processing -> dispatching
processing -> failed_before_dispatch
processing -> lease_expired

dispatching -> submitted
dispatching -> unknown_after_dispatch

submitted -> acknowledged
submitted -> unknown_after_dispatch
```

Transition yang tidak terdaftar harus ditolak dengan HTTP `409 Conflict`.

---

## 10. Claim protocol

### Request

```http
POST /api/hardware/v2/jobs/claim
```

```json
{
  "supportedCapabilities": [
    "print_label_sato",
    "print_document_pdf"
  ],
  "agentVersion": "2.0.0"
}
```

Server tidak boleh mempercayai request capability tanpa membandingkannya dengan heartbeat/configuration agent yang tersimpan.

### Candidate rules

Job dapat diklaim jika:

```text
organization_id cocok
outlet_id cocok
register_id cocok
status = pending
available_at <= now
expires_at > now
required_capability dimiliki agent
target_agent_id null atau sama dengan agent
attempt count belum mencapai max_attempts
protocol_version = 2
```

### Transaction

Claim dilakukan dalam satu transaction:

1. Tandai pending job yang expired menjadi `expired`.
2. Pilih candidate berdasarkan priority dan created time.
3. Lock candidate menggunakan `FOR UPDATE SKIP LOCKED`.
4. Buat `hardware_job_attempt`.
5. Generate random lease token minimal 256-bit.
6. Simpan hash lease token.
7. Set `current_attempt_id`.
8. Set job menjadi `claimed`.
9. Return raw lease token satu kali.

### Response

```json
{
  "success": true,
  "serverTime": "2026-07-16T10:00:00.000Z",
  "job": {
    "id": "job-uuid",
    "jobType": "print_receipt_certificate",
    "requiredCapability": "print_document_pdf",
    "payload": {},
    "payloadHash": "sha256-hex",
    "expiresAt": "2026-07-16T10:10:00.000Z"
  },
  "attempt": {
    "id": "attempt-uuid",
    "number": 1,
    "leaseToken": "raw-secret-returned-once",
    "leaseExpiresAt": "2026-07-16T10:01:00.000Z"
  }
}
```

Tidak ada job:

```json
{
  "success": true,
  "job": null,
  "serverTime": "2026-07-16T10:00:00.000Z"
}
```

---

## 11. Attempt update protocol

### Request

```http
PATCH /api/hardware/v2/jobs/{jobId}/attempts/{attemptId}
X-Hardware-Lease-Token: <raw-lease-token>
Idempotency-Key: <attempt-id>:<event-name>:<event-sequence>
```

Contoh processing:

```json
{
  "status": "processing",
  "eventSequence": 1,
  "occurredAt": "2026-07-16T10:00:05.000Z",
  "result": {
    "journalState": "processing"
  }
}
```

Contoh dispatching:

```json
{
  "status": "dispatching",
  "eventSequence": 2,
  "occurredAt": "2026-07-16T10:00:06.000Z",
  "result": {
    "adapter": "sumatrapdf",
    "printerName": "EPSON L3250 Series"
  }
}
```

Contoh submitted:

```json
{
  "status": "submitted",
  "eventSequence": 3,
  "occurredAt": "2026-07-16T10:00:09.000Z",
  "result": {
    "processExitCode": 0,
    "spoolerJobId": null,
    "localSubmittedAt": "2026-07-16T10:00:08.900Z"
  }
}
```

Contoh failed before dispatch:

```json
{
  "status": "failed_before_dispatch",
  "eventSequence": 2,
  "occurredAt": "2026-07-16T10:00:06.000Z",
  "error": {
    "code": "PRINTER_NOT_FOUND",
    "message": "Configured document printer was not found",
    "retrySafe": true
  }
}
```

Contoh unknown after dispatch:

```json
{
  "status": "unknown_after_dispatch",
  "eventSequence": 3,
  "occurredAt": "2026-07-16T10:00:20.000Z",
  "error": {
    "code": "PROCESS_TIMEOUT_AFTER_DISPATCH",
    "message": "Print process did not return before timeout",
    "retrySafe": false
  }
}
```

### Server validation

Server harus memeriksa:

- Agent authenticated.
- Job, attempt, organization, outlet, dan register cocok.
- Attempt adalah `current_attempt_id`.
- Attempt dimiliki agent.
- Lease token valid.
- Lease belum expired, kecuali idempotent replay dari event yang sudah diterima.
- Event baru wajib memakai `eventSequence` tepat satu angka setelah event terakhir; replay dengan sequence lama diperlakukan idempotent.
- Transition valid.
- Payload hash tetap sama.
- Error code sesuai allowlist.
- Result sudah dinormalisasi dan dibatasi ukurannya.

### Idempotency

Pengiriman ulang event yang sama harus mengembalikan hasil sukses yang sama.

Event lama dengan sequence lebih kecil tidak boleh mengubah state dan dapat dijawab:

```json
{
  "success": true,
  "duplicate": true,
  "currentStatus": "submitted"
}
```

---

## 12. Lease renewal

Default lease awal: **60 detik**.

Agent memperbarui lease bila pekerjaan masih berjalan dan belum dispatch selesai.

```http
POST /api/hardware/v2/jobs/{jobId}/attempts/{attemptId}/lease
X-Hardware-Lease-Token: <raw-lease-token>
```

Server dapat memperpanjang lease maksimum 60 detik per renewal.

Lease renewal tidak diperbolehkan untuk attempt terminal.

Setelah attempt mencapai `submitted`, lease expiry tidak boleh menyebabkan automatic requeue.

---

## 13. Local SQLite journal

Agent v2 wajib memakai SQLite.

### Tabel minimum

```sql
CREATE TABLE executions (
  attempt_id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL,
  attempt_number INTEGER NOT NULL,
  job_type TEXT NOT NULL,
  device_type TEXT NOT NULL,
  required_capability TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  payload_hash TEXT NOT NULL,
  lease_token_protected TEXT NOT NULL,
  lease_expires_at TEXT NOT NULL,
  event_sequence INTEGER NOT NULL DEFAULT 0,
  state TEXT NOT NULL,
  received_at TEXT NOT NULL,
  processing_at TEXT,
  dispatch_started_at TEXT,
  submitted_at TEXT,
  server_acknowledged_at TEXT,
  finished_at TEXT,
  result_json TEXT,
  error_code TEXT,
  error_message TEXT,
  pending_event_status TEXT,
  pending_event_sequence INTEGER,
  pending_event_idempotency_key TEXT,
  pending_event_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE UNIQUE INDEX executions_job_active_uq
ON executions(job_id)
WHERE state IN ('claimed', 'processing', 'dispatching', 'submitted');
```

`pending_event_*` menyimpan event yang sudah dicatat lokal tetapi belum menerima HTTP ACK. Event tersebut harus dikirim ulang dengan sequence dan idempotency key yang sama.

Pada Windows, lease token lokal dilindungi dengan DPAPI scope `CurrentUser`. Runtime non-Windows untuk development/test memakai AES-256-GCM dengan machine-local key file.

### Store-before-execute rule

Urutan wajib:

1. Claim diterima dan attempt disimpan ke SQLite sebelum eksekusi.
2. Canonical payload dihitung ulang dan dibandingkan dengan `payload_hash`.
3. Event `processing` dicatat sebagai pending event, dikirim, lalu ACK disimpan.
4. Resource preparation yang aman untuk retry dilakukan, misalnya download PDF dan pembuatan temporary file.
5. Event `dispatching` dicatat, dikirim, dan harus menerima ACK server.
6. `dispatch_started_at` disimpan secara sinkron tepat sebelum child process/perintah hardware dimulai.
7. Printer adapter dijalankan.
8. Setelah adapter sukses, event `submitted` dan result disimpan lokal sebelum request cloud.
9. Event `submitted` dikirim ulang sampai server ACK, tanpa menjalankan adapter lagi.
10. Event final `acknowledged` dikirim dan local execution menjadi terminal.

### Startup recovery

Saat agent restart:

- Pending event dikirim ulang memakai body, sequence, dan idempotency key yang tersimpan.
- `claimed` atau `processing` tanpa `dispatch_started_at`: aman dievaluasi untuk dilanjutkan selama lease lokal masih aktif.
- `dispatching` tanpa `dispatch_started_at`: preparation boleh diulang, lalu hardware dijalankan satu kali.
- State apa pun dengan `dispatch_started_at` tetapi belum `submitted`: jangan print ulang; laporkan `unknown_after_dispatch`.
- `submitted` tanpa server ACK: kirim ulang event `submitted`; jangan print ulang.
- `submitted` dengan server ACK: kirim ulang `acknowledged`; jangan print ulang.
- Lease expired sebelum dispatch: tandai local `lease_expired` dan tunggu server melakukan requeue.
- `acknowledged`: tidak melakukan tindakan hardware.
- Payload hash berbeda: hentikan dan laporkan integrity error.

---

### Implementasi PR 3

Windows agent PR 3 menggunakan built-in `node:sqlite`, sehingga runtime minimum agent adalah Node.js 22.5. Database memakai WAL dan `synchronous=FULL`. Agent rollout default memakai `HARDWARE_PROTOCOL_MODE=v2-preferred`: recovery dan claim v2 dijalankan lebih dahulu, sedangkan queue v1 masih dapat diproses ketika tidak ada local execution v2 yang tertunda.

---

## 14. Completion handshake

Untuk menghindari duplicate print:

1. Agent menyimpan `submitted` secara lokal.
2. Agent mengirim event `submitted`.
3. Server menyimpan job `submitted`.
4. Server mengirim ACK.
5. Agent menyimpan ACK secara lokal.
6. Agent mengirim event final `acknowledged`.
7. Server mengubah job menjadi `completed`.

Jika langkah 6 gagal, job tetap `submitted` dan tidak boleh di-requeue. Agent mengirim ulang acknowledgement pada startup/poll berikutnya.

Server dapat memberi alert bila job berada pada `submitted` terlalu lama, tetapi tidak boleh mencetak ulang otomatis.

---

## 15. Expiry policy

Default awal:

| Job type | Expiry |
|---|---:|
| `open_cash_drawer` | 30 detik |
| Test hardware | 2 menit |
| Auto-print receipt | 10 menit |
| Manual receipt reprint | 15 menit |
| Label inventory | 4 jam |

Expiry dihitung saat job dibuat.

Job `pending` yang melewati expiry menjadi `expired`.

Job yang sudah `dispatching` atau `submitted` tidak berubah menjadi `expired`; gunakan `unknown_outcome` bila hasil tidak dapat dipastikan.

---

## 16. Retry policy

### Retry-safe

Boleh automatic retry dengan exponential backoff bila dispatch belum dimulai:

```text
PAYLOAD_DOWNLOAD_FAILED
DOCUMENT_NOT_FOUND
PRINTER_NOT_CONFIGURED
PRINTER_NOT_FOUND
PROCESS_SPAWN_FAILED
TEMP_FILE_CREATE_FAILED
NETWORK_ERROR_BEFORE_DISPATCH
LEASE_EXPIRED_BEFORE_DISPATCH
```

### Tidak retry-safe

Tidak boleh automatic retry:

```text
AGENT_CRASH_DURING_DISPATCH
PROCESS_TIMEOUT_AFTER_DISPATCH
ACK_LOST_AFTER_SUBMIT
SPOOLER_RESULT_UNKNOWN
DEVICE_RESULT_UNKNOWN
```

### Backoff awal

```text
5 detik
15 detik
45 detik
2 menit
5 menit
```

Gunakan jitter ±20%.

### Manual retry

Retry dari `unknown_outcome` wajib:

- Permission khusus.
- Alasan operator.
- Warning duplicate risk.
- Audit log.
- Attempt baru.
- Confirmation eksplisit.

---

## 17. Idempotency policy

Unique constraint:

```text
(organization_id, idempotency_key)
```

Contoh key:

```text
receipt:{saleId}:initial
receipt:{saleId}:reprint:{reprintRequestId}
label:{itemId}:print:{printRequestId}
drawer:{paymentId}:open
hardware-test:{testRequestId}
```

`reprintRequestId` dan `printRequestId` dibuat oleh server untuk tindakan manual yang memang disengaja.

Duplicate guard berbasis `SELECT` lalu `INSERT` saja tidak cukup. Database unique constraint adalah sumber kebenaran.

---

## 18. Payload envelope

Payload menggunakan canonical JSON dan `schemaVersion`.

### Label

```json
{
  "schemaVersion": 1,
  "templateId": "jewelry_compact",
  "templateVersion": 1,
  "itemId": "item-uuid",
  "copies": 1,
  "fields": {
    "sku": "SKU-001",
    "barcode": "899000000001",
    "name": "Cincin Emas",
    "weightGram": "2.35",
    "purity": "75%",
    "price": 3500000
  }
}
```

Payload dibentuk server dari database. Browser hanya mengirim `itemId`, jumlah copy, dan intent yang diizinkan.

### Document

```json
{
  "schemaVersion": 1,
  "documentType": "receipt_certificate",
  "documentId": "sale-uuid",
  "download": {
    "path": "/api/sales/sale-uuid/receipt.pdf",
    "contentType": "application/pdf",
    "sha256": "hex",
    "maxBytes": 10485760
  },
  "printProfileId": "receipt_a5_v1",
  "copies": 1
}
```

Ukuran kertas tidak di-hardcode ke protocol.

Profile awal dapat berupa:

```text
receipt_a5_v1
```

Target akhir untuk Epson EcoTank L3251:

```text
receipt_a4_v1
```

Perubahan A5 ke A4 dilakukan melalui document layout dan print profile, tanpa mengubah state machine atau endpoint protocol.

### Cash drawer

```json
{
  "schemaVersion": 1,
  "drawerProfileId": "drawer_default_v1",
  "paymentId": "payment-uuid"
}
```

Pulse timing disimpan dalam configuration/profile server atau agent, bukan dikirim bebas dari browser.

---

## 19. Download security

Agent hanya boleh mengunduh dokumen apabila:

- URL menggunakan relative path atau origin sama dengan API base URL.
- Protocol adalah HTTPS pada production.
- Path sesuai allowlist.
- Content-Type sesuai payload.
- Content-Length tidak melebihi `maxBytes`.
- SHA-256 hasil download sama dengan payload.
- Redirect lintas origin ditolak.
- Header agent secret tidak pernah dikirim ke origin lain.

---

## 20. Agent authentication

Protocol v2 tahap pertama tetap memakai Agent ID + Agent Secret dengan ketentuan:

- HTTPS wajib.
- Secret dapat di-rotate.
- Agent dapat di-revoke.
- Secret memiliki version/key ID.
- Authentication endpoint memiliki rate limit.
- Secret tidak masuk log.
- Disabled agent tidak dapat heartbeat, claim, atau update attempt.

Lease token hanya mengotorisasi satu attempt dan tidak menggantikan agent authentication.

HMAC request signing dapat ditambahkan pada protocol minor version berikutnya.

---

## 21. Error response

Format standar:

```json
{
  "success": false,
  "error": {
    "code": "INVALID_STATE_TRANSITION",
    "message": "Attempt cannot transition from submitted to processing",
    "retryable": false
  },
  "serverTime": "2026-07-16T10:00:00.000Z"
}
```

Kode HTTP:

```text
400 malformed request
401 invalid agent credential
403 agent disabled atau scope tidak cocok
404 job/attempt tidak ditemukan
409 invalid transition, stale attempt, atau conflict
410 job expired
422 payload/event validation gagal
429 rate limited
500 server error
```

---

## 22. Observability dan audit

Metrics minimum:

```text
hardware_jobs_pending_total
hardware_jobs_oldest_pending_seconds
hardware_jobs_claim_latency_seconds
hardware_attempt_duration_seconds
hardware_jobs_failed_total
hardware_jobs_unknown_total
hardware_jobs_expired_total
hardware_jobs_submitted_stale_total
hardware_agent_last_seen_seconds
hardware_agent_version
hardware_error_code_total
```

Audit event minimum:

```text
hardware_job_created
hardware_job_claimed
hardware_job_submitted
hardware_job_completed
hardware_job_failed
hardware_job_unknown
hardware_job_expired
hardware_job_cancelled
hardware_job_manual_retry
hardware_job_manual_resolution
hardware_agent_secret_rotated
hardware_agent_revoked
```

Payload sensitif tidak boleh dicatat penuh di log. Gunakan job ID, attempt ID, source ID, payload hash, dan metadata aman.

---

## 23. Compatibility dan rollout

### Stage 1 — Additive schema

- Tambah table attempt.
- Tambah field v2 tanpa menghapus field v1.
- Tambah enum/status baru.
- Existing v1 agent tetap bekerja untuk job v1.

### Stage 2 — V2 server endpoints

- Implement claim v2.
- Implement lease.
- Implement attempt transitions.
- Tambah protocol version pada job.

### Stage 3 — Agent v2 dry-run

- SQLite journal.
- Fake printer adapter.
- Failure injection.
- Dual environment UAT.

### Stage 4 — SATO pilot

- Satu Mini PC.
- Satu outlet.
- Label printer saja.
- Observasi duplicate/unknown/error.

### Stage 5 — Document printer

- Aktifkan PDF adapter.
- Validasi profile A5 sementara.
- Migrasikan layout ke `receipt_a4_v1`.
- Validasi paper/orientation/scaling.

### Stage 6 — Disable v1 creation

- Semua job baru menggunakan v2.
- Endpoint v1 hanya menyelesaikan job lama.

### Stage 7 — Remove v1

- Setelah tidak ada agent v1 aktif.
- Setelah migration dan rollback window selesai.

---

## 24. Acceptance criteria Protocol v2

Protocol v2 dianggap siap memasuki UAT apabila seluruh skenario berikut lulus:

1. Dua agent claim bersamaan; hanya satu attempt yang dibuat.
2. Delayed update attempt lama ditolak.
3. Lease token salah ditolak.
4. Agent tanpa capability tidak dapat claim.
5. Targeted test job hanya diklaim target agent.
6. Pending job expired tidak diklaim.
7. Crash sebelum dispatch dapat di-retry sesuai policy.
8. Crash setelah `dispatch_started_at` menghasilkan `unknown_outcome`.
9. Print sukses lalu internet putus tidak menyebabkan print ulang.
10. Agent restart mengirim ulang status dari SQLite tanpa menjalankan printer.
11. Event status duplikat bersifat idempotent.
12. Manual retry dari unknown membutuhkan permission, alasan, dan audit.
13. Absolute download URL lintas origin ditolak.
14. Payload hash mismatch menghentikan eksekusi.
15. Job `submitted` tidak pernah diproses oleh stale recovery sebagai pending.
16. A5 dan A4 document profile dapat dipilih tanpa perubahan protocol.

---

## 25. Keputusan v0.1

Keputusan awal yang disetujui untuk implementasi:

- Tetap memakai polling; WebSocket bukan prioritas.
- Gunakan endpoint namespace v2.
- Gunakan PostgreSQL sebagai source of truth cloud.
- Gunakan SQLite sebagai execution journal lokal.
- Gunakan lease token per attempt.
- Setelah dispatch dimulai, automatic retry dilarang bila outcome tidak pasti.
- Capability dan target agent diterapkan saat claim.
- Semua job wajib memiliki expiry.
- Semua production intent wajib memiliki idempotency key.
- Document paper size dikontrol oleh `printProfileId`.
- Receipt A5 dipertahankan sementara dan nantinya dimigrasikan ke A4 untuk Epson EcoTank L3251.

---

## 26. Implementasi pertama

PR pertama disarankan mencakup:

1. Enum status baru.
2. Field baru pada `hardware_jobs`.
3. Table `hardware_job_attempts`.
4. Transition validator murni.
5. Expiry policy helper.
6. Capability mapping helper.
7. Migration Drizzle.
8. Unit tests state machine.
9. Dokumen protocol ini di repository.

Belum perlu mengubah physical printer adapter pada PR pertama.

---

## 27. Implementation status — PR 2 Claim Lease API

PR 2 mengimplementasikan bagian server-side berikut:

- Endpoint claim v2 dengan `FOR UPDATE SKIP LOCKED`.
- Capability-aware dan target-agent-aware routing.
- Attempt creation dan lease token 256-bit.
- Lease token hanya disimpan sebagai SHA-256 hash.
- Pending-job expiry saat claim.
- Recovery lease sebelum dispatch sebagai retry-safe.
- Recovery lease setelah dispatch menjadi `unknown_outcome`.
- Event sequence dan idempotent replay.
- Stale-attempt rejection.
- State-transition validation.
- Lease renewal untuk `claimed`, `processing`, dan `dispatching`.
- `submitted` tetap dapat di-ACK setelah lease berakhir dan tidak di-requeue.

Endpoint yang tersedia:

```text
POST  /api/hardware/v2/jobs/claim
PATCH /api/hardware/v2/jobs/{jobId}/attempts/{attemptId}
POST  /api/hardware/v2/jobs/{jobId}/attempts/{attemptId}/lease
```

PR ini belum mengubah Windows agent. Endpoint v1 tetap aktif sampai agent v2 dengan SQLite journal tersedia.

---

## 28. Implementation status — PR 4 Secure Job Producers

Producer production sekarang wajib menggunakan `createHardwareJobV2` atau
`createHardwareJobV2InTransaction`. Producer tersebut secara otomatis mengisi:

- `protocolVersion = 2`
- capability dan device type berdasarkan job type
- canonical `payloadHash`
- expiry berdasarkan creation mode
- unique business idempotency key
- audit event `hardware.job_created`

Label printing menerima hanya `itemId`, `copies`, dan request UUID dari browser.
SKU, barcode, nama, berat, kadar, atribut, serta harga dibaca ulang dari database
berdasarkan organization dan outlet yang dapat diakses user.

Permission baru:

```text
inventory.print_label
```

Receipt checkout menggunakan idempotency key:

```text
receipt:{saleId}:initial
```

Manual receipt reprint menggunakan request UUID yang dibuat saat form dirender
dan dipertahankan untuk retry request yang sama:

```text
receipt:{saleId}:reprint:{requestId}
```

Document payload masih memakai `receipt_a5_v1`. Migrasi ke `receipt_a4_v1`
tidak membutuhkan perubahan protocol atau producer lifecycle.

Agent hanya menerima document download pada same-origin path berikut:

```text
/api/sales/{saleId}/receipt-certificate
/api/sales/receipt-certificate-preview
```

Cloud API URL non-loopback wajib HTTPS.

---

## 29. Implementation status — PR 5 Unknown Outcome & Observability

Job `unknown_outcome` wajib diselesaikan oleh user dengan permission:

```text
hardware.resolve_unknown
```

Tiga resolusi yang tersedia:

```text
confirmed_completed
retry_authorized
cancelled
```

`retry_authorized` wajib menyimpan pengakuan risiko duplicate output. Resolusi
operator disimpan pada `hardware_job_resolutions` dan audit log. Attempt lama
tidak diubah agar evidence agent tetap utuh.

Lifecycle penting dari agent v2 juga menghasilkan audit event:

```text
hardware.job_dispatch_started
hardware.job_submitted
hardware.job_completed
hardware.job_retry_scheduled
hardware.job_failed
hardware.job_unknown_outcome
```

Dashboard Hardware Hub menampilkan operational snapshot untuk:

- unknown-outcome aktif
- submitted job tanpa final acknowledgement
- umur pending job tertua
- umur submitted job tertua
- agent stale/offline
- completed, failed, expired, success rate, dan failure rate 24 jam

Threshold dapat disesuaikan dengan:

```text
HARDWARE_PENDING_WARNING_SECONDS=300
HARDWARE_SUBMITTED_WARNING_SECONDS=120
HARDWARE_FAILURE_RATE_WARNING_PERCENT=10
```

Unknown outcome tidak pernah di-retry otomatis. Operator harus membuka detail
job, memeriksa output fisik atau artifact simulasi, memberikan alasan, lalu
memilih satu resolusi yang tercatat permanen.
