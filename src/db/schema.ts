import { relations, sql } from "drizzle-orm";
import {
  boolean,
  date,
  doublePrecision,
  integer,
  pgEnum,
  pgTable,
  text,
  time,
  timestamp,
  uniqueIndex,
  index,
  uuid,
} from "drizzle-orm/pg-core";

// ─────────────────────────────────────────────────────────────
// Enums
// ─────────────────────────────────────────────────────────────
export const orderStatusEnum = pgEnum("order_status", [
  "pending",
  "confirmed",
  "preparing",
  "out_for_delivery",
  "delivered",
  "cancelled",
]);

export type OrderStatus = (typeof orderStatusEnum.enumValues)[number];

export const fulfillmentTypeEnum = pgEnum("fulfillment_type", ["delivery", "pickup"]);

export type FulfillmentType = (typeof fulfillmentTypeEnum.enumValues)[number];

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};

// ─────────────────────────────────────────────────────────────
// settings — flexible key/value configuration store
// ─────────────────────────────────────────────────────────────
export const settings = pgTable(
  "settings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    key: text("key").notNull(),
    value: text("value").notNull(),
    ...timestamps,
  },
  (t) => ({
    keyIdx: uniqueIndex("settings_key_idx").on(t.key),
  }),
);

// ─────────────────────────────────────────────────────────────
// products — what is sold (broths today; other ramen/items later)
// ─────────────────────────────────────────────────────────────
export const products = pgTable(
  "products",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    // Product category (e.g. "Ramen"). Volume discounts apply per category.
    category: text("category").notNull().default("Ramen"),
    // Sale price in Argentine peso centavos (integer minor units; ARS only).
    priceCents: integer("price_cents").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    ...timestamps,
  },
  (t) => ({
    nameIdx: uniqueIndex("products_name_idx").on(t.name),
    sortIdx: index("products_sort_idx").on(t.sortOrder),
    categoryIdx: index("products_category_idx").on(t.category),
  }),
);

// ─────────────────────────────────────────────────────────────
// volume_discounts — quantity-threshold offers, scoped per category
// "From N units of this category, apply X% off the category subtotal."
// ─────────────────────────────────────────────────────────────
export const volumeDiscounts = pgTable(
  "volume_discounts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    category: text("category").notNull(),
    minQuantity: integer("min_quantity").notNull(),
    // Discount in basis points (625 = 6.25%). Integer to avoid float drift.
    discountBps: integer("discount_bps").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    ...timestamps,
  },
  (t) => ({
    catQtyIdx: uniqueIndex("volume_discounts_cat_qty_idx").on(t.category, t.minQuantity),
  }),
);

// ─────────────────────────────────────────────────────────────
// payment_methods — configurable (Efectivo, Transferencia, …)
// ─────────────────────────────────────────────────────────────
export const paymentMethods = pgTable(
  "payment_methods",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    ...timestamps,
  },
  (t) => ({
    nameIdx: uniqueIndex("payment_methods_name_idx").on(t.name),
    sortIdx: index("payment_methods_sort_idx").on(t.sortOrder),
  }),
);

// ─────────────────────────────────────────────────────────────
// shipping_methods — configurable (own vehicles, PedidosYa, Uber…)
// ─────────────────────────────────────────────────────────────
export const shippingMethods = pgTable(
  "shipping_methods",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    ...timestamps,
  },
  (t) => ({
    nameIdx: uniqueIndex("shipping_methods_name_idx").on(t.name),
    sortIdx: index("shipping_methods_sort_idx").on(t.sortOrder),
  }),
);

// ─────────────────────────────────────────────────────────────
// delivery_slots — predefined delivery time windows
// ─────────────────────────────────────────────────────────────
export const deliverySlots = pgTable(
  "delivery_slots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    label: text("label").notNull(),
    startTime: time("start_time").notNull(),
    endTime: time("end_time").notNull(),
    capacityLimit: integer("capacity_limit").notNull().default(6),
    // What shipping a delivery in this time window typically costs us (ARS centavos).
    shippingCostCents: integer("shipping_cost_cents").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    ...timestamps,
  },
  (t) => ({
    labelIdx: uniqueIndex("delivery_slots_label_idx").on(t.label),
    sortIdx: index("delivery_slots_sort_idx").on(t.sortOrder),
  }),
);

// ─────────────────────────────────────────────────────────────
// orders
// ─────────────────────────────────────────────────────────────
export const orders = pgTable(
  "orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // Unguessable token for the public, no-auth order page (/p/<token>).
    publicToken: uuid("public_token").notNull().defaultRandom(),
    customerName: text("customer_name").notNull(),
    customerPhone: text("customer_phone").notNull(),
    // Empty when fulfillmentType = 'pickup' (customer collects at the shop).
    customerAddress: text("customer_address").notNull().default(""),
    fulfillmentType: fulfillmentTypeEnum("fulfillment_type").notNull().default("delivery"),
    paymentMethodId: uuid("payment_method_id").references(() => paymentMethods.id, {
      onDelete: "restrict",
    }),
    // Only for deliveries (which vehicle/courier carried it).
    shippingMethodId: uuid("shipping_method_id").references(() => shippingMethods.id, {
      onDelete: "restrict",
    }),
    // Optional geocoded pin (Argentina-only address autocomplete + map).
    latitude: doublePrecision("latitude"),
    longitude: doublePrecision("longitude"),
    customerNotes: text("customer_notes"),
    internalNotes: text("internal_notes"),
    // Optional per-order delivery tracking link (used in customer messages).
    trackingUrl: text("tracking_url"),
    deliveryDate: date("delivery_date").notNull(),
    deliverySlotId: uuid("delivery_slot_id")
      .notNull()
      .references(() => deliverySlots.id, { onDelete: "restrict" }),
    status: orderStatusEnum("status").notNull().default("pending"),
    totalBowls: integer("total_bowls").notNull().default(0),
    exceededSlotCapacity: boolean("exceeded_slot_capacity").notNull().default(false),
    exceededDailyCapacity: boolean("exceeded_daily_capacity").notNull().default(false),
    overCapacityApproved: boolean("over_capacity_approved").notNull().default(false),
    overCapacityApprovedAt: timestamp("over_capacity_approved_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => ({
    deliveryDateIdx: index("orders_delivery_date_idx").on(t.deliveryDate),
    slotIdx: index("orders_slot_idx").on(t.deliverySlotId),
    statusIdx: index("orders_status_idx").on(t.status),
    dateSlotIdx: index("orders_date_slot_idx").on(t.deliveryDate, t.deliverySlotId),
    publicTokenIdx: uniqueIndex("orders_public_token_idx").on(t.publicToken),
  }),
);

// ─────────────────────────────────────────────────────────────
// order_items
// ─────────────────────────────────────────────────────────────
export const orderItems = pgTable(
  "order_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "restrict" }),
    quantity: integer("quantity").notNull().default(1),
    ...timestamps,
  },
  (t) => ({
    orderIdx: index("order_items_order_idx").on(t.orderId),
    productIdx: index("order_items_product_idx").on(t.productId),
  }),
);

// ─────────────────────────────────────────────────────────────
// rate_limit_hits — lightweight per-key request log for rate limiting
// (used by the public order form; no external service needed)
// ─────────────────────────────────────────────────────────────
export const rateLimitHits = pgTable(
  "rate_limit_hits",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    bucket: text("bucket").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    bucketIdx: index("rate_limit_hits_bucket_idx").on(t.bucket, t.createdAt),
  }),
);

// ─────────────────────────────────────────────────────────────
// delivery_runs — actual shipping cost of a delivery run (date + slot)
// ─────────────────────────────────────────────────────────────
export const deliveryRuns = pgTable(
  "delivery_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    deliveryDate: date("delivery_date").notNull(),
    slotId: uuid("slot_id")
      .notNull()
      .references(() => deliverySlots.id, { onDelete: "cascade" }),
    // How it was actually shipped + what it actually cost us (ARS centavos).
    shippingMethodId: uuid("shipping_method_id").references(() => shippingMethods.id, {
      onDelete: "set null",
    }),
    actualCostCents: integer("actual_cost_cents").notNull().default(0),
    notes: text("notes"),
    ...timestamps,
  },
  (t) => ({
    dateSlotIdx: uniqueIndex("delivery_runs_date_slot_idx").on(t.deliveryDate, t.slotId),
  }),
);

// ─────────────────────────────────────────────────────────────
// message_templates — editable WhatsApp message per order status
// ─────────────────────────────────────────────────────────────
export const messageTemplates = pgTable(
  "message_templates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    status: orderStatusEnum("status").notNull(),
    body: text("body").notNull(),
    ...timestamps,
  },
  (t) => ({
    statusIdx: uniqueIndex("message_templates_status_idx").on(t.status),
  }),
);

// ─────────────────────────────────────────────────────────────
// Relations
// ─────────────────────────────────────────────────────────────
export const ordersRelations = relations(orders, ({ one, many }) => ({
  slot: one(deliverySlots, {
    fields: [orders.deliverySlotId],
    references: [deliverySlots.id],
  }),
  paymentMethod: one(paymentMethods, {
    fields: [orders.paymentMethodId],
    references: [paymentMethods.id],
  }),
  shippingMethod: one(shippingMethods, {
    fields: [orders.shippingMethodId],
    references: [shippingMethods.id],
  }),
  items: many(orderItems),
}));

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, {
    fields: [orderItems.orderId],
    references: [orders.id],
  }),
  product: one(products, {
    fields: [orderItems.productId],
    references: [products.id],
  }),
}));

export const deliverySlotsRelations = relations(deliverySlots, ({ many }) => ({
  orders: many(orders),
}));

export const productsRelations = relations(products, ({ many }) => ({
  orderItems: many(orderItems),
}));

// ─────────────────────────────────────────────────────────────
// Inferred types
// ─────────────────────────────────────────────────────────────
export type Setting = typeof settings.$inferSelect;
export type Product = typeof products.$inferSelect;
export type NewProduct = typeof products.$inferInsert;
export type VolumeDiscount = typeof volumeDiscounts.$inferSelect;
export type NewVolumeDiscount = typeof volumeDiscounts.$inferInsert;
export type PaymentMethod = typeof paymentMethods.$inferSelect;
export type NewPaymentMethod = typeof paymentMethods.$inferInsert;
export type ShippingMethod = typeof shippingMethods.$inferSelect;
export type NewShippingMethod = typeof shippingMethods.$inferInsert;
export type DeliverySlot = typeof deliverySlots.$inferSelect;
export type NewDeliverySlot = typeof deliverySlots.$inferInsert;
export type Order = typeof orders.$inferSelect;
export type NewOrder = typeof orders.$inferInsert;
export type OrderItem = typeof orderItems.$inferSelect;
export type NewOrderItem = typeof orderItems.$inferInsert;
export type MessageTemplate = typeof messageTemplates.$inferSelect;
export type NewMessageTemplate = typeof messageTemplates.$inferInsert;
export type DeliveryRun = typeof deliveryRuns.$inferSelect;
export type NewDeliveryRun = typeof deliveryRuns.$inferInsert;

// Settings keys (typed constants)
export const SETTING_KEYS = {
  BUSINESS_NAME: "business_name",
  BUSINESS_NAME_SHORT: "business_name_short",
  BUSINESS_DESCRIPTION: "business_description",
  BUSINESS_LOGO: "business_logo",
  DEFAULT_SLOT_CAPACITY: "default_slot_capacity",
  DEFAULT_DAILY_CAPACITY: "default_daily_capacity",
  MAX_SLOT_CAPACITY: "max_slot_capacity",
  MAX_DAILY_CAPACITY: "max_daily_capacity",
  ACTIVE_DELIVERY_DAYS: "active_delivery_days",
  ORIGIN_ADDRESS: "origin_address",
  ORIGIN_LAT: "origin_lat",
  ORIGIN_LNG: "origin_lng",
  SEARCH_LABEL: "search_label",
  SEARCH_CENTER_LAT: "search_center_lat",
  SEARCH_CENTER_LNG: "search_center_lng",
  SEARCH_RADIUS_KM: "search_radius_km",
} as const;

// raw sql re-export for convenience in migrations/seeds
export { sql };
