-- =====================================================
-- Phase 1: Complete Database Schema
-- =====================================================
-- This migration creates all core tables for the KPI platform
-- Order: Parent tables first, then children with foreign keys
-- All foreign keys use CASCADE for referential integrity
-- =====================================================

-- =====================================================
-- 1. ROLES TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS public."roles" (
  id SERIAL PRIMARY KEY,
  role_name TEXT UNIQUE NOT NULL,
  department TEXT,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_roles_role_name ON public."roles"(role_name);

-- Seed default roles
INSERT INTO public."roles" (role_name, department, description) VALUES
  ('Product Manager', 'Product', 'Manages product development and strategy'),
  ('Product Designer', 'Design', 'Designs user interfaces and experiences'),
  ('Product Lead', 'Product', 'Leads product team and strategy'),
  ('Design Lead', 'Design', 'Leads design team and standards')
ON CONFLICT (role_name) DO NOTHING;

-- =====================================================
-- 2. TEAMS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS public."Teams" (
  id SERIAL PRIMARY KEY,
  team_name TEXT NOT NULL UNIQUE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_teams_team_name ON public."Teams"(team_name);

-- Enable RLS
ALTER TABLE public."Teams" ENABLE ROW LEVEL SECURITY;

-- All authenticated users can view teams
DROP POLICY IF EXISTS "Users can view teams" ON public."Teams";
CREATE POLICY "Users can view teams" ON public."Teams"
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Admins can manage teams
DROP POLICY IF EXISTS "Admins can manage teams" ON public."Teams";
CREATE POLICY "Admins can manage teams" ON public."Teams"
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public."Users"
      WHERE id = auth.uid() AND is_manager >= 3
    )
  );

-- Seed default teams
INSERT INTO public."Teams" (team_name) VALUES
  ('Product Management'),
  ('Design'),
  ('Engineering')
ON CONFLICT (team_name) DO NOTHING;

-- =====================================================
-- 3. ALTER USERS TABLE - Add Team Foreign Key
-- =====================================================
-- Add foreign key constraint to existing Users table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'users_team_id_fkey'
  ) THEN
    ALTER TABLE public."Users"
      ADD CONSTRAINT users_team_id_fkey
      FOREIGN KEY (team_id)
      REFERENCES public."Teams"(id)
      ON DELETE SET NULL;
  END IF;
END $$;

-- =====================================================
-- 4. OKRS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS public."OKRs" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id INTEGER NOT NULL REFERENCES public."roles"(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  quarter INTEGER NOT NULL CHECK (quarter BETWEEN 1 AND 4),
  okr_number INTEGER NOT NULL,
  okr_title TEXT NOT NULL,
  description TEXT,
  weight INTEGER NOT NULL CHECK (weight BETWEEN 0 AND 100),
  type INTEGER NOT NULL DEFAULT 1, -- 0=Qualitative, 1=Quantitative
  status INTEGER NOT NULL DEFAULT 1, -- 0=draft, 1=active, 2=completed, 3=archived
  tags TEXT,
  deadline_at TIMESTAMPTZ NOT NULL,
  deadline_missed BOOLEAN NOT NULL DEFAULT false,
  completed_date TIMESTAMPTZ,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for OKRs
CREATE INDEX IF NOT EXISTS idx_okrs_role_year_quarter ON public."OKRs"(role_id, year, quarter);
CREATE INDEX IF NOT EXISTS idx_okrs_status ON public."OKRs"(status);
CREATE INDEX IF NOT EXISTS idx_okrs_deadline_missed ON public."OKRs"(deadline_missed);
CREATE INDEX IF NOT EXISTS idx_okrs_created_by ON public."OKRs"(created_by);

-- Unique constraint: prevent duplicate OKR numbers per role/year/quarter
CREATE UNIQUE INDEX IF NOT EXISTS idx_okrs_unique_number
  ON public."OKRs"(role_id, year, quarter, okr_number) 
  WHERE status != 3; -- Exclude archived

-- Enable RLS
ALTER TABLE public."OKRs" ENABLE ROW LEVEL SECURITY;

-- All authenticated users can view active OKRs for their role
DROP POLICY IF EXISTS "Users can view OKRs for their role" ON public."OKRs";
CREATE POLICY "Users can view OKRs for their role" ON public."OKRs"
  FOR SELECT
  USING (
    auth.uid() IS NOT NULL AND (
      -- User can see OKRs for their role
      role_id IN (
        SELECT r.id FROM public."roles" r
        JOIN public."Users" u ON u.role = r.role_name
        WHERE u.id = auth.uid()
      )
      -- OR user is admin
      OR EXISTS (
        SELECT 1 FROM public."Users"
        WHERE id = auth.uid() AND is_manager >= 3
      )
    )
  );

-- Only admins can create/modify OKRs
DROP POLICY IF EXISTS "Admins can manage OKRs" ON public."OKRs";
CREATE POLICY "Admins can manage OKRs" ON public."OKRs"
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public."Users"
      WHERE id = auth.uid() AND is_manager >= 3
    )
  );

-- Updated_at trigger for OKRs
DROP TRIGGER IF EXISTS okrs_updated_at ON public."OKRs";
CREATE TRIGGER okrs_updated_at
  BEFORE UPDATE ON public."OKRs"
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- =====================================================
-- 5. KPI_COMPONENTS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS public."KPI_Components" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  okr_id UUID NOT NULL REFERENCES public."OKRs"(id) ON DELETE CASCADE,
  component_name TEXT NOT NULL,
  component_weight INTEGER NOT NULL CHECK (component_weight BETWEEN 0 AND 100),
  measurement_type INTEGER NOT NULL, -- 0=count, 1=percentage, 2=score, 3=boolean
  target_value DECIMAL(5,2) NOT NULL,
  unit TEXT NOT NULL,
  description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  deadline_at TIMESTAMPTZ NOT NULL,
  deadline_missed BOOLEAN NOT NULL DEFAULT false,
  completed_date TIMESTAMPTZ,
  counting_method INTEGER NOT NULL DEFAULT 0, -- 0=cumulative, 1=individual, 2=per_period
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for KPI_Components
CREATE INDEX IF NOT EXISTS idx_kpi_components_okr_id ON public."KPI_Components"(okr_id);
CREATE INDEX IF NOT EXISTS idx_kpi_components_sort_order ON public."KPI_Components"(okr_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_kpi_components_deadline_missed ON public."KPI_Components"(deadline_missed);

-- Enable RLS
ALTER TABLE public."KPI_Components" ENABLE ROW LEVEL SECURITY;

-- Users can view components for OKRs they can see
DROP POLICY IF EXISTS "Users can view KPI components" ON public."KPI_Components";
CREATE POLICY "Users can view KPI components" ON public."KPI_Components"
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public."OKRs"
      WHERE id = okr_id AND (
        role_id IN (
          SELECT r.id FROM public."roles" r
          JOIN public."Users" u ON u.role = r.role_name
          WHERE u.id = auth.uid()
        )
        OR EXISTS (
          SELECT 1 FROM public."Users"
          WHERE id = auth.uid() AND is_manager >= 3
        )
      )
    )
  );

-- Only admins can manage components
DROP POLICY IF EXISTS "Admins can manage KPI components" ON public."KPI_Components";
CREATE POLICY "Admins can manage KPI components" ON public."KPI_Components"
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public."Users"
      WHERE id = auth.uid() AND is_manager >= 3
    )
  );

-- =====================================================
-- 6. USER_KPI_DATA TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS public."User_KPI_Data" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  okr_id UUID NOT NULL REFERENCES public."OKRs"(id) ON DELETE CASCADE,
  kpi_component_id UUID NOT NULL REFERENCES public."KPI_Components"(id) ON DELETE CASCADE,
  value DECIMAL(5,2) NOT NULL,
  numerator DECIMAL(5,2),
  denominator DECIMAL(5,2),
  version_number INTEGER NOT NULL DEFAULT 1,
  data_source INTEGER NOT NULL DEFAULT 0, -- 0=manual_log, 1=jotform, 2=auto
  evidence_link TEXT,
  submitted_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status INTEGER NOT NULL DEFAULT 0, -- 0=pending, 1=approved, 2=rejected
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for User_KPI_Data
CREATE INDEX IF NOT EXISTS idx_user_kpi_data_user_id ON public."User_KPI_Data"(user_id);
CREATE INDEX IF NOT EXISTS idx_user_kpi_data_okr_id ON public."User_KPI_Data"(okr_id);
CREATE INDEX IF NOT EXISTS idx_user_kpi_data_kpi_component_id ON public."User_KPI_Data"(kpi_component_id);
CREATE INDEX IF NOT EXISTS idx_user_kpi_data_user_okr ON public."User_KPI_Data"(user_id, okr_id);
CREATE INDEX IF NOT EXISTS idx_user_kpi_data_status ON public."User_KPI_Data"(status);
CREATE INDEX IF NOT EXISTS idx_user_kpi_data_version ON public."User_KPI_Data"(kpi_component_id, user_id, version_number);

-- Enable RLS
ALTER TABLE public."User_KPI_Data" ENABLE ROW LEVEL SECURITY;

-- Users can view their own data
DROP POLICY IF EXISTS "Users can view own KPI data" ON public."User_KPI_Data";
CREATE POLICY "Users can view own KPI data" ON public."User_KPI_Data"
  FOR SELECT
  USING (user_id = auth.uid());

-- Users can insert their own data
DROP POLICY IF EXISTS "Users can insert own KPI data" ON public."User_KPI_Data";
CREATE POLICY "Users can insert own KPI data" ON public."User_KPI_Data"
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Users can update their own pending data
DROP POLICY IF EXISTS "Users can update own pending KPI data" ON public."User_KPI_Data";
CREATE POLICY "Users can update own pending KPI data" ON public."User_KPI_Data"
  FOR UPDATE
  USING (user_id = auth.uid() AND status = 0);

-- Managers can view team member data
DROP POLICY IF EXISTS "Managers can view team KPI data" ON public."User_KPI_Data";
CREATE POLICY "Managers can view team KPI data" ON public."User_KPI_Data"
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public."Users" u1
      JOIN public."Users" u2 ON u1.team_id = u2.team_id
      WHERE u1.id = auth.uid() 
        AND u1.is_manager > 0
        AND u2.id = user_id
    )
    OR EXISTS (
      SELECT 1 FROM public."Users"
      WHERE id = auth.uid() AND is_manager >= 3
    )
  );

-- Managers can update status (approve/reject)
DROP POLICY IF EXISTS "Managers can approve KPI data" ON public."User_KPI_Data";
CREATE POLICY "Managers can approve KPI data" ON public."User_KPI_Data"
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public."Users" u1
      JOIN public."Users" u2 ON u1.team_id = u2.team_id
      WHERE u1.id = auth.uid() 
        AND u1.is_manager > 0
        AND u2.id = user_id
    )
    OR EXISTS (
      SELECT 1 FROM public."Users"
      WHERE id = auth.uid() AND is_manager >= 3
    )
  );

-- Updated_at trigger
DROP TRIGGER IF EXISTS user_kpi_data_updated_at ON public."User_KPI_Data";
CREATE TRIGGER user_kpi_data_updated_at
  BEFORE UPDATE ON public."User_KPI_Data"
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- =====================================================
-- 7. TASKS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS public."Tasks" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kpi_component_id UUID NOT NULL REFERENCES public."KPI_Components"(id) ON DELETE CASCADE,
  user_kpi_data_id UUID NOT NULL REFERENCES public."User_KPI_Data"(id) ON DELETE CASCADE,
  assigned_to UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status INTEGER NOT NULL DEFAULT 0, -- 0=pending, 1=approved, 2=rejected, 3=in_review
  due_date TIMESTAMPTZ NOT NULL,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for Tasks
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON public."Tasks"(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON public."Tasks"(status);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON public."Tasks"(due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_kpi_component_id ON public."Tasks"(kpi_component_id);
CREATE INDEX IF NOT EXISTS idx_tasks_created_by ON public."Tasks"(created_by);

-- Enable RLS
ALTER TABLE public."Tasks" ENABLE ROW LEVEL SECURITY;

-- Task creator can view their tasks
DROP POLICY IF EXISTS "Users can view own tasks" ON public."Tasks";
CREATE POLICY "Users can view own tasks" ON public."Tasks"
  FOR SELECT
  USING (created_by = auth.uid());

-- Assigned managers can view tasks
DROP POLICY IF EXISTS "Assigned managers can view tasks" ON public."Tasks";
CREATE POLICY "Assigned managers can view tasks" ON public."Tasks"
  FOR SELECT
  USING (assigned_to = auth.uid());

-- Managers can update tasks assigned to them
DROP POLICY IF EXISTS "Managers can update assigned tasks" ON public."Tasks";
CREATE POLICY "Managers can update assigned tasks" ON public."Tasks"
  FOR UPDATE
  USING (
    assigned_to = auth.uid() 
    OR EXISTS (
      SELECT 1 FROM public."Users"
      WHERE id = auth.uid() AND is_manager >= 3
    )
  );

-- System can create tasks (via triggers/functions)
DROP POLICY IF EXISTS "Users can create tasks" ON public."Tasks";
CREATE POLICY "Users can create tasks" ON public."Tasks"
  FOR INSERT
  WITH CHECK (created_by = auth.uid());

-- Updated_at trigger
DROP TRIGGER IF EXISTS tasks_updated_at ON public."Tasks";
CREATE TRIGGER tasks_updated_at
  BEFORE UPDATE ON public."Tasks"
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- =====================================================
-- 8. TASK_COLLABORATORS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS public."Task_Collaborators" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public."Tasks"(id) ON DELETE CASCADE,
  collaborator_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  added_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(task_id, collaborator_user_id)
);

-- Indexes for Task_Collaborators
CREATE INDEX IF NOT EXISTS idx_task_collaborators_task_id ON public."Task_Collaborators"(task_id);
CREATE INDEX IF NOT EXISTS idx_task_collaborators_user_id ON public."Task_Collaborators"(collaborator_user_id);

-- Enable RLS
ALTER TABLE public."Task_Collaborators" ENABLE ROW LEVEL SECURITY;

-- Collaborators can view their collaborations
DROP POLICY IF EXISTS "Collaborators can view" ON public."Task_Collaborators";
CREATE POLICY "Collaborators can view" ON public."Task_Collaborators"
  FOR SELECT
  USING (
    collaborator_user_id = auth.uid()
    OR added_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public."Tasks"
      WHERE id = task_id AND (assigned_to = auth.uid() OR created_by = auth.uid())
    )
  );

-- Managers can add collaborators
DROP POLICY IF EXISTS "Managers can add collaborators" ON public."Task_Collaborators";
CREATE POLICY "Managers can add collaborators" ON public."Task_Collaborators"
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public."Users"
      WHERE id = auth.uid() AND is_manager > 0
    )
  );

-- =====================================================
-- 9. COMMENTS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS public."Comments" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL, -- OKR, KPI_Component, Task
  entity_id UUID NOT NULL,
  comment_text TEXT NOT NULL,
  is_rejection_flag BOOLEAN NOT NULL DEFAULT false,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for Comments
CREATE INDEX IF NOT EXISTS idx_comments_entity ON public."Comments"(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_comments_created_by ON public."Comments"(created_by);
CREATE INDEX IF NOT EXISTS idx_comments_is_rejection_flag ON public."Comments"(is_rejection_flag);
CREATE INDEX IF NOT EXISTS idx_comments_created_at ON public."Comments"(created_at DESC);

-- Enable RLS
ALTER TABLE public."Comments" ENABLE ROW LEVEL SECURITY;

-- Users can view comments on entities they can access
DROP POLICY IF EXISTS "Users can view relevant comments" ON public."Comments";
CREATE POLICY "Users can view relevant comments" ON public."Comments"
  FOR SELECT
  USING (
    -- Own comments
    created_by = auth.uid()
    -- OR comments on own tasks
    OR (entity_type = 'Task' AND EXISTS (
      SELECT 1 FROM public."Tasks"
      WHERE id = entity_id::UUID AND (created_by = auth.uid() OR assigned_to = auth.uid())
    ))
    -- OR comments on own KPI data
    OR (entity_type = 'User_KPI_Data' AND EXISTS (
      SELECT 1 FROM public."User_KPI_Data"
      WHERE id = entity_id::UUID AND user_id = auth.uid()
    ))
    -- OR manager viewing team comments
    OR EXISTS (
      SELECT 1 FROM public."Users"
      WHERE id = auth.uid() AND is_manager > 0
    )
  );

-- Users can create comments
DROP POLICY IF EXISTS "Users can create comments" ON public."Comments";
CREATE POLICY "Users can create comments" ON public."Comments"
  FOR INSERT
  WITH CHECK (created_by = auth.uid());

-- =====================================================
-- 10. AUDIT_LOG TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS public."Audit_Log" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  action TEXT NOT NULL, -- created, updated, deleted, approved, rejected, reassigned
  old_value JSONB,
  new_value JSONB,
  changed_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  changed_at TIMESTAMPTZ DEFAULT NOW(),
  reason TEXT
);

-- Indexes for Audit_Log
CREATE INDEX IF NOT EXISTS idx_audit_log_entity ON public."Audit_Log"(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_changed_by ON public."Audit_Log"(changed_by);
CREATE INDEX IF NOT EXISTS idx_audit_log_changed_at ON public."Audit_Log"(changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_action ON public."Audit_Log"(action);

-- Enable RLS
ALTER TABLE public."Audit_Log" ENABLE ROW LEVEL SECURITY;

-- Users can view audit logs for their own actions
DROP POLICY IF EXISTS "Users can view own audit logs" ON public."Audit_Log";
CREATE POLICY "Users can view own audit logs" ON public."Audit_Log"
  FOR SELECT
  USING (changed_by = auth.uid());

-- Admins can view all audit logs
DROP POLICY IF EXISTS "Admins can view all audit logs" ON public."Audit_Log";
CREATE POLICY "Admins can view all audit logs" ON public."Audit_Log"
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public."Users"
      WHERE id = auth.uid() AND is_manager >= 3
    )
  );

-- System can insert audit logs
DROP POLICY IF EXISTS "System can insert audit logs" ON public."Audit_Log";
CREATE POLICY "System can insert audit logs" ON public."Audit_Log"
  FOR INSERT
  WITH CHECK (true); -- Allow inserts from triggers/functions

-- =====================================================
-- 11. DEADLINE_CONFIG TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS public."Deadline_Config" (
  id SERIAL PRIMARY KEY,
  role_id INTEGER REFERENCES public."roles"(id) ON DELETE CASCADE,
  year INTEGER,
  quarter INTEGER CHECK (quarter BETWEEN 1 AND 4),
  days_after_quarter_end INTEGER NOT NULL DEFAULT 14,
  deadline_exceeded_action INTEGER NOT NULL DEFAULT 0, -- 0=stay_pending, 1=auto_reject, 2=auto_approve
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for Deadline_Config
CREATE INDEX IF NOT EXISTS idx_deadline_config_lookup ON public."Deadline_Config"(role_id, year, quarter);

-- Enable RLS
ALTER TABLE public."Deadline_Config" ENABLE ROW LEVEL SECURITY;

-- All authenticated users can view deadline config
DROP POLICY IF EXISTS "Users can view deadline config" ON public."Deadline_Config";
CREATE POLICY "Users can view deadline config" ON public."Deadline_Config"
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Only admins can manage deadline config
DROP POLICY IF EXISTS "Admins can manage deadline config" ON public."Deadline_Config";
CREATE POLICY "Admins can manage deadline config" ON public."Deadline_Config"
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public."Users"
      WHERE id = auth.uid() AND is_manager >= 3
    )
  );

-- Seed global default deadline config
INSERT INTO public."Deadline_Config" (role_id, year, quarter, days_after_quarter_end, deadline_exceeded_action)
VALUES (NULL, NULL, NULL, 14, 0)
ON CONFLICT DO NOTHING;

-- =====================================================
-- HELPER FUNCTIONS
-- =====================================================

-- Function to calculate quarter end date
CREATE OR REPLACE FUNCTION public.get_quarter_end_date(p_year INTEGER, p_quarter INTEGER)
RETURNS DATE AS $$
BEGIN
  RETURN DATE(p_year || '-' || (p_quarter * 3) || '-01') + INTERVAL '3 months' - INTERVAL '1 day';
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to calculate deadline from quarter
CREATE OR REPLACE FUNCTION public.calculate_deadline(p_year INTEGER, p_quarter INTEGER, p_role_id INTEGER DEFAULT NULL)
RETURNS TIMESTAMPTZ AS $$
DECLARE
  v_quarter_end DATE;
  v_days_after INTEGER;
BEGIN
  -- Get quarter end date
  v_quarter_end := public.get_quarter_end_date(p_year, p_quarter);
  
  -- Get days_after from config (role-specific or global)
  SELECT days_after_quarter_end INTO v_days_after
  FROM public."Deadline_Config"
  WHERE (role_id = p_role_id OR (role_id IS NULL AND p_role_id IS NULL))
    AND (year = p_year OR year IS NULL)
    AND (quarter = p_quarter OR quarter IS NULL)
  ORDER BY 
    CASE WHEN role_id IS NOT NULL THEN 3 ELSE 0 END +
    CASE WHEN year IS NOT NULL THEN 2 ELSE 0 END +
    CASE WHEN quarter IS NOT NULL THEN 1 ELSE 0 END DESC
  LIMIT 1;
  
  -- Default to 14 days if no config found
  v_days_after := COALESCE(v_days_after, 14);
  
  RETURN (v_quarter_end + INTERVAL '1 day' * v_days_after + INTERVAL '23 hours 59 minutes 59 seconds')::TIMESTAMPTZ;
END;
$$ LANGUAGE plpgsql STABLE;

-- =====================================================
-- AUDIT TRIGGERS
-- =====================================================

-- Generic audit log trigger function
CREATE OR REPLACE FUNCTION public.log_audit_trail()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public."Audit_Log" (entity_type, entity_id, action, new_value, changed_by)
    VALUES (TG_TABLE_NAME, NEW.id::TEXT, 'created', to_jsonb(NEW), auth.uid());
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public."Audit_Log" (entity_type, entity_id, action, old_value, new_value, changed_by)
    VALUES (TG_TABLE_NAME, NEW.id::TEXT, 'updated', to_jsonb(OLD), to_jsonb(NEW), auth.uid());
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public."Audit_Log" (entity_type, entity_id, action, old_value, changed_by)
    VALUES (TG_TABLE_NAME, OLD.id::TEXT, 'deleted', to_jsonb(OLD), auth.uid());
    RETURN OLD;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Apply audit triggers to key tables
DROP TRIGGER IF EXISTS audit_okrs ON public."OKRs";
CREATE TRIGGER audit_okrs
  AFTER INSERT OR UPDATE OR DELETE ON public."OKRs"
  FOR EACH ROW EXECUTE FUNCTION public.log_audit_trail();

DROP TRIGGER IF EXISTS audit_kpi_components ON public."KPI_Components";
CREATE TRIGGER audit_kpi_components
  AFTER INSERT OR UPDATE OR DELETE ON public."KPI_Components"
  FOR EACH ROW EXECUTE FUNCTION public.log_audit_trail();

DROP TRIGGER IF EXISTS audit_user_kpi_data ON public."User_KPI_Data";
CREATE TRIGGER audit_user_kpi_data
  AFTER INSERT OR UPDATE OR DELETE ON public."User_KPI_Data"
  FOR EACH ROW EXECUTE FUNCTION public.log_audit_trail();

DROP TRIGGER IF EXISTS audit_tasks ON public."Tasks";
CREATE TRIGGER audit_tasks
  AFTER INSERT OR UPDATE OR DELETE ON public."Tasks"
  FOR EACH ROW EXECUTE FUNCTION public.log_audit_trail();

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================
-- Run these to verify migration success:

-- Check all tables exist
SELECT 
  schemaname, 
  tablename 
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN (
    'roles', 'Teams', 'Users', 'OKRs', 'KPI_Components', 
    'User_KPI_Data', 'Tasks', 'Task_Collaborators', 
    'Comments', 'Audit_Log', 'Deadline_Config', 'User_Status_Audit'
  )
ORDER BY tablename;

-- Check foreign key constraints
SELECT
  conname AS constraint_name,
  conrelid::regclass AS table_name,
  confrelid::regclass AS referenced_table,
  pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE contype = 'f'
  AND connamespace = 'public'::regnamespace
ORDER BY conrelid::regclass::text;

-- Check RLS policies
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- Check indexes
SELECT 
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN (
    'roles', 'Teams', 'Users', 'OKRs', 'KPI_Components',
    'User_KPI_Data', 'Tasks', 'Task_Collaborators',
    'Comments', 'Audit_Log', 'Deadline_Config'
  )
ORDER BY tablename, indexname;
