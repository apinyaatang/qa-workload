-- ============================================================================
-- 🚨 คำสั่งฉุกเฉิน — เปิดระบบกลับให้ทุกคนเข้าได้ทันที
-- ============================================================================
-- ใช้เมื่อ: ทีมเข้าระบบไม่ได้ / ตารางว่างเปล่า / เขียนข้อมูลไม่ได้ หลัง deploy
--
-- ไฟล์นี้ทำงานได้โดย "ไม่ต้อง deploy อะไรเลย" — เปิด Supabase SQL Editor แล้วรัน
-- นั่นคือเหตุผลที่ต้องรู้จักไฟล์นี้ไว้ก่อน ไม่ใช่ตอนที่ระบบล่มแล้ว
--
-- สิ่งที่ทำ: คืน policy แบบเปิดกว้างให้ทั้ง anon และ authenticated ทุกตาราง
-- สิ่งที่ไม่ทำ: ไม่ลบข้อมูล ไม่ลบตาราง ไม่แตะ auth.users
-- ============================================================================

BEGIN;

DO $$
DECLARE t text;
BEGIN
  FOR t IN
    SELECT c.relname
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r'
    ORDER BY c.relname
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);

    EXECUTE format('DROP POLICY IF EXISTS wiq_rescue_all ON public.%I', t);
    EXECUTE format(
      'CREATE POLICY wiq_rescue_all ON public.%I
         FOR ALL TO anon, authenticated USING (true) WITH CHECK (true)', t);

    RAISE NOTICE '[%] เปิดกลับแล้ว', t;
  END LOOP;
END $$;

GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES    IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;

COMMIT;


-- ── หลังกู้ระบบได้แล้ว ──────────────────────────────────────────────────────
-- 1. ตั้ง VITE_REQUIRE_AUTH=false แล้ว redeploy → กลับไปสถานะไม่มี login
-- 2. หาสาเหตุด้วย 99_verify.sql
-- 3. เมื่อแก้แล้ว ลบ policy กู้ระบบออก:
--      DO $$ DECLARE t text; BEGIN
--        FOR t IN SELECT tablename FROM pg_policies
--                 WHERE schemaname='public' AND policyname='wiq_rescue_all'
--        LOOP EXECUTE format('DROP POLICY wiq_rescue_all ON public.%I', t); END LOOP;
--      END $$;

SELECT tablename, policyname, roles
FROM pg_policies
WHERE schemaname = 'public' AND policyname = 'wiq_rescue_all'
ORDER BY tablename;
