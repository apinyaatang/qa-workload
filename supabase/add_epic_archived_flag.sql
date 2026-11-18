-- Archieved count + Total (รวม Archieved ไม่รวม Retired) สำหรับ Tester Flag อัตโนมัติ
ALTER TABLE epics
  ADD COLUMN IF NOT EXISTS archived_count            INTEGER DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS items_total_with_archived INTEGER DEFAULT NULL;

-- เพิ่มตัวเลือก Recheck ใน dropdown Tester Flag
INSERT INTO master_tester_flags (value, sort_order) VALUES ('Recheck', 17)
ON CONFLICT (value) DO NOTHING;
