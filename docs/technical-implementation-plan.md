---
title: "KPI Platform - Technical Implementation Plan"
version: "2.0"
status: "Active Development"
last_updated: "2025-10-23T15:00:00Z"
description: "Detailed technical specifications for all 8 phases - acceptance criteria, requirements, testing, risks"
---

# KPI Platform - Technical Implementation Plan

**Detailed Technical Specifications for All Phases**  
**For executive status, see:** `/docs/implementation-roadmap.md`

---

# PHASE 1: FOUNDATION & DATABASE INFRASTRUCTURE

**Status:** ✅ COMPLETE | Hours: 30

## 1.1 Acceptance Criteria

- ✅ Database provisioned in Supabase with all 12 tables created
- ✅ All foreign key relationships validated
- ✅ All indexes created with query plans verified
- ✅ RLS policies active and tested per role
- ✅ Seed data loaded (teams 2, roles 2, OKRs 7, components 11)
- ✅ Express backend starts without errors on port 3001
- ✅ Health check endpoint returns 200 within 100ms
- ✅ Rate limiting kicks in after 100 requests/15 min
- ✅ CORS prevents disallowed origins
- ✅ Error handler returns consistent JSON: `{error, statusCode, requestId}`
- ✅ No hardcoded secrets in code

## 1.2 Technical Requirements

**Database:**
- PostgreSQL 12+ (Supabase)
- 12 tables with proper relationships
- 31 RLS policies active
- Indexes on foreign keys + performance paths
- Daily backups enabled

**Backend:**
- Node.js 18+, Express 4.x, TypeScript 5.x
- Supabase JS client v2.x
- express-rate-limit, helmet, cors, dotenv
- Centralized error handling
- Request logging with timestamps
- Health check: GET /health → `{status: "ok"}`

## 1.3 Testing Checklist

- ✅ Query each table, verify row counts
- ✅ Insert orphaned row, verify foreign key constraint
- ✅ Connect as user A, query user B's data via RLS
- ✅ Test slow query with/without index
- ✅ Verify OKR weights sum to 100%
- ✅ Health check returns 200
- ✅ Send 101 requests/15 min, 101st returns 429
- ✅ CORS test from disallowed origin
- ✅ Invalid input returns consistent error format
- ✅ Logs capture all HTTP calls
- ✅ TypeScript compiles without errors
- ✅ Delete .env, app fails with env error

## 1.4 Known Risks

| Risk | Probability | Mitigation |
|------|-------------|-----------|
| RLS too restrictive | Medium | Test with each role |
| Foreign key cascades | Low | Use soft delete |
| Index fragmentation | Low | Monitor monthly |
| Connection pool exhaustion | Low | Scale as needed |
| Seed data conflicts | Low | Idempotent seeding |

---

# PHASE 2: AUTHENTICATION & USER MANAGEMENT

**Status:** 🟢 95% COMPLETE | Hours: 25

## 2.1 Acceptance Criteria

- ✅ User signs up with valid email/password → receives verification email
- ✅ User cannot login until email verified
- ✅ Admin approves user → user can login
- ✅ Admin rejects user → rejection reason shown
- ✅ User resets password via email link
- ✅ User changes password after login
- ✅ Invalid password rejected with specific error
- ✅ Duplicate email rejected
- ✅ Rate limiting: 5 failed logins → 15 min lockout
- ✅ JWT token contains correct role
- ✅ Token expires after 1 hour, can refresh
- ✅ Logout invalidates token
- ✅ Cannot access endpoints without token
- ✅ Manager views own team only
- ✅ VP views all users
- ✅ All actions in Audit_Log

## 2.2 Technical Requirements

**Endpoints (10 total):**
- POST /api/auth/signup → {userId, status, message}
- POST /api/auth/verify-email → {success, message}
- POST /api/auth/login → {token, user, expiresIn}
- POST /api/auth/logout → {success}
- GET /api/auth/me → {user object}
- POST /api/auth/password-reset → {success}
- POST /api/auth/password-change → {success}
- POST /api/auth/password-update → {success}
- POST /api/auth/resend-verification → {success}
- POST /api/auth/check-email-available → {available}

**Validation:**
- Email: Unique, valid format
- Password: 12+ chars, uppercase + lowercase + number, not email, not common
- Name: Not empty
- Token: Not expired

**Rate Limiting:**
- Signup: 5/15 min per email
- Login: 5 failed/15 min per email, then locked 15 min
- Password reset: 3/15 min per email
- Verification: 10/15 min per email

**Email Templates (Supabase):**
- Verification link (24h expiry)
- Password reset link (1h expiry)
- Password change confirmation
- Account approval notification
- Email change confirmation

**Security:**
- Passwords hashed with bcrypt
- HTTP-only, Secure, SameSite=Strict cookies
- CSRF token rotation
- No secrets in logs

## 2.3 Testing Checklist

**Happy Path:**
- ✅ Signup → verification email received
- ✅ Verify email → status changes
- ✅ Login before verify → 403 error
- ✅ Admin approves → approval email sent
- ✅ Login after approval → JWT returned
- ✅ GET /api/auth/me with token → user data
- ✅ Call endpoint without token → 401 error
- ✅ Token refresh → new token returned
- ✅ Logout → token invalidated

**Unhappy Path:**
- ✅ Duplicate email signup → 400
- ✅ Weak password → 400 with specific reason
- ✅ Invalid email format → 400
- ✅ Wrong password login → 401
- ✅ Unverified email login → 403
- ✅ Pending user login → 403
- ✅ 5 failed logins → 429 lockout
- ✅ Reset non-existent email → 200 (don't reveal)
- ✅ Invalid reset token → 400

**Security:**
- ✅ Passwords never logged
- ✅ JWT token payload readable, claims correct
- ✅ Token tampering rejected
- ✅ Email token expires (old token fails)
- ✅ Rate limiting blocks rapid requests

## 2.4 Known Risks

| Risk | Probability | Mitigation |
|------|-------------|-----------|
| Email service down | Low | Fallback retry, log error |
| Rate limit too strict | Medium | Monitor false positives |
| RLS infinite recursion | Medium | Security audit |
| JWT secret exposed | Low | Never commit, use GitHub secrets |
| Password reset token leaked | Low | 1h expiry, single-use |
| Email verification skipped | Low | Enforce check in login |

---

# PHASE 3: OKR & KPI CONFIGURATION

**Status:** ✅ 100% COMPLETE | Hours: 35

## 3.1 Acceptance Criteria

- ✅ Create OKR with all fields
- ✅ Create KPI component for OKR
- ✅ Components must sum to 100% (enforced)
- ✅ Cannot add component breaking 100% rule
- ✅ Cannot delete component breaking 100% rule
- ✅ Edit OKR title/description/weight/status
- ✅ Cannot edit after deadline (403)
- ✅ Archive OKR (soft delete)
- ✅ Restore archived OKR
- ✅ List OKRs by role/year/quarter
- ✅ All changes in Audit_Log
- ✅ Only admin can create/modify (other roles 403)
- ✅ Deadline calculated correctly
- ✅ deadline_missed flag set when deadline passed
- ✅ Weights displayed with 2 decimals
- ✅ Filter by status/tags, sort by fields

## 3.2 Technical Requirements

**Endpoints (7 total):**
- GET /api/okrs?role_id&year&quarter → OKR[]
- GET /api/okrs/:id → OKR with components
- POST /api/okrs → Create OKR
- PUT /api/okrs/:id → Update OKR
- DELETE /api/okrs/:id → Soft delete (archive)
- POST /api/okrs/:id/restore → Restore OKR
- GET /api/kpi-components?okr_id → Component[]
- POST /api/kpi-components → Create component
- PUT /api/kpi-components/:id → Update component
- DELETE /api/kpi-components/:id → Soft delete

**Validation:**
- okr_number: 1-8
- weight: 0-100, numeric
- year: >= 2025
- quarter: 1-4
- measurement_type: 0-3
- target_value: > 0
- Component weights sum to 100% (enforced)

**Weight Validation:**
- After POST/PUT/DELETE: Sum all non-archived components in OKR
- If != 100%: Reject with error showing current sum
- Transactional: All or nothing

**Deadline:**
- Formula: quarter_end_date + days_from_Deadline_Config
- Mapping: Q1=Mar 31, Q2=Jun 30, Q3=Sep 30, Q4=Dec 31
- Check on GET: If now > deadline_at, set deadline_missed=true
- Prevent edits: If deadline_missed=true, return 403

**Audit Logging:**
- entity_type='OKR' or 'KPI_Component'
- action='created'/'updated'/'deleted'/'archived'/'restored'
- Store old_value and new_value as JSON

## 3.3 Testing Checklist

**Happy Path:**
- ✅ Create OKR, weight=15 stored
- ✅ Create 3 components (40, 35, 25) = 100%
- ✅ Try add 4th (10) = 110% → rejected
- ✅ List OKRs for role 1, year 2025, q4 → 7 OKRs
- ✅ Get OKR → all fields + nested components
- ✅ Edit OKR title → updated, audit logged
- ✅ Archive OKR → status="archived"
- ✅ Restore OKR → status="active"
- ✅ Delete component → weights still = 100% or error

**Unhappy Path:**
- ✅ Non-admin create OKR → 403
- ✅ Invalid year (1900) → 400
- ✅ quarter=5 → 400
- ✅ measurement_type=99 → 400
- ✅ target_value=0 → 400
- ✅ Edit component breaks 100% → rejected
- ✅ Edit after deadline → 403

**Validation:**
- ✅ Sum = exactly 100.00%
- ✅ Deadline = Jan 14 23:59:59 UTC for Q4
- ✅ All audit entries present
- ✅ Soft delete works, can restore

## 3.4 Known Risks

| Risk | Probability | Mitigation |
|------|-------------|-----------|
| Rounding errors | Medium | Use DECIMAL(5,2), test edge cases |
| Cascade incomplete | Low | Show archived status in UI |
| Deadline not enforced | Low | Check on all endpoints |
| Duplicate OKR creation | Low | Unique constraint |
| Race condition | Low | DB transactions, row locks |

---

# PHASE 4: DATA SUBMISSION & VERSIONING

**Status:** 🔴 NOT STARTED | Hours: 35

## 4.1 Acceptance Criteria

- ⏳ Can submit all 4 form types
- ⏳ Stored with status=0 (pending)
- ⏳ Resubmit creates version=2
- ⏳ Cannot submit after deadline (403)
- ⏳ All submissions in history
- ⏳ Audit log entries exist
- ⏳ Cannot submit for other users (403)
- ⏳ Cannot submit for archived OKRs
- ⏳ Percentage calculates + stores numerator/denominator
- ⏳ Score validates exactly 1 decimal (3.5 ok, 3.55 no)
- ⏳ Boolean accepts only 0 or 1
- ⏳ Concurrent submissions don't duplicate
- ⏳ URL validated (basic regex)
- ⏳ API response < 500ms
- ⏳ Error messages specific (field-level feedback)

## 4.2 Form Validators

**Count Form (measurement_type=0):**
- count_value: integer >= 0, required
- evidence_link: URL, required
- notes: string, max 500 chars, optional

**Test Cases:**
- ✅ count=2 → accepted
- ✅ count=0 → accepted
- ✅ count=-1 → rejected
- ✅ count="two" → rejected
- ✅ URL invalid → rejected
- ✅ URL null → rejected

**Percentage Form (measurement_type=1):**
- numerator: decimal >= 0, required
- denominator: decimal > 0, required
- evidence_link: URL, required
- Calculation: (numerator/denominator)*100 = DECIMAL(5,2)

**Test Cases:**
- ✅ 8/10 → 80.00 stored
- ✅ 3/7 → 42.86 (test rounding)
- ✅ 0/10 → 0.00
- ✅ 15/10 → 150.00 (overachievement)
- ✅ 5/0 → rejected
- ✅ "five"/10 → rejected

**Score Form (measurement_type=2):**
- score_value: decimal, 0.0-5.0, exactly 1 decimal, required
- response_count: integer > 0, required
- evidence_link: URL, required
- data_source: 0 (manual) or 1 (jotform)

**Test Cases:**
- ✅ 3.5, 15 responses → stored
- ✅ 5.0 → stored
- ✅ 0.0 → stored
- ✅ 3.55 → rejected (2 decimals)
- ✅ 6.0 → rejected (out of range)
- ✅ response_count=0 → rejected

**Boolean Form (measurement_type=3):**
- completed: 0 or 1, required
- evidence_link: URL, required
- notes: optional

**Test Cases:**
- ✅ completed=1 → stored
- ✅ completed=0 → stored
- ✅ completed=true → rejected
- ✅ completed=2 → rejected

## 4.3 Versioning & Resubmission

**First Submission:**
- Create User_KPI_Data row with version_number=1, status=0

**Manager Rejects:**
- Set status=2, create Comment with reason

**User Resubmits:**
- Create NEW row with version_number=2, status=0
- Old row stays immutable
- Query returns latest by default, all with ?include_history=true

**Test Cases:**
- ✅ Submit → version=1, status=0
- ✅ Reject → status=2
- ✅ Resubmit → version=2, status=0, version=1 preserved
- ✅ Query history → both versions
- ✅ Cannot resubmit if version pending → error

## 4.4 Deadline Enforcement

**Check on Submit:**
- If now() > deadline_at AND deadline_missed=true → 403
- Message: "OKR '{name}' closed on {date}, cannot submit"
- Allow late within grace period, flag submission

## 4.5 Idempotency & Concurrency

**Unique Constraint:** (user_id, kpi_component_id, version_number)

**Duplicate POST:** Return existing submission (not error)

**Two Users, Same Component:** Each gets own row (keyed by user_id)

**Test Cases:**
- ✅ Rapid-fire same component → 2nd blocked, not duplicated
- ✅ Two users same component → both submissions created

## 4.6 Edge Cases

- ⏳ count=0 → accepted
- ⏳ percentage > 100% → accepted
- ⏳ Very long notes → truncate or reject clearly
- ⏳ Inaccessible URL → accept (don't validate accessibility)
- ⏳ Archived OKR → reject 403
- ⏳ Submit for other user → reject 403, log security
- ⏳ Future timestamp → accept (clock skew)

## 4.7 API Endpoints

**POST /api/kpi-data**
- Request: {kpi_component_id, value, evidence_link, data_source, notes}
- Response: {id, user_id, kpi_component_id, value, version_number, status, submitted_date, ...}
- Response code: 201 Created
- Deadline check before storing
- Create Audit_Log entry

**GET /api/users/me/kpi-data**
- Query: okr_id (optional), include_history (default false)
- Response: Latest versions or all versions
- Access: User's own data only

**GET /api/users/me/submissions-history**
- Response: All submissions grouped by component with all versions

## 4.8 Testing Checklist

**Happy Path:**
- ⏳ Submit count → status=0
- ⏳ Submit percentage → percentage calculated
- ⏳ Submit score → 1 decimal validated
- ⏳ Submit boolean → stored
- ⏳ List submissions → latest versions
- ⏳ ?include_history=true → all versions
- ⏳ Audit log → entry for each

**Unhappy Path:**
- ⏳ Invalid count → 400
- ⏳ Invalid URL → 400
- ⏳ Missing evidence_link → 400
- ⏳ After deadline → 403
- ⏳ Other user's submission → 403
- ⏳ Archived OKR → 403
- ⏳ Concurrent duplicate → 409

**Validation:**
- ⏳ Percentage formula correct
- ⏳ Version increments
- ⏳ Audit log complete
- ⏳ Error messages specific

**Performance:**
- ⏳ Submit < 500ms
- ⏳ List < 200ms
- ⏳ Concurrent (5 users) no locks

## 4.9 Known Risks

| Risk | Probability | Mitigation |
|------|-------------|-----------|
| Rounding errors | Medium | DECIMAL(5,2), ROUND_HALF_UP, test |
| Score validation strict | Low | Accept numeric + string |
| Deadline race condition | Low | Check deadline_missed atomically |
| Version overflow | Very Low | INT, max ~2B |
| Concurrent version=2 | Low | Unique constraint |
| Evidence link never validated | Low | Don't validate accessibility |

---

# PHASE 5: PROGRESS CALCULATION ENGINE

**Status:** 🔴 NOT STARTED | Hours: 25

## 5.1 Acceptance Criteria

- ⏳ Overall progress calculated per formula
- ⏳ Per-OKR progress accurate
- ⏳ Per-component progress accurate
- ⏳ Overachievement (200%, 150%) counted correctly
- ⏳ Zero submissions = 0% (not error)
- ⏳ Manual calculations match API (7 test cases)
- ⏳ API response < 200ms for single user
- ⏳ Cannot query other users' progress (403)
- ⏳ Manager can query team members
- ⏳ VP can query all users
- ⏳ Historical queries work
- ⏳ Rounding consistent (ROUND_HALF_UP, 2 decimals)
- ⏳ Pending submissions NOT counted
- ⏳ Rejected submissions NOT counted
- ⏳ Only approved (status=1) counted

## 5.2 Calculation Formula

**Component Progress:**
```
(SUM of approved User_KPI_Data.value / target_value) * 100
Filter: WHERE status=1
```

**Component Weighted Score:**
```
component_progress * (component_weight / 100)
```

**OKR Score:**
```
SUM of all component_weighted_scores
```

**OKR Percentage:**
```
okr_score / 100
```

**OKR Weighted Score:**
```
okr_percentage * (okr_weight / 100)
```

**Overall Progress:**
```
SUM of (okr_percentage * okr_weight) / 100
```

**All results:** DECIMAL(5,2), ROUND_HALF_UP

## 5.3 Manual Verification Test Cases

**Case 1:** Single component, perfect
- Target: 1, Submitted: 1 → 100%

**Case 2:** Overachievement
- Target: 1, Submitted: 2 → 200%

**Case 3:** Multiple components weighted
- Comp1: 200%, weight 40% → 80 pts
- Comp2: 100%, weight 35% → 35 pts
- Comp3: 0%, weight 25% → 0 pts
- OKR: 115%

**Case 4:** Full OKR calculation
- OKR1: 145%, weight 15% → 21.75
- OKR2: 85%, weight 20% → 17.00
- OKR3: 100%, weight 65% → 65.00
- Overall: 103.75%

**Case 5:** Zero submissions
- No submissions → 0%

**Case 6:** Percentage cumulative
- 8/10 = 80%, 2/5 = 40%
- Combined: (8+2)/(10+5) = 66.67%

**Case 7:** Rounding precision
- 1/3 = 33.333...% → 33.33%

## 5.4 API Endpoints

**GET /api/users/me/progress?year&quarter**
- Response includes:
  - overall_progress
  - Per-OKR breakdown with components
  - Submission counts
  - Calculation timestamp

**GET /api/users/me/progress/historical?years&quarters**
- Array of progress for each requested quarter

**GET /api/manager/team-progress?year&quarter**
- Team members with individual progress

## 5.5 Performance Optimization

**Query Strategy:**
- Single query for all User_KPI_Data/submissions
- Join with KPI_Components
- Calculate in application (not DB)
- No N+1 queries

**Caching:**
- On-demand calculation (no background jobs)
- Memory cache with 1h TTL (optional Redis)
- Cache key: {user_id}:{year}:{quarter}
- Invalidate on: new submission, approval, rejection

**Targets:**
- Single user: < 200ms
- Team (5 users): < 500ms
- VP (all): < 1000ms

## 5.6 Testing Checklist

**Manual Verification:**
- ⏳ Test case 1-7: Calculate manually, verify API
- ⏳ Database query matches API result
- ⏳ Rounding consistent across 10 rounds

**API Tests:**
- ⏳ GET /progress?year=2025&quarter=4 → returns object
- ⏳ Progress > 0% with data
- ⏳ Progress = 0% with no submissions
- ⏳ Past quarter query → historical data
- ⏳ Other user query → 403
- ⏳ Manager query team → success
- ⏳ VP query any → success

**Performance:**
- ⏳ Single user < 200ms
- ⏳ Team (5) < 500ms
- ⏳ Concurrent (10) no race conditions
- ⏳ Historical (8 quarters) < 1000ms

**Edge Cases:**
- ⏳ No submissions: 0%
- ⏳ All rejected: 0%
- ⏳ Mix approved/pending: count approved only
- ⏳ Overachievement: 200% counted
- ⏳ Component weight 0.01%: handled
- ⏳ Small numbers: no precision loss

## 5.7 Known Risks

| Risk | Probability | Mitigation |
|------|-------------|-----------|
| Calculation bug | Medium | Manual verification 7 cases |
| Cumulative rounding | Low | DECIMAL(5,2), consistent |
| N+1 query | Medium | Batch, test with real data |
| Cache miss | Medium | Event-driven invalidation |
| Division by zero | Low | Validate target>0 at creation |
| Concurrent calc | Low | Atomic operations |

---

# PHASE 6: APPROVAL WORKFLOW & TASK MANAGEMENT

**Status:** 🔴 NOT STARTED | Hours: 40

## 6.1 Acceptance Criteria

- ⏳ User marks complete → Task auto-created
- ⏳ Task assigned to user's manager
- ⏳ Manager receives email
- ⏳ Manager can view pending tasks in queue
- ⏳ Manager approves → User_KPI_Data.status=1 (counts)
- ⏳ Manager rejects → User_KPI_Data.status=2 (doesn't count)
- ⏳ User receives approval/rejection email
- ⏳ Rejected user can resubmit → version=2
- ⏳ Comments visible on task
- ⏳ Manager can extend due date
- ⏳ Manager can add collaborator
- ⏳ All actions in Audit_Log
- ⏳ Cannot approve/reject twice
- ⏳ Email < 2 seconds
- ⏳ API response < 500ms

## 6.2 Task Auto-Creation

**POST /api/kpi-components/:id/mark-complete**
1. Create Task: kpi_component_id, assigned_to=user's manager
2. Set status=0 (pending), due_date=now+7d
3. Send email to manager
4. Create Audit_Log entry

**Error:** If user has no manager → 400

## 6.3 Task Management Endpoints

**GET /api/tasks?status&assigned_to**
- status: 0 (pending), 1 (approved), 2 (rejected)
- Sorted by due_date ascending
- Paginated: 20 per page

**GET /api/tasks/:id**
- Full task with submission, component, OKR, comments, collaborators

**PUT /api/tasks/:id/approve**
- Request: {approval_reason}
- Set Task.status=1, User_KPI_Data.status=1
- Send email to user
- Create Audit_Log
- Create Comment

**PUT /api/tasks/:id/reject**
- Request: {rejection_reason (required)}
- Set Task.status=2, User_KPI_Data.status=2
- Create Comment with is_rejection_flag=true
- Send email to user
- Create Audit_Log

**PUT /api/tasks/:id/due-date**
- Can only extend (new > current)
- Update Task.due_date

**PUT /api/tasks/:id/add-collaborator**
- Request: {collaborator_user_id}
- Create Task_Collaborators row
- Send email to collaborator

## 6.4 Comments System

**POST /api/comments**
- Request: {entity_type, entity_id, comment_text, is_rejection_flag}
- If is_rejection_flag=true: Send email to user

**GET /api/comments?entity_type&entity_id**
- Sorted by created_at ascending

## 6.5 Email Notifications

**Task Assigned:**
- To: manager
- Subject: "New task: {user} submitted {component}"
- Includes: Submission summary, due date, link to approve

**Task Approved:**
- To: user
- Subject: "Your submission was approved"
- Includes: Confirmation, link to dashboard

**Task Rejected:**
- To: user
- Subject: "Your submission needs changes"
- Includes: Rejection reason, resubmit instructions

**Collaborator Added:**
- To: collaborator
- Subject: "You've been added as reviewer"
- Includes: Task summary, review link

## 6.6 Testing Checklist

**Happy Path:**
- ⏳ Mark complete → Task created
- ⏳ Manager receives email
- ⏳ Approve → status=1
- ⏳ User receives approval email
- ⏳ Reject → status=2
- ⏳ User receives rejection email
- ⏳ Resubmit → version=2
- ⏳ Add collaborator → receives email
- ⏳ Extend due date → updated

**Unhappy Path:**
- ⏳ No manager → 400
- ⏳ Approve twice → 400
- ⏳ Reject without reason → 400
- ⏳ Non-manager approve → 403
- ⏳ Past date due → 400
- ⏳ Non-manager collaborator → 400

**Email:**
- ⏳ All sent < 2 seconds
- ⏳ Retry on failure
- ⏳ Log failed emails

## 6.7 Known Risks

| Risk | Probability | Mitigation |
|------|-------------|-----------|
| Email down | Medium | Log, continue, retry later |
| Concurrent approve | Low | Status check, row-lock |
| No manager | Medium | Check at user creation |
| Email slow | Low | Async send |

---

# PHASE 7: MANAGER DASHBOARD & REPORTING

**Status:** 🔴 NOT STARTED | Hours: 30

## 7.1 Acceptance Criteria

- ⏳ Manager sees team progress
- ⏳ Manager exports to CSV
- ⏳ Manager compares quarters
- ⏳ Admin views audit logs with filters
- ⏳ Admin sees system errors
- ⏳ Queries < 1 second
- ⏳ Cannot query other manager's team (403)
- ⏳ VP can query all teams

## 7.2 API Endpoints

**GET /api/manager/team-progress?year&quarter**
- Returns: [{user_name, overall_progress, submissions...}...]

**GET /api/manager/team-progress-detail/:user_id**
- Full breakdown for one user

**GET /api/manager/team-comparison?year&quarters**
- [{user_name, q3_progress, q4_progress, improvement}...]

**POST /api/manager/export-team-progress**
- Returns: CSV file download

**GET /api/admin/audit-logs?entity_type&date_range&user_id**
- Returns: Audit entries, sortable, filterable

**GET /api/admin/system-metrics**
- {total_users, active_teams, pending_approvals, error_rate, avg_approval_time}

**GET /api/admin/system-errors?date_range&error_type**
- {error_type, message, count, last_occurrence}

## 7.3 Testing Checklist

- ⏳ Manager queries team → 5+ members
- ⏳ Export CSV → valid format
- ⏳ Audit logs → 20+ entries
- ⏳ Filter by date → correct entries
- ⏳ Admin sees errors
- ⏳ Query < 1s for team

## 7.4 Known Risks

| Risk | Probability | Mitigation |
|------|-------------|-----------|
| Slow queries | Medium | Index (entity_type, entity_id, changed_at) |
| Export too large | Low | Paginate, limit 1000 rows |
| Sensitive data | Low | No passwords in logs |

---

# PHASE 8: JOTFORM INTEGRATION & PRODUCTION LAUNCH

**Status:** 🔴 NOT STARTED | Hours: 25

## 8.1 Acceptance Criteria

- ⏳ JotForm webhook receives survey data
- ⏳ Auto-parsed and stored as User_KPI_Data
- ⏳ Status=1 (auto-approved)
- ⏳ No duplicates
- ⏳ Cron runs daily @ 00:00 UTC
- ⏳ Deadline enforcement locks OKRs
- ⏳ Production checklist complete
- ⏳ Error tracking active
- ⏳ Monitoring dashboard shows health
- ⏳ Load test: 100 concurrent users
- ⏳ Backup/restore tested
- ⏳ Security audit passed

## 8.2 JotForm Webhook

**POST /api/webhooks/jotform**
1. Validate HMAC signature
2. Check evaluee_id exists
3. Parse responses, calculate average_score
4. Create User_KPI_Data (status=1, data_source=1)
5. Return 200 {success, user_kpi_data_id}

**Idempotency:** Store submission_id, detect duplicates

**Error Handling:**
- Invalid HMAC → 401
- Unknown evaluee → 400
- User not found → 404
- Webhook error → 500 (retry 3x)

## 8.3 Daily Cron Job

**Runs:** 00:00 UTC daily

**Task:**
1. Find OKRs: deadline_at < now() AND deadline_missed=false
2. Set deadline_missed=true
3. Apply deadline_exceeded_action (stay_pending, auto_reject, auto_approve)
4. Log to Audit_Log
5. Email admin if errors

## 8.4 Production Deployment Checklist

**Database:**
- [ ] Backup tested (can restore)
- [ ] RLS verified (no bypasses)
- [ ] Foreign keys working
- [ ] Indexes optimized
- [ ] Slow queries fixed

**Backend:**
- [ ] All endpoints returning proper codes
- [ ] Rate limiting active
- [ ] Env vars set (no hardcoded secrets)
- [ ] Error logging in Sentry/DataDog
- [ ] Health check responsive
- [ ] HTTPS enforced
- [ ] CORS restricted to frontend domain

**Frontend:**
- [ ] All API calls correct
- [ ] Error handling for 4xx/5xx
- [ ] Loading states shown
- [ ] Session timeout handling
- [ ] Build tested (no debug files)

**Email:**
- [ ] Mailgun active
- [ ] Templates configured (5 total)
- [ ] Bounce handling set up
- [ ] Unsubscribe links working

**Monitoring:**
- [ ] Error tracking active (Sentry)
- [ ] API metrics dashboard
- [ ] DB metrics dashboard
- [ ] Alert rules configured
- [ ] Thresholds: error_rate > 1%, response_time > 2s

**Documentation:**
- [ ] API docs complete
- [ ] Runbook written
- [ ] Deployment guide written
- [ ] Disaster recovery plan

**Testing:**
- [ ] All auth flows tested
- [ ] All forms tested
- [ ] Approval workflow end-to-end
- [ ] Progress calculation verified
- [ ] JotForm webhook tested
- [ ] Deadline enforcement tested
- [ ] 5+ concurrent users tested
- [ ] 100 req/sec load test passed

## 8.5 Monitoring & Alerting

**Metrics:**
- API response time (target < 200ms)
- Error rate (target < 1%)
- DB connections (alert > 80% of pool)
- Email success rate (target > 99%)
- Webhook latency (target < 1s)
- Cron execution status

**Alerts:**
- Error rate > 1% → email ops
- Response time > 2s avg → email ops
- Email delivery < 95% → escalate
- Webhook failures > 5 → email ops
- Cron failed → email ops

## 8.6 Production Safety

**Rate Limiting:**
- General: 100 req/15 min
- Auth: 5 req/15 min
- Webhooks: 1000/hour
- Burst: < 10 req/sec

**Input Validation:**
- Strings: Max 5000 chars
- Numbers: Range check
- URLs: Format validation
- Dates: ISO 8601
- Enums: Against whitelist

**Data Protection:**
- Passwords: bcrypt hash
- Secrets: Never logged
- Personal data: RLS enforced
- Audit logs: Immutable

**Graceful Degradation:**
- Email down: Log, queue, retry
- DB slow: 503 "Temporarily unavailable"
- External API down: Retry 3x, alert
- Out of memory: Graceful shutdown

## 8.7 Testing Checklist

**JotForm:**
- ⏳ Webhook receives data
- ⏳ Data auto-parsed
- ⏳ Stored as User_KPI_Data
- ⏳ Status=1 (auto-approved)
- ⏳ No duplicates on retry

**Deadline:**
- ⏳ Cron runs @ 00:00
- ⏳ Locks expired OKRs
- ⏳ Pending submissions handled
- ⏳ All logged

**Production:**
- ⏳ All checklist items verified
- ⏳ Error tracking captures all
- ⏳ Monitoring dashboard shows health
- ⏳ Load test: 100 concurrent
- ⏳ Backup/restore works
- ⏳ Security audit passed

## 8.8 Known Risks

| Risk | Probability | Mitigation |
|------|-------------|-----------|
| Webhook signature leak | Low | HMAC validation, rotate keys |
| Cron job fails | Low | Retry logic, alert admin |
| Production data issues | Medium | Backup before launch, test restore |
| Monitoring alert fatigue | Medium | Fine-tune thresholds |

---

**Document Version:** 2.0  
**Last Updated:** October 23, 2025 @ 15:00 UTC  
**Status:** Ready for Development  
**Reference:** See `/docs/implementation-roadmap.md` for executive summary
