import "dotenv/config";

import { and, eq, inArray, or } from "drizzle-orm";

import { hashPassword } from "../lib/auth/password";
import { db, pool } from "./index";
import {
  metalPurities,
  metals,
  organizations,
  outlets,
  permissions,
  productCategories,
  registers,
  rolePermissions,
  roles,
  userOutlets,
  userRoles,
  users,
} from "./schema";

const permissionSeeds = [
  {
    code: "admin.access",
    name: "Mengakses dashboard admin",
    module: "admin",
  },
  {
    code: "pos.access",
    name: "Mengakses aplikasi POS",
    module: "pos",
  },
  {
    code: "staff.manage",
    name: "Mengelola staff dan pengguna",
    module: "administration",
  },
  {
    code: "roles.manage",
    name: "Mengelola role dan hak akses",
    module: "administration",
  },
  {
    code: "outlets.manage",
    name: "Mengelola outlet dan register",
    module: "operations",
  },
  {
    code: "products.view",
    name: "Melihat katalog produk",
    module: "products",
  },
  {
    code: "products.manage",
    name: "Mengelola katalog produk",
    module: "products",
  },
  {
    code: "inventory.view",
    name: "Melihat inventaris",
    module: "inventory",
  },
  {
    code: "inventory.receive",
    name: "Menerima barang ke inventaris",
    module: "inventory",
  },
  {
    code: "inventory.adjust",
    name: "Melakukan penyesuaian inventaris",
    module: "inventory",
  },
  {
    code: "inventory.transfer",
    name: "Memindahkan inventaris antar outlet",
    module: "inventory",
  },
  {
    code: "inventory.manage",
    name: "Mengelola seluruh inventaris (kompatibilitas)",
    module: "inventory",
  },
  {
    code: "pricing.view_cost",
    name: "Melihat harga modal produk",
    module: "pricing",
  },
  {
    code: "pricing.manage",
    name: "Mengelola harga dan rate logam",
    module: "pricing",
  },
  {
    code: "sales.view",
    name: "Melihat transaksi penjualan",
    module: "sales",
  },
  {
    code: "sales.create",
    name: "Membuat transaksi penjualan",
    module: "sales",
  },
  {
    code: "payments.manage",
    name: "Mengelola pembayaran",
    module: "payments",
  },
  {
    code: "payments.verify.manual",
    name: "Memverifikasi pembayaran manual berisiko tinggi",
    module: "payments",
  },
  {
    code: "sales.void.request",
    name: "Mengajukan void transaksi",
    module: "sales",
  },
  {
    code: "sales.void.approve",
    name: "Menyetujui atau menolak void transaksi",
    module: "sales",
  },
  {
    code: "sales.void.execute",
    name: "Mengeksekusi void transaksi yang disetujui",
    module: "sales",
  },
  {
    code: "payments.refund.request",
    name: "Mengajukan refund pembayaran",
    module: "payments",
  },
  {
    code: "payments.refund.approve",
    name: "Menyetujui atau menolak refund pembayaran",
    module: "payments",
  },
  {
    code: "payments.refund.execute",
    name: "Mengeksekusi refund pembayaran yang disetujui",
    module: "payments",
  },
  {
    code: "returns.view",
    name: "Melihat workflow retur dan pemeriksaan barang",
    module: "inventory",
  },
  {
    code: "returns.receive",
    name: "Menerima barang retur dari customer",
    module: "inventory",
  },
  {
    code: "returns.inspect",
    name: "Memeriksa dan menentukan status barang retur",
    module: "inventory",
  },
  {
    code: "shifts.manage",
    name: "Mengelola shift dan kas",
    module: "operations",
  },
  {
    code: "reports.view",
    name: "Melihat laporan",
    module: "reports",
  },
  {
    code: "settings.manage",
    name: "Mengubah pengaturan sistem",
    module: "settings",
  },
  {
    code: "audit.view",
    name: "Melihat audit log",
    module: "administration",
  },
] as const;

const metalSeeds = [
  { code: "GOLD", name: "Emas" },
  { code: "SILVER", name: "Perak" },
  { code: "PLATINUM", name: "Platinum" },
  { code: "PALLADIUM", name: "Palladium" },
] as const;

const metalPuritySeeds = [
  {
    metalCode: "GOLD",
    code: "24K",
    displayName: "24K",
    purityPercentage: "99.9000",
  },
  {
    metalCode: "GOLD",
    code: "18K",
    displayName: "18K",
    purityPercentage: "75.0000",
  },
  {
    metalCode: "GOLD",
    code: "17K",
    displayName: "17K",
    purityPercentage: "70.8333",
  },
  {
    metalCode: "GOLD",
    code: "14K",
    displayName: "14K",
    purityPercentage: "58.5000",
  },
  {
    metalCode: "SILVER",
    code: "925",
    displayName: "925",
    purityPercentage: "92.5000",
  },
  {
    metalCode: "PLATINUM",
    code: "950",
    displayName: "950",
    purityPercentage: "95.0000",
  },
  {
    metalCode: "PALLADIUM",
    code: "950",
    displayName: "950",
    purityPercentage: "95.0000",
  },
] as const;

const productCategorySeeds = [
  { code: "RING", name: "Cincin", displayOrder: 10 },
  { code: "NECKLACE", name: "Kalung", displayOrder: 20 },
  { code: "BRACELET", name: "Gelang", displayOrder: 30 },
  { code: "EARRING", name: "Anting", displayOrder: 40 },
  { code: "PENDANT", name: "Liontin", displayOrder: 50 },
  { code: "PRECIOUS_METAL", name: "Logam Mulia", displayOrder: 60 },
  { code: "ACCESSORY", name: "Aksesori", displayOrder: 70 },
] as const;

const roleSeeds = [
  {
    code: "system_admin",
    name: "System Administrator",
    description: "Mengelola konfigurasi teknis dan seluruh modul sistem.",
    isSystem: true,
  },
  {
    code: "owner",
    name: "Owner",
    description: "Akses penuh untuk kebutuhan bisnis dan laporan.",
    isSystem: true,
  },
  {
    code: "manager",
    name: "Manager",
    description: "Mengelola operasional outlet dan approval.",
    isSystem: true,
  },
  {
    code: "cashier",
    name: "Kasir",
    description: "Memproses transaksi, pembayaran, dan shift.",
    isSystem: true,
  },
  {
    code: "stock_admin",
    name: "Admin Stok",
    description: "Mengelola produk, item, dan inventaris.",
    isSystem: true,
  },
  {
    code: "finance",
    name: "Finance",
    description: "Mengakses pembayaran dan laporan keuangan.",
    isSystem: true,
  },
] as const;

const allPermissionCodes = permissionSeeds.map((permission) => permission.code);

const rolePermissionMap: Record<string, readonly string[]> = {
  system_admin: allPermissionCodes,

  owner: allPermissionCodes,

  manager: [
    "admin.access",
    "pos.access",
    "outlets.manage",
    "products.view",
    "products.manage",
    "inventory.view",
    "inventory.receive",
    "inventory.adjust",
    "inventory.transfer",
    "pricing.view_cost",
    "pricing.manage",
    "sales.view",
    "sales.create",
    "payments.manage",
    "payments.verify.manual",
    "sales.void.request",
    "sales.void.approve",
    "sales.void.execute",
    "payments.refund.request",
    "payments.refund.approve",
    "payments.refund.execute",
    "returns.view",
    "returns.receive",
    "returns.inspect",
    "shifts.manage",
    "reports.view",
    "audit.view",
  ],

  cashier: [
    "pos.access",
    "products.view",
    "inventory.view",
    "sales.view",
    "sales.create",
    "payments.manage",
    "sales.void.request",
    "payments.refund.request",
    "returns.view",
    "returns.receive",
    "shifts.manage",
  ],

  stock_admin: [
    "admin.access",
    "products.view",
    "products.manage",
    "inventory.view",
    "inventory.receive",
    "inventory.adjust",
    "inventory.transfer",
    "pricing.view_cost",
    "pricing.manage",
    "sales.view",
    "returns.view",
    "returns.receive",
    "returns.inspect",
  ],

  finance: [
    "admin.access",
    "products.view",
    "pricing.view_cost",
    "sales.view",
    "payments.manage",
    "payments.verify.manual",
    "payments.refund.approve",
    "payments.refund.execute",
    "returns.view",
    "reports.view",
  ],
};

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Environment variable ${name} belum diatur.`);
  }

  return value;
}

function getFirst<T>(rows: readonly T[], entityName: string): T {
  const row = rows[0];

  if (!row) {
    throw new Error(`${entityName} gagal dibuat atau ditemukan.`);
  }

  return row;
}

async function seed() {
  const organizationName = requiredEnv("BOOTSTRAP_ORGANIZATION_NAME");

  const organizationSlug = requiredEnv(
    "BOOTSTRAP_ORGANIZATION_SLUG",
  ).toLowerCase();

  const outletCode = requiredEnv("BOOTSTRAP_OUTLET_CODE").toUpperCase();

  const outletName = requiredEnv("BOOTSTRAP_OUTLET_NAME");

  const registerCode = requiredEnv("BOOTSTRAP_REGISTER_CODE").toUpperCase();

  const registerName = requiredEnv("BOOTSTRAP_REGISTER_NAME");

  const adminName = requiredEnv("BOOTSTRAP_ADMIN_NAME");

  const adminUsername = requiredEnv("BOOTSTRAP_ADMIN_USERNAME").toLowerCase();

  const adminEmail = requiredEnv("BOOTSTRAP_ADMIN_EMAIL").toLowerCase();

  const adminPassword = requiredEnv("BOOTSTRAP_ADMIN_PASSWORD");

  if (adminPassword.length < 12) {
    throw new Error(
      "BOOTSTRAP_ADMIN_PASSWORD minimal harus terdiri dari 12 karakter.",
    );
  }

  await db.transaction(async (tx) => {
    const now = new Date();

    const organizationRows = await tx
      .insert(organizations)
      .values({
        name: organizationName,
        slug: organizationSlug,
        timezone: "Asia/Jakarta",
        currency: "IDR",
        isActive: true,
      })
      .onConflictDoUpdate({
        target: organizations.slug,
        set: {
          name: organizationName,
          timezone: "Asia/Jakarta",
          currency: "IDR",
          isActive: true,
          updatedAt: now,
        },
      })
      .returning({
        id: organizations.id,
      });

    const organization = getFirst(organizationRows, "Organization");

    const outletRows = await tx
      .insert(outlets)
      .values({
        organizationId: organization.id,
        code: outletCode,
        name: outletName,
        isActive: true,
      })
      .onConflictDoUpdate({
        target: [outlets.organizationId, outlets.code],
        set: {
          name: outletName,
          isActive: true,
          updatedAt: now,
        },
      })
      .returning({
        id: outlets.id,
      });

    const outlet = getFirst(outletRows, "Outlet");

    // Seed harus idempotent walaupun kode register bootstrap berubah.
    // Nonaktifkan hardware hub lama terlebih dahulu agar partial unique index
    // registers_one_hardware_hub_per_outlet_uq tidak dilanggar.
    await tx
      .update(registers)
      .set({
        isHardwareHub: false,
        updatedAt: now,
      })
      .where(
        and(
          eq(registers.outletId, outlet.id),
          eq(registers.isHardwareHub, true),
        ),
      );

    const registerRows = await tx
      .insert(registers)
      .values({
        outletId: outlet.id,
        code: registerCode,
        name: registerName,
        isHardwareHub: true,
        isActive: true,
      })
      .onConflictDoUpdate({
        target: [registers.outletId, registers.code],
        set: {
          name: registerName,
          isHardwareHub: true,
          isActive: true,
          updatedAt: now,
        },
      })
      .returning({
        id: registers.id,
      });

    getFirst(registerRows, "Register");

    const metalIds = new Map<string, string>();

    for (const metal of metalSeeds) {
      const metalRows = await tx
        .insert(metals)
        .values({
          organizationId: organization.id,
          code: metal.code,
          name: metal.name,
          isActive: true,
        })
        .onConflictDoUpdate({
          target: [metals.organizationId, metals.code],
          set: {
            name: metal.name,
            isActive: true,
            updatedAt: now,
          },
        })
        .returning({
          id: metals.id,
          code: metals.code,
        });

      const metalRow = getFirst(metalRows, `Metal ${metal.code}`);

      metalIds.set(metalRow.code, metalRow.id);
    }

    for (const purity of metalPuritySeeds) {
      const metalId = metalIds.get(purity.metalCode);

      if (!metalId) {
        throw new Error(`Metal ${purity.metalCode} tidak ditemukan.`);
      }

      await tx
        .insert(metalPurities)
        .values({
          metalId,
          code: purity.code,
          displayName: purity.displayName,
          purityPercentage: purity.purityPercentage,
          isActive: true,
        })
        .onConflictDoUpdate({
          target: [metalPurities.metalId, metalPurities.code],
          set: {
            displayName: purity.displayName,
            purityPercentage: purity.purityPercentage,
            isActive: true,
            updatedAt: now,
          },
        });
    }

    for (const category of productCategorySeeds) {
      await tx
        .insert(productCategories)
        .values({
          organizationId: organization.id,
          parentCategoryId: null,
          code: category.code,
          name: category.name,
          description: null,
          displayOrder: category.displayOrder,
          attributeSchema: {},
          isActive: true,
        })
        .onConflictDoUpdate({
          target: [productCategories.organizationId, productCategories.code],
          set: {
            name: category.name,
            displayOrder: category.displayOrder,
            isActive: true,
            updatedAt: now,
          },
        });
    }

    const permissionIds = new Map<string, string>();

    for (const permission of permissionSeeds) {
      const permissionRows = await tx
        .insert(permissions)
        .values({
          ...permission,
          description: null,
        })
        .onConflictDoUpdate({
          target: permissions.code,
          set: {
            name: permission.name,
            module: permission.module,
            updatedAt: now,
          },
        })
        .returning({
          id: permissions.id,
          code: permissions.code,
        });

      const permissionRow = getFirst(
        permissionRows,
        `Permission ${permission.code}`,
      );

      permissionIds.set(permissionRow.code, permissionRow.id);
    }

    const roleIds = new Map<string, string>();

    for (const role of roleSeeds) {
      const roleRows = await tx
        .insert(roles)
        .values({
          organizationId: organization.id,
          ...role,
          isActive: true,
        })
        .onConflictDoUpdate({
          target: [roles.organizationId, roles.code],
          set: {
            name: role.name,
            description: role.description,
            isSystem: role.isSystem,
            isActive: true,
            updatedAt: now,
          },
        })
        .returning({
          id: roles.id,
          code: roles.code,
        });

      const roleRow = getFirst(roleRows, `Role ${role.code}`);

      roleIds.set(roleRow.code, roleRow.id);
    }

    for (const [roleCode, permissionCodes] of Object.entries(
      rolePermissionMap,
    )) {
      const roleId = roleIds.get(roleCode);

      if (!roleId) {
        throw new Error(`Role ${roleCode} tidak ditemukan.`);
      }

      for (const permissionCode of permissionCodes) {
        const permissionId = permissionIds.get(permissionCode);

        if (!permissionId) {
          throw new Error(`Permission ${permissionCode} tidak ditemukan.`);
        }

        await tx
          .insert(rolePermissions)
          .values({
            roleId,
            permissionId,
            constraints: null,
          })
          .onConflictDoNothing();
      }
    }

    const legacyAssignments = await tx
      .select({
        roleId: rolePermissions.roleId,
        permissionCode: permissions.code,
      })
      .from(rolePermissions)
      .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
      .where(
        inArray(permissions.code, ["products.manage", "inventory.manage"]),
      );

    const compatibilityMap: Record<string, readonly string[]> = {
      "products.manage": ["products.view"],
      "inventory.manage": [
        "inventory.view",
        "inventory.receive",
        "inventory.adjust",
        "inventory.transfer",
      ],
    };

    for (const assignment of legacyAssignments) {
      const impliedPermissionCodes =
        compatibilityMap[assignment.permissionCode] ?? [];

      for (const impliedPermissionCode of impliedPermissionCodes) {
        const permissionId = permissionIds.get(impliedPermissionCode);

        if (!permissionId) {
          throw new Error(
            `Permission ${impliedPermissionCode} tidak ditemukan.`,
          );
        }

        await tx
          .insert(rolePermissions)
          .values({
            roleId: assignment.roleId,
            permissionId,
            constraints: null,
          })
          .onConflictDoNothing();
      }
    }

    const existingAdminRows = await tx
      .select({
        id: users.id,
      })
      .from(users)
      .where(
        and(
          eq(users.organizationId, organization.id),
          or(eq(users.username, adminUsername), eq(users.email, adminEmail)),
        ),
      )
      .limit(1);

    const existingAdmin = existingAdminRows[0];

    let adminUserId: string;

    if (existingAdmin) {
      adminUserId = existingAdmin.id;

      await tx
        .update(users)
        .set({
          fullName: adminName,
          email: adminEmail,
          username: adminUsername,
          status: "active",
          updatedAt: now,
        })
        .where(eq(users.id, adminUserId));
    } else {
      const passwordHash = await hashPassword(adminPassword);

      const adminRows = await tx
        .insert(users)
        .values({
          organizationId: organization.id,
          fullName: adminName,
          username: adminUsername,
          email: adminEmail,
          passwordHash,
          status: "active",
        })
        .returning({
          id: users.id,
        });

      const adminUser = getFirst(adminRows, "System Administrator");

      adminUserId = adminUser.id;
    }

    const systemAdminRoleId = roleIds.get("system_admin");

    if (!systemAdminRoleId) {
      throw new Error("Role system_admin tidak ditemukan.");
    }

    await tx
      .insert(userRoles)
      .values({
        userId: adminUserId,
        roleId: systemAdminRoleId,
      })
      .onConflictDoNothing();

    await tx
      .insert(userOutlets)
      .values({
        userId: adminUserId,
        outletId: outlet.id,
        isPrimary: true,
      })
      .onConflictDoUpdate({
        target: [userOutlets.userId, userOutlets.outletId],
        set: {
          isPrimary: true,
        },
      });
  });
}

async function main() {
  try {
    await seed();

    console.log("✅ Database seed berhasil dijalankan.");

    console.log(
      "✅ Organization, outlet, register, katalog dasar, role, permission, dan administrator siap.",
    );
  } catch (error) {
    console.error("❌ Database seed gagal:", error);

    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
