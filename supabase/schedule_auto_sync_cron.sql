-- ตัวปลุก Auto Sync ADO → Supabase ที่ตรงเวลา (แทน GitHub schedule ที่ดีเลย์/ข้ามรอบ)
-- Supabase pg_cron ยิง GitHub API สั่ง workflow "auto-sync.yml" รันทุกวัน 08:00 เวลาไทย
-- pg_cron ใช้เวลา UTC: '0 1 * * *' = 01:00 UTC = 08:00 Bangkok (sync ใช้ ~7 นาที เสร็จราว 08:07)
--
-- ขั้นตอน (รันใน Supabase → SQL Editor ทีละส่วน)
-- 1) เปิด extension (หรือเปิดที่ Database → Extensions: pg_cron, pg_net)
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- 2) เก็บ GitHub token ไว้ใน Vault (แทน <GITHUB_TOKEN> ด้วย token จริง — รันครั้งเดียว, อย่า commit token)
--    Token: GitHub → Settings → Developer settings → Fine-grained tokens
--           Repository access = Only qa-workload, Permissions → Actions = Read and write
-- select vault.create_secret('<GITHUB_TOKEN>', 'github_dispatch_token');

-- 3) ตั้งตารางเวลา (ถ้ารันซ้ำ จะอัปเดต job ชื่อเดิม)
select cron.schedule(
  'ado-auto-sync-0800',
  '0 1 * * *',
  $$
  select net.http_post(
    url     := 'https://api.github.com/repos/apinyaatang/qa-workload/actions/workflows/auto-sync.yml/dispatches',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'github_dispatch_token'),
      'Accept', 'application/vnd.github+json',
      'User-Agent', 'qa-workload-cron',
      'Content-Type', 'application/json'
    ),
    body    := '{"ref":"main"}'::jsonb
  );
  $$
);

-- ตรวจสอบ
-- select jobid, jobname, schedule, active from cron.job;
-- select status, start_time, return_message from cron.job_run_details order by start_time desc limit 5;
-- select status_code, content, created from net._http_response order by created desc limit 5;  -- 204 = GitHub รับคำสั่งแล้ว
--
-- ทดสอบยิงทันที (ไม่ต้องรอ 08:00): รัน block select net.http_post(...) ด้านบนเดี่ยวๆ แล้วดูที่ GitHub → Actions
-- ยกเลิก: select cron.unschedule('ado-auto-sync-0800');
