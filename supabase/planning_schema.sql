-- ============================================================
--  WorkloadIQ — Planning Projects Table
--  รันใน Supabase Dashboard → SQL Editor → New Query
-- ============================================================

create table if not exists planning_projects (
  id               text primary key,          -- CSV column "ID" (unique key for upsert)
  iteration        text,
  project_name     text not null,
  item_type        text,
  feature          text,
  tags             text,
  status           text,
  test_lead        text,                      -- mapped from CSV "Test Buddy"
  priority         text,
  tester           text,
  go_live_date     date,
  uat_date         date,
  testing_percent  numeric,                   -- CSV "Testing (%)"
  tester_flag      text,
  tester_note      text,
  test_estimate_day numeric,                  -- CSV "Test Estimate (day)"
  test_date        date,                      -- calculated: UAT Date - Test Estimate (working days)
  remark_to_pmos   text,
  pm               text,
  ba_note          text,
  quotation_no     text,
  epic_no          text,
  raw_import_data  jsonb,                     -- full original CSV row stored as JSON
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- Auto-update updated_at on every row change
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists planning_projects_updated_at on planning_projects;
create trigger planning_projects_updated_at
  before update on planning_projects
  for each row execute function set_updated_at();

-- RLS
alter table planning_projects enable row level security;

drop policy if exists "allow_all_planning_projects" on planning_projects;
create policy "allow_all_planning_projects" on planning_projects
  for all to anon using (true) with check (true);

-- Indexes for common filter/sort patterns
create index if not exists idx_pp_uat_date      on planning_projects (uat_date);
create index if not exists idx_pp_go_live_date  on planning_projects (go_live_date);
create index if not exists idx_pp_test_date     on planning_projects (test_date);
create index if not exists idx_pp_priority      on planning_projects (priority);
create index if not exists idx_pp_tester        on planning_projects (tester);
create index if not exists idx_pp_test_lead     on planning_projects (test_lead);
create index if not exists idx_pp_iteration     on planning_projects (iteration);
create index if not exists idx_pp_status        on planning_projects (status);
