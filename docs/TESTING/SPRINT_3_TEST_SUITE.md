# Sprint 3 Automated Testing Guide

Run these tests in order. All should pass before Sprint 4.

---

## Test 1: Database Schema Validation

```sql
-- Verify status column exists with correct default
SELECT 
  column_name, 
  data_type, 
  column_default, 
  is_nullable
FROM information_schema.columns
WHERE table_name = 'kpi_components' 
AND column_name = 'status';

-- Expected: data_type=integer, column_default=0, is_nullable=NO
```

```sql
-- Verify index exists
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'kpi_components' 
AND indexname = 'idx_kpi_components_okr_status';

-- Expected: 1 row with CREATE INDEX statement
```

---

## Test 2: Weight Validation Logic

```sql
-- Test 2a: Verify all OKRs have components summing to 100%
SELECT 
  o.okr_number,
  o.okr_title,
  SUM(kc.component_weight) as total_weight,
  COUNT(kc.id) as component_count,
  CASE 
    WHEN SUM(kc.component_weight) = 100 THEN '✅ PASS'
    ELSE '❌ FAIL'
  END as validation_status
FROM okrs o
LEFT JOIN kpi_components kc ON o.id = kc.okr_id
WHERE o.status != 3 AND kc.status = 0
GROUP BY o.id, o.okr_number, o.okr_title
ORDER BY o.okr_number;

-- Expected: All rows show validation_status = '✅ PASS'
```

```sql
-- Test 2b: Verify archived components excluded from sum
SELECT 
  okr_id,
  COUNT(*) FILTER (WHERE status = 0) as active_count,
  COUNT(*) FILTER (WHERE status = 1) as archived_count,
  SUM(component_weight) FILTER (WHERE status = 0) as active_weight_sum
FROM kpi_components
GROUP BY okr_id;

-- Expected: active_weight_sum = 100 for all OKRs
```

---

## Test 3: Sort Order Assignment

```sql
-- Verify sort_order is sequential per OKR
SELECT 
  okr_id,
  component_name,
  sort_order,
  status
FROM kpi_components
WHERE status = 0
ORDER BY okr_id, sort_order;

-- Expected: Each OKR has sort_order 1, 2, 3... with no gaps
```

---

## Test 4: Deadline Inheritance

```sql
-- Verify components inherit deadline from parent OKR
SELECT 
  o.okr_title,
  o.deadline_at as okr_deadline,
  kc.component_name,
  kc.deadline_at as component_deadline,
  CASE 
    WHEN o.deadline_at = kc.deadline_at THEN '✅ PASS'
    ELSE '❌ FAIL'
  END as deadline_match
FROM okrs o
JOIN kpi_components kc ON o.id = kc.okr_id
WHERE kc.status = 0
ORDER BY o.okr_number, kc.sort_order;

-- Expected: All rows show deadline_match = '✅ PASS'
```

---

## Test 5: Audit Trail Verification

```sql
-- Verify audit logs exist for component operations
SELECT 
  entity_type,
  action,
  COUNT(*) as log_count
FROM audit_log
WHERE entity_type = 'KPI_Component'
GROUP BY entity_type, action
ORDER BY action;

-- Expected: Rows for 'created', potentially 'updated', 'archived'
```

```sql
-- Check recent audit entries have all required fields
SELECT 
  entity_type,
  entity_id,
  action,
  changed_by,
  changed_at,
  CASE 
    WHEN new_value IS NOT NULL THEN '✅ Has new_value'
    ELSE '⚠️ No new_value'
  END as new_value_check
FROM audit_log
WHERE entity_type = 'KPI_Component'
ORDER BY changed_at DESC
LIMIT 5;

-- Expected: All entries have changed_by and new_value
```

---

## Test 6: Soft Delete Verification

```sql
-- Test 6a: Count active vs archived components
SELECT 
  status,
  CASE status 
    WHEN 0 THEN 'Active'
    WHEN 1 THEN 'Archived'
  END as status_label,
  COUNT(*) as count
FROM kpi_components
GROUP BY status
ORDER BY status;

-- Expected: All components should be status=0 (none archived yet)
```

```sql
-- Test 6b: Simulate archive and verify exclusion from weight sum
-- First, get a component to test with
SELECT id, component_name, component_weight, okr_id
FROM kpi_components
WHERE status = 0
LIMIT 1;

-- Manually note the id, then run:
-- UPDATE kpi_components SET status = 1 WHERE id = '<noted_id>';

-- Then verify it's excluded:
-- SELECT SUM(component_weight) FROM kpi_components 
-- WHERE okr_id = '<noted_okr_id>' AND status = 0;
-- Expected: Sum should be < 100 now
```

---

## Test 7: Measurement Type Validation

```sql
-- Verify all measurement_type values are valid (0-3)
SELECT 
  measurement_type,
  COUNT(*) as count,
  CASE 
    WHEN measurement_type IN (0,1,2,3) THEN '✅ PASS'
    ELSE '❌ FAIL'
  END as validation
FROM kpi_components
GROUP BY measurement_type
ORDER BY measurement_type;

-- Expected: Only values 0, 1, 2, 3 with validation = '✅ PASS'
```

---

## Test 8: Target Value Validation

```sql
-- Verify all target_value >= 0
SELECT 
  component_name,
  target_value,
  CASE 
    WHEN target_value >= 0 THEN '✅ PASS'
    ELSE '❌ FAIL'
  END as validation
FROM kpi_components
WHERE status = 0;

-- Expected: All rows show validation = '✅ PASS'
```

---

## Test 9: Foreign Key Integrity

```sql
-- Verify all components have valid parent OKRs
SELECT 
  kc.id as component_id,
  kc.component_name,
  kc.okr_id,
  o.okr_title,
  CASE 
    WHEN o.id IS NOT NULL THEN '✅ PASS'
    ELSE '❌ FAIL - Orphaned'
  END as parent_check
FROM kpi_components kc
LEFT JOIN okrs o ON kc.okr_id = o.id
WHERE kc.status = 0;

-- Expected: All rows show parent_check = '✅ PASS'
```

---

## Test 10: Counting Method Validation

```sql
-- Verify all counting_method values are valid (0-2)
SELECT 
  counting_method,
  COUNT(*) as count,
  CASE 
    WHEN counting_method IN (0,1,2) THEN '✅ PASS'
    ELSE '❌ FAIL'
  END as validation
FROM kpi_components
GROUP BY counting_method
ORDER BY counting_method;

-- Expected: Only values 0, 1, 2 with validation = '✅ PASS'
```

---

## Summary Validation Query

```sql
-- Run this single query to get overall health check
WITH weight_check AS (
  SELECT 
    okr_id,
    SUM(component_weight) as total_weight
  FROM kpi_components
  WHERE status = 0
  GROUP BY okr_id
),
deadline_check AS (
  SELECT 
    COUNT(*) as mismatched_deadlines
  FROM okrs o
  JOIN kpi_components kc ON o.id = kc.okr_id
  WHERE o.deadline_at != kc.deadline_at AND kc.status = 0
),
orphan_check AS (
  SELECT COUNT(*) as orphaned_components
  FROM kpi_components kc
  LEFT JOIN okrs o ON kc.okr_id = o.id
  WHERE o.id IS NULL AND kc.status = 0
)
SELECT 
  (SELECT COUNT(*) FROM kpi_components WHERE status = 0) as total_active_components,
  (SELECT COUNT(*) FROM kpi_components WHERE status = 1) as total_archived_components,
  (SELECT COUNT(*) FROM weight_check WHERE total_weight = 100) as okrs_with_valid_weights,
  (SELECT COUNT(*) FROM weight_check WHERE total_weight != 100) as okrs_with_invalid_weights,
  (SELECT mismatched_deadlines FROM deadline_check) as deadline_mismatches,
  (SELECT orphaned_components FROM orphan_check) as orphaned_components,
  (SELECT COUNT(*) FROM audit_log WHERE entity_type = 'KPI_Component') as audit_log_entries,
  CASE 
    WHEN (SELECT COUNT(*) FROM weight_check WHERE total_weight != 100) = 0
     AND (SELECT mismatched_deadlines FROM deadline_check) = 0
     AND (SELECT orphaned_components FROM orphan_check) = 0
    THEN '✅ ALL TESTS PASSED'
    ELSE '❌ TESTS FAILED'
  END as overall_status;

-- Expected: overall_status = '✅ ALL TESTS PASSED'
```

---

## Expected Results Summary

| Test | Pass Criteria |
|------|---------------|
| 1. Schema | status column exists, default=0, index created |
| 2. Weights | All OKRs sum to 100%, archived excluded |
| 3. Sort Order | Sequential 1,2,3... per OKR |
| 4. Deadlines | All components match parent OKR |
| 5. Audit Trail | Logs exist for created components |
| 6. Soft Delete | Status field works, exclusion logic correct |
| 7. Measurement Type | All values 0-3 |
| 8. Target Value | All >= 0 |
| 9. Foreign Keys | All components have valid parent OKR |
| 10. Counting Method | All values 0-2 |

**Sprint 3 Ready:** All 10 tests pass + summary query shows "✅ ALL TESTS PASSED"
