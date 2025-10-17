-- =====================================================
-- Phase 2: Authentication Schema
-- =====================================================
-- This migration sets up:
-- 1. Users table linked to auth.users
-- 2. Trigger to auto-create Users record on signup
-- 3. RLS policies for data access control
-- =====================================================

-- Create custom Users table
CREATE TABLE IF NOT EXISTS public."Users" (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  first_name TEXT,
  last_name TEXT,
  role TEXT NOT NULL DEFAULT 'Product Manager',
  team_id INTEGER,
  is_manager INTEGER NOT NULL DEFAULT 0, -- 0=user, 1=product_lead, 2=design_lead, 3=vp_product, 4=cto
  status TEXT NOT NULL DEFAULT 'pending', -- pending, approved, rejected
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_email ON public."Users"(email);
CREATE INDEX IF NOT EXISTS idx_users_status ON public."Users"(status);
CREATE INDEX IF NOT EXISTS idx_users_team_id ON public."Users"(team_id);

-- =====================================================
-- Trigger: Auto-create Users record on auth signup
-- =====================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public."Users" (id, email, first_name, last_name)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'first_name',
    NEW.raw_user_meta_data->>'last_name'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =====================================================
-- Updated_at trigger
-- =====================================================
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS users_updated_at ON public."Users";
CREATE TRIGGER users_updated_at
  BEFORE UPDATE ON public."Users"
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- =====================================================
-- Row Level Security (RLS) Policies
-- =====================================================
ALTER TABLE public."Users" ENABLE ROW LEVEL SECURITY;

-- Users can read their own data
DROP POLICY IF EXISTS "Users can view own profile" ON public."Users";
CREATE POLICY "Users can view own profile" ON public."Users"
  FOR SELECT
  USING (auth.uid() = id);

-- Users can update their own profile (except status, is_manager)
DROP POLICY IF EXISTS "Users can update own profile" ON public."Users";
CREATE POLICY "Users can update own profile" ON public."Users"
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id 
    AND status = (SELECT status FROM public."Users" WHERE id = auth.uid())
    AND is_manager = (SELECT is_manager FROM public."Users" WHERE id = auth.uid())
  );

-- Admins (is_manager >= 3) can view all users
DROP POLICY IF EXISTS "Admins can view all users" ON public."Users";
CREATE POLICY "Admins can view all users" ON public."Users"
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public."Users"
      WHERE id = auth.uid() AND is_manager >= 3
    )
  );

-- Admins can update any user
DROP POLICY IF EXISTS "Admins can update users" ON public."Users";
CREATE POLICY "Admins can update users" ON public."Users"
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public."Users"
      WHERE id = auth.uid() AND is_manager >= 3
    )
  );

-- =====================================================
-- Helper function: Check if user is approved
-- =====================================================
CREATE OR REPLACE FUNCTION public.is_user_approved(user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public."Users"
    WHERE id = user_id AND status = 'approved'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- Audit log for user status changes
-- =====================================================
CREATE TABLE IF NOT EXISTS public."User_Status_Audit" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public."Users"(id),
  old_status TEXT,
  new_status TEXT NOT NULL,
  changed_by UUID REFERENCES auth.users(id),
  reason TEXT,
  changed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_status_audit_user_id ON public."User_Status_Audit"(user_id);
CREATE INDEX IF NOT EXISTS idx_user_status_audit_changed_at ON public."User_Status_Audit"(changed_at);

-- Trigger to log status changes
CREATE OR REPLACE FUNCTION public.log_user_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public."User_Status_Audit" (user_id, old_status, new_status, changed_by)
    VALUES (NEW.id, OLD.status, NEW.status, auth.uid());
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS user_status_change_audit ON public."Users";
CREATE TRIGGER user_status_change_audit
  AFTER UPDATE ON public."Users"
  FOR EACH ROW EXECUTE FUNCTION public.log_user_status_change();

-- =====================================================
-- Seed admin user (run after first admin signs up)
-- =====================================================
-- Manual step: After first user signs up via UI, run:
-- UPDATE public."Users" 
-- SET status = 'approved', is_manager = 4 
-- WHERE email = 'admin@company.com';
