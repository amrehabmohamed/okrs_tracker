-- =====================================================
-- Phase 4 Test Data Seed
-- =====================================================
-- Creates test user, OKRs, and KPI components for testing

-- 1. Create test user in Users table
-- First create in Supabase Studio Auth: test@example.com / Test123!@#
DO $$
DECLARE
  v_user_id UUID;
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'test@example.com';
  
  IF v_user_id IS NULL THEN
    RAISE NOTICE 'Create user test@example.com in Supabase Studio Auth first';
  ELSE
    INSERT INTO public."Users" (id, email, first_name, last_name, role, team_id, is_manager, status)
    VALUES (v_user_id, 'test@example.com', 'Test', 'User', 'Product Manager', 1, 0, 'approved')
    ON CONFLICT (id) DO UPDATE SET status = 'approved';
    
    RAISE NOTICE 'User created: %', v_user_id;
  END IF;
END $$;

-- 2. Create test OKRs
INSERT INTO public."OKRs" (role_id, year, quarter, okr_number, okr_title, weight, type, status, deadline_at, created_by)
VALUES 
  (1, 2025, 4, 1, 'Discovery & Customer Alignment', 25, 1, 1, '2025-12-31 23:59:59', (SELECT id FROM auth.users WHERE email = 'test@example.com')),
  (1, 2025, 4, 2, 'Product Quality', 25, 1, 1, '2025-12-31 23:59:59', (SELECT id FROM auth.users WHERE email = 'test@example.com'))
ON CONFLICT DO NOTHING;

-- 3. Create KPI Components (one of each measurement type)
DO $$
DECLARE
  v_okr1_id UUID;
  v_okr2_id UUID;
BEGIN
  SELECT id INTO v_okr1_id FROM public."OKRs" WHERE okr_number = 1 AND year = 2025 AND quarter = 4 AND role_id = 1;
  SELECT id INTO v_okr2_id FROM public."OKRs" WHERE okr_number = 2 AND year = 2025 AND quarter = 4 AND role_id = 1;
  
  INSERT INTO public."KPI_Components" (okr_id, component_name, component_weight, measurement_type, target_value, unit, sort_order, deadline_at, counting_method)
  VALUES 
    (v_okr1_id, 'Conduct customer interviews', 40, 0, 5.00, 'interviews', 1, '2025-12-31 23:59:59', 0),
    (v_okr1_id, 'Complete PRDs with all elements', 35, 1, 80.00, '%', 2, '2025-12-31 23:59:59', 0),
    (v_okr2_id, 'Maintain collaboration score', 50, 2, 3.50, 'rating', 1, '2025-12-31 23:59:59', 0),
    (v_okr2_id, 'All projects with stakeholder sign-off', 50, 3, 1.00, 'completed', 2, '2025-12-31 23:59:59', 0);
END $$;

-- 4. Verify
SELECT 'Users' as table_name, COUNT(*) FROM public."Users" WHERE email = 'test@example.com'
UNION ALL
SELECT 'OKRs', COUNT(*) FROM public."OKRs" WHERE year = 2025 AND quarter = 4 AND role_id = 1
UNION ALL
SELECT 'KPI_Components', COUNT(*) FROM public."KPI_Components" 
WHERE okr_id IN (SELECT id FROM public."OKRs" WHERE year = 2025 AND quarter = 4 AND role_id = 1);

-- 5. Get component IDs for API testing
SELECT id, component_name, measurement_type FROM public."KPI_Components"
WHERE okr_id IN (SELECT id FROM public."OKRs" WHERE year = 2025 AND quarter = 4 AND role_id = 1)
ORDER BY measurement_type;
