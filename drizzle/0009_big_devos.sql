ALTER TABLE "orders" ADD COLUMN "transfer_receipt_path" text;--> statement-breakpoint
ALTER TABLE "payment_methods" ADD COLUMN "requires_receipt" boolean DEFAULT false NOT NULL;