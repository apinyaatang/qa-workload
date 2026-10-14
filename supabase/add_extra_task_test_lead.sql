-- ── Add test_lead column to extra_tasks table ─────────────────────────────────
-- Run this script in Supabase SQL Editor

ALTER TABLE extra_tasks
  ADD COLUMN IF NOT EXISTS test_lead TEXT NOT NULL DEFAULT '';
