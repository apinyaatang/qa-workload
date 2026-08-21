-- ============================================================================
-- Phase 1 · ตารางและ policy ของระบบ auth  (เวอร์ชันที่แก้บั๊กแล้ว)
-- ============================================================================
-- ไฟล์นี้แทนที่ supabase/auth_progress_schema.sql ซึ่ง "ยังไม่เคยรัน"
-- และมีบั๊ก 5 จุดที่ทำให้ระบบใช้งานไม่ได้ถ้ารันตามนั้น:
--
--  1. RECURSION — การเช็คสิทธิ์ admin 7 จุดเขียนเป็น
--       EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role='admin')
--     ไว้ใน policy ที่อยู่บนตาราง profiles เอง → policy เรียกตัวเองไม่สิ้นสุด
--     ทำให้อ่านตาราง profiles ไม่ได้ตั้งแต่ query แรก
--     แก้: helper `is_admin()` แบบ SECURITY DEFINER ที่ข้าม RLS ได้
--
--  2. PRIVILEGE ESCALATION — trigger ตอนสมัครอ่าน role จาก
--       raw_user_meta_data->>'role' ซึ่ง client ส่งมาเอง
--     ใครสมัครได้ก็ขอ role admin ได้ในคำขอเดียว
--     แก้: hardcode 'staff' — ห้ามใส่การอ่าน metadata กลับมา
--
--  3. ไม่มีทางปิดการใช้งาน user — เพิ่มคอลัมน์ is_active
--     (ชั้นที่หยุด token ที่ออกไปแล้ว ซึ่ง Supabase ban หยุดไม่ได้)
--
--  4. TYPE MISMATCH — planning_id ประกาศเป็น UUID แต่ planning id คือ
--     business key ที่มาจาก CSV และ client ส่งมาเป็น text
--     แก้: เปลี่ยนคอลัมน์เป็น TEXT (ไม่ใช่แก้ฝั่ง client)
--
--  5. ล็อก admin คนสุดท้ายได้ — เพิ่ม trigger กันไว้ในระดับ database
--     ซึ่งเป็นชั้นเดียวที่จับได้ตอนมีคนแก้ข้อมูลมือใน Supabase dashboard
--
-- ต้องรัน 02_authenticated_policies.sql ให้ผ่านก่อน
-- ============================================================================

BEGIN;

-- ──────────────────────────────────────────────────────────────────────────
-- 1. PROFILES
-- ──────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.profiles (
  id         UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email      TEXT,
  full_name  TEXT,
  role       TEXT    NOT NULL DEFAULT 'staff' CHECK (role IN ('admin', 'staff')),
  is_active  BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- บั๊ก 3: เผื่อกรณีตารางถูกสร้างจากไฟล์เก่าที่ยังไม่มีคอลัมน์นี้
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_updated_at ON public.profiles;
CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ──────────────────────────────────────────────────────────────────────────
-- 2. HELPER: is_admin()  ← บั๊ก 1
-- ──────────────────────────────────────────────────────────────────────────
-- SECURITY DEFINER ทำให้ฟังก์ชันรันด้วยสิทธิ์เจ้าของ จึงอ่าน profiles
-- ได้โดยไม่ผ่าน RLS → ไม่เกิด recursion เมื่อถูกเรียกจาก policy บน profiles
--
-- SET search_path เป็นข้อบังคับด้านความปลอดภัยของ SECURITY DEFINER
-- ไม่ใส่ = เปิดช่องให้ปลอมตารางแล้วยึดสิทธิ์
CREATE OR REPLACE FUNCTION public.is_admin(uid UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = uid AND role = 'admin' AND is_active
  );
$$;

-- ผู้ใช้ที่ล็อกอินแล้วและยังไม่ถูกปิดการใช้งาน
CREATE OR REPLACE FUNCTION public.is_active_user(uid UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = uid AND is_active
  );
$$;

REVOKE ALL ON FUNCTION public.is_admin(UUID)       FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_active_user(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin(UUID)       TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_active_user(UUID) TO authenticated;


-- ──────────────────────────────────────────────────────────────────────────
-- 3. TRIGGER สร้าง profile ตอนสมัคร  ← บั๊ก 2
-- ──────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role, is_active)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    -- ⛔ ห้ามอ่าน role จาก raw_user_meta_data เด็ดขาด
    --    metadata มาจาก client โดยตรง — ใครสมัครได้ก็ขอ admin ได้
    --    การยกระดับ role ต้องทำโดย admin ผ่าน Edge Function เท่านั้น (Phase 4)
    --    วันนี้ยังโจมตีไม่ได้เพราะ public signup ปิดอยู่
    --    แต่ถ้าเปิด บรรทัดเดิมคือการแจก admin ฟรี
    'staff',
    TRUE
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- ──────────────────────────────────────────────────────────────────────────
-- 4. TRIGGER กัน admin คนสุดท้าย  ← บั๊ก 5
-- ──────────────────────────────────────────────────────────────────────────
-- ชั้นนี้สำคัญที่สุดในสามชั้น (client / Edge Function / database)
-- เพราะเป็นชั้นเดียวที่จับได้ตอนมีคนแก้ข้อมูลมือใน Supabase dashboard
-- ซึ่งเป็นทางที่มีโอกาสล็อกตัวเองออกจากระบบมากที่สุด
CREATE OR REPLACE FUNCTION public.guard_last_admin()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  remaining INT;
BEGIN
  -- สนใจเฉพาะการเปลี่ยนที่ทำให้แถวนี้ "เลิกเป็น admin ที่ใช้งานได้"
  IF TG_OP = 'UPDATE'
     AND OLD.role = 'admin' AND OLD.is_active
     AND (NEW.role <> 'admin' OR NOT NEW.is_active)
  THEN
    SELECT count(*) INTO remaining
    FROM public.profiles
    WHERE role = 'admin' AND is_active AND id <> OLD.id;

    IF remaining = 0 THEN
      RAISE EXCEPTION
        'ไม่สามารถถอนสิทธิ์ admin คนสุดท้ายได้ — ต้องมี admin ที่ใช้งานได้อย่างน้อย 1 คน'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  IF TG_OP = 'DELETE' AND OLD.role = 'admin' AND OLD.is_active THEN
    SELECT count(*) INTO remaining
    FROM public.profiles
    WHERE role = 'admin' AND is_active AND id <> OLD.id;

    IF remaining = 0 THEN
      RAISE EXCEPTION
        'ไม่สามารถลบ admin คนสุดท้ายได้ — ต้องมี admin ที่ใช้งานได้อย่างน้อย 1 คน'
        USING ERRCODE = 'check_violation';
    END IF;
    RETURN OLD;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_guard_last_admin ON public.profiles;
CREATE TRIGGER profiles_guard_last_admin
  BEFORE UPDATE OR DELETE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_last_admin();


-- ──────────────────────────────────────────────────────────────────────────
-- 5. STAFF ASSIGNMENTS — สะพานเชื่อม user ↔ ชื่อ tester ใน planning
-- ──────────────────────────────────────────────────────────────────────────
-- เลือกใช้ตารางแยกแทนการเพิ่มคอลัมน์ email ในตาราง employees
-- เพราะแถว employees ถูกเขียนทับทั้งชุดทุกครั้งที่ import CSV จึงเปราะโดยธรรมชาติ
-- และการจับคู่ชื่อแบบ fuzzy ใช้เป็นเส้นแบ่งสิทธิ์ไม่ได้
CREATE TABLE IF NOT EXISTS public.staff_assignments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tester_name TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (staff_id, tester_name)
);

CREATE INDEX IF NOT EXISTS idx_staff_assignments_staff
  ON public.staff_assignments (staff_id);


-- ──────────────────────────────────────────────────────────────────────────
-- 6. ADO PROJECT CONFIG
-- ──────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ado_project_config (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  planning_id TEXT NOT NULL UNIQUE,   -- ← บั๊ก 4: text ไม่ใช่ uuid
  ado_org_url TEXT NOT NULL,
  ado_project TEXT NOT NULL,
  ado_tag     TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS ado_project_config_updated_at ON public.ado_project_config;
CREATE TRIGGER ado_project_config_updated_at
  BEFORE UPDATE ON public.ado_project_config
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ──────────────────────────────────────────────────────────────────────────
-- 7. PROGRESS UPDATES — log แบบเขียนต่อท้ายอย่างเดียว
-- ──────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.progress_updates (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  planning_id     TEXT NOT NULL,   -- ← บั๊ก 4: business key จาก CSV เป็น text
  staff_id        UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  testing_percent INT  NOT NULL CHECK (testing_percent BETWEEN 0 AND 100),
  comment         TEXT NOT NULL DEFAULT '',
  ado_snapshot    JSONB,
  sent_to_teams   BOOLEAN NOT NULL DEFAULT FALSE,
  teams_sent_at   TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- บั๊ก 4 (กรณีไฟล์เก่าถูกรันไปแล้ว): แปลง uuid → text
-- ต้องทำก่อนใส่ policy ที่บังคับ auth.uid() = staff_id ไม่งั้นการส่ง progress ล้มทุกครั้ง
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'progress_updates'
      AND column_name = 'planning_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE public.progress_updates
      ALTER COLUMN planning_id TYPE TEXT USING planning_id::TEXT;
    RAISE NOTICE 'progress_updates.planning_id: uuid → text';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'ado_project_config'
      AND column_name = 'planning_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE public.ado_project_config
      ALTER COLUMN planning_id TYPE TEXT USING planning_id::TEXT;
    RAISE NOTICE 'ado_project_config.planning_id: uuid → text';
  END IF;
END $$;

-- staff_id เดิมเป็น NOT NULL REFERENCES ... ON DELETE SET NULL ซึ่งขัดกันเอง
-- (ลบ user แล้วจะ set null ลงคอลัมน์ที่ห้าม null) → ปล่อยให้ null ได้
ALTER TABLE public.progress_updates ALTER COLUMN staff_id DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_progress_updates_planning
  ON public.progress_updates (planning_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_progress_updates_staff
  ON public.progress_updates (staff_id, created_at DESC);


-- ──────────────────────────────────────────────────────────────────────────
-- 8. RLS POLICIES — ไม่มีการ query ตัวเองแล้ว ทุกจุดใช้ is_admin()
-- ──────────────────────────────────────────────────────────────────────────
ALTER TABLE public.profiles           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_assignments  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ado_project_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.progress_updates   ENABLE ROW LEVEL SECURITY;

-- ── profiles ──
-- อ่านของตัวเองได้เสมอ แม้จะถูกปิดการใช้งานแล้ว
-- (จำเป็น: แอปต้องอ่าน is_active=false ให้ได้ เพื่อแสดงหน้า "บัญชีถูกปิด"
--  ถ้ากรองแถวนี้ออก คนที่ถูกปิดสิทธิ์จะเห็นแค่หน้าจอว่างๆ แทนคำอธิบาย)
DROP POLICY IF EXISTS "profiles: own read"       ON public.profiles;
DROP POLICY IF EXISTS "profiles: admin read all" ON public.profiles;
DROP POLICY IF EXISTS "profiles: admin update"   ON public.profiles;

CREATE POLICY "profiles: own read"
  ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid());

CREATE POLICY "profiles: admin read all"
  ON public.profiles FOR SELECT TO authenticated
  USING (public.is_admin());

CREATE POLICY "profiles: admin write"
  ON public.profiles FOR UPDATE TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ไม่มี policy "แก้ชื่อตัวเอง" โดยเจตนา
-- การเขียน policy นั้นให้ปลอดภัยต้องเทียบค่า role/is_active เดิม ซึ่งหมายถึง
-- subquery อ่านตาราง profiles จาก policy ที่อยู่บน profiles เอง = recursion (บั๊ก 1)
-- ถ้าจะทำ ต้องผ่าน SECURITY DEFINER helper หรือ RPC เท่านั้น
-- v1 ให้ admin แก้ชื่อผ่านหน้าจัดการ user (Phase 4) แทน
DROP POLICY IF EXISTS "profiles: own name update" ON public.profiles;

-- ── staff_assignments ──
DROP POLICY IF EXISTS "staff_assignments: own read"      ON public.staff_assignments;
DROP POLICY IF EXISTS "staff_assignments: admin read all" ON public.staff_assignments;
DROP POLICY IF EXISTS "staff_assignments: admin write"   ON public.staff_assignments;

CREATE POLICY "staff_assignments: own read"
  ON public.staff_assignments FOR SELECT TO authenticated
  USING (staff_id = auth.uid());

CREATE POLICY "staff_assignments: admin read all"
  ON public.staff_assignments FOR SELECT TO authenticated
  USING (public.is_admin());

CREATE POLICY "staff_assignments: admin write"
  ON public.staff_assignments FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ── ado_project_config ──
DROP POLICY IF EXISTS "ado_project_config: auth read"   ON public.ado_project_config;
DROP POLICY IF EXISTS "ado_project_config: admin write" ON public.ado_project_config;

CREATE POLICY "ado_project_config: auth read"
  ON public.ado_project_config FOR SELECT TO authenticated
  USING (public.is_active_user());

CREATE POLICY "ado_project_config: admin write"
  ON public.ado_project_config FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ── progress_updates ──
-- การอ่านระดับทีมเปิดไว้ เพราะ dashboard ต้องรวมข้อมูลข้ามทุกคนจริงๆ
DROP POLICY IF EXISTS "progress_updates: own read"      ON public.progress_updates;
DROP POLICY IF EXISTS "progress_updates: admin read all" ON public.progress_updates;
DROP POLICY IF EXISTS "progress_updates: auth insert"   ON public.progress_updates;
DROP POLICY IF EXISTS "progress_updates: admin update"  ON public.progress_updates;

CREATE POLICY "progress_updates: team read"
  ON public.progress_updates FOR SELECT TO authenticated
  USING (public.is_active_user());

-- เขียนได้เฉพาะในชื่อตัวเอง — ทำให้ปลอมชื่อคนอื่นไม่ได้
CREATE POLICY "progress_updates: own insert"
  ON public.progress_updates FOR INSERT TO authenticated
  WITH CHECK (staff_id = auth.uid() AND public.is_active_user());

-- staff แก้ย้อนหลังไม่ได้เลย (นี่คือเหตุผลที่ไม่ต้องมีตาราง audit log แยก)
CREATE POLICY "progress_updates: admin update"
  ON public.progress_updates FOR UPDATE TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

COMMIT;


-- ============================================================================
-- ตรวจผล
-- ============================================================================
-- 1) ไม่มี policy ไหนเหลือการ query ตาราง profiles ซ้อนอยู่ข้างใน
SELECT tablename, policyname, roles, cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('profiles','staff_assignments','ado_project_config','progress_updates')
ORDER BY tablename, policyname;

-- 2) helper ต้องมีจริงและเป็น SECURITY DEFINER
SELECT p.proname, p.prosecdef AS security_definer, p.proconfig
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname IN ('is_admin','is_active_user','guard_last_admin');
