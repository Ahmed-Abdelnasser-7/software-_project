-- This migration switches IDs to auto-increment integers and renames the password column.
-- It drops and recreates the users/orders tables (safe for dev if you don't need existing data).

DROP TABLE IF EXISTS "orders";
DROP TABLE IF EXISTS "users";

CREATE TABLE "users" (
  "id" SERIAL NOT NULL,
  "name" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "password" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

CREATE TABLE "orders" (
  "id" SERIAL NOT NULL,
  "user_id" INTEGER NOT NULL,
  "location" TEXT NOT NULL,
  "items" JSONB NOT NULL,
  "subtotal_cents" INTEGER NOT NULL,
  "delivery_fee_cents" INTEGER NOT NULL,
  "total_cents" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'confirmed',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "eta_at" TIMESTAMP(3) NOT NULL,
  "delivered_at" TIMESTAMP(3),

  CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "orders_user_id_idx" ON "orders"("user_id");

ALTER TABLE "orders"
  ADD CONSTRAINT "orders_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
