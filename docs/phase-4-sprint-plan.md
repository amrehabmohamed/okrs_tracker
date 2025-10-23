# Phase 4: Data Submission & Versioning - Sprint Plan

**Total Duration:** 35 hours | 7 sprints | Each sprint: 1-2 days  
**Goal:** Users can submit KPI data with versioning, validation, and audit trail

---

## Sprint 4.1: Foundation & Count Form (5 hours)

### Objective
Establish submission infrastructure with the simplest form type

### Deliverables
- [ ] POST /api/kpi-data endpoint created
- [ ] Request authentication & authorization middleware
- [ ] Count form validator (value >= 0, URL format, notes <= 500 chars)
- [ ] Database insertion with User_KPI_Data table
- [ ] Error responses with specific field-level feedback
- [ ] Audit_Log entry on every submission
- [ ] 5 unit tests for validation
- [ ] 1 integration test: submit count form end-to-end

### Acceptance Criteria
- ✅ Submit valid count form → 201 Created
- ✅ Negative count → 400 with specific error
- ✅ Missing evidence_link → 400
- ✅ Submit for other user's component → 403
- ✅ Response time < 500ms
- ✅ Audit_Log entry exists

### Test Cases
```javascript
// Valid submission
{ kpi_component_id: "uuid", value: 2, evidence_link: "https://...", notes: "..." }
→ 201 Created

// Invalid: negative value
{ value: -1, ... } → 400 "count_value must be >= 0"

// Invalid: missing required field
{ value: 2, notes: "..." } → 400 "evidence_link is required"

// Invalid: wrong user
POST as user_id=1 for component owned by user_id=2 → 403
```

---

## Sprint 4.2: Percentage Form & Calculations (5 hours)

### Objective
Add percentage calculations with numerator/denominator audit trail

### Deliverables
- [ ] Percentage form validator (numerator >= 0, denominator > 0)
- [ ] Calculation logic: (numerator/denominator) * 100
- [ ] Store numerator, denominator, AND calculated percentage
- [ ] Rounding: DECIMAL(5,2), ROUND_HALF_UP
- [ ] Handle overachievement (150%, 200% valid)
- [ ] Division by zero protection
- [ ] 8 unit tests covering edge cases
- [ ] 2 integration tests

### Acceptance Criteria
- ✅ 8/10 → stores: num=8, denom=10, value=80.00
- ✅ 3/7 → value=42.86 (rounding verified)
- ✅ 0/10 → value=0.00 (zero numerator valid)
- ✅ 15/10 → value=150.00 (overachievement)
- ✅ 5/0 → 400 "denominator must be > 0"
- ✅ "five"/10 → 400 "numerator must be numeric"

### Test Cases
```javascript
// Standard percentage
{ numerator: 8, denominator: 10, evidence_link: "..." }
→ Stored: numerator=8, denominator=10, value=80.00

// Rounding test
{ numerator: 3, denominator: 7 }
→ value=42.86 (not 42.857142...)

// Overachievement
{ numerator: 15, denominator: 10 }
→ value=150.00 (valid)

// Division by zero
{ numerator: 5, denominator: 0 }
→ 400 "denominator must be greater than 0"
```

---

## Sprint 4.3: Score & Boolean Forms (4 hours)

### Objective
Complete all 4 form types, enabling full KPI coverage

### Deliverables
- [ ] Score form validator (0.0-5.0, exactly 1 decimal place, response_count > 0)
- [ ] Boolean form validator (completed: 0 or 1 only)
- [ ] data_source field handling (0=manual, 1=jotform)
- [ ] 6 unit tests (3 per form type)
- [ ] 2 integration tests (1 per form type)

### Acceptance Criteria
- ✅ Score 3.5 with 15 responses → accepted
- ✅ Score 3.55 → 400 "must have exactly 1 decimal place"
- ✅ Score 6.0 → 400 "must be between 0.0 and 5.0"
- ✅ Boolean completed=1 → accepted
- ✅ Boolean completed=true → 400 "must be 0 or 1"
- ✅ All 4 form types working

### Test Cases
```javascript
// Score form
{ score_value: 3.5, response_count: 15, evidence_link: "..." }
→ 201 Created

{ score_value: 3.55, response_count: 15, evidence_link: "..." }
→ 400 "score_value must have exactly 1 decimal place"

{ score_value: 6.0, response_count: 15, evidence_link: "..." }
→ 400 "score_value must be between 0.0 and 5.0"

// Boolean form
{ completed: 1, evidence_link: "..." }
→ 201 Created

{ completed: true, evidence_link: "..." }
→ 400 "completed must be 0 or 1"
```

**Milestone:** All form types implemented. Platform can handle 100% of KPI component types.

---

## Sprint 4.4: Versioning & Resubmission Logic (6 hours)

### Objective
Enable rejection → resubmission workflow with immutable history

### Deliverables
- [ ] version_number logic (defaults to 1 on first submission)
- [ ] Resubmission detection (find latest version for component)
- [ ] Auto-increment version_number on resubmit
- [ ] Unique constraint: (user_id, kpi_component_id, version_number)
- [ ] Business rule: Cannot have 2 pending versions simultaneously
- [ ] Old versions preserved (immutable)
- [ ] 5 unit tests for versioning logic
- [ ] 3 integration tests for resubmission flow

### Acceptance Criteria
- ✅ First submission → version_number=1, status=0 (pending)
- ✅ Resubmit after rejection → version_number=2, status=0
- ✅ Old version preserved with status=2 (rejected)
- ✅ Cannot submit version=2 while version=1 pending → 400
- ✅ Query returns latest version by default
- ✅ Query with ?include_history=true returns all versions

### Test Cases
```javascript
// First submission
POST /api/kpi-data { kpi_component_id: "abc", value: 10 }
→ Created: version_number=1, status=0

// Manager rejects (done in Phase 6, but we prepare for it here)
// Manually set status=2 for testing

// Resubmission
POST /api/kpi-data { kpi_component_id: "abc", value: 12 }
→ Created: version_number=2, status=0
→ version=1 still exists with status=2

// Cannot resubmit while pending
POST (while version=1 status=0)
→ 400 "Cannot resubmit while previous version is pending"

// Query
GET /api/users/me/kpi-data?kpi_component_id=abc
→ Returns version=2 only

GET /api/users/me/kpi-data?kpi_component_id=abc&include_history=true
→ Returns [version=1, version=2]
```

---

## Sprint 4.5: Deadline Enforcement & Edge Cases (6 hours)

### Objective
Prevent submissions after deadlines; handle all edge cases

### Deliverables
- [ ] Deadline check on every POST (deadline_at < now AND deadline_missed=true → 403)
- [ ] Atomic deadline check (transaction-level)
- [ ] Edge case handling: count=0, percentage>100%, long notes, archived OKR
- [ ] Security logging for 403 attempts
- [ ] 8 unit tests (1 per edge case)
- [ ] 3 integration tests (deadline scenarios)

### Acceptance Criteria
- ✅ Submit after deadline → 403 "OKR closed on {date}"
- ✅ count_value=0 → accepted (valid data point)
- ✅ Percentage 150% → accepted (overachievement)
- ✅ Notes > 500 chars → 400 "notes max 500 characters"
- ✅ Submit for archived OKR → 403
- ✅ Submit for another user → 403 + security log
- ✅ Concurrent duplicate → returns existing (idempotent)

### Edge Cases Tested
```javascript
// Edge case 1: Zero value (valid)
{ value: 0, ... } → 201 Created

// Edge case 2: Overachievement (valid)
{ numerator: 15, denominator: 10 } → value=150.00, 201 Created

// Edge case 3: Long notes (invalid)
{ notes: "a".repeat(501), ... } → 400 "notes exceeds 500 characters"

// Edge case 4: Deadline passed
POST when deadline_at < now() AND deadline_missed=true
→ 403 "OKR 'Discovery' closed on 2025-11-13, cannot submit"

// Edge case 5: Archived OKR
POST for OKR with status=3 (archived)
→ 403 "Cannot submit to archived OKR"

// Edge case 6: Wrong user
POST as user_id=1 for kpi_component owned by user_id=2
→ 403 "Unauthorized" + Audit_Log entry with security flag

// Edge case 7: Concurrent duplicate
POST same data twice within 100ms
→ First: 201 Created, Second: 200 OK (returns existing)

// Edge case 8: Inaccessible URL
{ evidence_link: "https://nonexistent.com/doc" }
→ 201 Created (we don't validate URL accessibility)
```

---

## Sprint 4.6: History & Audit Trail (5 hours)

### Objective
Enable comprehensive submission history querying

### Deliverables
- [ ] GET /api/users/me/kpi-data?okr_id={id} (latest versions only)
- [ ] GET /api/users/me/kpi-data?include_history=true (all versions)
- [ ] GET /api/users/me/submissions-history (all OKRs, all time)
- [ ] Response includes: submission details, component info, OKR info, version history
- [ ] Pagination: 20 per page
- [ ] Sort: submitted_date DESC by default
- [ ] Join optimization (avoid N+1 queries)
- [ ] 3 unit tests for query logic
- [ ] 2 integration tests for history retrieval

### Acceptance Criteria
- ✅ Query returns only user's own submissions (RLS enforced)
- ✅ Default: latest versions only
- ✅ ?include_history=true: all versions nested
- ✅ Response < 300ms for 20 submissions
- ✅ Includes component name, OKR title, target value
- ✅ Pagination works correctly
- ✅ Cannot query other user's history → 403

### Response Structure
```javascript
GET /api/users/me/kpi-data?okr_id=abc123&include_history=true

{
  "submissions": [
    {
      "id": "uuid-1",
      "kpi_component": {
        "id": "comp-1",
        "name": "Conduct at least ONE customer interview",
        "target_value": 1.00,
        "unit": "interviews"
      },
      "okr": {
        "id": "okr-1",
        "title": "Discovery & Customer Alignment",
        "quarter": 4,
        "year": 2025
      },
      "value": 2.00,
      "version_number": 2,
      "status": 0, // pending
      "evidence_link": "https://...",
      "submitted_date": "2025-10-22T14:30:00Z",
      "versions": [
        {
          "version_number": 1,
          "value": 1.00,
          "status": 2, // rejected
          "submitted_date": "2025-10-20T10:00:00Z"
        },
        {
          "version_number": 2,
          "value": 2.00,
          "status": 0, // pending
          "submitted_date": "2025-10-22T14:30:00Z"
        }
      ]
    }
  ],
  "pagination": {
    "page": 1,
    "per_page": 20,
    "total": 45,
    "total_pages": 3
  }
}
```

---

## Sprint 4.7: Integration Testing & Performance (4 hours)

### Objective
Verify production readiness through comprehensive testing

### Deliverables
- [ ] 30+ unit tests (all validators, calculators, transformers)
- [ ] 15+ integration tests (full request-response flows)
- [ ] 5+ performance tests (load, concurrency, stress)
- [ ] 8+ security tests (access control, injection, rate limiting)
- [ ] Load test: 100 submissions in parallel → 99.9% success
- [ ] Performance benchmark: All endpoints < 500ms
- [ ] Test coverage report: > 80% code coverage
- [ ] Security audit: Zero access control bypasses

### Test Scenarios

**Integration Tests:**
1. ✅ Submit all 4 form types → retrieve → verify
2. ✅ Submit → reject → resubmit → verify v2 created
3. ✅ Submit after deadline → 403
4. ✅ 5 concurrent users same component → all succeed
5. ✅ Malformed JSON → 400
6. ✅ SQL injection attempt → rejected safely
7. ✅ User A queries User B data → 403
8. ✅ All actions logged to Audit_Log

**Performance Tests:**
1. ✅ Single submission: < 500ms (target: 200ms)
2. ✅ Batch query (20 submissions): < 300ms
3. ✅ History query with versions: < 500ms
4. ✅ 10 concurrent users: No deadlocks
5. ✅ Sustained load: 10 req/sec for 5 min → no degradation

**Security Tests:**
1. ✅ JWT missing → 401
2. ✅ JWT expired → 401
3. ✅ JWT tampered → 401
4. ✅ Submit for other user → 403
5. ✅ SQL injection in notes field → sanitized
6. ✅ XSS in evidence_link → sanitized
7. ✅ Rate limit: 100 req/15 min exceeded → 429
8. ✅ CORS from disallowed origin → blocked

### Performance Benchmarks
- Single submission: Target < 200ms, Max 500ms
- Batch retrieval (20): Target < 200ms, Max 300ms
- History with versions: Target < 300ms, Max 500ms
- Concurrent (10 users): No timeouts, no deadlocks
- Load (50 concurrent, 1000 total): Success rate > 99.9%

### Success Criteria
✅ All unit tests passing (30+)  
✅ All integration tests passing (15+)  
✅ All performance benchmarks met  
✅ Zero security vulnerabilities found  
✅ Test coverage > 80%  
✅ No critical bugs remaining  
✅ API documentation generated  
✅ Phase 4 ready for Phase 5 dependency  

---

## Phase 4 Summary

### Total Deliverables
- 4 form types fully validated and working
- Complete versioning and resubmission logic
- Deadline enforcement preventing late submissions
- Comprehensive submission history queries
- 60+ automated tests covering all scenarios
- Performance validated under load
- Security hardened against common attacks
- Full audit trail for compliance
- API documentation complete

### Dependencies for Phase 5
✅ User_KPI_Data table populated with test data  
✅ All 4 measurement types submittable  
✅ Version tracking working  
✅ Status field (0=pending, 1=approved, 2=rejected)  
✅ RLS policies enforcing data access  
✅ Audit_Log capturing all actions  

### Risks Mitigated
✅ Calculation errors (extensive testing)  
✅ Race conditions (atomic operations)  
✅ Access control bypasses (RLS + middleware)  
✅ Performance degradation (load testing)  
✅ Data corruption (validation + constraints)  

**Phase 4 Status:** Ready to begin Sprint 4.1  
**Next Phase:** Phase 5 (Progress Calculation Engine) blocked until Phase 4 complete
