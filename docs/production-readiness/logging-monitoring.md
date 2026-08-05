# Logging and Monitoring

## Architecture

AJSystem uses lightweight monitoring suitable for a 4 GB VPS:

- Docker `json-file` log rotation
- Persistent systemd journal with bounded storage
- PostgreSQL backup and Backblaze B2 verification timers
- Internal monitoring approximately every five minutes
- UptimeRobot for public application and database health
- Healthchecks.io for internal heartbeat and failure notification

Prometheus, Grafana, Loki, and an additional time-series database are not
installed on the application VPS.

## Logging

Journald:

- persistent storage;
- compression enabled;
- maximum persistent usage: 400 MB;
- minimum filesystem free space: 2 GB;
- maximum journal file size: 64 MB;
- maximum retention: 30 days;
- runtime journal maximum: 100 MB.

Docker log rotation:

| Service | Driver | Max size | Max files |
|---|---|---:|---:|
| Application | `json-file` | 10 MB | 5 |
| PostgreSQL | `json-file` | 10 MB | 5 |
| Migration | `json-file` | 10 MB | 3 |

## Scheduled jobs

| Job | Schedule |
|---|---|
| Internal monitor | Approximately every 5 minutes |
| Daily backup | Monday–Saturday, 02:30 Asia/Jakarta |
| Weekly backup | Sunday, 03:30 Asia/Jakarta |
| Off-site verification | Daily, 05:00 Asia/Jakarta |

Backup timers use a randomized delay of up to ten minutes.

## Internal monitor

The internal monitor checks:

- local application health;
- local database health;
- public health through Cloudflare;
- Docker, Caddy, Fail2ban, and SSH;
- application, database, and migration containers;
- backup timers;
- root filesystem and inode usage;
- available memory and swap;
- expected public and private listening ports;
- local backup age;
- Backblaze upload and verification age;
- failed systemd units.

Status file:

```text
/var/lib/asihjaya-rms/monitor/latest.json
```

Thresholds:

| Metric | Warning | Critical |
|---|---:|---:|
| Root disk usage | 75% | 85% |
| Root inode usage | 80% | 90% |
| Available memory | Below 20% | Below 10% |
| Swap usage | 25% | 60% |
| Backup or verification age | 30 hours | 36 hours |

## Alerting

UptimeRobot monitors:

```text
https://ajsystem.id/api/health
https://ajsystem.id/api/health/database
```

Healthchecks.io receives internal monitor results:

- normal ping for healthy or warning;
- `/fail` for critical;
- missing pings detect VPS, timer, or monitor failure.

The Healthchecks.io Ping URL is stored only in:

```text
/etc/asihjaya-rms/monitor-heartbeat.env
```

The file must remain owned by root with mode `600` and must never be committed.

## Systemd units

```text
ajsystem-monitor.service
ajsystem-monitor.timer
ajsystem-db-backup@.service
ajsystem-db-backup-daily.timer
ajsystem-db-backup-weekly.timer
ajsystem-db-backup-verify.timer
```

## Operational commands

```bash
systemctl list-timers --all ajsystem-monitor.timer
systemctl list-timers --all 'ajsystem-db-backup-*.timer'

journalctl -u ajsystem-monitor.service
journalctl -u 'ajsystem-db-backup@*.service'

python3 -m json.tool /var/lib/asihjaya-rms/monitor/latest.json
python3 -m json.tool /var/lib/asihjaya-rms/offsite-status/latest.json

systemctl --failed
journalctl --disk-usage
```

## Recovery

After correcting a critical condition:

```bash
sudo systemctl reset-failed ajsystem-monitor.service
sudo systemctl start ajsystem-monitor.service
sudo systemctl start ajsystem-monitor.timer
```

Verify that the latest internal status is healthy, all required timers are
active, and the Healthchecks.io check has returned to `Up`.

## Sensitive files excluded from the repository

```text
/etc/asihjaya-rms/production.env
/etc/asihjaya-rms/monitor-heartbeat.env
/etc/caddy/certs/cloudflare-authenticated-origin-pull-ca.pem
```
