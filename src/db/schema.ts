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
// broth_types — the products
// ─────────────────────────────────────────────────────────────
export const brothTypes = pgTable(
  "broth_types",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    ...timestamps,
  },
  (t) => ({
    nameIdx: uniqueIndex("broth_types_name_idx").on(t.name),
    sortIdx: index("broth_types_sort_idx").on(t.sortOrder),
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
    customerName: text("customer_name").notNull(),
    customerPhone: text("customer_phone").notNull(),
    customerAddress: text("customer_address").notNull(),
    // Optional geocoded pin (Argentina-only address autocomplete + map).
    latitude: doublePrecision("latitude"),
    longitude: doublePrecision("longitude"),
    customerNotes: text("customer_notes"),
    internalNotes: text("internal_notes"),
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
    brothTypeId: uuid("broth_type_id")
      .notNull()
      .references(() => brothTypes.id, { onDelete: "restrict" }),
    quantity: integer("quantity").notNull().default(1),
    ...timestamps,
  },
  (t) => ({
    orderIdx: index("order_items_order_idx").on(t.orderId),
    brothIdx: index("order_items_broth_idx").on(t.brothTypeId),
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
  items: many(orderItems),
}));

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, {
    fields: [orderItems.orderId],
    references: [orders.id],
  }),
  brothType: one(brothTypes, {
    fields: [orderItems.brothTypeId],
    references: [brothTypes.id],
  }),
}));

export const deliverySlotsRelations = relations(deliverySlots, ({ many }) => ({
  orders: many(orders),
}));

export const brothTypesRelations = relations(brothTypes, ({ many }) => ({
  orderItems: many(orderItems),
}));

// ─────────────────────────────────────────────────────────────
// Inferred types
// ─────────────────────────────────────────────────────────────
export type Setting = typeof settings.$inferSelect;
export type BrothType = typeof brothTypes.$inferSelect;
export type NewBrothType = typeof brothTypes.$inferInsert;
export type DeliverySlot = typeof deliverySlots.$inferSelect;
export type NewDeliverySlot = typeof deliverySlots.$inferInsert;
export type Order = typeof orders.$inferSelect;
export type NewOrder = typeof orders.$inferInsert;
export type OrderItem = typeof orderItems.$inferSelect;
export type NewOrderItem = typeof orderItems.$inferInsert;

// Settings keys (typed constants)
export const SETTING_KEYS = {
  DEFAULT_SLOT_CAPACITY: "default_slot_capacity",
  DEFAULT_DAILY_CAPACITY: "default_daily_capacity",
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
