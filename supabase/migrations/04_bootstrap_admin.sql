-- ============================================================================
-- Phase 1 · สร้าง admin คนแรก  —  ★ ทางกู้ระบบถาวร ★
-- ============================================================================
--  ห้ามลบไฟล์นี้ และห้ามคิดว่าเป็นสคริปต์ใช้ครั้งเดียว
--
--  นี่คือทางเดียวที่จะกู้ระบบกลับมาได้ ถ้า admin ทุกคนถูกล็อกออกจากระบบ
--  (ปัญหาไก่กับไข่: หน้าจัดการ user ต้องมี admin ก่อน แต่ admin ก็สร้างได้
--   จากหน้านั้นเท่านั้น — ไฟล์นี้คือทางออกที่ไม่ต้องผ่านแอป)
--
--  รันซ้ำได้ปลอดภัย: ถ้า user เป็น admin ที่ใช้งานได้อยู่แล้ว จะไม่มีอะไรเกิดขึ้น
-- ============================================================================
--
-- ขั้นตอน
-- ─────────
-- 1. สร้าง user ใน Supabase Dashboard → Authentication → Users → Add user
--       • ใส่ email + password
--       • ติ๊ก "Auto Confirm User"  ← ถ้าไม่ติ๊ก จะล็อกอินไม่ได้
--    trigger on_auth_user_created จะสร้าง profile เป็น role 'staff' ให้อัตโนมัติ
--
-- 2. แก้ค่า :admin_email ข้างล่าง ให้เป็น email ที่เพิ่งสร้าง
--
-- 3. รันไฟล์นี้ → profile นั้นถูกยกเป็น admin
--
-- 4. ปิด public signup:  Dashboard → Authentication → Providers → Email
--       ปิด "Enable email signups"
--    ถ้าไม่ปิด ใครก็สมัครเองได้ (ได้ role staff ตาม trigger — แต่ไม่ควรเปิดทิ้งไว้)
-- ============================================================================

DO $$
DECLARE
  -- ⬇⬇⬇  แก้เฉพาะบรรทัดนี้  ⬇⬇⬇
  admin_email CONSTANT TEXT := 'apinya.ta@buzzebees.com';
  -- ⬆⬆⬆  แก้เฉพาะบรรทัดนี้  ⬆⬆⬆

  target_id UUID;
  cur_role  TEXT;
  cur_active BOOLEAN;
BEGIN
  SELECT id INTO target_id FROM auth.users WHERE lower(email) = lower(admin_email);

  IF target_id IS NULL THEN
    RAISE EXCEPTION
      E'ไม่พบ user ที่ email = %\n'
       'ต้องสร้าง user ใน Dashboard → Authentication → Users ก่อน '
       '(อย่าลืมติ๊ก Auto Confirm User)', admin_email;
  END IF;

  -- เผื่อกรณี profile ไม่ถูกสร้าง เพราะ user ถูกสร้างก่อนที่ trigger จะมี
  INSERT INTO public.profiles (id, email, full_name, role, is_active)
  VALUES (target_id, admin_email, admin_email, 'admin', TRUE)
  ON CONFLICT (id) DO NOTHING;

  SELECT role, is_active INTO cur_role, cur_active
  FROM public.profiles WHERE id = target_id;

  IF cur_role = 'admin' AND cur_active THEN
    RAISE NOTICE '% เป็น admin ที่ใช้งานได้อยู่แล้ว — ไม่มีอะไรเปลี่ยน', admin_email;
  ELSE
    UPDATE public.profiles
    SET role = 'admin', is_active = TRUE
    WHERE id = target_id;
    RAISE NOTICE '% → admin (เดิม role=% active=%)', admin_email, cur_role, cur_active;
  END IF;
END $$;


-- ── ตรวจผล: ต้องมี admin ที่ใช้งานได้อย่างน้อย 1 แถว ────────────────────────
SELECT id, email, role, is_active, created_at
FROM public.profiles
WHERE role = 'admin'
ORDER BY created_at;
