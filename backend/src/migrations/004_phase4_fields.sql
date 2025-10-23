-- =====================================================
-- Phase 4: Data Submission & Versioning - Additional Fields
-- =====================================================
-- This migration adds fields needed for Phase 4 submissions
-- - notes: Optional user notes for submissions
-- - response_count: Number of responses (for score forms in Sprint 4.3)
-- - Unique constraint on version numbers
-- =====================================================

-- Add notes column for user comments on submissions
ALTER TABLE public."User_KPI_Data"
ADD COLUMN IF NOT EXISTS notes TEXT;

-- Add response_count for score-based measurements (Sprint 4.3)
ALTER TABLE public."User_KPI_Data"
ADD COLUMN IF NOT EXISTS response_count INTEGER;

-- Add unique constraint to prevent duplicate version numbers
-- This ensures each (user, component, version) combination is unique
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'user_kpi_data_unique_version'
  ) THEN
    ALTER TABLE public."User_KPI_Data"
      ADD CONSTRAINT user_kpi_data_unique_version
      UNIQUE (user_id, kpi_component_id, version_number);
  END IF;
END $$;

-- Create index for faster version lookup
CREATE INDEX IF NOT EXISTS idx_user_kpi_data_version_lookup
  ON public."User_KPI_Data"(user_id, kpi_component_id, version_number DESC);

-- Add comment for documentation
COMMENT ON COLUMN public."User_KPI_Data".notes IS 'Optional user notes explaining the submission (max 500 chars enforced at application level)';
COMMENT ON COLUMN public."User_KPI_Data".response_count IS 'Number of survey responses for score-based measurements (measurement_type=2)';

-- =====================================================
-- VERIFICATION
-- =====================================================
-- Verify columns were added
SELECT
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'User_KPI_Data'
  AND column_name IN ('notes', 'response_count')
ORDER BY column_name;

-- Verify unique constraint exists
SELECT
  conname AS constraint_name,
  pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conname = 'user_kpi_data_unique_version';
