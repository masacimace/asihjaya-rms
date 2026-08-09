import "dotenv/config";

import { Pool } from "pg";

const DEFAULT_REGISTER_CODE = "DEV-HW-TEST";
const DEFAULT_REGISTER_NAME = "Hardware Provisioning Test";

type CliArgs = {
  outletCode: string | null;
  registerCode: string;
  registerName: string;
};

type OutletRow = {
  id: string;
  code: string;
  name: string;
};

type RegisterRow = {
  id: string;
  code: string;
  name: string;
  is_active: boolean;
};

function readArg(name: string): string | null {
  const index = process.argv.indexOf(name);
  if (index < 0) return null;

  const value = process.argv[index + 1];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function getArgs(): CliArgs {
  return {
    outletCode: readArg("--outlet-code"),
    registerCode: readArg("--register-code") ?? DEFAULT_REGISTER_CODE,
    registerName: readArg("--register-name") ?? DEFAULT_REGISTER_NAME,
  };
}

function requireLocalDatabase(databaseUrl: string) {
  const parsed = new URL(databaseUrl);
  const allowedHosts = new Set([
    "localhost",
    "127.0.0.1",
    "::1",
    "host.docker.internal",
  ]);

  if (
    !allowedHosts.has(parsed.hostname) &&
    process.env.ALLOW_HARDWARE_ACCEPTANCE_NONLOCAL_DB !== "1"
  ) {
    throw new Error(
      `Safety stop: DATABASE_URL mengarah ke host "${parsed.hostname}", bukan database local. ` +
        "Script acceptance ini tidak akan memodifikasi DB non-local. " +
        "Jika environment non-local memang sandbox khusus, set ALLOW_HARDWARE_ACCEPTANCE_NONLOCAL_DB=1 secara eksplisit.",
    );
  }
}

async function main() {
  const args = getArgs();
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL tidak tersedia. Pastikan .env local sudah benar.");
  }

  requireLocalDatabase(databaseUrl);

  const pool = new Pool({
    connectionString: databaseUrl,
    max: 1,
  });

  try {
    const outletRows = await pool.query<OutletRow>(
      `
        select id, code, name
        from outlets
        where is_active = true
          and ($1::text is null or code = $1)
        order by name asc
      `,
      [args.outletCode],
    );

    if (!args.outletCode && outletRows.rows.length > 1) {
      const codes = outletRows.rows.map((row) => row.code).join(", ");
      throw new Error(
        `Ada lebih dari satu outlet aktif (${codes}). Jalankan ulang dengan --outlet-code KODE_OUTLET.`,
      );
    }

    const outlet = outletRows.rows[0];

    if (!outlet) {
      throw new Error(
        args.outletCode
          ? `Outlet aktif dengan kode ${args.outletCode} tidak ditemukan.`
          : "Tidak ada outlet aktif pada database local.",
      );
    }

    const existingRows = await pool.query<RegisterRow>(
      `
        select id, code, name, is_active
        from registers
        where outlet_id = $1
          and code = $2
        limit 1
      `,
      [outlet.id, args.registerCode],
    );

    const existing = existingRows.rows[0];
    let registerId: string;

    if (existing) {
      registerId = existing.id;

      const activeAgentRows = await pool.query<{ total: string }>(
        `
          select count(*)::text as total
          from hardware_agents
          where register_id = $1
            and is_active = true
        `,
        [registerId],
      );

      if (Number(activeAgentRows.rows[0]?.total ?? "0") > 0) {
        throw new Error(
          `Register ${args.registerCode} sudah memiliki Hardware Agent aktif. ` +
            "Gunakan register acceptance lain atau nonaktifkan agent test lama melalui workflow yang benar.",
        );
      }

      if (!existing.is_active) {
        await pool.query(
          `
            update registers
            set is_active = true,
                updated_at = now()
            where id = $1
          `,
          [registerId],
        );
      }

      console.log(`[PASS] Register acceptance tersedia: ${existing.code}`);
    } else {
      const inserted = await pool.query<{ id: string }>(
        `
          insert into registers (
            outlet_id,
            code,
            name,
            is_hardware_hub,
            is_active,
            created_at,
            updated_at
          )
          values ($1, $2, $3, false, true, now(), now())
          returning id
        `,
        [outlet.id, args.registerCode, args.registerName],
      );

      const insertedRegister = inserted.rows[0];

      if (!insertedRegister) {
        throw new Error("Register acceptance gagal dibuat.");
      }

      registerId = insertedRegister.id;
      console.log(`[PASS] Register acceptance dibuat: ${args.registerCode}`);
    }

    console.log(`[PASS] Outlet: ${outlet.code} · ${outlet.name}`);
    console.log(`[PASS] Register ID: ${registerId}`);
    console.log("");
    console.log("NEXT:");
    console.log("1. Buka /admin/operasional/hardware.");
    console.log(`2. Pilih register ${args.registerCode}.`);
    console.log(`3. Gunakan kode agent ${args.registerCode}-HH.`);
    console.log('4. Nama perangkat: "Hardware Hub Local Acceptance".');
    console.log("5. Klik Buat Hardware Agent.");
    console.log("6. Download hardware-hub.env dari dialog sukses.");
    console.log("7. Setelah itu jalankan verifier 2D.1D.");
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error(
    error instanceof Error ? error.message : "Prepare acceptance gagal.",
  );
  process.exitCode = 1;
});
