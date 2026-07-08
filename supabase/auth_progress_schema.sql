-- ============================================================
-- WorkloadIQ — Auth & Progress Schema
-- Run this in Supabase SQL Editor after enabling Auth
-- ============================================================

-- ──────────────────────────────────────────────────────────────
-- 1. PROFILES TABLE (mirrors auth.users, stores role)
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.profiles (
  id        UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email     TEXT,
  full_name TEXT,
  role      TEXT NOT NULL DEFAULT 'staff' CHECK (role IN ('admin', 'staff')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Auto-create profile on user sign-up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    COALESCE(NEW.raw_user_meta_data->>'role', 'staff')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_updated_at ON public.profiles;
CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ──────────────────────────────────────────────────────────────
-- 2. STAFF ASSIGNMENTS TABLE
--    Maps a Supabase user (staff_id) → tester_name used in planning_projects
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.staff_assignments (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tester_name  TEXT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (staff_id, tester_name)
);

-- ──────────────────────────────────────────────────────────────
-- 3. ADO PROJECT CONFIG TABLE
--    Stores per-project ADO org/project/tag overrides
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ado_project_config (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  planning_id     UUID NOT NULL,  -- references planning_projects.id
  ado_org_url     TEXT NOT NULL,  -- e.g. https://dev.azure.com/myorg
  ado_project     TEXT NOT NULL,
  ado_tag         TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (planning_id)
);

DROP TRIGGER IF EXISTS ado_project_config_updated_at ON public.ado_project_config;
CREATE TRIGGER ado_project_config_updated_at
  BEFORE UPDATE ON public.ado_project_config
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ──────────────────────────────────────────────────────────────
-- 4. PROGRESS UPDATES TABLE
--    Audit log of every progress submission by staff
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.progress_updates (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  planning_id      UUID NOT NULL,  -- references planning_projects.id
  staff_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  testing_percent  INT NOT NULL CHECK (testing_percent BETWEEN 0 AND 100),
  comment          TEXT NOT NULL DEFAULT '',
  ado_snapshot     JSONB,          -- { "Active": 5, "Closed": 12, ... }
  sent_to_teams    BOOLEAN NOT NULL DEFAULT FALSE,
  teams_sent_at    TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast lookup by planning_id
CREATE INDEX IF NOT EXISTS idx_progress_updates_planning_id
  ON public.progress_updates (planning_id, created_at DESC);

-- ──────────────────────────────────────────────────────────────
-- 5. ROW LEVEL SECURITY POLICIES
-- ──────────────────────────────────────────────────────────────

-- Enable RLS
ALTER TABLE public.profiles           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_assignments  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ado_project_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.progress_updates   ENABLE ROW LEVEL SECURITY;

-- ── profiles ──────────────────────────────────────────────────

-- Any authenticated user can read their own profile
DROP POLICY IF EXISTS "profiles: own read"   ON public.profiles;
CREATE POLICY "profiles: own read"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

-- Admins can read all profiles
DROP POLICY IF EXISTS "profiles: admin read all" ON public.profiles;
CREATE POLICY "profiles: admin read all"
  ON public.profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- Only admins can update roles
DROP POLICY IF EXISTS "profiles: admin update" ON public.profiles;
CREATE POLICY "profiles: admin update"
  ON public.profiles FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- ── staff_assignments ──────────────────────────────────────────

-- Staff can read their own assignments
DROP POLICY IF EXISTS "staff_assignments: own read" ON public.staff_assignments;
CREATE POLICY "staff_assignments: own read"
  ON public.staff_assignments FOR SELECT
  USING (auth.uid() = staff_id);

-- Admins can read all assignments
DROP POLICY IF EXISTS "staff_assignments: admin read all" ON public.staff_assignments;
CREATE POLICY "staff_assignments: admin read all"
  ON public.staff_assignments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- Only admins can insert/update/delete assignments
DROP POLICY IF EXISTS "staff_assignments: admin write" ON public.staff_assignments;
CREATE POLICY "staff_assignments: admin write"
  ON public.staff_assignments FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- ── ado_project_config ────────────────────────────────────────

-- All authenticated users can read ADO config
DROP POLICY IF EXISTS "ado_project_config: auth read" ON public.ado_project_config;
CREATE POLICY "ado_project_config: auth read"
  ON public.ado_project_config FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Only admins can write ADO config
DROP POLICY IF EXISTS "ado_project_config: admin write" ON public.ado_project_config;
CREATE POLICY "ado_project_config: admin write"
  ON public.ado_project_config FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- ── progress_updates ──────────────────────────────────────────

-- Staff can read their own progress updates
DROP POLICY IF EXISTS "progress_updates: own read" ON public.progress_updates;
CREATE POLICY "progress_updates: own read"
  ON public.progress_updates FOR SELECT
  USING (auth.uid() = staff_id);

-- Admins can read all progress updates
DROP POLICY IF EXISTS "progress_updates: admin read all" ON public.progress_updates;
CREATE POLICY "progress_updates: admin read all"
  ON public.progress_updates FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- Any authenticated user can insert their own progress update
DROP POLICY IF EXISTS "progress_updates: auth insert" ON public.progress_updates;
CREATE POLICY "progress_updates: auth insert"
  ON public.progress_updates FOR INSERT
  WITH CHECK (auth.uid() = staff_id);

-- Staff cannot update/delete past entries (immutable audit log)
-- Admins can update if needed
DROP POLICY IF EXISTS "progress_updates: admin update" ON public.progress_updates;
CREATE POLICY "progress_updates: admin update"
  ON public.progress_updates FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );
