# Windows Production Operations — Hardware Hub Agent

**Status:** Implemented and simulation-testable; physical printer validation remains pending outlet testing.

## Operating model

Hardware Hub runs through Windows Task Scheduler in a dedicated outlet Windows user context. This is intentional:

- Windows printer installations can be user-scoped.
- Protocol v2 lease tokens use DPAPI `CurrentUser`.
- The same user must run manual diagnostics and the Scheduled Task.
- Switching the task between Windows users can make active lease tokens unreadable.

The task starts at user logon, waits briefly for Windows networking/printer services, restarts after non-zero exit, and ignores duplicate task starts.

## Production setup

From `C:\Asihjaya\hardware-hub`:

```powershell
copy .env.example .env
notepad .env
npm run setup:production
```

The setup command:

1. Installs production dependencies.
2. Validates Node.js `>=22.5 <25`.
3. Creates runtime directories.
4. Runs DPAPI and configuration self-tests.
5. Registers and starts the Scheduled Task using the absolute `node.exe` path.

The raw `.env`, SQLite journal, encryption key, and print artifacts remain local and must not be committed or placed in a support bundle.

## Single-instance protection

The agent owns:

```text
hardware-hub/data/agent.lock
```

A second process exits with code `73` while the first PID is alive. A stale lock left after an abnormal process termination is removed automatically on the next start.

Task Scheduler also uses `MultipleInstances=IgnoreNew`, providing protection at both scheduler and process level.

## Structured logs

Agent output is mirrored to the console and written as JSON Lines:

```text
hardware-hub/logs/agent-YYYY-MM-DD.jsonl
hardware-hub/logs/agent-YYYY-MM-DD-001.jsonl
```

Configuration:

```env
HARDWARE_LOG_LEVEL=info
HARDWARE_LOG_RETENTION_DAYS=30
HARDWARE_LOG_MAX_FILE_MB=20
HARDWARE_LOG_MAX_FILES=90
```

The logger:

- rotates by date and maximum file size;
- removes old/excess files;
- records timestamp, level, version, agent ID, PID, and message;
- redacts configured agent secrets and token-like fields;
- does not log document or label file contents.

Open the directory:

```powershell
npm run logs
```

## Local health diagnostics

The agent atomically updates:

```text
hardware-hub/data/health-state.json
```

It records:

- startup/ready state;
- process and runtime metadata;
- last heartbeat attempt/success/error;
- last poll attempt/success/error;
- current and last job identifiers;
- local journal summary;
- latest operational error.

Check health:

```powershell
npm run health
```

Exit codes:

```text
0 healthy and fresh
1 unhealthy
2 missing or stale health state
```

A loopback-only endpoint is enabled by default:

```text
http://127.0.0.1:3210/health
http://127.0.0.1:3210/ready
```

`/ready` returns HTTP 503 while the agent is not ready. Never bind this server to a LAN/public address; configuration validation rejects non-loopback hosts.

Combined task and health status:

```powershell
npm run status
```

## Support bundle

Create a support ZIP:

```powershell
npm run support:bundle
```

Default output:

```text
hardware-hub/support-bundles/asihjaya-hardware-hub-support-YYYYMMDD-HHMMSS.zip
```

Included:

- redacted configuration;
- runtime and health diagnostics;
- recent structured logs;
- Scheduled Task status;
- Windows printer inventory;
- DPAPI diagnostic output;
- explicit security notice.

Excluded:

- raw `.env`;
- agent secret and lease tokens;
- SQLite journal content;
- journal encryption key;
- generated label/PDF/drawer artifacts.

Review the ZIP before sharing it externally.

## Scheduled Task behavior

Install or update only the task:

```powershell
npm run install:startup
```

The installer resolves the current absolute `node.exe` path. If Node.js is moved or upgraded into a different directory, reinstall the task.

Recommended outlet account policy:

- dedicated non-administrator Windows user;
- password protected and auto-login only when approved by outlet security policy;
- prevent staff from installing arbitrary software;
- install printers and run all Hardware Hub diagnostics under this same user;
- disable sleep/hibernation during outlet operating hours;
- enable Windows time synchronization.

Uninstalling the task does not delete journal or logs:

```powershell
npm run uninstall:startup
```

## Startup exit codes

```text
0 graceful stop
1 unexpected startup/runtime failure
73 another agent instance is running
78 DPAPI/secret protector startup self-test failed
79 local health server failed to bind
86 intentional fake crash-after-dispatch simulation
```

## Routine operator checks

Daily/when opening outlet:

```powershell
npm run status
```

After Windows/Node/printer driver changes:

```powershell
npm run check:dpapi
npm run check
npm run check:v2
npm run status
```

Before requesting remote support:

```powershell
npm run support:bundle
```

## Recovery rules

Do not delete these files as a generic troubleshooting step:

```text
data/hardware-executions.sqlite
data/hardware-executions.sqlite-wal
data/hardware-executions.sqlite-shm
data/hardware-journal.key (non-Windows fallback only)
```

Deleting the journal can remove evidence that a command may already have been dispatched. Use the Hardware Hub dashboard and `unknown_outcome` resolution workflow instead.
