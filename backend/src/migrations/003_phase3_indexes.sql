-- Phase 3 Database Indexes
-- Run this migration before starting Sprint 2

-- Index for OKR weight validation queries
-- Speeds up: SELECT weight WHERE role_id=X AND year=Y AND quarter=Z AND status!=3
CREATE INDEX IF NOT EXISTS idx_okrs_validation 
ON okrs (role_id, year, quarter, status);

-- Index for Component weight validation queries  
-- Speeds up: SELECT component_weight WHERE okr_id=X
CREATE INDEX IF NOT EXISTS idx_components_validation
ON kpi_components (okr_id);

-- Unique constraint to prevent duplicate OKR numbers in same quarter
-- Prevents race condition where two admins create OKR #1 simultaneously
CREATE UNIQUE INDEX IF NOT EXISTS idx_okrs_unique_number
ON "OKRs" (role_id, year, quarter, okr_number) 
WHERE status != 3; -- Exclude archived OKRs from constraint

-- Index for audit log queries by entity
CREATE INDEX IF NOT EXISTS idx_audit_entity
ON audit_log (entity_type, entity_id, changed_at DESC);

-- Index for audit log queries by user
CREATE INDEX IF NOT EXISTS idx_audit_user
ON audit_log (changed_by, changed_at DESC);

-- Verify indexes were created
SELECT 
  schemaname, 
  tablename, 
  indexname 
FROM pg_indexes 
WHERE tablename IN ('okrs', 'kpi_components', 'audit_log')
ORDER BY tablename, indexname;
