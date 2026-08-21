-- ============================================================================
-- Phase 0 · ขั้นที่ 1 — สำรวจ database ตัวจริง  (READ-ONLY ปลอดภัย 100%)
-- ============================================================================
-- รันไฟล์นี้ก่อนไฟล์อื่นทั้งหมด แล้วเก็บผลลัพธ์ไว้
--
-- ทำไมต้องสำรวจ: repo กับ database จริงไม่ตรงกันแล้ว
--   ตาราง epics / extra_tasks ถูกอ่าน-เขียนโดยแอป แต่ไม่มี CREATE TABLE ใน repo
--   ดังนั้น "ความจริง" อยู่ที่ pg_policies ไม่ใช่ไฟล์ SQL
--
-- ไฟล์นี้ไม่เปลี่ยนอะไรเลย — SELECT ทั้งหมด
-- ============================================================================


-- ── 1. ตารางทั้งหมดใน public + สถานะ RLS ────────────────────────────────────
--    คอลัมน์ rls_enabled = false คือตารางที่เปิดโล่ง ไม่มี RLS เลย
SELECT
  c.relname                                        AS table_name,
  c.relrowsecurity                                 AS rls_enabled,
  c.relforcerowsecurity                            AS rls_forced,
  (SELECT count(*) FROM pg_policies p
    WHERE p.schemaname = 'public' AND p.tablename = c.relname) AS policy_count
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'r'
ORDER BY c.relname;


-- ── 2. policy ทุกตัวที่มีอยู่จริง + role ที่ผูกไว้ ──────────────────────────
--    ตรวจคอลัมน์ roles: ถ้าเห็น {anon} แต่ไม่เห็น {authenticated}
--    → ตารางนั้นจะพังทันทีที่มีคนล็อกอิน
SELECT
  tablename,
  policyname,
  roles,
  cmd,
  permissive,
  qual        AS using_expr,
  with_check  AS check_expr
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;


-- ── 3. สรุปช่องว่าง: ตารางที่ authenticated ยังเข้าไม่ได้ ───────────────────
--    ผลลัพธ์ของ query นี้คือรายการตารางที่ Phase 0 ต้องซ่อม
SELECT
  c.relname AS table_name,
  bool_or('anon'          = ANY(p.roles::text[])) AS has_anon_policy,
  bool_or('authenticated' = ANY(p.roles::text[])) AS has_authenticated_policy,
  bool_or('public'        = ANY(p.roles::text[])) AS has_public_policy
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
LEFT JOIN pg_policies p ON p.schemaname = 'public' AND p.tablename = c.relname
WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relrowsecurity
GROUP BY c.relname
HAVING NOT bool_or('authenticated' = ANY(p.roles::text[]))
   AND NOT bool_or('public'        = ANY(p.roles::text[]))
ORDER BY c.relname;


-- ── 4. GRANT ที่อยู่ข้างใต้ policy ──────────────────────────────────────────
--    การลบ policy ไม่ได้ถอน grant — Phase 5 ต้องกลับมาดูตารางนี้
SELECT
  table_name,
  grantee,
  string_agg(privilege_type, ', ' ORDER BY privilege_type) AS privileges
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND grantee IN ('anon', 'authenticated')
GROUP BY table_name, grantee
ORDER BY table_name, grantee;


-- ── 5. โครงสร้างคอลัมน์จริงของตารางที่ไม่มี DDL ใน repo ─────────────────────
--    เอาผลลัพธ์ไปเทียบกับ 01_baseline_ddl.sql ว่าตรงกันหรือไม่
SELECT
  table_name,
  ordinal_position AS pos,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('epics', 'extra_tasks', 'master_tester_flags')
ORDER BY table_name, ordinal_position;


-- ── 6. มี auth user อยู่แล้วหรือยัง ─────────────────────────────────────────
--    ถ้า 0 → ยังไม่มีใครล็อกอินได้ ต้องใช้ 04_bootstrap_admin.sql
SELECT
  (SELECT count(*) FROM auth.users)                                       AS auth_users,
  (SELECT count(*) FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = 'profiles')           AS profiles_table_exists,
  (SELECT count(*) FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = 'staff_assignments')  AS staff_assignments_exists;
