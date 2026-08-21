-- ============================================================================
-- Phase 3 · ผูกคนจริงกับการเขียน progress
-- ============================================================================
-- ผลกระทบ: การส่ง progress
--
-- ⚠️  ลำดับสำคัญมาก — ต้อง deploy โค้ดฝั่ง client ก่อนรันไฟล์นี้
--
--     policy "progress_updates: own insert" (สร้างใน 03) บังคับว่า
--       WITH CHECK (staff_id = auth.uid() AND is_active_user())
--
--     โค้ดเดิมส่ง staffId: 'offline' ซึ่งเป็น string ธรรมดา ลงคอลัมน์
--     uuid REFERENCES auth.users(id) — insert ล้มทุกครั้งไม่ว่าจะมีสิทธิ์หรือไม่
--
--     ถ้ารันไฟล์นี้ก่อน deploy โค้ด: การส่ง progress จะยังล้มเหมือนเดิม
--     ถ้า deploy โค้ดก่อน: โค้ดใหม่ข้ามการเขียนเมื่อไม่มี user id จริง
--                          จึงไม่มีช่วงที่ผู้ใช้เจอ error
--
-- ต้องรัน 03_auth_core.sql ให้ผ่านก่อน
-- ============================================================================


-- ── ขั้นที่ 1 · ตรวจแถวกำพร้าก่อนแตะ constraint (READ-ONLY) ─────────────────
-- ความเสี่ยงที่แผนระบุไว้: แถวข้อมูลกำพร้าทำให้ใส่ foreign key ไม่ได้
-- ต้องได้ 0 ทั้งสองคอลัมน์ก่อนไปต่อ
SELECT
  count(*)                                                      AS total_rows,
  count(*) FILTER (
    WHERE staff_id IS NOT NULL
      AND staff_id NOT IN (SELECT id FROM auth.users)
  )                                                             AS orphan_staff_id,
  count(*) FILTER (WHERE planning_id IS NULL OR planning_id = '') AS empty_planning_id
FROM public.progress_updates;

-- ถ้า orphan_staff_id > 0 ให้ดูว่าเป็นแถวไหนก่อนตัดสินใจ
-- (อย่าลบทิ้งทันที — ตารางนี้เป็นประวัติการทำงาน)
SELECT id, planning_id, staff_id, testing_percent, created_at
FROM public.progress_updates
WHERE staff_id IS NOT NULL
  AND staff_id NOT IN (SELECT id FROM auth.users)
ORDER BY created_at DESC
LIMIT 50;


-- ── ขั้นที่ 2 · เพิ่มคอลัมน์ชื่อคนบันทึก ────────────────────────────────────
BEGIN;

-- เก็บชื่อซ้ำไว้ในแถวโดยเจตนา ไม่ join กับ profiles ตอนอ่าน เพราะ:
--   • ตารางนี้เป็น log แบบเขียนต่อท้ายอย่างเดียว — ชื่อที่ต้องการคือชื่อ
--     ณ เวลาที่บันทึก ไม่ใช่ชื่อปัจจุบัน
--   • staff_id เป็น ON DELETE SET NULL — ถ้าลบ user ทิ้ง ประวัติต้องยังอ่านได้ว่าใครทำ
--   • ไม่ต้อง join ทำให้ policy ของ progress_updates ไม่ต้องพึ่ง policy ของ profiles
ALTER TABLE public.progress_updates
  ADD COLUMN IF NOT EXISTS staff_name TEXT;

-- เติมย้อนหลังให้แถวที่ยังมี staff_id ใช้งานได้
UPDATE public.progress_updates pu
SET staff_name = COALESCE(p.full_name, p.email, pu.staff_id::text)
FROM public.profiles p
WHERE p.id = pu.staff_id
  AND pu.staff_name IS NULL;

COMMIT;


-- ── ขั้นที่ 3 · ตรวจผล ──────────────────────────────────────────────────────
-- planning_id ต้องเป็น text (03 แปลงไว้แล้ว) และ staff_name ต้องมี
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'progress_updates'
  AND column_name IN ('planning_id', 'staff_id', 'staff_name')
ORDER BY column_name;

-- policy ที่บังคับตัวตนต้องอยู่ครบ
SELECT policyname, cmd, roles, with_check
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'progress_updates'
ORDER BY policyname;
