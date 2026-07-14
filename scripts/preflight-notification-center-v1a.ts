import "dotenv/config";

import { Pool, type QueryResultRow } from "pg";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL belum diatur.");

type Check = {
  name: string;
  description: string;
  query: string;
};

const checks: Check[] = [
  {
    name: "admin_access_permission",
    description:
      "Permission admin.access wajib tersedia agar notifikasi organization/outlet dapat ditargetkan ke admin aktif.",
    query: `
      select 'admin.access permission tidak ditemukan' as issue
      where not exists (
        select 1 from permissions where code = 'admin.access'
      )
    `,
  },
  {
    name: "legacy_notification_outlet_scope",
    description:
      "Outlet pada notifikasi legacy wajib berasal dari organization yang sama.",
    query: `
      select
        notification.id::text,
        notification.organization_id::text,
        notification.outlet_id::text,
        outlet.organization_id::text as outlet_organization_id
      from notifications notification
      join outlets outlet on outlet.id = notification.outlet_id
      where outlet.organization_id <> notification.organization_id
      order by notification.created_at
      limit 50
    `,
  },
  {
    name: "legacy_notification_user_scope",
    description:
      "Penerima langsung pada notifikasi legacy wajib berasal dari organization yang sama.",
    query: `
      select
        notification.id::text,
        notification.organization_id::text,
        notification.user_id::text,
        recipient.organization_id::text as user_organization_id
      from notifications notification
      join users recipient on recipient.id = notification.user_id
      where recipient.organization_id <> notification.organization_id
      order by notification.created_at
      limit 50
    `,
  },
];

function printRows(rows: QueryResultRow[]) {
  for (const row of rows) console.error(`  - ${JSON.stringify(row)}`);
}

async function main() {
  const pool = new Pool({
    connectionString: databaseUrl,
    application_name: "asihjaya-notification-center-v1a-preflight",
    max: 1,
  });
  const client = await pool.connect();
  let blockers = 0;

  try {
    await client.query("begin transaction read only");

    for (const check of checks) {
      const result = await client.query(check.query);
      if (!result.rowCount) {
        console.log(`[OK] ${check.name}`);
        continue;
      }

      blockers += 1;
      console.error(`\n[BLOCKER] ${check.name}`);
      console.error(check.description);
      printRows(result.rows);
    }

    const legacyCount = await client.query<{ total: number }>(`
      select count(*)::int as total from notifications
    `);
    console.log(
      `[INFO] legacy_notifications: ${legacyCount.rows[0]?.total ?? 0} record akan dibackfill ke event/recipient model.`,
    );

    await client.query("rollback");
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }

  if (blockers > 0) {
    console.error(
      `\nNotification Center V1-A preflight gagal: ${blockers} kategori blocker ditemukan.`,
    );
    process.exitCode = 1;
    return;
  }

  console.log(
    "\nNotification Center V1-A preflight lulus. Migration event foundation dapat diterapkan.",
  );
}

main().catch((error: unknown) => {
  console.error(
    "Notification Center V1-A preflight tidak dapat dijalankan.",
    error,
  );
  process.exitCode = 1;
});
