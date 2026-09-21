-- ── Add buddy columns to epics table ─────────────────────────────────────────
-- Run this script in Supabase SQL Editor

ALTER TABLE epics
  ADD COLUMN IF NOT EXISTS buddy1 TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS buddy2 TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS buddy3 TEXT NOT NULL DEFAULT '';
