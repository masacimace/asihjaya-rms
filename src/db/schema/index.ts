import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  date,
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

export const productMasterNumberSequence = pgSequence(
  "product_master_number_seq",
  {
    startWith: 1,
    increment: 1,
    minValue: 1,
    cache: 1,
  },
);

export const productItemNumberSequence = pgSequence("product_item_number_seq", {
  startWith: 1,
  increment: 1,
  minValue: 1,
  cache: 1,
});

export const productBatchImportStatusEnum = pgEnum(
  "product_batch_import_status",
  [
    "uploaded",
    "validating",
    "invalid",
    "ready",
    "committing",
    "completed",
    "failed",
    "cancelled",
    "expired",
  ],
);

export const productBatchImportRowValidationStatusEnum = pgEnum(
  "product_batch_import_row_validation_status",
  ["pending", "valid", "warning", "invalid"],
);

export const productBatchImportMediaEntityKindEnum = pgEnum(
  "product_batch_import_media_entity_kind",
  ["master", "item"],
);

export const productBatchImportMediaStatusEnum = pgEnum(
  "product_batch_import_media_status",
  ["staged", "validated", "promoted", "failed", "deleted"],
);

export const legacyProductImportStatusEnum = pgEnum(
  "legacy_product_import_status",
  ["processing", "ready", "failed", "archived"],
);

export const legacyProductRowValidationStatusEnum = pgEnum(
  "legacy_product_row_validation_status",
  ["valid", "warning", "invalid"],
);

export const itemBarcodeSourceEnum = pgEnum("item_barcode_source", [
  "legacy_import",
  "legacy_physical_label",
  "system_generated",
  "replacement",
  "manual",
]);

export const legacyMasterMappingStatusEnum = pgEnum(
  "legacy_master_mapping_status",
  ["pending", "mapped", "ignored"],
);

export const legacyMasterMappingSourceEnum = pgEnum(
  "legacy_master_mapping_source",
  ["existing", "created"],
);

export const itemAvailabilityEnum = pgEnum("item_availability", [
  "draft",
  "migration_hold",
  "processing",
  "available",
  "reserved",
  "inspection",
  "sold",
]);

export const itemConditionEnum = pgEnum("item_condition", [
  "good",
  "used",
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
  "migration_opening",
  "buyback",
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

export const buybackStatusEnum = pgEnum("buyback_status", [
  "completed",
  "cancelled",
]);

export const buybackItemSourceEnum = pgEnum("buyback_item_source", [
  "asihjaya",
  "external",
]);

export const buybackProcessingTypeEnum = pgEnum("buyback_processing_type", [
  "cleaning",
  "recondition",
]);

export const buybackProcessingStatusEnum = pgEnum("buyback_processing_status", [
  "pending",
  "completed",
]);

export const buybackPayoutMethodEnum = pgEnum("buyback_payout_method", [
  "cash",
  "bank_transfer",
  "customer_deposit",
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

export const posCheckoutAttemptStatusEnum = pgEnum(
  "pos_checkout_attempt_status",
  ["processing", "completed", "failed"],
);

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

export const telegramDestinationTypeEnum = pgEnum("telegram_destination_type", [
  "private_group",
]);

export const telegramReportTypeEnum = pgEnum("telegram_report_type", [
  "opening",
  "closing_daily",
  "weekly",
  "monthly",
  "shift_reopened",
  "test",
]);

export const telegramDeliveryStatusEnum = pgEnum("telegram_delivery_status", [
  "pending",
  "processing",
  "retry",
  "sent",
  "failed",
  "cancelled",
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
    uniqueIndex("metal_purities_metal_code_uq").on(table.metalId, table.code),
    index("metal_purities_metal_active_idx").on(table.metalId, table.isActive),
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
      "product_items_barcode_not_blank_ck",
      sql`length(btrim(${table.barcode})) > 0 and ${table.barcode} = btrim(${table.barcode})`,
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

export const productBatchImportSessions = pgTable(
  "product_batch_import_sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    createdByUserId: uuid("created_by_user_id")
      .notNull()
      .references(() => users.id),
    fileName: varchar("file_name", { length: 255 }).notNull(),
    fileSha256: varchar("file_sha256", { length: 64 }).notNull(),
    fileSizeBytes: integer("file_size_bytes").notNull(),
    templateVersion: integer("template_version").notNull(),
    status: productBatchImportStatusEnum("status")
      .default("uploaded")
      .notNull(),
    storageKey: text("storage_key").notNull(),
    totalMasterRows: integer("total_master_rows").default(0).notNull(),
    totalItemRows: integer("total_item_rows").default(0).notNull(),
    validMasterRows: integer("valid_master_rows").default(0).notNull(),
    validItemRows: integer("valid_item_rows").default(0).notNull(),
    invalidRows: integer("invalid_rows").default(0).notNull(),
    warningCount: integer("warning_count").default(0).notNull(),
    committedMasterCount: integer("committed_master_count")
      .default(0)
      .notNull(),
    committedItemCount: integer("committed_item_count").default(0).notNull(),
    failureCode: varchar("failure_code", { length: 120 }),
    failureMessage: text("failure_message"),
    validatedAt: timestamp("validated_at", { withTimezone: true }),
    committedAt: timestamp("committed_at", { withTimezone: true }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("product_batch_import_sessions_org_hash_active_uq")
      .on(table.organizationId, table.fileSha256)
      .where(
        sql`${table.status} in ('uploaded', 'validating', 'ready', 'committing', 'completed')`,
      ),
    index("product_batch_import_sessions_org_status_created_idx").on(
      table.organizationId,
      table.status,
      table.createdAt,
    ),
    index("product_batch_import_sessions_expires_idx").on(
      table.expiresAt,
      table.status,
    ),
    check(
      "product_batch_import_sessions_file_sha256_ck",
      sql`${table.fileSha256} ~ '^[0-9a-f]{64}$'`,
    ),
    check(
      "product_batch_import_sessions_file_size_ck",
      sql`${table.fileSizeBytes} between 1 and 104857600`,
    ),
    check(
      "product_batch_import_sessions_template_version_ck",
      sql`${table.templateVersion} > 0`,
    ),
    check(
      "product_batch_import_sessions_counts_nonnegative_ck",
      sql`${table.totalMasterRows} >= 0
        and ${table.totalItemRows} >= 0
        and ${table.validMasterRows} >= 0
        and ${table.validItemRows} >= 0
        and ${table.invalidRows} >= 0
        and ${table.warningCount} >= 0
        and ${table.committedMasterCount} >= 0
        and ${table.committedItemCount} >= 0`,
    ),
    check(
      "product_batch_import_sessions_counts_bounds_ck",
      sql`${table.validMasterRows} <= ${table.totalMasterRows}
        and ${table.validItemRows} <= ${table.totalItemRows}
        and ${table.invalidRows} <= (${table.totalMasterRows} + ${table.totalItemRows})
        and ${table.committedMasterCount} <= ${table.totalMasterRows}
        and ${table.committedItemCount} <= ${table.totalItemRows}`,
    ),
  ],
);

export const productBatchImportMasterRows = pgTable(
  "product_batch_import_master_rows",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => productBatchImportSessions.id, { onDelete: "cascade" }),
    rowNumber: integer("row_number").notNull(),
    masterKey: varchar("master_key", { length: 120 }).notNull(),
    rawPayload: jsonb("raw_payload")
      .$type<Record<string, unknown>>()
      .default({})
      .notNull(),
    normalizedPayload: jsonb("normalized_payload")
      .$type<Record<string, unknown>>()
      .default({})
      .notNull(),
    validationStatus: productBatchImportRowValidationStatusEnum(
      "validation_status",
    )
      .default("pending")
      .notNull(),
    validationErrors: jsonb("validation_errors")
      .$type<Array<Record<string, unknown>>>()
      .default([])
      .notNull(),
    validationWarnings: jsonb("validation_warnings")
      .$type<Array<Record<string, unknown>>>()
      .default([])
      .notNull(),
    resolvedCategoryId: uuid("resolved_category_id").references(
      () => productCategories.id,
    ),
    plannedProductMasterId: uuid("planned_product_master_id"),
    committedProductMasterId: uuid("committed_product_master_id").references(
      () => productMasters.id,
    ),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("product_batch_import_master_rows_session_key_uq").on(
      table.sessionId,
      table.masterKey,
    ),
    uniqueIndex("product_batch_import_master_rows_session_row_uq").on(
      table.sessionId,
      table.rowNumber,
    ),
    index("product_batch_import_master_rows_session_validation_idx").on(
      table.sessionId,
      table.validationStatus,
      table.rowNumber,
    ),
    check(
      "product_batch_import_master_rows_row_number_ck",
      sql`${table.rowNumber} >= 2`,
    ),
  ],
);

export const productBatchImportItemRows = pgTable(
  "product_batch_import_item_rows",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => productBatchImportSessions.id, { onDelete: "cascade" }),
    rowNumber: integer("row_number").notNull(),
    rowKey: varchar("row_key", { length: 120 }).notNull(),
    masterKey: varchar("master_key", { length: 120 }).notNull(),
    rawPayload: jsonb("raw_payload")
      .$type<Record<string, unknown>>()
      .default({})
      .notNull(),
    normalizedPayload: jsonb("normalized_payload")
      .$type<Record<string, unknown>>()
      .default({})
      .notNull(),
    validationStatus: productBatchImportRowValidationStatusEnum(
      "validation_status",
    )
      .default("pending")
      .notNull(),
    validationErrors: jsonb("validation_errors")
      .$type<Array<Record<string, unknown>>>()
      .default([])
      .notNull(),
    validationWarnings: jsonb("validation_warnings")
      .$type<Array<Record<string, unknown>>>()
      .default([])
      .notNull(),
    resolvedOutletId: uuid("resolved_outlet_id").references(() => outlets.id),
    plannedProductItemId: uuid("planned_product_item_id"),
    committedProductItemId: uuid("committed_product_item_id").references(
      () => productItems.id,
    ),
    generatedSku: varchar("generated_sku", { length: 80 }),
    generatedBarcode: varchar("generated_barcode", { length: 120 }),
    generatedQrValue: varchar("generated_qr_value", { length: 220 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("product_batch_import_item_rows_session_key_uq").on(
      table.sessionId,
      table.rowKey,
    ),
    uniqueIndex("product_batch_import_item_rows_session_row_uq").on(
      table.sessionId,
      table.rowNumber,
    ),
    index("product_batch_import_item_rows_session_master_idx").on(
      table.sessionId,
      table.masterKey,
      table.rowNumber,
    ),
    index("product_batch_import_item_rows_session_validation_idx").on(
      table.sessionId,
      table.validationStatus,
      table.rowNumber,
    ),
    check(
      "product_batch_import_item_rows_row_number_ck",
      sql`${table.rowNumber} >= 2`,
    ),
  ],
);

export const productBatchImportMedia = pgTable(
  "product_batch_import_media",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => productBatchImportSessions.id, { onDelete: "cascade" }),
    archivePath: text("archive_path").notNull(),
    entityKind: productBatchImportMediaEntityKindEnum("entity_kind").notNull(),
    masterKey: varchar("master_key", { length: 120 }),
    rowKey: varchar("row_key", { length: 120 }),
    sha256: varchar("sha256", { length: 64 }).notNull(),
    contentType: varchar("content_type", { length: 100 }).notNull(),
    byteSize: integer("byte_size").notNull(),
    width: integer("width"),
    height: integer("height"),
    stagingKey: text("staging_key").notNull(),
    finalKey: text("final_key"),
    status: productBatchImportMediaStatusEnum("status")
      .default("staged")
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("product_batch_import_media_session_archive_path_uq").on(
      table.sessionId,
      table.archivePath,
    ),
    index("product_batch_import_media_session_target_idx").on(
      table.sessionId,
      table.entityKind,
      table.status,
    ),
    check(
      "product_batch_import_media_sha256_ck",
      sql`${table.sha256} ~ '^[0-9a-f]{64}$'`,
    ),
    check(
      "product_batch_import_media_byte_size_ck",
      sql`${table.byteSize} between 1 and 5242880`,
    ),
    check(
      "product_batch_import_media_dimensions_ck",
      sql`(${table.width} is null or ${table.width} > 0)
        and (${table.height} is null or ${table.height} > 0)`,
    ),
    check(
      "product_batch_import_media_target_ck",
      sql`(
        ${table.entityKind} = 'master'
        and ${table.masterKey} is not null
        and ${table.rowKey} is null
      ) or (
        ${table.entityKind} = 'item'
        and ${table.masterKey} is null
        and ${table.rowKey} is not null
      )`,
    ),
  ],
);

export const legacyProductImportBatches = pgTable(
  "legacy_product_import_batches",
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
    fileName: varchar("file_name", { length: 255 }).notNull(),
    fileHash: varchar("file_hash", { length: 64 }).notNull(),
    fileSizeBytes: integer("file_size_bytes").notNull(),
    worksheetName: varchar("worksheet_name", { length: 160 }).notNull(),
    barcodeLength: integer("barcode_length").default(6).notNull(),
    status: legacyProductImportStatusEnum("status")
      .default("processing")
      .notNull(),
    totalRows: integer("total_rows").default(0).notNull(),
    validRows: integer("valid_rows").default(0).notNull(),
    warningRows: integer("warning_rows").default(0).notNull(),
    invalidRows: integer("invalid_rows").default(0).notNull(),
    uniqueMasterCount: integer("unique_master_count").default(0).notNull(),
    duplicateBarcodeCount: integer("duplicate_barcode_count")
      .default(0)
      .notNull(),
    leadingZeroBarcodeCount: integer("leading_zero_barcode_count")
      .default(0)
      .notNull(),
    imageUrlCount: integer("image_url_count").default(0).notNull(),
    headers: jsonb("headers").$type<string[]>().default([]).notNull(),
    validationSummary: jsonb("validation_summary")
      .$type<Record<string, unknown>>()
      .default({})
      .notNull(),
    errorMessage: text("error_message"),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("legacy_product_import_batches_org_outlet_hash_uq").on(
      table.organizationId,
      table.outletId,
      table.fileHash,
    ),
    index("legacy_product_import_batches_org_status_idx").on(
      table.organizationId,
      table.status,
      table.createdAt,
    ),
    index("legacy_product_import_batches_outlet_time_idx").on(
      table.outletId,
      table.createdAt,
    ),
    check(
      "legacy_product_import_batches_file_size_ck",
      sql`${table.fileSizeBytes} between 1 and 10485760`,
    ),
    check(
      "legacy_product_import_batches_barcode_length_ck",
      sql`${table.barcodeLength} between 1 and 120`,
    ),
    check(
      "legacy_product_import_batches_counts_ck",
      sql`${table.totalRows} >= 0
        and ${table.validRows} >= 0
        and ${table.warningRows} >= 0
        and ${table.invalidRows} >= 0
        and ${table.uniqueMasterCount} >= 0
        and ${table.duplicateBarcodeCount} >= 0
        and ${table.leadingZeroBarcodeCount} >= 0
        and ${table.imageUrlCount} >= 0
        and ${table.validRows} + ${table.warningRows} + ${table.invalidRows} = ${table.totalRows}`,
    ),
  ],
);

export const legacyProductRows = pgTable(
  "legacy_product_rows",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    batchId: uuid("batch_id")
      .notNull()
      .references(() => legacyProductImportBatches.id, { onDelete: "cascade" }),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    outletId: uuid("outlet_id")
      .notNull()
      .references(() => outlets.id),
    rowNumber: integer("row_number").notNull(),
    sourceSequence: integer("source_sequence"),
    legacyBarcode: varchar("legacy_barcode", { length: 120 }),
    normalizedBarcode: varchar("normalized_barcode", { length: 120 }),
    legacyCategory: varchar("legacy_category", { length: 160 }),
    legacyMasterCode: varchar("legacy_master_code", { length: 120 }),
    legacyMasterName: varchar("legacy_master_name", { length: 220 }),
    legacyItemName: varchar("legacy_item_name", { length: 240 }),
    legacyPurity: numeric("legacy_purity", { precision: 10, scale: 3 }),
    legacyExchangePurity: numeric("legacy_exchange_purity", {
      precision: 10,
      scale: 3,
    }),
    legacyPricePerGram: numeric("legacy_price_per_gram", {
      precision: 18,
      scale: 0,
    }),
    legacyDeductionPerGram: numeric("legacy_deduction_per_gram", {
      precision: 18,
      scale: 0,
    }),
    legacyWeightGram: numeric("legacy_weight_gram", {
      precision: 12,
      scale: 3,
    }),
    legacyColor: varchar("legacy_color", { length: 120 }),
    legacyImageUrl: text("legacy_image_url"),
    validationStatus: legacyProductRowValidationStatusEnum("validation_status")
      .default("valid")
      .notNull(),
    validationIssues: jsonb("validation_issues")
      .$type<Array<Record<string, unknown>>>()
      .default([])
      .notNull(),
    rowFingerprint: varchar("row_fingerprint", { length: 64 }).notNull(),
    rawData: jsonb("raw_data")
      .$type<Record<string, unknown>>()
      .default({})
      .notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("legacy_product_rows_batch_row_uq").on(
      table.batchId,
      table.rowNumber,
    ),
    index("legacy_product_rows_batch_status_idx").on(
      table.batchId,
      table.validationStatus,
      table.rowNumber,
    ),
    index("legacy_product_rows_batch_barcode_idx").on(
      table.batchId,
      table.normalizedBarcode,
    ),
    index("legacy_product_rows_org_outlet_barcode_idx").on(
      table.organizationId,
      table.outletId,
      table.normalizedBarcode,
    ),
    index("legacy_product_rows_batch_master_idx").on(
      table.batchId,
      table.legacyMasterCode,
    ),
    check("legacy_product_rows_row_number_ck", sql`${table.rowNumber} > 1`),
  ],
);

export const legacyProductMasterMappings = pgTable(
  "legacy_product_master_mappings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    batchId: uuid("batch_id")
      .notNull()
      .references(() => legacyProductImportBatches.id, { onDelete: "cascade" }),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    outletId: uuid("outlet_id")
      .notNull()
      .references(() => outlets.id),
    legacyMasterCode: varchar("legacy_master_code", { length: 120 }).notNull(),
    legacyMasterName: varchar("legacy_master_name", { length: 220 }).notNull(),
    legacyCategory: varchar("legacy_category", { length: 160 }),
    normalizedCategoryName: varchar("normalized_category_name", {
      length: 160,
    }),
    itemCount: integer("item_count").default(0).notNull(),
    status: legacyMasterMappingStatusEnum("status")
      .default("pending")
      .notNull(),
    mappingSource: legacyMasterMappingSourceEnum("mapping_source"),
    targetCategoryId: uuid("target_category_id").references(
      () => productCategories.id,
    ),
    targetProductMasterId: uuid("target_product_master_id").references(
      () => productMasters.id,
    ),
    reviewNotes: text("review_notes"),
    reviewedBy: uuid("reviewed_by").references(() => users.id),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("legacy_product_master_mappings_batch_code_uq").on(
      table.batchId,
      table.legacyMasterCode,
    ),
    index("legacy_product_master_mappings_batch_status_idx").on(
      table.batchId,
      table.status,
      table.legacyMasterCode,
    ),
    index("legacy_product_master_mappings_target_idx").on(
      table.organizationId,
      table.targetProductMasterId,
    ),
    check(
      "legacy_product_master_mappings_item_count_ck",
      sql`${table.itemCount} >= 0`,
    ),
    check(
      "legacy_product_master_mappings_resolution_ck",
      sql`(
        ${table.status} = 'pending'
        and ${table.targetCategoryId} is null
        and ${table.targetProductMasterId} is null
        and ${table.mappingSource} is null
        and ${table.reviewedBy} is null
        and ${table.reviewedAt} is null
      ) or (
        ${table.status} = 'mapped'
        and ${table.targetCategoryId} is not null
        and ${table.targetProductMasterId} is not null
        and ${table.mappingSource} is not null
        and ${table.reviewedBy} is not null
        and ${table.reviewedAt} is not null
      ) or (
        ${table.status} = 'ignored'
        and ${table.targetCategoryId} is null
        and ${table.targetProductMasterId} is null
        and ${table.mappingSource} is null
        and ${table.reviewedBy} is not null
        and ${table.reviewedAt} is not null
        and nullif(btrim(${table.reviewNotes}), '') is not null
      )`,
    ),
  ],
);

export const itemBarcodes = pgTable(
  "item_barcodes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    itemId: uuid("item_id")
      .notNull()
      .references(() => productItems.id, { onDelete: "cascade" }),
    barcodeValue: varchar("barcode_value", { length: 120 }).notNull(),
    barcodeFormat: varchar("barcode_format", { length: 48 }),
    source: itemBarcodeSourceEnum("source").notNull(),
    isPrimary: boolean("is_primary").default(false).notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    createdBy: uuid("created_by").references(() => users.id),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("item_barcodes_item_value_uq").on(
      table.itemId,
      table.barcodeValue,
    ),
    uniqueIndex("item_barcodes_org_active_value_uq")
      .on(table.organizationId, table.barcodeValue)
      .where(sql`${table.isActive} = true`),
    uniqueIndex("item_barcodes_item_active_primary_uq")
      .on(table.itemId)
      .where(sql`${table.isActive} = true and ${table.isPrimary} = true`),
    index("item_barcodes_item_primary_idx").on(
      table.itemId,
      table.isPrimary,
      table.isActive,
    ),
    check(
      "item_barcodes_barcode_not_blank_ck",
      sql`length(btrim(${table.barcodeValue})) > 0 and ${table.barcodeValue} = btrim(${table.barcodeValue})`,
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
    uniqueIndex("inventory_movements_migration_opening_item_uq")
      .on(table.itemId)
      .where(sql`${table.movementType} = 'migration_opening'`),
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
    businessDate: date("business_date", { mode: "string" }),
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
    uniqueIndex("shifts_outlet_business_date_uq")
      .on(table.outletId, table.businessDate)
      .where(sql`${table.businessDate} is not null`),
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

export const financeClosingSnapshots = pgTable(
  "finance_closing_snapshots",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    shiftId: uuid("shift_id")
      .notNull()
      .references(() => shifts.id, { onDelete: "restrict" }),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "restrict" }),
    outletId: uuid("outlet_id")
      .notNull()
      .references(() => outlets.id, { onDelete: "restrict" }),
    businessDate: date("business_date", { mode: "string" }).notNull(),
    revision: integer("revision").default(1).notNull(),
    supersededAt: timestamp("superseded_at", { withTimezone: true }),
    supersededByUserId: uuid("superseded_by_user_id").references(
      () => users.id,
      {
        onDelete: "restrict",
      },
    ),
    supersededReason: text("superseded_reason"),
    grossSales: numeric("gross_sales", { precision: 18, scale: 0 })
      .default("0")
      .notNull(),
    discountTotal: numeric("discount_total", { precision: 18, scale: 0 })
      .default("0")
      .notNull(),
    netSales: numeric("net_sales", { precision: 18, scale: 0 })
      .default("0")
      .notNull(),
    costSnapshotComplete: boolean("cost_snapshot_complete")
      .default(false)
      .notNull(),
    costOfGoods: numeric("cost_of_goods", { precision: 18, scale: 0 }),
    grossMargin: numeric("gross_margin", { precision: 18, scale: 0 }),
    grossMarginRate: numeric("gross_margin_rate", { precision: 9, scale: 4 }),
    cashTotal: numeric("cash_total", { precision: 18, scale: 0 })
      .default("0")
      .notNull(),
    bankTransferTotal: numeric("bank_transfer_total", {
      precision: 18,
      scale: 0,
    })
      .default("0")
      .notNull(),
    debitCardTotal: numeric("debit_card_total", { precision: 18, scale: 0 })
      .default("0")
      .notNull(),
    creditCardTotal: numeric("credit_card_total", { precision: 18, scale: 0 })
      .default("0")
      .notNull(),
    customerDepositOpeningBalance: numeric("customer_deposit_opening_balance", {
      precision: 18,
      scale: 0,
    })
      .default("0")
      .notNull(),
    customerDepositIn: numeric("customer_deposit_in", {
      precision: 18,
      scale: 0,
    })
      .default("0")
      .notNull(),
    customerDepositUsed: numeric("customer_deposit_used", {
      precision: 18,
      scale: 0,
    })
      .default("0")
      .notNull(),
    customerDepositWithdrawal: numeric("customer_deposit_withdrawal", {
      precision: 18,
      scale: 0,
    })
      .default("0")
      .notNull(),
    customerDepositAdjustmentIn: numeric("customer_deposit_adjustment_in", {
      precision: 18,
      scale: 0,
    })
      .default("0")
      .notNull(),
    customerDepositAdjustmentOut: numeric("customer_deposit_adjustment_out", {
      precision: 18,
      scale: 0,
    })
      .default("0")
      .notNull(),
    customerDepositClosingBalance: numeric("customer_deposit_closing_balance", {
      precision: 18,
      scale: 0,
    })
      .default("0")
      .notNull(),
    expectedCash: numeric("expected_cash", {
      precision: 18,
      scale: 0,
    }).notNull(),
    actualCash: numeric("actual_cash", { precision: 18, scale: 0 }).notNull(),
    cashVariance: numeric("cash_variance", {
      precision: 18,
      scale: 0,
    }).notNull(),
    transactionCount: integer("transaction_count").default(0).notNull(),
    itemsSoldCount: integer("items_sold_count").default(0).notNull(),
    heldTransactionCount: integer("held_transaction_count")
      .default(0)
      .notNull(),
    openedAt: timestamp("opened_at", { withTimezone: true }).notNull(),
    closedAt: timestamp("closed_at", { withTimezone: true }).notNull(),
    cashierId: uuid("cashier_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("finance_closing_snapshots_shift_revision_uq").on(
      table.shiftId,
      table.revision,
    ),
    uniqueIndex("finance_closing_snapshots_outlet_date_revision_uq").on(
      table.outletId,
      table.businessDate,
      table.revision,
    ),
    uniqueIndex("finance_closing_snapshots_current_shift_uq")
      .on(table.shiftId)
      .where(sql`${table.supersededAt} is null`),
    uniqueIndex("finance_closing_snapshots_current_outlet_date_uq")
      .on(table.outletId, table.businessDate)
      .where(sql`${table.supersededAt} is null`),
    index("finance_closing_snapshots_org_period_idx").on(
      table.organizationId,
      table.businessDate,
    ),
    check(
      "finance_closing_snapshots_revision_positive_ck",
      sql`${table.revision} > 0`,
    ),
    check(
      "finance_closing_snapshots_superseded_state_ck",
      sql`(
        ${table.supersededAt} is null
        and ${table.supersededByUserId} is null
        and ${table.supersededReason} is null
      ) or (
        ${table.supersededAt} is not null
        and ${table.supersededByUserId} is not null
        and length(btrim(${table.supersededReason})) >= 5
      )`,
    ),
    check(
      "finance_closing_snapshots_sales_nonnegative_ck",
      sql`${table.grossSales} >= 0 and ${table.discountTotal} >= 0 and ${table.netSales} >= 0`,
    ),
    check(
      "finance_closing_snapshots_payment_nonnegative_ck",
      sql`${table.cashTotal} >= 0
        and ${table.bankTransferTotal} >= 0
        and ${table.debitCardTotal} >= 0
        and ${table.creditCardTotal} >= 0`,
    ),
    check(
      "finance_closing_snapshots_deposit_nonnegative_ck",
      sql`${table.customerDepositOpeningBalance} >= 0
        and ${table.customerDepositIn} >= 0
        and ${table.customerDepositUsed} >= 0
        and ${table.customerDepositWithdrawal} >= 0
        and ${table.customerDepositAdjustmentIn} >= 0
        and ${table.customerDepositAdjustmentOut} >= 0
        and ${table.customerDepositClosingBalance} >= 0`,
    ),
    check(
      "finance_closing_snapshots_cost_state_ck",
      sql`(
        ${table.costSnapshotComplete} = false
        and ${table.costOfGoods} is null
        and ${table.grossMargin} is null
        and ${table.grossMarginRate} is null
      ) or (
        ${table.costSnapshotComplete} = true
        and ${table.costOfGoods} is not null
        and ${table.costOfGoods} >= 0
        and ${table.grossMargin} is not null
        and ${table.grossMarginRate} is not null
      )`,
    ),
    check(
      "finance_closing_snapshots_counts_nonnegative_ck",
      sql`${table.transactionCount} >= 0
        and ${table.itemsSoldCount} >= 0
        and ${table.heldTransactionCount} >= 0`,
    ),
    check(
      "finance_closing_snapshots_actual_cash_nonnegative_ck",
      sql`${table.actualCash} >= 0`,
    ),
    check(
      "finance_closing_snapshots_time_order_ck",
      sql`${table.closedAt} >= ${table.openedAt}`,
    ),
  ],
);

export const telegramDestinations = pgTable(
  "telegram_destinations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "restrict" }),
    outletId: uuid("outlet_id")
      .notNull()
      .references(() => outlets.id, { onDelete: "restrict" }),
    name: varchar("name", { length: 160 }).notNull(),
    chatId: varchar("chat_id", { length: 32 }).notNull(),
    destinationType: telegramDestinationTypeEnum("destination_type")
      .default("private_group")
      .notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    updatedBy: uuid("updated_by")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("telegram_destinations_chat_id_uq").on(table.chatId),
    uniqueIndex("telegram_destinations_one_active_per_outlet_uq")
      .on(table.outletId)
      .where(sql`${table.isActive} = true`),
    index("telegram_destinations_org_outlet_idx").on(
      table.organizationId,
      table.outletId,
    ),
    check(
      "telegram_destinations_name_not_blank_ck",
      sql`length(btrim(${table.name})) > 0 and ${table.name} = btrim(${table.name})`,
    ),
    check(
      "telegram_destinations_chat_id_not_blank_ck",
      sql`length(btrim(${table.chatId})) > 0 and ${table.chatId} = btrim(${table.chatId})`,
    ),
  ],
);

export const telegramReportSettings = pgTable(
  "telegram_report_settings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    destinationId: uuid("destination_id")
      .notNull()
      .references(() => telegramDestinations.id, { onDelete: "cascade" }),
    openingEnabled: boolean("opening_enabled").default(false).notNull(),
    closingDailyEnabled: boolean("closing_daily_enabled")
      .default(false)
      .notNull(),
    weeklyEnabled: boolean("weekly_enabled").default(false).notNull(),
    monthlyEnabled: boolean("monthly_enabled").default(false).notNull(),
    timezone: varchar("timezone", { length: 64 })
      .default("Asia/Jakarta")
      .notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("telegram_report_settings_destination_uq").on(
      table.destinationId,
    ),
    check(
      "telegram_report_settings_timezone_not_blank_ck",
      sql`length(btrim(${table.timezone})) > 0 and ${table.timezone} = btrim(${table.timezone})`,
    ),
  ],
);

export const telegramDeliveryOutbox = pgTable(
  "telegram_delivery_outbox",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "restrict" }),
    eventKey: varchar("event_key", { length: 200 }).notNull(),
    destinationId: uuid("destination_id")
      .notNull()
      .references(() => telegramDestinations.id, { onDelete: "restrict" }),
    outletId: uuid("outlet_id")
      .notNull()
      .references(() => outlets.id, { onDelete: "restrict" }),
    reportType: telegramReportTypeEnum("report_type").notNull(),
    businessDate: date("business_date", { mode: "string" }),
    periodStart: date("period_start", { mode: "string" }),
    periodEnd: date("period_end", { mode: "string" }),
    payloadSnapshotJson: jsonb("payload_snapshot_json")
      .$type<Record<string, unknown>>()
      .notNull(),
    messageText: text("message_text").notNull(),
    status: telegramDeliveryStatusEnum("status").default("pending").notNull(),
    attemptCount: integer("attempt_count").default(0).notNull(),
    maxAttempts: integer("max_attempts").default(5).notNull(),
    nextAttemptAt: timestamp("next_attempt_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    lockedAt: timestamp("locked_at", { withTimezone: true }),
    lockedBy: varchar("locked_by", { length: 120 }),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    telegramMessageId: varchar("telegram_message_id", { length: 64 }),
    lastErrorCode: varchar("last_error_code", { length: 80 }),
    lastErrorMessage: text("last_error_message"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("telegram_delivery_outbox_event_destination_uq").on(
      table.eventKey,
      table.destinationId,
    ),
    index("telegram_delivery_outbox_status_next_attempt_idx").on(
      table.status,
      table.nextAttemptAt,
      table.createdAt,
    ),
    index("telegram_delivery_outbox_outlet_report_date_idx").on(
      table.outletId,
      table.reportType,
      table.businessDate,
      table.createdAt,
    ),
    index("telegram_delivery_outbox_destination_created_idx").on(
      table.destinationId,
      table.createdAt,
    ),
    check(
      "telegram_delivery_outbox_event_key_not_blank_ck",
      sql`length(btrim(${table.eventKey})) > 0 and ${table.eventKey} = btrim(${table.eventKey})`,
    ),
    check(
      "telegram_delivery_outbox_message_not_blank_ck",
      sql`length(${table.messageText}) > 0`,
    ),
    check(
      "telegram_delivery_outbox_attempts_ck",
      sql`${table.attemptCount} >= 0 and ${table.maxAttempts} > 0 and ${table.attemptCount} <= ${table.maxAttempts}`,
    ),
    check(
      "telegram_delivery_outbox_lock_pair_ck",
      sql`(${table.lockedAt} is null and ${table.lockedBy} is null)
        or (${table.lockedAt} is not null and ${table.lockedBy} is not null)`,
    ),
    check(
      "telegram_delivery_outbox_processing_lock_ck",
      sql`${table.status} <> 'processing' or (${table.lockedAt} is not null and ${table.lockedBy} is not null)`,
    ),
    check(
      "telegram_delivery_outbox_sent_state_ck",
      sql`${table.status} <> 'sent' or (${table.sentAt} is not null and ${table.telegramMessageId} is not null)`,
    ),
    check(
      "telegram_delivery_outbox_period_order_ck",
      sql`${table.periodStart} is null or ${table.periodEnd} is null or ${table.periodEnd} >= ${table.periodStart}`,
    ),
  ],
);

export const telegramDeliveryAttempts = pgTable(
  "telegram_delivery_attempts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    deliveryId: uuid("delivery_id")
      .notNull()
      .references(() => telegramDeliveryOutbox.id, { onDelete: "cascade" }),
    attemptNumber: integer("attempt_number").notNull(),
    requestedAt: timestamp("requested_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    httpStatus: integer("http_status"),
    telegramOk: boolean("telegram_ok"),
    telegramErrorCode: integer("telegram_error_code"),
    telegramErrorDescription: text("telegram_error_description"),
    telegramMessageId: varchar("telegram_message_id", { length: 64 }),
    durationMs: integer("duration_ms"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("telegram_delivery_attempts_delivery_number_uq").on(
      table.deliveryId,
      table.attemptNumber,
    ),
    index("telegram_delivery_attempts_delivery_requested_idx").on(
      table.deliveryId,
      table.requestedAt,
    ),
    check(
      "telegram_delivery_attempts_number_positive_ck",
      sql`${table.attemptNumber} > 0`,
    ),
    check(
      "telegram_delivery_attempts_http_status_ck",
      sql`${table.httpStatus} is null or ${table.httpStatus} between 100 and 599`,
    ),
    check(
      "telegram_delivery_attempts_duration_nonnegative_ck",
      sql`${table.durationMs} is null or ${table.durationMs} >= 0`,
    ),
    check(
      "telegram_delivery_attempts_time_order_ck",
      sql`${table.completedAt} is null or ${table.completedAt} >= ${table.requestedAt}`,
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

export const customerHistoryCredentials = pgTable(
  "customer_history_credentials",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id),
    pinHash: text("pin_hash").notNull(),
    credentialVersion: integer("credential_version").default(1).notNull(),
    mustChangePin: boolean("must_change_pin").default(true).notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    failedAttemptCount: integer("failed_attempt_count").default(0).notNull(),
    failedWindowStartedAt: timestamp("failed_window_started_at", {
      withTimezone: true,
    }),
    lockedUntil: timestamp("locked_until", { withTimezone: true }),
    pinCreatedAt: timestamp("pin_created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    pinResetAt: timestamp("pin_reset_at", { withTimezone: true }),
    pinCreatedByUserId: uuid("pin_created_by_user_id").references(
      () => users.id,
    ),
    lastSuccessfulAccessAt: timestamp("last_successful_access_at", {
      withTimezone: true,
    }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("customer_history_credentials_customer_uq").on(
      table.customerId,
    ),
    index("customer_history_credentials_org_active_idx").on(
      table.organizationId,
      table.isActive,
    ),
    check(
      "customer_history_credentials_version_ck",
      sql`${table.credentialVersion} > 0`,
    ),
    check(
      "customer_history_credentials_failed_count_ck",
      sql`${table.failedAttemptCount} >= 0`,
    ),
  ],
);

export const customerHistorySessions = pgTable(
  "customer_history_sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id),
    credentialVersion: integer("credential_version").notNull(),
    tokenHash: varchar("token_hash", { length: 64 }).notNull(),
    requiresPinChange: boolean("requires_pin_change").default(false).notNull(),
    absoluteExpiresAt: timestamp("absolute_expires_at", {
      withTimezone: true,
    }).notNull(),
    idleExpiresAt: timestamp("idle_expires_at", {
      withTimezone: true,
    }).notNull(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    ipAddress: varchar("ip_address", { length: 64 }),
    userAgent: text("user_agent"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("customer_history_sessions_token_hash_uq").on(table.tokenHash),
    index("customer_history_sessions_customer_expiry_idx").on(
      table.customerId,
      table.absoluteExpiresAt,
    ),
    index("customer_history_sessions_expiry_idx").on(
      table.absoluteExpiresAt,
      table.idleExpiresAt,
    ),
    check(
      "customer_history_sessions_version_ck",
      sql`${table.credentialVersion} > 0`,
    ),
  ],
);

export const customerHistoryIpRateLimits = pgTable(
  "customer_history_ip_rate_limits",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    keyHash: varchar("key_hash", { length: 64 }).notNull(),
    windowStartedAt: timestamp("window_started_at", {
      withTimezone: true,
    }).notNull(),
    failureCount: integer("failure_count").default(0).notNull(),
    blockedUntil: timestamp("blocked_until", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("customer_history_ip_rate_limits_key_uq").on(table.keyHash),
    index("customer_history_ip_rate_limits_blocked_idx").on(table.blockedUntil),
    check(
      "customer_history_ip_rate_limits_failure_count_ck",
      sql`${table.failureCount} >= 0`,
    ),
  ],
);

export const securityRateLimits = pgTable(
  "security_rate_limits",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    scope: varchar("scope", { length: 80 }).notNull(),
    keyHash: varchar("key_hash", { length: 64 }).notNull(),
    windowStartedAt: timestamp("window_started_at", {
      withTimezone: true,
    }).notNull(),
    attemptCount: integer("attempt_count").default(0).notNull(),
    blockedUntil: timestamp("blocked_until", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("security_rate_limits_scope_key_uq").on(
      table.scope,
      table.keyHash,
    ),
    index("security_rate_limits_blocked_idx").on(table.blockedUntil),
    index("security_rate_limits_updated_idx").on(table.updatedAt),
    check(
      "security_rate_limits_attempt_count_ck",
      sql`${table.attemptCount} >= 0`,
    ),
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
    check(
      "pos_held_carts_item_count_nonnegative_ck",
      sql`${table.itemCount} >= 0`,
    ),
    check(
      "pos_held_carts_subtotal_nonnegative_ck",
      sql`${table.subtotalAmount} >= 0`,
    ),
    check(
      "pos_held_carts_discount_nonnegative_ck",
      sql`${table.discountAmount} >= 0`,
    ),
    check(
      "pos_held_carts_total_nonnegative_ck",
      sql`${table.totalAmount} >= 0`,
    ),
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
    requestFingerprint: varchar("request_fingerprint", {
      length: 64,
    }).notNull(),
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
    costAmountSnapshot: numeric("cost_amount_snapshot", {
      precision: 18,
      scale: 0,
    }),
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
      sql`${table.finalPriceAmount} = ${table.listPriceAmount} - ${table.discountAmount} + coalesce(nullif(${table.snapshot}->>'laborAmount', '')::numeric, 0) + coalesce(nullif(${table.snapshot}->>'adjustmentAmount', '')::numeric, 0)`,
    ),
    check(
      "sale_items_final_price_positive_ck",
      sql`${table.finalPriceAmount} > 0`,
    ),
    check(
      "sale_items_cost_snapshot_nonnegative_ck",
      sql`${table.costAmountSnapshot} is null or ${table.costAmountSnapshot} >= 0`,
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
    verificationSource: varchar("verification_source", {
      length: 40,
    }).notNull(),
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
    manualPaymentProfileId: uuid("manual_payment_profile_id").references(
      () => manualPaymentProfiles.id,
      { onDelete: "set null" },
    ),
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
  ],
);

export const buybacks = pgTable(
  "buybacks",
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
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id),
    processedBy: uuid("processed_by")
      .notNull()
      .references(() => users.id),
    buybackNumber: varchar("buyback_number", { length: 80 }).notNull(),
    idempotencyKey: varchar("idempotency_key", { length: 120 }).notNull(),
    status: buybackStatusEnum("status").default("completed").notNull(),
    totalAmount: numeric("total_amount", { precision: 18, scale: 0 }).notNull(),
    notes: text("notes"),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("buybacks_org_number_uq").on(
      table.organizationId,
      table.buybackNumber,
    ),
    uniqueIndex("buybacks_org_idempotency_uq").on(
      table.organizationId,
      table.idempotencyKey,
    ),
    index("buybacks_outlet_created_idx").on(table.outletId, table.createdAt),
    index("buybacks_customer_created_idx").on(
      table.customerId,
      table.createdAt,
    ),
    index("buybacks_shift_idx").on(table.shiftId),
    check("buybacks_total_positive_ck", sql`${table.totalAmount} > 0`),
    check(
      "buybacks_completed_timestamp_ck",
      sql`${table.status} <> 'completed' or ${table.completedAt} is not null`,
    ),
    check(
      "buybacks_cancelled_timestamp_ck",
      sql`${table.status} <> 'cancelled' or ${table.cancelledAt} is not null`,
    ),
  ],
);

export const buybackItems = pgTable(
  "buyback_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    buybackId: uuid("buyback_id")
      .notNull()
      .references(() => buybacks.id),
    productItemId: uuid("product_item_id").references(() => productItems.id),
    source: buybackItemSourceEnum("source").notNull(),
    lineNumber: integer("line_number").notNull(),
    weightGram: numeric("weight_gram", { precision: 12, scale: 3 }).notNull(),
    purityPercent: numeric("purity_percent", { precision: 7, scale: 3 }).notNull(),
    exchangePurityPercent: numeric("exchange_purity_percent", {
      precision: 7,
      scale: 3,
    }),
    buybackPricePerGram: numeric("buyback_price_per_gram", {
      precision: 18,
      scale: 0,
    }),
    deductionPerGram: numeric("deduction_per_gram", {
      precision: 18,
      scale: 0,
    })
      .default("0")
      .notNull(),
    baseAmount: numeric("base_amount", { precision: 18, scale: 0 }).notNull(),
    deductionAmount: numeric("deduction_amount", {
      precision: 18,
      scale: 0,
    })
      .default("0")
      .notNull(),
    finalAmount: numeric("final_amount", { precision: 18, scale: 0 }).notNull(),
    snapshot: jsonb("snapshot").$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("buyback_items_buyback_line_uq").on(
      table.buybackId,
      table.lineNumber,
    ),
    uniqueIndex("buyback_items_buyback_product_uq").on(
      table.buybackId,
      table.productItemId,
    ),
    index("buyback_items_product_idx").on(table.productItemId),
    check("buyback_items_line_positive_ck", sql`${table.lineNumber} > 0`),
    check("buyback_items_weight_positive_ck", sql`${table.weightGram} > 0`),
    check(
      "buyback_items_purity_range_ck",
      sql`${table.purityPercent} > 0 and ${table.purityPercent} <= 100`,
    ),
    check(
      "buyback_items_exchange_purity_range_ck",
      sql`${table.exchangePurityPercent} is null or (${table.exchangePurityPercent} > 0 and ${table.exchangePurityPercent} <= 999.999)`,
    ),
    check(
      "buyback_items_price_positive_ck",
      sql`${table.buybackPricePerGram} is null or ${table.buybackPricePerGram} > 0`,
    ),
    check(
      "buyback_items_deduction_nonnegative_ck",
      sql`${table.deductionPerGram} >= 0 and ${table.deductionAmount} >= 0`,
    ),
    check(
      "buyback_items_amount_formula_ck",
      sql`${table.finalAmount} = ${table.baseAmount} - ${table.deductionAmount}`,
    ),
    check(
      "buyback_items_final_positive_ck",
      sql`${table.finalAmount} > 0 and ${table.deductionAmount} < ${table.baseAmount}`,
    ),
  ],
);

export const buybackItemProcessings = pgTable(
  "buyback_item_processings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    buybackItemId: uuid("buyback_item_id")
      .notNull()
      .references(() => buybackItems.id),
    processingType: buybackProcessingTypeEnum("processing_type").notNull(),
    status: buybackProcessingStatusEnum("status").default("pending").notNull(),
    resultProductItemId: uuid("result_product_item_id").references(
      () => productItems.id,
    ),
    resultSnapshot: jsonb("result_snapshot").$type<
      Record<string, unknown> | null
    >(),
    processedBy: uuid("processed_by").references(() => users.id),
    processedAt: timestamp("processed_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("buyback_item_processings_buyback_item_uq").on(
      table.buybackItemId,
    ),
    index("buyback_item_processings_status_type_created_idx").on(
      table.status,
      table.processingType,
      table.createdAt,
    ),
    index("buyback_item_processings_result_item_idx").on(
      table.resultProductItemId,
    ),
    check(
      "buyback_item_processings_completion_ck",
      sql`(
        ${table.status} = 'pending'
        and ${table.resultProductItemId} is null
        and ${table.resultSnapshot} is null
        and ${table.processedBy} is null
        and ${table.processedAt} is null
      ) or (
        ${table.status} = 'completed'
        and ${table.resultProductItemId} is not null
        and ${table.resultSnapshot} is not null
        and ${table.processedBy} is not null
        and ${table.processedAt} is not null
      )`,
    ),
    check(
      "buyback_item_processings_processed_time_ck",
      sql`${table.processedAt} is null or ${table.processedAt} >= ${table.createdAt}`,
    ),
  ],
);

export const buybackPayouts = pgTable(
  "buyback_payouts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    buybackId: uuid("buyback_id")
      .notNull()
      .references(() => buybacks.id),
    method: buybackPayoutMethodEnum("method").notNull(),
    amount: numeric("amount", { precision: 18, scale: 0 }).notNull(),
    reference: varchar("reference", { length: 160 }),
    metadata: jsonb("metadata")
      .$type<Record<string, unknown>>()
      .default({})
      .notNull(),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("buyback_payouts_buyback_method_uq").on(
      table.buybackId,
      table.method,
    ),
    index("buyback_payouts_buyback_idx").on(table.buybackId),
    check("buyback_payouts_amount_positive_ck", sql`${table.amount} > 0`),
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
    uniqueIndex("hardware_agents_one_active_per_register_uq")
      .on(table.registerId)
      .where(sql`${table.isActive} = true`),
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
    status: hardwareJobAttemptStatusEnum("status").default("claimed").notNull(),
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
    check("hardware_job_attempts_number_ck", sql`${table.attemptNumber} > 0`),
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
    payload: jsonb("payload")
      .$type<Record<string, unknown>>()
      .default({})
      .notNull(),
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
    cashMovementId: uuid("cash_movement_id").references(
      () => cashMovements.id,
      {
        onDelete: "set null",
      },
    ),
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
    check(
      "customer_deposit_ledger_amount_positive_ck",
      sql`${table.amount} > 0`,
    ),
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
