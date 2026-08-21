-- ============================================================================
-- Phase 0 · ขั้นที่ 3 — เพิ่ม policy สำหรับ role `authenticated`
-- ============================================================================
--  ★★★  ไฟล์นี้คือหัวใจของ Phase 0 — ต้องรันก่อนเปิด login เท่านั้น  ★★★
--
-- ปัญหาที่ไฟล์นี้แก้:
--   policy ที่มีอยู่ทุกตัวเขียนว่า `FOR ALL TO anon`
--   แต่ request ของคนที่ล็อกอินแล้วรันเป็น role `authenticated` ไม่ใช่ `anon`
--   และเพราะ RLS เปิดอยู่แล้วแต่ไม่มี policy สำหรับ authenticated → default deny
--
--   ผลถ้าเปิด login โดยไม่รันไฟล์นี้ก่อน:
--     • ทุก SELECT คืน []  แบบเงียบๆ (RLS กรองแถวออก ไม่ throw error)
--     • ทุกการเขียนล้มด้วย "new row violates row-level security policy"
--     • AppContext รายงานว่าต่อ database สำเร็จ — แอปดูเหมือนติดตั้งใหม่ที่ไม่มีข้อมูล
--
-- ผลกระทบของไฟล์นี้: ไม่มี
--   Postgres เอา permissive policy มา OR กันข้าม role
--   การเพิ่ม policy ของ authenticated จึงไม่เปลี่ยนพฤติกรรมของ anon วันนี้
--   → รันได้ทันทีบน production ก่อนแตะโค้ดแอปแม้แต่บรรทัดเดียว
--
-- ย้อนกลับ: 99_emergency_rollback.sql
-- ============================================================================

BEGIN;

DO $$
DECLARE
  t              text;
  rls_was_off    boolean;
  n_enabled      int := 0;
  n_auth_added   int := 0;
  n_anon_added   int := 0;
BEGIN
  FOR t IN
    SELECT c.relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'
      -- ตารางของระบบ auth มี policy จริงของตัวเองใน 03 — ไม่เอามาเปิดกว้าง
      AND c.relname NOT IN ('profiles', 'staff_assignments',
                            'progress_updates', 'ado_project_config')
    ORDER BY c.relname
  LOOP
    SELECT NOT relrowsecurity INTO rls_was_off
    FROM pg_class WHERE oid = format('public.%I', t)::regclass;

    -- ── เปิด RLS ถ้ายังปิดอยู่ ──
    -- ตารางที่ RLS ปิด (เช่น master_tester_flags) เข้าถึงได้ด้วย GRANT เพียวๆ
    -- การเปิด RLS เฉยๆ = default deny ทันที → ต้องสร้าง policy ให้ทั้งสอง role
    -- ในทรานแซกชันเดียวกัน ซึ่งคือสิ่งที่บล็อกนี้ทำ
    IF rls_was_off THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
      n_enabled := n_enabled + 1;
      RAISE NOTICE '[%] เปิด RLS (เดิมปิดอยู่)', t;
    END IF;

    -- ── policy ของ authenticated: ตัวที่ทำให้ login ไม่ทำให้แอปพัง ──
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = t
        AND policyname = 'wiq_authenticated_all'
    ) THEN
      EXECUTE format(
        'CREATE POLICY wiq_authenticated_all ON public.%I
           FOR ALL TO authenticated USING (true) WITH CHECK (true)', t);
      n_auth_added := n_auth_added + 1;
      RAISE NOTICE '[%] + policy authenticated', t;
    END IF;

    -- ── policy ของ anon: กันตารางที่เพิ่งเปิด RLS ไม่ให้ล็อกตัวเอง ──
    -- ตารางที่มี policy anon อยู่แล้วจะได้ policy ซ้อนอีกตัว ซึ่งไม่มีผล
    -- (permissive policy ถูก OR กัน) แต่ทำให้ไม่มีตารางไหนหลุดไปเป็น deny
    -- Phase 5 จะลบ policy กลุ่มนี้ทีละตาราง
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = t
        AND 'anon' = ANY(roles::text[])
    ) THEN
      EXECUTE format(
        'CREATE POLICY wiq_anon_all ON public.%I
           FOR ALL TO anon USING (true) WITH CHECK (true)', t);
      n_anon_added := n_anon_added + 1;
      RAISE NOTICE '[%] + policy anon (ชดเชยการเปิด RLS)', t;
    END IF;
  END LOOP;

  RAISE NOTICE '── สรุป: เปิด RLS % ตาราง · +authenticated % · +anon % ──',
    n_enabled, n_auth_added, n_anon_added;
END $$;


-- ── GRANT ที่อยู่ข้างใต้ policy ─────────────────────────────────────────────
-- policy ตัดสินว่า "แถวไหน" — GRANT ตัดสินว่า "แตะตารางได้ไหมตั้งแต่แรก"
-- ต้องมีทั้งคู่ Supabase ให้ทั้งสอง role มาตั้งแต่ต้นอยู่แล้ว แต่ประกาศไว้ให้ชัด
-- เพราะ Phase 5 ต้องกลับมาถอน grant ของ anon ออก (การลบ policy ไม่ถอน grant)
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES    IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- ตารางที่สร้างในอนาคตได้สิทธิ์เดียวกันโดยไม่ต้องมาแก้ไฟล์นี้อีก
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON SEQUENCES TO authenticated;

COMMIT;


-- ============================================================================
-- ตรวจผล — ทุกแถวต้องได้ has_authenticated = true
-- ถ้ามีแถวไหนเป็น false ห้ามไป Phase 1 เด็ดขาด
-- ============================================================================
SELECT
  c.relname AS table_name,
  c.relrowsecurity AS rls_on,
  bool_or('anon'          = ANY(p.roles::text[])) AS has_anon,
  bool_or('authenticated' = ANY(p.roles::text[])) AS has_authenticated
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
LEFT JOIN pg_policies p ON p.schemaname = 'public' AND p.tablename = c.relname
WHERE n.nspname = 'public' AND c.relkind = 'r'
GROUP BY c.relname, c.relrowsecurity
ORDER BY has_authenticated NULLS FIRST, c.relname;
