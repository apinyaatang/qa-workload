-- ── Master Tester Flags table ─────────────────────────────────────────────────
-- Run this script in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS master_tester_flags (
  id         SERIAL PRIMARY KEY,
  value      TEXT NOT NULL UNIQUE,
  sort_order INT  NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Insert all flag values
INSERT INTO master_tester_flags (value, sort_order) VALUES
  ('Delay from Other team', 1),
  ('Follow up plan',        2),
  ('Wait confirm',          3),
  ('Can be postpone',       4),
  ('No need Tester',        5),
  ('Wait kickoff',          6),
  ('Follow Feature',        7),
  ('Testcase',              8),
  ('On going',              9),
  ('Test on plan',          10),
  ('Test delay',            11),
  ('Testing hold',          12),
  ('Support UAT',           13),
  ('Test Done',             14),
  ('Deployed',              15),
  ('Support PRD',           16)
ON CONFLICT (value) DO NOTHING;
