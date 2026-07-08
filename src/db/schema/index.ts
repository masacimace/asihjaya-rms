import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgSequence,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
};

export const userStatusEnum = pgEnum("user_status", [
  "active",
  "inactive",
  "suspended",
]);

export const masterStatusEnum = pgEnum("master_status", [
  "draft",
  "active",
  "inactive",
]);



export const productItemNumberSequence = pgSequence(
  "product_item_number_seq",
  {
    startWith: 1,
    increment: 1,
    minValue: 1,
    cache: 1,
  },
);

export const itemAvailabilityEnum = pgEnum("item_availability", [
  "draft",
  "available",
  "reserved",
  "sold",
]);

export const itemConditionEnum = pgEnum("item_condition", [
  "good",
  "damaged",
  "lost",
  "returned",
]);

export const itemLocationStateEnum = pgEnum("item_location_state", [
  "outlet",
  "warehouse",
  "in_transit",
  "customer",
  "repair",
]);

export const movementTypeEnum = pgEnum("inventory_movement_type", [
  "goods_receipt",
  "sale",
  "sale_return",
  "transfer_out",
  "transfer_in",
  "reservation",
  "reservation_release",
  "adjustment",
  "damaged",
  "lost",
  "repair_out",
  "repair_in",
  "reversal",
]);

export const shiftStatusEnum = pgEnum("shift_status", [
  "open",
  "closing",
  "closed",
]);

export const cashMovementTypeEnum = pgEnum("cash_movement_type", [
  "opening_balance",
  "cash_sale",
  "cash_refund",
  "cash_in",
  "cash_out",
  "closing_adjustment",
]);

export const saleStatusEnum = pgEnum("sale_status", [
  "draft",
  "awaiting_payment",
  "completed",
  "cancelled",
  "voided",
  "partially_refunded",
  "refunded",
]);

export const paymentStatusEnum = pgEnum("payment_status", [
  "pending",
  "paid",
  "failed",
  "expired",
  "cancelled",
  "partially_refunded",
  "refunded",
]);

export const paymentMethodEnum = pgEnum("payment_method", [
  "cash",
  "debit_card",
  "credit_card",
  "bank_transfer",
  "qris_manual",
  "qris_gateway",
  "other",
]);

export const posHeldCartStatusEnum = pgEnum("pos_held_cart_status", [
  "active",
  "resumed",
  "canceled",
]);

export const organizations = pgTable(
  "organizations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: varchar("name", { length: 160 }).notNull(),
    slug: varchar("slug", { length: 80 }).notNull(),
    timezone: varchar("timezone", { length: 64 })
      .default("Asia/Jakarta")
      .notNull(),
    currency: varchar("currency", { length: 3 }).default("IDR").notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    ...timestamps,
  },
  (table) => [uniqueIndex("organizations_slug_uq").on(table.slug)],
);

export const outlets = pgTable(
  "outlets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    code: varchar("code", { length: 24 }).notNull(),
    name: varchar("name", { length: 160 }).notNull(),
    address: text("address"),
    phone: varchar("phone", { length: 32 }),
    isActive: boolean("is_active").default(true).notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("outlets_org_code_uq").on(table.organizationId, table.code),
    index("outlets_org_idx").on(table.organizationId),
  ],
);

export const registers = pgTable(
  "registers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    outletId: uuid("outlet_id")
      .notNull()
      .references(() => outlets.id),
    code: varchar("code", { length: 32 }).notNull(),
    name: varchar("name", { length: 120 }).notNull(),
    isHardwareHub: boolean("is_hardware_hub").default(false).notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("registers_outlet_code_uq").on(table.outletId, table.code),

    uniqueIndex("registers_one_hardware_hub_per_outlet_uq")
      .on(table.outletId)
      .where(sql`${table.isHardwareHub} = true`),

    index("registers_outlet_idx").on(table.outletId),
  ],
);

export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    email: varchar("email", { length: 254 }).notNull(),
    username: varchar("username", { length: 80 }).notNull(),
    fullName: varchar("full_name", { length: 160 }).notNull(),
    phone: varchar("phone", { length: 32 }),
    passwordHash: text("password_hash"),
    status: userStatusEnum("status").default("active").notNull(),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("users_org_email_uq").on(table.organizationId, table.email),
    uniqueIndex("users_org_username_uq").on(
      table.organizationId,
      table.username,
    ),
    index("users_org_status_idx").on(table.organizationId, table.status),
  ],
);

export const userSessions = pgTable(
  "user_sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),

    /**
     * Token asli hanya disimpan di cookie browser.
     * Database hanya menyimpan hash/HMAC dari token.
     */
    tokenHash: varchar("token_hash", {
      length: 64,
    }).notNull(),

    expiresAt: timestamp("expires_at", {
      withTimezone: true,
    }).notNull(),

    lastSeenAt: timestamp("last_seen_at", {
      withTimezone: true,
    })
      .defaultNow()
      .notNull(),

    revokedAt: timestamp("revoked_at", {
      withTimezone: true,
    }),

    ipAddress: varchar("ip_address", {
      length: 64,
    }),

    userAgent: text("user_agent"),

    ...timestamps,
  },
  (table) => [
    uniqueIndex("user_sessions_token_hash_uq").on(table.tokenHash),

    index("user_sessions_user_expires_idx").on(table.userId, table.expiresAt),

    index("user_sessions_expires_idx").on(table.expiresAt),
  ],
);

export const roles = pgTable(
  "roles",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    code: varchar("code", { length: 64 }).notNull(),
    name: varchar("name", { length: 120 }).notNull(),
    description: text("description"),
    isSystem: boolean("is_system").default(false).notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("roles_org_code_uq").on(table.organizationId, table.code),
  ],
);

export const permissions = pgTable(
  "permissions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    code: varchar("code", { length: 120 }).notNull(),
    name: varchar("name", { length: 160 }).notNull(),
    module: varchar("module", { length: 80 }).notNull(),
    description: text("description"),
    ...timestamps,
  },
  (table) => [uniqueIndex("permissions_code_uq").on(table.code)],
);

export const userRoles = pgTable(
  "user_roles",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    roleId: uuid("role_id")
      .notNull()
      .references(() => roles.id),
    assignedAt: timestamp("assigned_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    assignedBy: uuid("assigned_by").references(() => users.id),
  },
  (table) => [
    uniqueIndex("user_roles_user_role_uq").on(table.userId, table.roleId),
  ],
);

export const rolePermissions = pgTable(
  "role_permissions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    roleId: uuid("role_id")
      .notNull()
      .references(() => roles.id),
    permissionId: uuid("permission_id")
      .notNull()
      .references(() => permissions.id),
    constraints: jsonb("constraints").$type<Record<string, unknown> | null>(),
  },
  (table) => [
    uniqueIndex("role_permissions_role_permission_uq").on(
      table.roleId,
      table.permissionId,
    ),
  ],
);

export const userOutlets = pgTable(
  "user_outlets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    outletId: uuid("outlet_id")
      .notNull()
      .references(() => outlets.id),
    isPrimary: boolean("is_primary").default(false).notNull(),
  },
  (table) => [
    uniqueIndex("user_outlets_user_outlet_uq").on(table.userId, table.outletId),
  ],
);

export const productCategories = pgTable(
  "product_categories",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    parentCategoryId: uuid("parent_category_id").references(
      (): AnyPgColumn => productCategories.id,
    ),
    code: varchar("code", { length: 48 }).notNull(),
    name: varchar("name", { length: 120 }).notNull(),
    description: text("description"),
    displayOrder: integer("display_order").default(0).notNull(),
    attributeSchema: jsonb("attribute_schema")
      .$type<Record<string, unknown>>()
      .default({}),
    isActive: boolean("is_active").default(true).notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("product_categories_org_code_uq").on(
      table.organizationId,
      table.code,
    ),
    index("product_categories_org_parent_idx").on(
      table.organizationId,
      table.parentCategoryId,
    ),
    index("product_categories_org_active_order_idx").on(
      table.organizationId,
      table.isActive,
      table.displayOrder,
    ),
    check(
      "product_categories_no_self_parent_ck",
      sql`${table.parentCategoryId} is null or ${table.parentCategoryId} <> ${table.id}`,
    ),
  ],
);

export const metals = pgTable(
  "metals",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    code: varchar("code", { length: 32 }).notNull(),
    name: varchar("name", { length: 80 }).notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("metals_org_code_uq").on(table.organizationId, table.code),
    index("metals_org_active_idx").on(table.organizationId, table.isActive),
  ],
);

export const metalPurities = pgTable(
  "metal_purities",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    metalId: uuid("metal_id")
      .notNull()
      .references(() => metals.id),
    code: varchar("code", { length: 32 }).notNull(),
    displayName: varchar("display_name", { length: 80 }).notNull(),
    purityPercentage: numeric("purity_percentage", {
      precision: 7,
      scale: 4,
    }).notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("metal_purities_metal_code_uq").on(
      table.metalId,
      table.code,
    ),
    index("metal_purities_metal_active_idx").on(
      table.metalId,
      table.isActive,
    ),
    check(
      "metal_purities_percentage_ck",
      sql`${table.purityPercentage} > 0 and ${table.purityPercentage} <= 100`,
    ),
  ],
);

export const metalPriceRates = pgTable(
  "metal_price_rates",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    metalPurityId: uuid("metal_purity_id")
      .notNull()
      .references(() => metalPurities.id),
    ratePerGram: numeric("rate_per_gram", {
      precision: 18,
      scale: 0,
    }).notNull(),
    effectiveFrom: timestamp("effective_from", { withTimezone: true })
      .defaultNow()
      .notNull(),
    effectiveUntil: timestamp("effective_until", { withTimezone: true }),
    notes: text("notes"),
    createdByUserId: uuid("created_by_user_id").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("metal_price_rates_purity_effective_uq").on(
      table.metalPurityId,
      table.effectiveFrom,
    ),
    check("metal_price_rates_positive_ck", sql`${table.ratePerGram} > 0`),
    check(
      "metal_price_rates_range_ck",
      sql`${table.effectiveUntil} is null or ${table.effectiveUntil} > ${table.effectiveFrom}`,
    ),
  ],
);

export const productMasters = pgTable(
  "product_masters",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => productCategories.id),
    code: varchar("code", { length: 64 }).notNull(),
    name: varchar("name", { length: 200 }).notNull(),
    brand: varchar("brand", { length: 120 }),
    material: varchar("material", { length: 80 }),
    collection: varchar("collection", { length: 120 }),
    description: text("description"),
    imageKey: text("image_key"),
    attributes: jsonb("attributes")
      .$type<Record<string, unknown>>()
      .default({}),
    status: masterStatusEnum("status").default("draft").notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("product_masters_org_code_uq").on(
      table.organizationId,
      table.code,
    ),
    index("product_masters_category_idx").on(table.categoryId),
    index("product_masters_org_status_idx").on(
      table.organizationId,
      table.status,
    ),
  ],
);



export const productItems = pgTable(
  "product_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    productMasterId: uuid("product_master_id")
      .notNull()
      .references(() => productMasters.id),
    displayName: varchar("display_name", { length: 220 }),

    currentOutletId: uuid("current_outlet_id").references(() => outlets.id),
    sku: varchar("sku", { length: 80 }).notNull(),
    barcode: varchar("barcode", { length: 120 }).notNull(),
    qrValue: varchar("qr_value", { length: 220 }),
    serialNumber: varchar("serial_number", { length: 120 }),
    legacyId: varchar("legacy_id", { length: 120 }),
    legacyUrl: text("legacy_url"),
    weightGram: numeric("weight_gram", { precision: 12, scale: 3 }),
    purityPercent: numeric("purity_percent", { precision: 7, scale: 3 }),
    exchangePurityPercent: numeric("exchange_purity_percent", {
      precision: 7,
      scale: 3,
    }),
    size: varchar("size", { length: 64 }),
    color: varchar("color", { length: 64 }),
    gemstone: varchar("gemstone", { length: 160 }),
    costAmount: numeric("cost_amount", { precision: 18, scale: 0 }),
    sellingAmount: numeric("selling_amount", {
      precision: 18,
      scale: 0,
    }),
    pricePerGram: numeric("price_per_gram", { precision: 18, scale: 0 }),
    deductionPerGram: numeric("deduction_per_gram", {
      precision: 18,
      scale: 0,
    }),
    availability: itemAvailabilityEnum("availability")
      .default("draft")
      .notNull(),
    condition: itemConditionEnum("condition").default("good").notNull(),
    locationState: itemLocationStateEnum("location_state")
      .default("outlet")
      .notNull(),
    locationCode: varchar("location_code", { length: 80 }),
    imageKey: text("image_key"),
    attributes: jsonb("attributes")
      .$type<Record<string, unknown>>()
      .default({}),
    internalNotes: text("internal_notes"),
    isActive: boolean("is_active").default(true).notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("product_items_org_sku_uq").on(table.organizationId, table.sku),
    uniqueIndex("product_items_org_barcode_uq").on(
      table.organizationId,
      table.barcode,
    ),
    uniqueIndex("product_items_org_serial_uq").on(
      table.organizationId,
      table.serialNumber,
    ),
    index("product_items_master_idx").on(table.productMasterId),
    index("product_items_outlet_availability_idx").on(
      table.currentOutletId,
      table.availability,
    ),
    check(
      "product_items_weight_positive_ck",
      sql`${table.weightGram} is null or ${table.weightGram} > 0`,
    ),
    check(
      "product_items_cost_nonnegative_ck",
      sql`${table.costAmount} is null or ${table.costAmount} >= 0`,
    ),
    check(
      "product_items_selling_positive_ck",
      sql`${table.sellingAmount} is null or ${table.sellingAmount} > 0`,
    ),
    check(
      "product_items_price_per_gram_nonnegative_ck",
      sql`${table.pricePerGram} is null or ${table.pricePerGram} >= 0`,
    ),
    check(
      "product_items_deduction_nonnegative_ck",
      sql`${table.deductionPerGram} is null or ${table.deductionPerGram} >= 0`,
    ),
  ],
);

export const inventoryMovements = pgTable(
  "inventory_movements",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    itemId: uuid("item_id")
      .notNull()
      .references(() => productItems.id),
    movementType: movementTypeEnum("movement_type").notNull(),
    fromOutletId: uuid("from_outlet_id").references(() => outlets.id),
    toOutletId: uuid("to_outlet_id").references(() => outlets.id),
    referenceType: varchar("reference_type", { length: 80 }),
    referenceId: uuid("reference_id"),
    reason: text("reason"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
    performedBy: uuid("performed_by")
      .notNull()
      .references(() => users.id),
    approvedBy: uuid("approved_by").references(() => users.id),
    occurredAt: timestamp("occurred_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("inventory_movements_item_time_idx").on(
      table.itemId,
      table.occurredAt,
    ),
    index("inventory_movements_reference_idx").on(
      table.referenceType,
      table.referenceId,
    ),
  ],
);

export const shifts = pgTable(
  "shifts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    outletId: uuid("outlet_id")
      .notNull()
      .references(() => outlets.id),
    registerId: uuid("register_id")
      .notNull()
      .references(() => registers.id),
    openedBy: uuid("opened_by")
      .notNull()
      .references(() => users.id),
    closedBy: uuid("closed_by").references(() => users.id),
    status: shiftStatusEnum("status").default("open").notNull(),
    openingCash: numeric("opening_cash", { precision: 18, scale: 0 })
      .default("0")
      .notNull(),
    expectedCash: numeric("expected_cash", { precision: 18, scale: 0 }),
    actualCash: numeric("actual_cash", { precision: 18, scale: 0 }),
    cashVariance: numeric("cash_variance", { precision: 18, scale: 0 }),
    varianceReason: text("variance_reason"),
    openedAt: timestamp("opened_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    index("shifts_register_status_idx").on(table.registerId, table.status),
    index("shifts_outlet_opened_idx").on(table.outletId, table.openedAt),
  ],
);

export const cashMovements = pgTable(
  "cash_movements",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    shiftId: uuid("shift_id")
      .notNull()
      .references(() => shifts.id),
    type: cashMovementTypeEnum("type").notNull(),
    amount: numeric("amount", { precision: 18, scale: 0 }).notNull(),
    referenceType: varchar("reference_type", { length: 80 }),
    referenceId: uuid("reference_id"),
    reason: text("reason"),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("cash_movements_shift_time_idx").on(table.shiftId, table.createdAt),
  ],
);

export const customers = pgTable(
  "customers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    customerCode: varchar("customer_code", { length: 64 }),
    fullName: varchar("full_name", { length: 180 }).notNull(),
    phone: varchar("phone", { length: 32 }),
    email: varchar("email", { length: 254 }),
    address: text("address"),
    notes: text("notes"),
    isActive: boolean("is_active").default(true).notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("customers_org_code_uq").on(
      table.organizationId,
      table.customerCode,
    ),
    index("customers_org_phone_idx").on(table.organizationId, table.phone),
  ],
);

export const posHeldCarts = pgTable(
  "pos_held_carts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    outletId: uuid("outlet_id")
      .notNull()
      .references(() => outlets.id),
    registerId: uuid("register_id")
      .notNull()
      .references(() => registers.id),
    shiftId: uuid("shift_id")
      .notNull()
      .references(() => shifts.id),
    customerId: uuid("customer_id").references(() => customers.id),
    heldByUserId: uuid("held_by_user_id")
      .notNull()
      .references(() => users.id),
    holdNumber: varchar("hold_number", { length: 80 }).notNull(),
    title: varchar("title", { length: 160 }),
    note: text("note"),
    status: posHeldCartStatusEnum("status").default("active").notNull(),
    itemCount: integer("item_count").default(0).notNull(),
    subtotalAmount: numeric("subtotal_amount", { precision: 18, scale: 0 })
      .default("0")
      .notNull(),
    discountAmount: numeric("discount_amount", { precision: 18, scale: 0 })
      .default("0")
      .notNull(),
    totalAmount: numeric("total_amount", { precision: 18, scale: 0 })
      .default("0")
      .notNull(),
    resumedAt: timestamp("resumed_at", { withTimezone: true }),
    resumedByUserId: uuid("resumed_by_user_id").references(() => users.id),
    canceledAt: timestamp("canceled_at", { withTimezone: true }),
    canceledByUserId: uuid("canceled_by_user_id").references(() => users.id),
    cancelReason: text("cancel_reason"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("pos_held_carts_org_hold_number_uq").on(
      table.organizationId,
      table.holdNumber,
    ),
    index("pos_held_carts_outlet_status_created_idx").on(
      table.outletId,
      table.status,
      table.createdAt,
    ),
    index("pos_held_carts_register_status_idx").on(
      table.registerId,
      table.status,
    ),
    index("pos_held_carts_shift_status_idx").on(table.shiftId, table.status),
    index("pos_held_carts_customer_idx").on(table.customerId),
    index("pos_held_carts_held_by_idx").on(table.heldByUserId),
    check("pos_held_carts_item_count_nonnegative_ck", sql`${table.itemCount} >= 0`),
    check(
      "pos_held_carts_subtotal_nonnegative_ck",
      sql`${table.subtotalAmount} >= 0`,
    ),
    check(
      "pos_held_carts_discount_nonnegative_ck",
      sql`${table.discountAmount} >= 0`,
    ),
    check("pos_held_carts_total_nonnegative_ck", sql`${table.totalAmount} >= 0`),
  ],
);

export const posHeldCartItems = pgTable(
  "pos_held_cart_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    heldCartId: uuid("held_cart_id")
      .notNull()
      .references(() => posHeldCarts.id),
    productItemId: uuid("product_item_id")
      .notNull()
      .references(() => productItems.id),
    lineNumber: bigint("line_number", { mode: "number" }).notNull(),
    listPriceAmount: numeric("list_price_amount", {
      precision: 18,
      scale: 0,
    }).notNull(),
    discountAmount: numeric("discount_amount", { precision: 18, scale: 0 })
      .default("0")
      .notNull(),
    finalPriceAmount: numeric("final_price_amount", {
      precision: 18,
      scale: 0,
    }).notNull(),
    snapshot: jsonb("snapshot").$type<Record<string, unknown>>().notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    releasedAt: timestamp("released_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("pos_held_cart_items_cart_item_uq").on(
      table.heldCartId,
      table.productItemId,
    ),
    uniqueIndex("pos_held_cart_items_cart_line_uq").on(
      table.heldCartId,
      table.lineNumber,
    ),
    uniqueIndex("pos_held_cart_items_active_item_uq")
      .on(table.productItemId)
      .where(sql`${table.isActive} = true`),
    index("pos_held_cart_items_cart_active_idx").on(
      table.heldCartId,
      table.isActive,
    ),
    index("pos_held_cart_items_product_idx").on(table.productItemId),
    check(
      "pos_held_cart_items_list_price_nonnegative_ck",
      sql`${table.listPriceAmount} >= 0`,
    ),
    check(
      "pos_held_cart_items_discount_nonnegative_ck",
      sql`${table.discountAmount} >= 0`,
    ),
    check(
      "pos_held_cart_items_final_price_nonnegative_ck",
      sql`${table.finalPriceAmount} >= 0`,
    ),
  ],
);

export const sales = pgTable(
  "sales",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    outletId: uuid("outlet_id")
      .notNull()
      .references(() => outlets.id),
    registerId: uuid("register_id")
      .notNull()
      .references(() => registers.id),
    shiftId: uuid("shift_id")
      .notNull()
      .references(() => shifts.id),
    customerId: uuid("customer_id").references(() => customers.id),
    cashierId: uuid("cashier_id")
      .notNull()
      .references(() => users.id),
    invoiceNumber: varchar("invoice_number", { length: 80 }).notNull(),
    idempotencyKey: varchar("idempotency_key", { length: 120 }).notNull(),
    status: saleStatusEnum("status").default("draft").notNull(),
    subtotalAmount: numeric("subtotal_amount", { precision: 18, scale: 0 })
      .default("0")
      .notNull(),
    discountAmount: numeric("discount_amount", { precision: 18, scale: 0 })
      .default("0")
      .notNull(),
    discountReason: text("discount_reason"),
    additionalFeeAmount: numeric("additional_fee_amount", {
      precision: 18,
      scale: 0,
    })
      .default("0")
      .notNull(),
    totalAmount: numeric("total_amount", { precision: 18, scale: 0 })
      .default("0")
      .notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    notes: text("notes"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("sales_org_invoice_uq").on(
      table.organizationId,
      table.invoiceNumber,
    ),
    uniqueIndex("sales_idempotency_uq").on(table.idempotencyKey),
    index("sales_outlet_created_idx").on(table.outletId, table.createdAt),
    index("sales_shift_idx").on(table.shiftId),
  ],
);

export const saleItems = pgTable(
  "sale_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    saleId: uuid("sale_id")
      .notNull()
      .references(() => sales.id),
    productItemId: uuid("product_item_id")
      .notNull()
      .references(() => productItems.id),
    lineNumber: bigint("line_number", { mode: "number" }).notNull(),
    listPriceAmount: numeric("list_price_amount", {
      precision: 18,
      scale: 0,
    }).notNull(),
    discountAmount: numeric("discount_amount", { precision: 18, scale: 0 })
      .default("0")
      .notNull(),
    finalPriceAmount: numeric("final_price_amount", {
      precision: 18,
      scale: 0,
    }).notNull(),
    snapshot: jsonb("snapshot").$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("sale_items_sale_item_uq").on(
      table.saleId,
      table.productItemId,
    ),
    uniqueIndex("sale_items_sale_line_uq").on(table.saleId, table.lineNumber),
  ],
);

export const payments = pgTable(
  "payments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    saleId: uuid("sale_id")
      .notNull()
      .references(() => sales.id),
    method: paymentMethodEnum("method").notNull(),
    provider: varchar("provider", { length: 80 }).default("manual").notNull(),
    amount: numeric("amount", { precision: 18, scale: 0 }).notNull(),
    status: paymentStatusEnum("status").default("pending").notNull(),
    providerReference: varchar("provider_reference", { length: 160 }),
    externalOrderId: varchar("external_order_id", { length: 160 }),
    verifiedBy: uuid("verified_by").references(() => users.id),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
    ...timestamps,
  },
  (table) => [
    index("payments_sale_status_idx").on(table.saleId, table.status),
    index("payments_provider_reference_idx").on(
      table.provider,
      table.providerReference,
    ),
  ],
);

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    outletId: uuid("outlet_id").references(() => outlets.id),
    actorUserId: uuid("actor_user_id").references(() => users.id),
    action: varchar("action", { length: 120 }).notNull(),
    entityType: varchar("entity_type", { length: 120 }).notNull(),
    entityId: varchar("entity_id", { length: 160 }),
    beforeData: jsonb("before_data").$type<Record<string, unknown> | null>(),
    afterData: jsonb("after_data").$type<Record<string, unknown> | null>(),
    reason: text("reason"),
    requestId: varchar("request_id", { length: 120 }),
    ipAddress: varchar("ip_address", { length: 64 }),
    userAgent: text("user_agent"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("audit_logs_org_time_idx").on(table.organizationId, table.createdAt),
    index("audit_logs_entity_idx").on(table.entityType, table.entityId),
  ],
);

export const hardwareAgentStatusEnum = pgEnum("hardware_agent_status", [
  "online",
  "offline",
  "disabled",
]);

export const hardwareJobStatusEnum = pgEnum("hardware_job_status", [
  "pending",
  "claimed",
  "printing",
  "completed",
  "failed",
  "cancelled",
]);

export const hardwareJobTypeEnum = pgEnum("hardware_job_type", [
  "print_label_sato",
  "print_receipt_certificate",
  "open_cash_drawer",
  "test_label_printer",
  "test_document_printer",
  "test_cash_drawer",
]);

export const hardwareDeviceTypeEnum = pgEnum("hardware_device_type", [
  "label_printer",
  "document_printer",
  "cash_drawer",
  "other",
]);

export const hardwareAgents = pgTable(
  "hardware_agents",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    outletId: uuid("outlet_id")
      .notNull()
      .references(() => outlets.id),
    registerId: uuid("register_id")
      .notNull()
      .references(() => registers.id),
    code: varchar("code", { length: 80 }).notNull(),
    name: varchar("name", { length: 160 }).notNull(),
    secretHash: text("secret_hash").notNull(),
    status: hardwareAgentStatusEnum("status").default("offline").notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    capabilities: jsonb("capabilities")
      .$type<Record<string, unknown>>()
      .default({}),
    settings: jsonb("settings").$type<Record<string, unknown>>().default({}),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
    lastIpAddress: varchar("last_ip_address", { length: 64 }),
    lastUserAgent: text("last_user_agent"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("hardware_agents_org_code_uq").on(
      table.organizationId,
      table.code,
    ),
    index("hardware_agents_register_idx").on(table.registerId, table.isActive),
    index("hardware_agents_org_status_idx").on(
      table.organizationId,
      table.status,
    ),
  ],
);

export const hardwareJobs = pgTable(
  "hardware_jobs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    outletId: uuid("outlet_id")
      .notNull()
      .references(() => outlets.id),
    registerId: uuid("register_id")
      .notNull()
      .references(() => registers.id),
    agentId: uuid("agent_id").references(() => hardwareAgents.id),
    createdByUserId: uuid("created_by_user_id").references(() => users.id),
    jobType: hardwareJobTypeEnum("job_type").notNull(),
    deviceType: hardwareDeviceTypeEnum("device_type").notNull(),
    targetDevice: varchar("target_device", { length: 120 }),
    status: hardwareJobStatusEnum("status").default("pending").notNull(),
    priority: integer("priority").default(100).notNull(),
    attempts: integer("attempts").default(0).notNull(),
    maxAttempts: integer("max_attempts").default(3).notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    result: jsonb("result").$type<Record<string, unknown>>().default({}),
    error: text("error"),
    idempotencyKey: varchar("idempotency_key", { length: 160 }),
    sourceType: varchar("source_type", { length: 80 }),
    sourceId: varchar("source_id", { length: 160 }),
    availableAt: timestamp("available_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    claimedAt: timestamp("claimed_at", { withTimezone: true }),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    failedAt: timestamp("failed_at", { withTimezone: true }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    index("hardware_jobs_claim_idx").on(
      table.organizationId,
      table.outletId,
      table.registerId,
      table.status,
      table.availableAt,
    ),
    index("hardware_jobs_agent_status_idx").on(table.agentId, table.status),
    index("hardware_jobs_source_idx").on(table.sourceType, table.sourceId),
    uniqueIndex("hardware_jobs_idempotency_uq")
      .on(table.organizationId, table.idempotencyKey)
      .where(sql`${table.idempotencyKey} is not null`),
  ],
);

export const approvalStatusEnum = pgEnum("approval_status", [
  "pending",
  "approved",
  "rejected",
]);

export const approvalTypeEnum = pgEnum("approval_type", [
  "discount",
  "void_receipt",
  "refund_transaction",
  "stock_adjustment",
  "other",
]);

export const approvals = pgTable(
  "approvals",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    outletId: uuid("outlet_id").references(() => outlets.id),
    type: approvalTypeEnum("type").notNull(),
    status: approvalStatusEnum("status").default("pending").notNull(),
    requestedBy: uuid("requested_by")
      .notNull()
      .references(() => users.id),
    approvedBy: uuid("approved_by").references(() => users.id),
    referenceType: varchar("reference_type", { length: 80 }),
    referenceId: uuid("reference_id"),
    requestData: jsonb("request_data").$type<Record<string, unknown>>().notNull(),
    notes: text("notes"),
    responseNotes: text("response_notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  },
  (table) => [
    index("approvals_org_status_idx").on(table.organizationId, table.status),
    index("approvals_ref_idx").on(table.referenceType, table.referenceId),
  ],
);
