-- Run this SQL in your Supabase Dashboard → SQL Editor
-- Creates the alert_subscriptions and alert_sent_logs tables

CREATE TABLE IF NOT EXISTS "alert_subscriptions" (
  "id"                TEXT        NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "user_id"           TEXT        NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "symbol"            TEXT        NOT NULL,
  "alert_high_enabled" BOOLEAN    NOT NULL DEFAULT true,
  "alert_low_enabled"  BOOLEAN    NOT NULL DEFAULT true,
  "threshold_pct"     DOUBLE PRECISION NOT NULL DEFAULT 1.0,
  "created_at"        TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at"        TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "alert_subscriptions_user_id_symbol_key" UNIQUE ("user_id", "symbol")
);

CREATE TABLE IF NOT EXISTS "alert_sent_logs" (
  "id"          TEXT        NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "user_id"     TEXT        NOT NULL,
  "symbol"      TEXT        NOT NULL,
  "alert_type"  TEXT        NOT NULL,
  "sent_at"     TIMESTAMPTZ NOT NULL DEFAULT now(),
  "sent_date"   DATE        NOT NULL,
  CONSTRAINT "alert_sent_logs_user_id_symbol_alertType_sentDate_key"
    UNIQUE ("user_id", "symbol", "alert_type", "sent_date")
);
