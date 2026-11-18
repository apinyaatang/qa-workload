-- ค่า % ล่าสุดเก็บบน epics เพื่อให้หน้าจออ่านได้ทันที
-- testing_percent เดิมถูกเขียนทับด้วยค่าคำนวณ (qa_count / items_total) ทุกครั้งที่ Sync
ALTER TABLE epics
  ADD COLUMN IF NOT EXISTS dev_percent  NUMERIC DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS ba_percent   NUMERIC DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS done_percent NUMERIC DEFAULT NULL;

-- ประวัติ: 1 แถวต่อ Epic ต่อการ Sync 1 ครั้ง เก็บย้อนหลังไม่เกิน 30 วัน
CREATE TABLE IF NOT EXISTS epic_progress (
  id                 BIGSERIAL PRIMARY KEY,
  epic_no            INTEGER     NOT NULL,
  items_total        INTEGER     NOT NULL,
  dev_count          INTEGER     NOT NULL,
  ba_count           INTEGER     NOT NULL,
  qa_count           INTEGER     NOT NULL,
  wait_confirm_count INTEGER     NOT NULL,
  wait_deploy_count  INTEGER     NOT NULL,
  dev_percent        NUMERIC,
  ba_percent         NUMERIC,
  testing_percent    NUMERIC,
  done_percent       NUMERIC,
  synced_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_epic_progress_epic_synced ON epic_progress (epic_no, synced_at DESC);
CREATE INDEX IF NOT EXISTS idx_epic_progress_synced      ON epic_progress (synced_at);

ALTER TABLE epic_progress ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_epic_progress" ON epic_progress;
CREATE POLICY "allow_all_epic_progress" ON epic_progress
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
