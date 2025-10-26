-- Cleanup script for test data
-- Run this before running tests to ensure clean state

-- Delete test user's KPI data submissions
DELETE FROM user_kpi_data 
WHERE user_id = '08004308-29f8-4073-8445-b374755ecf32';

-- Verify cleanup
SELECT COUNT(*) as remaining_submissions 
FROM user_kpi_data 
WHERE user_id = '08004308-29f8-4073-8445-b374755ecf32';
