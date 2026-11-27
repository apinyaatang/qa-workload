-- BA ของ Epic = System.AssignedTo ใน ADO (ใช้ Filter / คอลัมน์ BA หน้า Epic)
ALTER TABLE epics ADD COLUMN IF NOT EXISTS ba_name TEXT DEFAULT '';
