-- ============================================================================
-- Phase 0 · ขั้นที่ 2 — DDL ย้อนหลังของตารางที่ไม่มี version ใน repo
-- ============================================================================
-- ผลกระทบ: ไม่มี — ทุกคำสั่งเป็น IF NOT EXISTS
--
-- ตาราง epics และ extra_tasks ถูกสร้างด้วยมือใน Supabase dashboard
-- ไฟล์นี้เขียน DDL ย้อนหลังให้ตรงกับที่โค้ดใช้จริง เพื่อให้มี version ในที่สุด
--   • ถ้าตารางมีอยู่แล้ว  → ไม่มีอะไรเกิดขึ้น (ตรงตามที่ต้องการ)
--   • ถ้าสร้าง project ใหม่ → ไฟล์นี้สร้างให้ครบ
--
-- ⚠️  ไฟล์นี้ตั้งใจ "ไม่" แตะ RLS เลย
--     การเปิด RLS บนตารางที่เดิมปิดอยู่ต้องทำคู่กับการสร้าง policy
--     ในทรานแซกชันเดียว — อยู่ใน 02_authenticated_policies.sql
--
-- ที่มาของคอลัมน์: src/lib/epicDb.ts (fromRow) และ src/lib/extraTaskDb.ts
-- ตรวจความตรงกับของจริงด้วย query ข้อ 5 ใน 00_survey.sql
-- ============================================================================

BEGIN;

-- ── ฟังก์ชัน updated_at ที่ใช้ร่วมกัน ────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


-- ── epics ───────────────────────────────────────────────────────────────────
-- ซิงก์มาจาก Azure DevOps (คอลัมน์กลุ่มแรก) + ข้อมูลที่ QA กรอกเอง (กลุ่มหลัง)
CREATE TABLE IF NOT EXISTS public.epics (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- ── มาจาก ADO: ถูกเขียนทับทุกครั้งที่ sync ──
  epic_no           BIGINT NOT NULL UNIQUE,   -- System.Id
  item_type         TEXT   NOT NULL DEFAULT '',
  iteration         TEXT   NOT NULL DEFAULT '',
  project           TEXT   NOT NULL DEFAULT '',
  feature           TEXT   NOT NULL DEFAULT '',
  state             TEXT   NOT NULL DEFAULT '',
  sit_date          DATE,
  uat_date          DATE,
  target_date       DATE,

  -- ── QA กรอกเอง: sync ต้องไม่แตะ ──
  test_date         DATE,                     -- คำนวณจาก uat/target - estimate
  testing_percent   INT CHECK (testing_percent BETWEEN 0 AND 100),
  tester_flag       JSONB,                    -- array ของ flag; NULL = ว่าง
  tester_note       TEXT NOT NULL DEFAULT '',
  test_estimate_day NUMERIC,
  test_lead         TEXT NOT NULL DEFAULT '',
  test_owner        TEXT NOT NULL DEFAULT '',

  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- เผื่อกรณีตารางมีอยู่แล้วแต่ขาดคอลัมน์ (drift ที่เกิดจากการแก้มือ)
ALTER TABLE public.epics ADD COLUMN IF NOT EXISTS tester_flag       JSONB;
ALTER TABLE public.epics ADD COLUMN IF NOT EXISTS test_estimate_day NUMERIC;
ALTER TABLE public.epics ADD COLUMN IF NOT EXISTS test_lead         TEXT NOT NULL DEFAULT '';
ALTER TABLE public.epics ADD COLUMN IF NOT EXISTS test_owner        TEXT NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_epics_epic_no     ON public.epics (epic_no);
CREATE INDEX IF NOT EXISTS idx_epics_uat_date    ON public.epics (uat_date);
CREATE INDEX IF NOT EXISTS idx_epics_target_date ON public.epics (target_date);
CREATE INDEX IF NOT EXISTS idx_epics_state       ON public.epics (state);
CREATE INDEX IF NOT EXISTS idx_epics_test_lead   ON public.epics (test_lead);

DROP TRIGGER IF EXISTS epics_updated_at ON public.epics;
CREATE TRIGGER epics_updated_at
  BEFORE UPDATE ON public.epics
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ── extra_tasks ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.extra_tasks (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tester            TEXT,
  project_name      TEXT NOT NULL,
  type              TEXT,
  status            TEXT,
  go_live_date      DATE,
  testing_percent   INT CHECK (testing_percent BETWEEN 0 AND 100),
  test_estimate_day NUMERIC,
  tester_flag       JSONB,
  remark            TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.extra_tasks ADD COLUMN IF NOT EXISTS tester_flag JSONB;

CREATE INDEX IF NOT EXISTS idx_extra_tasks_tester     ON public.extra_tasks (tester);
CREATE INDEX IF NOT EXISTS idx_extra_tasks_created_at ON public.extra_tasks (created_at DESC);

DROP TRIGGER IF EXISTS extra_tasks_updated_at ON public.extra_tasks;
CREATE TRIGGER extra_tasks_updated_at
  BEFORE UPDATE ON public.extra_tasks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ── master_tester_flags ─────────────────────────────────────────────────────
-- DDL อยู่ใน supabase/master_tester_flags.sql แล้ว แต่ตารางนั้น "ไม่มี RLS"
-- การเปิด RLS ทำใน 02 พร้อมกับ policy ในทรานแซกชันเดียว
CREATE TABLE IF NOT EXISTS public.master_tester_flags (
  id         SERIAL PRIMARY KEY,
  value      TEXT NOT NULL UNIQUE,
  sort_order INT  NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMIT;


-- ── ตรวจผล ──────────────────────────────────────────────────────────────────
SELECT table_name, count(*) AS columns
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('epics', 'extra_tasks', 'master_tester_flags')
GROUP BY table_name
ORDER BY table_name;
