-- Rename broth_types → products (preserve data) and add the category column.
ALTER TABLE "broth_types" RENAME TO "products";--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "category" text DEFAULT 'Ramen' NOT NULL;--> statement-breakpoint
ALTER INDEX "broth_types_name_idx" RENAME TO "products_name_idx";--> statement-breakpoint
ALTER INDEX "broth_types_sort_idx" RENAME TO "products_sort_idx";--> statement-breakpoint
CREATE INDEX "products_category_idx" ON "products" USING btree ("category");--> statement-breakpoint
-- New: quantity-threshold volume discounts, scoped per category.
CREATE TABLE "volume_discounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category" text NOT NULL,
	"min_quantity" integer NOT NULL,
	"discount_bps" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "volume_discounts_cat_qty_idx" ON "volume_discounts" USING btree ("category","min_quantity");--> statement-breakpoint
-- Rename order_items.broth_type_id → product_id (preserve data + FK).
ALTER TABLE "order_items" RENAME COLUMN "broth_type_id" TO "product_id";--> statement-breakpoint
ALTER TABLE "order_items" RENAME CONSTRAINT "order_items_broth_type_id_broth_types_id_fk" TO "order_items_product_id_products_id_fk";--> statement-breakpoint
ALTER INDEX "order_items_broth_idx" RENAME TO "order_items_product_idx";
