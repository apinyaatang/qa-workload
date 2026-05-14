-- ============================================================
--  WorkloadIQ — Supabase Schema
--  รันใน Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- ── Employees ─────────────────────────────────────────────
create table if not exists employees (
  id          text primary key,
  first_name  text not null,
  last_name   text not null,
  department  text not null,
  position    text not null,
  skills      text[] not null default '{}',
  start_date  date not null,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

-- ── Projects ──────────────────────────────────────────────
create table if not exists projects (
  id          text primary key,
  code        text not null unique,
  name        text not null,
  description text,
  department  text not null,
  owner_id    text references employees(id) on delete set null,
  start_date  date not null,
  end_date    date,
  status      text not null default 'Active'
              check (status in ('Active', 'Inactive', 'Completed')),
  budget      numeric,
  created_at  timestamptz not null default now()
);

-- ── Tasks ─────────────────────────────────────────────────
create table if not exists tasks (
  id                  text primary key,
  name                text not null,
  assignee_ids        text[] not null default '{}',
  estimated_hours     numeric not null check (estimated_hours > 0),
  deadline            date not null,
  task_type           text not null check (task_type in ('Planned', 'Adhoc')),
  source              text not null check (source in ('Excel/GSheet', 'Azure DevOps')),
  status              text not null default 'Pending'
                      check (status in ('Pending', 'In-Progress', 'Done', 'Cancelled')),
  period_start        date not null,
  period_end          date not null,
  description         text,
  azure_work_item_id  text,
  created_at          timestamptz not null default now()
);

-- ── Leave Records ──────────────────────────────────────────
create table if not exists leave_records (
  id           text primary key,
  employee_id  text not null references employees(id) on delete cascade,
  date         date not null,
  leave_type   text not null check (leave_type in ('annual','sick','personal','maternity','other')),
  status       text not null default 'pending'
               check (status in ('pending','approved','rejected')),
  note         text,
  created_at   timestamptz not null default now()
);

-- ── Public Holidays ────────────────────────────────────────
create table if not exists public_holidays (
  id          text primary key,
  date        date not null unique,
  name        text not null,
  created_at  timestamptz not null default now()
);

-- ── Import Sessions ────────────────────────────────────────
create table if not exists import_sessions (
  id               text primary key,
  file_name        text not null,
  imported_at      timestamptz not null,
  import_status    text not null check (import_status in ('success','error','partial')),
  total_rows       integer not null,
  success_rows     integer not null,
  error_rows       integer not null,
  rows             jsonb not null default '[]',
  applied_to_tasks boolean not null default false,
  created_at       timestamptz not null default now()
);

-- ── Row Level Security (เปิดไว้ แต่ allow all สำหรับ anon) ──
alter table employees       enable row level security;
alter table projects        enable row level security;
alter table tasks           enable row level security;
alter table leave_records   enable row level security;
alter table public_holidays enable row level security;
alter table import_sessions enable row level security;

-- Policy: anon key อ่าน-เขียน-แก้-ลบได้ทั้งหมด
-- (ปรับเป็น authenticated เมื่อเพิ่ม Auth ภายหลัง)
do $$
declare t text;
begin
  foreach t in array array['employees','projects','tasks','leave_records','public_holidays','import_sessions']
  loop
    execute format('
      create policy "allow_all_%s" on %s
      for all to anon using (true) with check (true);
    ', t, t);
  end loop;
end $$;
