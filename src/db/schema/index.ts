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
  "inspection",
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

export const manualPaymentVerificationStatusEnum = pgEnum(
  "manual_payment_verification_status",
  ["self_verified", "co_verification_required", "co_verified", "rejected"],
);

export const paymentSettlementStatusEnum = pgEnum(
  "payment_settlement_status",
  [
    "not_applicable",
    "unreconciled",
    "pending_settlement",
    "reconciled",
    "mismatch",
    "not_found",
    "waived",
  ],
);

export const settlementImportStatusEnum = pgEnum("settlement_import_status", [
  "uploaded",
  "ready",
  "processing",
  "completed",
  "completed_with_issues",
  "failed",
  "cancelled",
]);

export const settlementImportRowStatusEnum = pgEnum(
  "settlement_import_row_status",
  [
    "pending",
    "matched",
    "ambiguous",
    "mismatch",
    "not_found",
    "duplicate",
    "ignored",
    "applied",
    "failed",
  ],
);

export const posCheckoutAttemptStatusEnum = pgEnum("pos_checkout_attempt_status", [
  "processing",
  "completed",
  "failed",
]);

export const paymentRefundStatusEnum = pgEnum("payment_refund_status", [
  "requested",
  "approved",
  "processing",
  "confirmed",
  "failed",
  "cancelled",
]);

export const saleReturnCaseStatusEnum = pgEnum("sale_return_case_status", [
  "awaiting_receipt",
  "pending_inspection",
  "partially_inspected",
  "completed",
  "rejected",
  "cancelled",
]);

export const saleReturnItemStatusEnum = pgEnum("sale_return_item_status", [
  "awaiting_receipt",
  "pending_inspection",
  "restocked",
  "repair",
  "damaged",
  "rejected",
]);

export const returnInspectionDecisionEnum = pgEnum(
  "return_inspection_decision",
  ["restock", "repair", "damaged", "reject"],
);

export const approvalExecutionStatusEnum = pgEnum("approval_execution_status", [
  "not_started",
  "executing",
  "completed",
  "failed",
  "cancelled",
]);

export const customerDepositLedgerEntryTypeEnum = pgEnum(
  "customer_deposit_ledger_entry_type",
  ["deposit_in", "deposit_used", "deposit_withdrawal", "adjustment"],
);

export const customerDepositLedgerDirectionEnum = pgEnum(
  "customer_deposit_ledger_direction",
  ["credit", "debit"],
);

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
    googleMapsEmbedUrl: text("google_maps_embed_url"),
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
    uniqueIndex("inventory_movements_reference_guard_uq")
      .on(
        table.itemId,
        table.movementType,
        table.referenceType,
        table.referenceId,
      )
      .where(
        sql`${table.referenceType} is not null and ${table.referenceId} is not null`,
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
    uniqueIndex("shifts_one_active_per_register_uq")
      .on(table.registerId)
      .where(sql`${table.status} in ('open', 'closing')`),
    index("shifts_register_status_idx").on(table.registerId, table.status),
    index("shifts_outlet_opened_idx").on(table.outletId, table.openedAt),
    check("shifts_opening_cash_nonnegative_ck", sql`${table.openingCash} >= 0`),
    check(
      "shifts_actual_cash_nonnegative_ck",
      sql`${table.actualCash} is null or ${table.actualCash} >= 0`,
    ),
    check(
      "shifts_closed_state_complete_ck",
      sql`${table.status} <> 'closed' or (
        ${table.closedBy} is not null
        and ${table.expectedCash} is not null
        and ${table.actualCash} is not null
        and ${table.cashVariance} is not null
        and ${table.closedAt} is not null
      )`,
    ),
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
    uniqueIndex("cash_movements_reference_guard_uq")
      .on(table.type, table.referenceType, table.referenceId)
      .where(
        sql`${table.referenceType} is not null and ${table.referenceId} is not null`,
      ),
    index("cash_movements_shift_time_idx").on(table.shiftId, table.createdAt),
    check(
      "cash_movements_amount_ck",
      sql`(
        ${table.type} = 'opening_balance' and ${table.amount} >= 0
      ) or (
        ${table.type} <> 'opening_balance' and ${table.amount} > 0
      )`,
    ),
    check(
      "cash_movements_system_reference_ck",
      sql`${table.type} not in ('opening_balance', 'cash_sale', 'cash_refund')
        or (${table.referenceType} is not null and ${table.referenceId} is not null)`,
    ),
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
    checkoutFingerprint: varchar("checkout_fingerprint", { length: 64 }),
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
    check("sales_subtotal_nonnegative_ck", sql`${table.subtotalAmount} >= 0`),
    check("sales_discount_nonnegative_ck", sql`${table.discountAmount} >= 0`),
    check(
      "sales_additional_fee_nonnegative_ck",
      sql`${table.additionalFeeAmount} >= 0`,
    ),
    check("sales_total_nonnegative_ck", sql`${table.totalAmount} >= 0`),
    check(
      "sales_discount_not_above_subtotal_ck",
      sql`${table.discountAmount} <= ${table.subtotalAmount}`,
    ),
    check(
      "sales_total_formula_ck",
      sql`${table.totalAmount} = ${table.subtotalAmount} - ${table.discountAmount} + ${table.additionalFeeAmount}`,
    ),
    check(
      "sales_completed_timestamp_ck",
      sql`${table.status} <> 'completed' or ${table.completedAt} is not null`,
    ),
    check(
      "sales_cancelled_timestamp_ck",
      sql`${table.status} not in ('cancelled', 'voided', 'refunded') or ${table.cancelledAt} is not null`,
    ),
  ],
);

export const posCheckoutAttempts = pgTable(
  "pos_checkout_attempts",
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
    cashierId: uuid("cashier_id")
      .notNull()
      .references(() => users.id),
    idempotencyKey: varchar("idempotency_key", { length: 120 }).notNull(),
    requestFingerprint: varchar("request_fingerprint", { length: 64 }).notNull(),
    status: posCheckoutAttemptStatusEnum("status")
      .default("processing")
      .notNull(),
    saleId: uuid("sale_id").references(() => sales.id, {
      onDelete: "set null",
    }),
    attemptCount: integer("attempt_count").default(1).notNull(),
    lastErrorCode: varchar("last_error_code", { length: 80 }),
    lastErrorMessage: text("last_error_message"),
    startedAt: timestamp("started_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    failedAt: timestamp("failed_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("pos_checkout_attempts_idempotency_uq").on(
      table.idempotencyKey,
    ),
    index("pos_checkout_attempts_org_cashier_idx").on(
      table.organizationId,
      table.cashierId,
      table.createdAt,
    ),
    index("pos_checkout_attempts_sale_idx").on(table.saleId),
    check(
      "pos_checkout_attempts_attempt_count_positive_ck",
      sql`${table.attemptCount} > 0`,
    ),
    check(
      "pos_checkout_attempts_completed_state_ck",
      sql`${table.status} <> 'completed' or (${table.saleId} is not null and ${table.completedAt} is not null)`,
    ),
    check(
      "pos_checkout_attempts_failed_state_ck",
      sql`${table.status} <> 'failed' or ${table.failedAt} is not null`,
    ),
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
    check(
      "sale_items_list_price_positive_ck",
      sql`${table.listPriceAmount} > 0`,
    ),
    check(
      "sale_items_discount_nonnegative_ck",
      sql`${table.discountAmount} >= 0`,
    ),
    check(
      "sale_items_discount_not_above_list_ck",
      sql`${table.discountAmount} <= ${table.listPriceAmount}`,
    ),
    check(
      "sale_items_final_price_formula_ck",
      sql`${table.finalPriceAmount} = ${table.listPriceAmount} - ${table.discountAmount}`,
    ),
  ],
);

export const manualPaymentProfiles = pgTable(
  "manual_payment_profiles",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    outletId: uuid("outlet_id")
      .notNull()
      .references(() => outlets.id),
    registerId: uuid("register_id").references(() => registers.id, {
      onDelete: "set null",
    }),
    profileType: varchar("profile_type", { length: 24 }).notNull(),
    code: varchar("code", { length: 40 }).notNull(),
    name: varchar("name", { length: 120 }).notNull(),
    provider: varchar("provider", { length: 80 }).notNull(),
    verificationSource: varchar("verification_source", { length: 40 }).notNull(),
    merchantId: varchar("merchant_id", { length: 80 }),
    terminalId: varchar("terminal_id", { length: 80 }),
    destinationAccount: varchar("destination_account", { length: 120 }),
    displayOrder: integer("display_order").default(0).notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("manual_payment_profiles_org_outlet_code_uq").on(
      table.organizationId,
      table.outletId,
      table.code,
    ),
    index("manual_payment_profiles_outlet_type_idx").on(
      table.outletId,
      table.profileType,
      table.isActive,
      table.displayOrder,
    ),
    index("manual_payment_profiles_register_idx").on(
      table.registerId,
      table.isActive,
    ),
    check(
      "manual_payment_profiles_type_ck",
      sql`${table.profileType} in ('qris', 'edc', 'bank_account')`,
    ),
    check(
      "manual_payment_profiles_source_ck",
      sql`${table.verificationSource} in ('merchant_app', 'edc_terminal', 'bank_app', 'bank_statement')`,
    ),
    check(
      "manual_payment_profiles_fields_ck",
      sql`(
        (${table.profileType} = 'qris'
          and ${table.verificationSource} in ('merchant_app', 'bank_app')
          and ${table.merchantId} is not null
          and btrim(${table.merchantId}) <> '')
        or
        (${table.profileType} = 'edc'
          and ${table.verificationSource} = 'edc_terminal'
          and ${table.terminalId} is not null
          and btrim(${table.terminalId}) <> '')
        or
        (${table.profileType} = 'bank_account'
          and ${table.verificationSource} in ('bank_app', 'bank_statement')
          and ${table.destinationAccount} is not null
          and btrim(${table.destinationAccount}) <> '')
      )`,
    ),
    check(
      "manual_payment_profiles_display_order_ck",
      sql`${table.displayOrder} between 0 and 9999`,
    ),
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
    normalizedReference: varchar("normalized_reference", { length: 160 }),
    externalOrderId: varchar("external_order_id", { length: 160 }),
    verificationStatus: manualPaymentVerificationStatusEnum(
      "verification_status",
    )
      .default("self_verified")
      .notNull(),
    verificationSource: varchar("verification_source", { length: 40 }),
    providerPaidAt: timestamp("provider_paid_at", { withTimezone: true }),
    verificationApprovalId: uuid("verification_approval_id").references(
      () => approvals.id,
    ),
    coVerifiedBy: uuid("co_verified_by").references(() => users.id),
    coVerifiedAt: timestamp("co_verified_at", { withTimezone: true }),
    evidenceKey: text("evidence_key"),
    manualPaymentProfileId: uuid("manual_payment_profile_id").references(
      () => manualPaymentProfiles.id,
      { onDelete: "set null" },
    ),
    settlementStatus: paymentSettlementStatusEnum("settlement_status")
      .default("not_applicable")
      .notNull(),
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
    index("payments_normalized_reference_idx").on(
      table.method,
      table.provider,
      table.normalizedReference,
    ),
    index("payments_verification_status_idx").on(
      table.verificationStatus,
      table.createdAt,
    ),
    index("payments_settlement_status_idx").on(
      table.settlementStatus,
      table.createdAt,
    ),
    index("payments_manual_profile_idx").on(
      table.manualPaymentProfileId,
      table.createdAt,
    ),
    check("payments_amount_positive_ck", sql`${table.amount} > 0`),
    check(
      "payments_paid_state_complete_ck",
      sql`${table.status} <> 'paid' or (
        ${table.verifiedBy} is not null
        and ${table.verifiedAt} is not null
        and ${table.paidAt} is not null
      )`,
    ),
    check(
      "payments_manual_noncash_verification_ck",
      sql`${table.method} not in ('qris_manual', 'debit_card', 'credit_card', 'bank_transfer') or (
        btrim(${table.provider}) <> ''
        and lower(btrim(${table.provider})) <> 'manual'
        and ${table.providerReference} is not null
        and btrim(${table.providerReference}) <> ''
        and ${table.normalizedReference} is not null
        and length(${table.normalizedReference}) >= 4
        and ${table.verificationSource} in ('merchant_app', 'edc_terminal', 'bank_app', 'bank_statement')
        and ${table.providerPaidAt} is not null
        and ${table.settlementStatus} <> 'not_applicable'
      )`,
    ),
    check(
      "payments_co_verified_state_ck",
      sql`${table.verificationStatus} <> 'co_verified' or (
        ${table.verificationApprovalId} is not null
        and ${table.coVerifiedBy} is not null
        and ${table.coVerifiedAt} is not null
      )`,
    ),
    check(
      "payments_cash_settlement_ck",
      sql`${table.method} <> 'cash' or (
        ${table.settlementStatus} = 'not_applicable'
        and ${table.verificationSource} is null
        and ${table.providerPaidAt} is null
        and ${table.verificationApprovalId} is null
        and ${table.coVerifiedBy} is null
        and ${table.coVerifiedAt} is null
        and ${table.evidenceKey} is null
      )`,
    ),
  ],
);


export const paymentReconciliations = pgTable(
  "payment_reconciliations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    outletId: uuid("outlet_id")
      .notNull()
      .references(() => outlets.id),
    paymentId: uuid("payment_id")
      .notNull()
      .references(() => payments.id, { onDelete: "cascade" }),
    status: paymentSettlementStatusEnum("status").notNull(),
    expectedAmount: numeric("expected_amount", { precision: 18, scale: 0 })
      .notNull(),
    settlementGrossAmount: numeric("settlement_gross_amount", {
      precision: 18,
      scale: 0,
    }),
    feeAmount: numeric("fee_amount", { precision: 18, scale: 0 })
      .default("0")
      .notNull(),
    taxAmount: numeric("tax_amount", { precision: 18, scale: 0 })
      .default("0")
      .notNull(),
    netSettlementAmount: numeric("net_settlement_amount", {
      precision: 18,
      scale: 0,
    }),
    differenceAmount: numeric("difference_amount", {
      precision: 18,
      scale: 0,
    })
      .default("0")
      .notNull(),
    settlementDate: timestamp("settlement_date", { withTimezone: true }),
    settlementReference: varchar("settlement_reference", { length: 160 }),
    evidenceKey: text("evidence_key"),
    notes: text("notes"),
    reconciledBy: uuid("reconciled_by")
      .notNull()
      .references(() => users.id),
    reconciledAt: timestamp("reconciled_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    resolvedBy: uuid("resolved_by").references(() => users.id),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    metadata: jsonb("metadata")
      .$type<Record<string, unknown>>()
      .default({})
      .notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("payment_reconciliations_payment_uq").on(table.paymentId),
    index("payment_reconciliations_org_status_idx").on(
      table.organizationId,
      table.status,
      table.updatedAt,
    ),
    index("payment_reconciliations_outlet_status_idx").on(
      table.outletId,
      table.status,
      table.updatedAt,
    ),
    index("payment_reconciliations_settlement_date_idx").on(
      table.settlementDate,
    ),
    check(
      "payment_reconciliations_actionable_status_ck",
      sql`${table.status} not in ('not_applicable', 'unreconciled')`,
    ),
    check(
      "payment_reconciliations_expected_positive_ck",
      sql`${table.expectedAmount} > 0`,
    ),
    check(
      "payment_reconciliations_amounts_nonnegative_ck",
      sql`${table.feeAmount} >= 0 and ${table.taxAmount} >= 0 and (${table.settlementGrossAmount} is null or ${table.settlementGrossAmount} >= 0) and (${table.netSettlementAmount} is null or ${table.netSettlementAmount} >= 0)`,
    ),
    check(
      "payment_reconciliations_net_formula_ck",
      sql`${table.settlementGrossAmount} is null or ${table.netSettlementAmount} is null or ${table.netSettlementAmount} = ${table.settlementGrossAmount} - ${table.feeAmount} - ${table.taxAmount}`,
    ),
    check(
      "payment_reconciliations_difference_formula_ck",
      sql`${table.settlementGrossAmount} is null or ${table.differenceAmount} = ${table.settlementGrossAmount} - ${table.expectedAmount}`,
    ),
    check(
      "payment_reconciliations_reconciled_complete_ck",
      sql`${table.status} <> 'reconciled' or (
        ${table.settlementGrossAmount} = ${table.expectedAmount}
        and ${table.differenceAmount} = 0
        and ${table.netSettlementAmount} is not null
        and ${table.settlementDate} is not null
        and ${table.settlementReference} is not null
        and btrim(${table.settlementReference}) <> ''
      )`,
    ),
    check(
      "payment_reconciliations_mismatch_complete_ck",
      sql`${table.status} <> 'mismatch' or (
        ${table.settlementGrossAmount} is not null
        and ${table.differenceAmount} <> 0
      )`,
    ),
    check(
      "payment_reconciliations_not_found_notes_ck",
      sql`${table.status} <> 'not_found' or (${table.notes} is not null and length(btrim(${table.notes})) >= 8)`,
    ),
    check(
      "payment_reconciliations_waived_resolution_ck",
      sql`${table.status} <> 'waived' or (
        ${table.notes} is not null
        and length(btrim(${table.notes})) >= 8
        and ${table.resolvedBy} is not null
        and ${table.resolvedAt} is not null
      )`,
    ),
  ],
);

export const settlementImportMappings = pgTable(
  "settlement_import_mappings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    outletId: uuid("outlet_id")
      .notNull()
      .references(() => outlets.id),
    profileId: uuid("profile_id")
      .notNull()
      .references(() => manualPaymentProfiles.id, { onDelete: "cascade" }),
    delimiter: varchar("delimiter", { length: 8 }).default(",").notNull(),
    columnMapping: jsonb("column_mapping")
      .$type<Record<string, string | null>>()
      .default({})
      .notNull(),
    updatedBy: uuid("updated_by")
      .notNull()
      .references(() => users.id),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("settlement_import_mappings_profile_uq").on(table.profileId),
    index("settlement_import_mappings_org_outlet_idx").on(
      table.organizationId,
      table.outletId,
    ),
    check(
      "settlement_import_mappings_delimiter_ck",
      sql`length(${table.delimiter}) between 1 and 8`,
    ),
  ],
);

export const settlementImportBatches = pgTable(
  "settlement_import_batches",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    outletId: uuid("outlet_id")
      .notNull()
      .references(() => outlets.id),
    profileId: uuid("profile_id")
      .notNull()
      .references(() => manualPaymentProfiles.id),
    uploadedBy: uuid("uploaded_by")
      .notNull()
      .references(() => users.id),
    fileName: varchar("file_name", { length: 255 }).notNull(),
    fileKey: text("file_key").notNull(),
    fileHash: varchar("file_hash", { length: 64 }).notNull(),
    fileSizeBytes: integer("file_size_bytes").notNull(),
    status: settlementImportStatusEnum("status").default("uploaded").notNull(),
    delimiter: varchar("delimiter", { length: 8 }).default(",").notNull(),
    headers: jsonb("headers").$type<string[]>().default([]).notNull(),
    columnMapping: jsonb("column_mapping")
      .$type<Record<string, string | null>>()
      .default({})
      .notNull(),
    rowCount: integer("row_count").default(0).notNull(),
    validRowCount: integer("valid_row_count").default(0).notNull(),
    matchedCount: integer("matched_count").default(0).notNull(),
    appliedCount: integer("applied_count").default(0).notNull(),
    ambiguousCount: integer("ambiguous_count").default(0).notNull(),
    mismatchCount: integer("mismatch_count").default(0).notNull(),
    notFoundCount: integer("not_found_count").default(0).notNull(),
    duplicateCount: integer("duplicate_count").default(0).notNull(),
    ignoredCount: integer("ignored_count").default(0).notNull(),
    failedCount: integer("failed_count").default(0).notNull(),
    errorMessage: text("error_message"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("settlement_import_batches_org_hash_uq").on(
      table.organizationId,
      table.fileHash,
    ),
    index("settlement_import_batches_org_status_idx").on(
      table.organizationId,
      table.status,
      table.createdAt,
    ),
    index("settlement_import_batches_outlet_profile_idx").on(
      table.outletId,
      table.profileId,
      table.createdAt,
    ),
    check(
      "settlement_import_batches_file_size_ck",
      sql`${table.fileSizeBytes} between 1 and 5242880`,
    ),
    check(
      "settlement_import_batches_counts_ck",
      sql`${table.rowCount} >= 0
        and ${table.validRowCount} >= 0
        and ${table.matchedCount} >= 0
        and ${table.appliedCount} >= 0
        and ${table.ambiguousCount} >= 0
        and ${table.mismatchCount} >= 0
        and ${table.notFoundCount} >= 0
        and ${table.duplicateCount} >= 0
        and ${table.ignoredCount} >= 0
        and ${table.failedCount} >= 0`,
    ),
  ],
);

export const settlementImportRows = pgTable(
  "settlement_import_rows",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    batchId: uuid("batch_id")
      .notNull()
      .references(() => settlementImportBatches.id, { onDelete: "cascade" }),
    rowNumber: integer("row_number").notNull(),
    rawData: jsonb("raw_data")
      .$type<Record<string, string>>()
      .default({})
      .notNull(),
    transactionDate: timestamp("transaction_date", { withTimezone: true }),
    paymentReference: varchar("payment_reference", { length: 160 }),
    normalizedReference: varchar("normalized_reference", { length: 160 }),
    grossAmount: numeric("gross_amount", { precision: 18, scale: 0 }),
    feeAmount: numeric("fee_amount", { precision: 18, scale: 0 })
      .default("0")
      .notNull(),
    taxAmount: numeric("tax_amount", { precision: 18, scale: 0 })
      .default("0")
      .notNull(),
    netAmount: numeric("net_amount", { precision: 18, scale: 0 }),
    settlementReference: varchar("settlement_reference", { length: 160 }),
    providerStatus: varchar("provider_status", { length: 80 }),
    status: settlementImportRowStatusEnum("status").default("pending").notNull(),
    matchedPaymentId: uuid("matched_payment_id").references(() => payments.id),
    candidatePaymentIds: jsonb("candidate_payment_ids")
      .$type<string[]>()
      .default([])
      .notNull(),
    matchReason: text("match_reason"),
    errorMessage: text("error_message"),
    reviewNotes: text("review_notes"),
    appliedAt: timestamp("applied_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("settlement_import_rows_batch_row_uq").on(
      table.batchId,
      table.rowNumber,
    ),
    index("settlement_import_rows_batch_status_idx").on(
      table.batchId,
      table.status,
      table.rowNumber,
    ),
    index("settlement_import_rows_reference_idx").on(
      table.normalizedReference,
    ),
    index("settlement_import_rows_payment_idx").on(table.matchedPaymentId),
    check(
      "settlement_import_rows_row_number_ck",
      sql`${table.rowNumber} > 1`,
    ),
    check(
      "settlement_import_rows_amounts_ck",
      sql`(${table.grossAmount} is null or ${table.grossAmount} >= 0)
        and ${table.feeAmount} >= 0
        and ${table.taxAmount} >= 0
        and (${table.netAmount} is null or ${table.netAmount} >= 0)`,
    ),
    check(
      "settlement_import_rows_applied_ck",
      sql`${table.status} <> 'applied' or (
        ${table.matchedPaymentId} is not null
        and ${table.appliedAt} is not null
      )`,
    ),
  ],
);

export const manualPaymentPolicies = pgTable(
  "manual_payment_policies",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    method: paymentMethodEnum("method").notNull(),
    coVerificationThreshold: numeric("co_verification_threshold", {
      precision: 18,
      scale: 0,
    })
      .default("0")
      .notNull(),
    evidenceThreshold: numeric("evidence_threshold", {
      precision: 18,
      scale: 0,
    })
      .default("0")
      .notNull(),
    duplicateLookbackDays: integer("duplicate_lookback_days")
      .default(30)
      .notNull(),
    isEnabled: boolean("is_enabled").default(true).notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("manual_payment_policies_org_method_uq").on(
      table.organizationId,
      table.method,
    ),
    check(
      "manual_payment_policies_method_ck",
      sql`${table.method} in ('qris_manual', 'debit_card', 'credit_card', 'bank_transfer')`,
    ),
    check(
      "manual_payment_policies_thresholds_ck",
      sql`${table.coVerificationThreshold} >= 0 and ${table.evidenceThreshold} >= 0`,
    ),
    check(
      "manual_payment_policies_lookback_ck",
      sql`${table.duplicateLookbackDays} between 1 and 3650`,
    ),
  ],
);

export const paymentEvidenceUploads = pgTable(
  "payment_evidence_uploads",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    outletId: uuid("outlet_id")
      .notNull()
      .references(() => outlets.id),
    uploadedBy: uuid("uploaded_by")
      .notNull()
      .references(() => users.id),
    storageKey: text("storage_key").notNull(),
    originalFilename: varchar("original_filename", { length: 255 }),
    sizeBytes: integer("size_bytes").notNull(),
    saleId: uuid("sale_id").references(() => sales.id),
    attachedAt: timestamp("attached_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).default(
      sql`now() + interval '7 days'`,
    ),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("payment_evidence_uploads_storage_key_uq").on(table.storageKey),
    index("payment_evidence_uploads_org_outlet_idx").on(
      table.organizationId,
      table.outletId,
      table.createdAt,
    ),
    index("payment_evidence_uploads_expiry_idx").on(
      table.saleId,
      table.expiresAt,
    ),
    index("payment_evidence_uploads_uploader_idx").on(
      table.uploadedBy,
      table.createdAt,
    ),
    check("payment_evidence_uploads_size_ck", sql`${table.sizeBytes} > 0`),
    check(
      "payment_evidence_uploads_attachment_ck",
      sql`(${table.saleId} is null and ${table.attachedAt} is null) or (${table.saleId} is not null and ${table.attachedAt} is not null and ${table.expiresAt} is null)`,
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
  "processing",
  "printing",
  "submitted",
  "completed",
  "failed",
  "unknown_outcome",
  "expired",
  "cancelled",
]);

export const hardwareJobAttemptStatusEnum = pgEnum(
  "hardware_job_attempt_status",
  [
    "claimed",
    "processing",
    "dispatching",
    "submitted",
    "acknowledged",
    "failed_before_dispatch",
    "unknown_after_dispatch",
    "lease_expired",
    "cancelled",
  ],
);

export const hardwareJobResolutionTypeEnum = pgEnum(
  "hardware_job_resolution_type",
  ["confirmed_completed", "retry_authorized", "cancelled"],
);

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

export const hardwareJobAttempts = pgTable(
  "hardware_job_attempts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    jobId: uuid("job_id")
      .notNull()
      .references((): AnyPgColumn => hardwareJobs.id, { onDelete: "cascade" }),
    agentId: uuid("agent_id")
      .notNull()
      .references(() => hardwareAgents.id),
    attemptNumber: integer("attempt_number").notNull(),
    status: hardwareJobAttemptStatusEnum("status")
      .default("claimed")
      .notNull(),
    leaseTokenHash: text("lease_token_hash").notNull(),
    leaseExpiresAt: timestamp("lease_expires_at", {
      withTimezone: true,
    }).notNull(),
    payloadHash: varchar("payload_hash", { length: 64 }).notNull(),
    eventSequence: integer("event_sequence").default(0).notNull(),
    dispatchStartedAt: timestamp("dispatch_started_at", {
      withTimezone: true,
    }),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    serverAcknowledgedAt: timestamp("server_acknowledged_at", {
      withTimezone: true,
    }),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    errorCode: varchar("error_code", { length: 80 }),
    errorMessage: text("error_message"),
    retrySafe: boolean("retry_safe"),
    result: jsonb("result")
      .$type<Record<string, unknown>>()
      .default({})
      .notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("hardware_job_attempts_job_number_uq").on(
      table.jobId,
      table.attemptNumber,
    ),
    uniqueIndex("hardware_job_attempts_one_active_uq")
      .on(table.jobId)
      .where(
        sql`${table.status} in ('claimed', 'processing', 'dispatching', 'submitted')`,
      ),
    index("hardware_job_attempts_agent_status_idx").on(
      table.agentId,
      table.status,
      table.createdAt,
    ),
    index("hardware_job_attempts_lease_idx").on(
      table.status,
      table.leaseExpiresAt,
    ),
    check(
      "hardware_job_attempts_number_ck",
      sql`${table.attemptNumber} > 0`,
    ),
    check(
      "hardware_job_attempts_event_sequence_ck",
      sql`${table.eventSequence} >= 0`,
    ),
    check(
      "hardware_job_attempts_payload_hash_ck",
      sql`${table.payloadHash} ~ '^[0-9a-f]{64}$'`,
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
    // Legacy v1 claim owner. Protocol v2 uses currentAttemptId + attempt.agentId.
    agentId: uuid("agent_id").references(() => hardwareAgents.id),
    targetAgentId: uuid("target_agent_id").references(() => hardwareAgents.id),
    currentAttemptId: uuid("current_attempt_id").references(
      () => hardwareJobAttempts.id,
      { onDelete: "set null" },
    ),
    createdByUserId: uuid("created_by_user_id").references(() => users.id),
    protocolVersion: integer("protocol_version").default(1).notNull(),
    jobType: hardwareJobTypeEnum("job_type").notNull(),
    deviceType: hardwareDeviceTypeEnum("device_type").notNull(),
    requiredCapability: varchar("required_capability", { length: 80 }),
    targetDevice: varchar("target_device", { length: 120 }),
    status: hardwareJobStatusEnum("status").default("pending").notNull(),
    priority: integer("priority").default(100).notNull(),
    attempts: integer("attempts").default(0).notNull(),
    maxAttempts: integer("max_attempts").default(3).notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    payloadHash: varchar("payload_hash", { length: 64 }),
    result: jsonb("result").$type<Record<string, unknown>>().default({}),
    error: text("error"),
    lastErrorCode: varchar("last_error_code", { length: 80 }),
    lastErrorMessage: text("last_error_message"),
    idempotencyKey: varchar("idempotency_key", { length: 160 }),
    sourceType: varchar("source_type", { length: 80 }),
    sourceId: varchar("source_id", { length: 160 }),
    availableAt: timestamp("available_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    claimedAt: timestamp("claimed_at", { withTimezone: true }),
    startedAt: timestamp("started_at", { withTimezone: true }),
    processingAt: timestamp("processing_at", { withTimezone: true }),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    failedAt: timestamp("failed_at", { withTimezone: true }),
    unknownAt: timestamp("unknown_at", { withTimezone: true }),
    expiredAt: timestamp("expired_at", { withTimezone: true }),
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
    index("hardware_jobs_v2_claim_idx").on(
      table.organizationId,
      table.outletId,
      table.registerId,
      table.protocolVersion,
      table.status,
      table.requiredCapability,
      table.availableAt,
      table.priority,
    ),
    index("hardware_jobs_agent_status_idx").on(table.agentId, table.status),
    index("hardware_jobs_target_agent_idx").on(
      table.targetAgentId,
      table.status,
      table.availableAt,
    ),
    index("hardware_jobs_expiry_idx")
      .on(table.status, table.expiresAt)
      .where(sql`${table.expiresAt} is not null`),
    index("hardware_jobs_source_idx").on(table.sourceType, table.sourceId),
    uniqueIndex("hardware_jobs_current_attempt_uq")
      .on(table.currentAttemptId)
      .where(sql`${table.currentAttemptId} is not null`),
    uniqueIndex("hardware_jobs_idempotency_uq")
      .on(table.organizationId, table.idempotencyKey)
      .where(sql`${table.idempotencyKey} is not null`),
    check(
      "hardware_jobs_protocol_version_ck",
      sql`${table.protocolVersion} in (1, 2)`,
    ),
    check(
      "hardware_jobs_attempts_ck",
      sql`${table.protocolVersion} <> 2 or (${table.attempts} >= 0 and ${table.maxAttempts} > 0 and ${table.attempts} <= ${table.maxAttempts})`,
    ),
    check(
      "hardware_jobs_required_capability_ck",
      sql`${table.requiredCapability} is null or ${table.requiredCapability} in ('print_label_sato', 'print_document_pdf', 'open_cash_drawer')`,
    ),
    check(
      "hardware_jobs_payload_hash_ck",
      sql`${table.payloadHash} is null or ${table.payloadHash} ~ '^[0-9a-f]{64}$'`,
    ),
    check(
      "hardware_jobs_v2_required_fields_ck",
      sql`${table.protocolVersion} <> 2 or (${table.requiredCapability} is not null and ${table.payloadHash} is not null and ${table.expiresAt} is not null and ${table.idempotencyKey} is not null)`,
    ),
    check(
      "hardware_jobs_v2_status_ck",
      sql`${table.protocolVersion} <> 2 or ${table.status} <> 'printing'`,
    ),
    check(
      "hardware_jobs_expiry_after_creation_ck",
      sql`${table.expiresAt} is null or ${table.expiresAt} > ${table.createdAt}`,
    ),
  ],
);


export const hardwareJobResolutions = pgTable(
  "hardware_job_resolutions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    outletId: uuid("outlet_id")
      .notNull()
      .references(() => outlets.id),
    jobId: uuid("job_id")
      .notNull()
      .references(() => hardwareJobs.id, { onDelete: "cascade" }),
    attemptId: uuid("attempt_id").references(() => hardwareJobAttempts.id, {
      onDelete: "set null",
    }),
    resolvedByUserId: uuid("resolved_by_user_id")
      .notNull()
      .references(() => users.id),
    resolutionType: hardwareJobResolutionTypeEnum("resolution_type").notNull(),
    reason: text("reason").notNull(),
    duplicateRiskAcknowledged: boolean("duplicate_risk_acknowledged")
      .default(false)
      .notNull(),
    previousStatus: hardwareJobStatusEnum("previous_status").notNull(),
    nextStatus: hardwareJobStatusEnum("next_status").notNull(),
    metadata: jsonb("metadata")
      .$type<Record<string, unknown>>()
      .default({})
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("hardware_job_resolutions_job_time_idx").on(
      table.jobId,
      table.createdAt,
    ),
    index("hardware_job_resolutions_org_time_idx").on(
      table.organizationId,
      table.createdAt,
    ),
    check(
      "hardware_job_resolutions_reason_ck",
      sql`char_length(trim(${table.reason})) between 12 and 500`,
    ),
    check(
      "hardware_job_resolutions_retry_ack_ck",
      sql`${table.resolutionType} <> 'retry_authorized' or ${table.duplicateRiskAcknowledged} = true`,
    ),
    check(
      "hardware_job_resolutions_status_ck",
      sql`${table.previousStatus} = 'unknown_outcome' and ${table.nextStatus} in ('completed', 'pending', 'cancelled')`,
    ),
  ],
);

export const notificationCategoryEnum = pgEnum("notification_category", [
  "sales",
  "payment",
  "cash_shift",
  "inventory_return",
  "hardware",
  "security",
  "system",
  "approval_result",
]);

export const notificationRecipientStatusEnum = pgEnum(
  "notification_recipient_status",
  ["unread", "read", "acknowledged", "resolved", "archived"],
);

export const notificationTypeEnum = pgEnum("notification_type", [
  "sales",
  "hardware",
  "shift",
  "cash",
  "inventory",
  "system",
]);

export const notificationSeverityEnum = pgEnum("notification_severity", [
  "info",
  "success",
  "warning",
  "critical",
]);

export const notificationEvents = pgTable(
  "notification_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    outletId: uuid("outlet_id").references(() => outlets.id),
    category: notificationCategoryEnum("category").notNull(),
    eventType: varchar("event_type", { length: 120 }).notNull(),
    severity: notificationSeverityEnum("severity").default("info").notNull(),
    title: varchar("title", { length: 160 }).notNull(),
    summary: text("summary").notNull(),
    entityType: varchar("entity_type", { length: 80 }),
    entityId: varchar("entity_id", { length: 160 }),
    actionUrl: varchar("action_url", { length: 300 }),
    requiresAction: boolean("requires_action").default(false).notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().default({}).notNull(),
    deduplicationKey: varchar("deduplication_key", { length: 220 }),
    occurredAt: timestamp("occurred_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("notification_events_active_dedupe_uq")
      .on(table.organizationId, table.deduplicationKey)
      .where(
        sql`${table.deduplicationKey} is not null and ${table.resolvedAt} is null`,
      ),
    index("notification_events_org_occurred_idx").on(
      table.organizationId,
      table.occurredAt,
    ),
    index("notification_events_org_category_idx").on(
      table.organizationId,
      table.category,
      table.occurredAt,
    ),
    index("notification_events_outlet_idx").on(
      table.outletId,
      table.occurredAt,
    ),
    index("notification_events_entity_idx").on(
      table.entityType,
      table.entityId,
    ),
    index("notification_events_active_action_idx")
      .on(table.organizationId, table.requiresAction, table.severity)
      .where(sql`${table.resolvedAt} is null`),
    check(
      "notification_events_title_summary_ck",
      sql`length(btrim(${table.title})) > 0 and length(btrim(${table.summary})) > 0`,
    ),
    check(
      "notification_events_action_url_ck",
      sql`${table.actionUrl} is null or left(${table.actionUrl}, 1) = '/'`,
    ),
    check(
      "notification_events_resolved_time_ck",
      sql`${table.resolvedAt} is null or ${table.resolvedAt} >= ${table.occurredAt}`,
    ),
  ],
);

export const notificationRecipients = pgTable(
  "notification_recipients",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => notificationEvents.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: notificationRecipientStatusEnum("status")
      .default("unread")
      .notNull(),
    readAt: timestamp("read_at", { withTimezone: true }),
    acknowledgedAt: timestamp("acknowledged_at", { withTimezone: true }),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("notification_recipients_event_user_uq").on(
      table.eventId,
      table.userId,
    ),
    index("notification_recipients_user_status_idx").on(
      table.userId,
      table.status,
      table.createdAt,
    ),
    index("notification_recipients_event_status_idx").on(
      table.eventId,
      table.status,
    ),
    check(
      "notification_recipients_read_time_ck",
      sql`${table.status} <> 'read' or ${table.readAt} is not null`,
    ),
    check(
      "notification_recipients_ack_time_ck",
      sql`${table.status} <> 'acknowledged' or ${table.acknowledgedAt} is not null`,
    ),
    check(
      "notification_recipients_resolved_time_ck",
      sql`${table.status} <> 'resolved' or ${table.resolvedAt} is not null`,
    ),
    check(
      "notification_recipients_archived_time_ck",
      sql`${table.status} <> 'archived' or ${table.archivedAt} is not null`,
    ),
  ],
);

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    outletId: uuid("outlet_id").references(() => outlets.id),
    userId: uuid("user_id").references(() => users.id),
    type: notificationTypeEnum("type").notNull(),
    severity: notificationSeverityEnum("severity").default("info").notNull(),
    title: varchar("title", { length: 160 }).notNull(),
    message: text("message").notNull(),
    entityType: varchar("entity_type", { length: 80 }),
    entityId: varchar("entity_id", { length: 160 }),
    actionUrl: varchar("action_url", { length: 300 }),
    isRead: boolean("is_read").default(false).notNull(),
    readAt: timestamp("read_at", { withTimezone: true }),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
    ...timestamps,
  },
  (table) => [
    index("notifications_org_unread_idx").on(
      table.organizationId,
      table.isRead,
      table.createdAt,
    ),
    index("notifications_org_type_idx").on(table.organizationId, table.type),
    index("notifications_outlet_idx").on(table.outletId, table.createdAt),
    index("notifications_user_idx").on(table.userId, table.isRead),
    index("notifications_entity_idx").on(table.entityType, table.entityId),
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
  "manual_payment_verification",
  "customer_deposit_withdrawal",
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
    executionStatus: approvalExecutionStatusEnum("execution_status")
      .default("not_started")
      .notNull(),
    executionIdempotencyKey: varchar("execution_idempotency_key", {
      length: 160,
    }),
    executionStartedAt: timestamp("execution_started_at", {
      withTimezone: true,
    }),
    executedAt: timestamp("executed_at", { withTimezone: true }),
    executedBy: uuid("executed_by").references(() => users.id),
    executionError: text("execution_error"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("approvals_execution_idempotency_uq")
      .on(table.organizationId, table.executionIdempotencyKey)
      .where(sql`${table.executionIdempotencyKey} is not null`),
    uniqueIndex("approvals_manual_payment_fingerprint_uq")
      .on(
        table.organizationId,
        table.outletId,
        table.requestedBy,
        sql`(${table.requestData}->>'verificationFingerprint')`,
      )
      .where(sql`${table.type} = 'manual_payment_verification'`),
    index("approvals_org_status_idx").on(table.organizationId, table.status),
    index("approvals_ref_idx").on(table.referenceType, table.referenceId),
    index("approvals_execution_status_idx").on(
      table.organizationId,
      table.executionStatus,
    ),
    check(
      "approvals_executing_state_ck",
      sql`${table.executionStatus} <> 'executing' or ${table.executionStartedAt} is not null`,
    ),
    check(
      "approvals_completed_state_ck",
      sql`${table.executionStatus} <> 'completed' or (
        ${table.executedAt} is not null and ${table.executedBy} is not null
      )`,
    ),
  ],
);

export const customerDepositLedger = pgTable(
  "customer_deposit_ledger",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    outletId: uuid("outlet_id")
      .notNull()
      .references(() => outlets.id),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id),
    saleId: uuid("sale_id").references(() => sales.id, {
      onDelete: "set null",
    }),
    paymentId: uuid("payment_id").references(() => payments.id, {
      onDelete: "set null",
    }),
    cashMovementId: uuid("cash_movement_id").references(() => cashMovements.id, {
      onDelete: "set null",
    }),
    approvalId: uuid("approval_id").references(() => approvals.id, {
      onDelete: "set null",
    }),
    entryType: customerDepositLedgerEntryTypeEnum("entry_type").notNull(),
    direction: customerDepositLedgerDirectionEnum("direction").notNull(),
    amount: numeric("amount", { precision: 18, scale: 0 }).notNull(),
    balanceAfter: numeric("balance_after", { precision: 18, scale: 0 })
      .default("0")
      .notNull(),
    idempotencyKey: varchar("idempotency_key", { length: 160 }),
    referenceType: varchar("reference_type", { length: 80 }),
    referenceId: uuid("reference_id"),
    description: text("description"),
    metadata: jsonb("metadata")
      .$type<Record<string, unknown>>()
      .default({})
      .notNull(),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id),
    occurredAt: timestamp("occurred_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("customer_deposit_ledger_scope_time_idx").on(
      table.organizationId,
      table.outletId,
      table.customerId,
      table.occurredAt,
    ),
    index("customer_deposit_ledger_sale_idx").on(table.saleId),
    index("customer_deposit_ledger_reference_idx").on(
      table.referenceType,
      table.referenceId,
    ),
    uniqueIndex("customer_deposit_ledger_idempotency_uq")
      .on(table.organizationId, table.idempotencyKey)
      .where(sql`${table.idempotencyKey} is not null`),
    check("customer_deposit_ledger_amount_positive_ck", sql`${table.amount} > 0`),
    check(
      "customer_deposit_ledger_balance_nonnegative_ck",
      sql`${table.balanceAfter} >= 0`,
    ),
    check(
      "customer_deposit_ledger_direction_ck",
      sql`(
        (${table.entryType} = 'deposit_in' and ${table.direction} = 'credit')
        or (${table.entryType} in ('deposit_used', 'deposit_withdrawal') and ${table.direction} = 'debit')
        or (${table.entryType} = 'adjustment' and ${table.direction} in ('credit', 'debit'))
      )`,
    ),
    check(
      "customer_deposit_ledger_reference_pair_ck",
      sql`(${table.referenceType} is null and ${table.referenceId} is null)
        or (${table.referenceType} is not null and ${table.referenceId} is not null)`,
    ),
  ],
);

export const paymentRefunds = pgTable(
  "payment_refunds",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    outletId: uuid("outlet_id")
      .notNull()
      .references(() => outlets.id),
    saleId: uuid("sale_id")
      .notNull()
      .references(() => sales.id),
    paymentId: uuid("payment_id")
      .notNull()
      .references(() => payments.id),
    approvalId: uuid("approval_id").references(() => approvals.id),
    originalShiftId: uuid("original_shift_id")
      .notNull()
      .references(() => shifts.id),
    refundShiftId: uuid("refund_shift_id").references(() => shifts.id),
    amount: numeric("amount", { precision: 18, scale: 0 }).notNull(),
    method: paymentMethodEnum("method").notNull(),
    provider: varchar("provider", { length: 80 }).default("manual").notNull(),
    providerReference: varchar("provider_reference", { length: 160 }),
    destinationMasked: varchar("destination_masked", { length: 160 }),
    evidenceKey: text("evidence_key"),
    reason: text("reason").notNull(),
    status: paymentRefundStatusEnum("status").default("requested").notNull(),
    idempotencyKey: varchar("idempotency_key", { length: 160 }).notNull(),
    requestedBy: uuid("requested_by")
      .notNull()
      .references(() => users.id),
    approvedBy: uuid("approved_by").references(() => users.id),
    executedBy: uuid("executed_by").references(() => users.id),
    confirmedBy: uuid("confirmed_by").references(() => users.id),
    requestedAt: timestamp("requested_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    executedAt: timestamp("executed_at", { withTimezone: true }),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
    failureCode: varchar("failure_code", { length: 120 }),
    failureMessage: text("failure_message"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("payment_refunds_org_idempotency_uq").on(
      table.organizationId,
      table.idempotencyKey,
    ),
    uniqueIndex("payment_refunds_approval_payment_uq")
      .on(table.approvalId, table.paymentId)
      .where(sql`${table.approvalId} is not null`),
    index("payment_refunds_sale_status_idx").on(table.saleId, table.status),
    index("payment_refunds_payment_status_idx").on(
      table.paymentId,
      table.status,
    ),
    index("payment_refunds_refund_shift_idx").on(table.refundShiftId),
    index("payment_refunds_provider_reference_idx").on(
      table.provider,
      table.providerReference,
    ),
    check("payment_refunds_amount_positive_ck", sql`${table.amount} > 0`),
    check(
      "payment_refunds_confirmed_state_ck",
      sql`${table.status} <> 'confirmed' or ${table.confirmedAt} is not null`,
    ),
    check(
      "payment_refunds_cash_shift_ck",
      sql`not (${table.method} = 'cash' and ${table.status} = 'confirmed')
        or ${table.refundShiftId} is not null`,
    ),
  ],
);

export const saleReturnCases = pgTable(
  "sale_return_cases",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    outletId: uuid("outlet_id")
      .notNull()
      .references(() => outlets.id),
    saleId: uuid("sale_id")
      .notNull()
      .references(() => sales.id),
    approvalId: uuid("approval_id").references(() => approvals.id),
    status: saleReturnCaseStatusEnum("status")
      .default("awaiting_receipt")
      .notNull(),
    expectedItemCount: integer("expected_item_count").notNull(),
    receivedItemCount: integer("received_item_count").default(0).notNull(),
    inspectedItemCount: integer("inspected_item_count").default(0).notNull(),
    notes: text("notes"),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("sale_return_cases_sale_uq").on(table.saleId),
    uniqueIndex("sale_return_cases_approval_uq")
      .on(table.approvalId)
      .where(sql`${table.approvalId} is not null`),
    index("sale_return_cases_outlet_status_idx").on(
      table.outletId,
      table.status,
    ),
    check(
      "sale_return_cases_counts_ck",
      sql`${table.expectedItemCount} > 0
        and ${table.receivedItemCount} >= 0
        and ${table.inspectedItemCount} >= 0
        and ${table.receivedItemCount} <= ${table.expectedItemCount}
        and ${table.inspectedItemCount} <= ${table.receivedItemCount}`,
    ),
    check(
      "sale_return_cases_completed_state_ck",
      sql`${table.status} not in ('completed', 'rejected') or ${table.completedAt} is not null`,
    ),
    check(
      "sale_return_cases_cancelled_state_ck",
      sql`${table.status} <> 'cancelled' or ${table.cancelledAt} is not null`,
    ),
  ],
);

export const saleReturnItems = pgTable(
  "sale_return_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    outletId: uuid("outlet_id")
      .notNull()
      .references(() => outlets.id),
    returnCaseId: uuid("return_case_id")
      .notNull()
      .references(() => saleReturnCases.id),
    saleItemId: uuid("sale_item_id")
      .notNull()
      .references(() => saleItems.id),
    productItemId: uuid("product_item_id")
      .notNull()
      .references(() => productItems.id),
    status: saleReturnItemStatusEnum("status")
      .default("awaiting_receipt")
      .notNull(),
    expectedSku: varchar("expected_sku", { length: 80 }).notNull(),
    expectedBarcode: varchar("expected_barcode", { length: 120 }).notNull(),
    expectedSerialNumber: varchar("expected_serial_number", { length: 120 }),
    expectedWeightGram: numeric("expected_weight_gram", {
      precision: 12,
      scale: 3,
    }),
    receivedCode: varchar("received_code", { length: 160 }),
    actualWeightGram: numeric("actual_weight_gram", {
      precision: 12,
      scale: 3,
    }),
    identityConfirmed: boolean("identity_confirmed"),
    certificateComplete: boolean("certificate_complete"),
    packagingComplete: boolean("packaging_complete"),
    conditionGood: boolean("condition_good"),
    decision: returnInspectionDecisionEnum("decision"),
    inspectionNotes: text("inspection_notes"),
    photoKey: text("photo_key"),
    receivedBy: uuid("received_by").references(() => users.id),
    receivedAt: timestamp("received_at", { withTimezone: true }),
    inspectedBy: uuid("inspected_by").references(() => users.id),
    inspectedAt: timestamp("inspected_at", { withTimezone: true }),
    decidedBy: uuid("decided_by").references(() => users.id),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("sale_return_items_case_sale_item_uq").on(
      table.returnCaseId,
      table.saleItemId,
    ),
    uniqueIndex("sale_return_items_case_product_item_uq").on(
      table.returnCaseId,
      table.productItemId,
    ),
    index("sale_return_items_case_status_idx").on(
      table.returnCaseId,
      table.status,
    ),
    index("sale_return_items_product_status_idx").on(
      table.productItemId,
      table.status,
    ),
    check(
      "sale_return_items_weight_positive_ck",
      sql`${table.actualWeightGram} is null or ${table.actualWeightGram} > 0`,
    ),
    check(
      "sale_return_items_received_state_ck",
      sql`${table.status} = 'awaiting_receipt' or (${table.receivedBy} is not null and ${table.receivedAt} is not null)`,
    ),
    check(
      "sale_return_items_inspected_state_ck",
      sql`${table.status} in ('awaiting_receipt', 'pending_inspection') or (
        ${table.inspectedBy} is not null
        and ${table.inspectedAt} is not null
        and ${table.decidedBy} is not null
        and ${table.decidedAt} is not null
        and ${table.decision} is not null
      )`,
    ),
  ],
);

