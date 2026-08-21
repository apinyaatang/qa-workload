-- ============================================================================
-- สคริปต์ตรวจสอบ — รันหลังทุกไฟล์ ทุกครั้ง
-- ============================================================================
-- RLS ทดสอบจาก test setup ที่มีอยู่ (vitest บน Node) ไม่ได้จริงจัง
-- ไฟล์นี้คือการตรวจแทน — ทุก assertion ที่ FAIL คือของที่ห้ามข้าม
--
-- อ่านผลจากคอลัมน์ result: PASS / FAIL
-- ============================================================================

-- ── A1. ทุกตารางที่เปิด RLS ต้องมี policy ของ authenticated ─────────────────
--     FAIL = การล็อกอินจะทำให้ตารางนั้นคืน [] แบบเงียบๆ
WITH t AS (
  SELECT c.relname AS tbl,
         bool_or('authenticated' = ANY(p.roles::text[])) AS ok
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  LEFT JOIN pg_policies p ON p.schemaname = 'public' AND p.tablename = c.relname
  WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relrowsecurity
  GROUP BY c.relname
)
SELECT 'A1 · ทุกตารางมี policy authenticated' AS assertion,
       CASE WHEN count(*) FILTER (WHERE NOT COALESCE(ok, false)) = 0
            THEN 'PASS' ELSE 'FAIL' END AS result,
       COALESCE(string_agg(tbl, ', ') FILTER (WHERE NOT COALESCE(ok, false)), '—') AS offenders
FROM t;


-- ── A2. ทุกตารางที่มี GRANT ต้องเปิด RLS ────────────────────────────────────
--     FAIL = ตารางนั้นเข้าถึงได้ด้วย anon key โดยไม่ผ่าน policy เลย
SELECT 'A2 · ไม่มีตารางที่ RLS ปิดอยู่' AS assertion,
       CASE WHEN count(*) = 0 THEN 'PASS' ELSE 'FAIL' END AS result,
       COALESCE(string_agg(relname, ', '), '—') AS offenders
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'r' AND NOT c.relrowsecurity;


-- ── A3. helper ต้องเป็น SECURITY DEFINER และปิด search_path ─────────────────
--     FAIL = policy จะ recurse หรือเปิดช่องยึดสิทธิ์ผ่าน search_path
SELECT 'A3 · helper เป็น SECURITY DEFINER + pin search_path' AS assertion,
       CASE WHEN count(*) = 2
                 AND bool_and(prosecdef)
                 AND bool_and(proconfig IS NOT NULL)
            THEN 'PASS' ELSE 'FAIL' END AS result,
       COALESCE(string_agg(proname || '(secdef=' || prosecdef || ')', ', '), '—') AS detail
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname IN ('is_admin', 'is_active_user');


-- ── A4. trigger ตอนสมัครต้องไม่อ่าน role จาก metadata ───────────────────────
--     FAIL = ใครสมัครได้ก็ขอสิทธิ์ admin ได้ในคำขอเดียว
SELECT 'A4 · handle_new_user ไม่อ่าน role จาก metadata' AS assertion,
       CASE WHEN count(*) = 0 THEN 'PASS' ELSE 'FAIL' END AS result,
       CASE WHEN count(*) = 0 THEN '—'
            ELSE 'พบการอ่าน raw_user_meta_data->>role ในฟังก์ชัน' END AS detail
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname = 'handle_new_user'
  AND p.prosrc ~* 'raw_user_meta_data\s*->>\s*''role''';


-- ── A5. ไม่มี policy ไหนอ่านตาราง profiles ซ้อนอยู่ข้างใน ───────────────────
--     FAIL = recursion — อ่าน profiles ไม่ได้ตั้งแต่ query แรก
SELECT 'A5 · policy ไม่ query profiles ซ้อน' AS assertion,
       CASE WHEN count(*) = 0 THEN 'PASS' ELSE 'FAIL' END AS result,
       COALESCE(string_agg(tablename || '.' || policyname, ', '), '—') AS offenders
FROM pg_policies
WHERE schemaname = 'public'
  AND (COALESCE(qual, '') || ' ' || COALESCE(with_check, '')) ~* 'from\s+(public\.)?profiles';


-- ── A6. ต้องมี admin ที่ใช้งานได้อย่างน้อย 1 คน ─────────────────────────────
--     FAIL = ไม่มีใครเข้าหน้าจัดการ user ได้ → ต้องรัน 04_bootstrap_admin.sql
SELECT 'A6 · มี admin ที่ใช้งานได้ ≥ 1 คน' AS assertion,
       CASE WHEN count(*) >= 1 THEN 'PASS' ELSE 'FAIL' END AS result,
       count(*)::text || ' คน' AS detail
FROM public.profiles WHERE role = 'admin' AND is_active;


-- ── A7. trigger กัน admin คนสุดท้ายต้องติดตั้งอยู่ ──────────────────────────
SELECT 'A7 · trigger กัน admin คนสุดท้ายติดตั้งแล้ว' AS assertion,
       CASE WHEN count(*) = 1 THEN 'PASS' ELSE 'FAIL' END AS result,
       count(*)::text AS detail
FROM pg_trigger
WHERE tgname = 'profiles_guard_last_admin' AND NOT tgisinternal;


-- ── A8. planning_id ต้องเป็น text ทั้งสองตาราง ──────────────────────────────
--     FAIL = การส่ง progress ล้มทุกครั้ง (client ส่ง text ลงคอลัมน์ uuid)
SELECT 'A8 · planning_id เป็น text' AS assertion,
       CASE WHEN count(*) FILTER (WHERE data_type <> 'text') = 0
            THEN 'PASS' ELSE 'FAIL' END AS result,
       COALESCE(string_agg(table_name || '=' || data_type, ', ')
                FILTER (WHERE data_type <> 'text'), '—') AS offenders
FROM information_schema.columns
WHERE table_schema = 'public' AND column_name = 'planning_id';


-- ── A9. ทุก user ใน auth.users ต้องมี profile ────────────────────────────────
--     FAIL = คนนั้นล็อกอินได้แต่เข้าหน้า "ไม่พบข้อมูลผู้ใช้" ตลอด
SELECT 'A9 · ทุก auth user มี profile' AS assertion,
       CASE WHEN count(*) = 0 THEN 'PASS' ELSE 'FAIL' END AS result,
       COALESCE(string_agg(u.email, ', '), '—') AS offenders
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE p.id IS NULL;
