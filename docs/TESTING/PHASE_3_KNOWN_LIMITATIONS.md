# Phase 3: Known Limitations & Technical Debt

**Version:** 1.0  
**Last Updated:** October 18, 2025

---

## Critical Limitations (MVP Acceptable)

### 1. Weight Validation Race Condition

**Issue**: Two admins creating/updating OKRs simultaneously could bypass validation

**Scenario**:
- Admin A queries OKRs, sees sum = 80%, tries to create 20% OKR
- Admin B queries OKRs at same time, sees sum = 80%, tries to create 20% OKR  
- Both pass validation, result: sum = 120%

**Mitigation**:
- ✅ UNIQUE constraint on `(role_id, year, quarter, okr_number)` prevents duplicate numbers
- ✅ Status code 409 Conflict returned if insert fails
- ❌ Does NOT prevent weight sum going over 100% if different okr_numbers used

**Risk Assessment**: LOW for MVP
- Requires 2+ admins editing same quarter simultaneously
- Can be manually corrected by editing weights
- Frontend can show warning if detected

**Future Fix**: 
- Database row-level locking: `SELECT ... FOR UPDATE`
- Use Supabase RPC with explicit locking
- Add CHECK constraint at DB level (complex, requires triggers)

---

### 2. Audit Logging Transaction Safety

**Issue**: Audit log is not in same ACID transaction as main operation

**Scenario**:
- OKR created successfully
- Audit log insert fails (network, DB error)
- Result: Operation succeeded but no audit trail

**Current Implementation**: 
```typescript
// In okrService.ts
await supabase.from('OKRs').insert(okrData);  // Transaction 1
await logAudit({ ... });                      // Transaction 2 - could fail
```

**Mitigation Options**:

**Option A: Accept Risk** (Current - MVP)
- Document that audit log is "best effort"
- Add error alerting if audit fails
- Retry logic for failed audits
- **Pros**: Simple, works now
- **Cons**: Gaps in audit trail possible

**Option B: Database Triggers** (Recommended for production)
```sql
CREATE TRIGGER audit_okr_changes
AFTER INSERT OR UPDATE OR DELETE ON "OKRs"
FOR EACH ROW EXECUTE FUNCTION log_audit_trail();
```
- **Pros**: True atomicity, automatic
- **Cons**: Requires PostgreSQL function, harder to debug

**Option C: Supabase RPC** (Best for complex logic)
```typescript
await supabase.rpc('create_okr_with_audit', {
  okr_data: {...},
  audit_data: {...}
});
```
- **Pros**: Single transaction, keeps logic in application
- **Cons**: Need to write/maintain RPC functions

**Chosen for MVP**: Option A (Accept Risk)  
**Production Plan**: Implement Option B (DB Triggers) in Phase 7

---

### 3. No Row-Level Locking

**Issue**: Updates don't use `SELECT ... FOR UPDATE` to prevent concurrent modifications

**Scenario**:
- User A reads OKR, changes weight from 20 to 25
- User B reads OKR at same time, changes weight from 20 to 30
- Result: Last write wins, one update silently lost

**Mitigation**:
- ✅ Frontend shows "updated_at" timestamp
- ✅ Can detect conflicts by checking updated_at before update
- ❌ No optimistic locking implemented

**Risk Assessment**: LOW for MVP
- Rare in single-tenant system
- Affects only simultaneous edits of SAME record

**Future Fix**:
```typescript
// Add version field to OKRs table
// Check version on update
UPDATE "OKRs" 
SET weight = 25, version = version + 1
WHERE id = 'abc' AND version = 3;
// Returns 0 rows if version changed = conflict detected
```

---

## Performance Considerations

### Query Performance

**Current State**: 
- ✅ Indexes created on validation queries
- ✅ Queries limited to specific role/year/quarter
- ⚠️ No query result caching

**Scaling Projections**:
- 10 roles × 4 quarters × 10 years = 400 OKRs max
- 400 OKRs × 3 components avg = 1,200 components
- **Conclusion**: No performance issues expected for MVP scale

**When to Optimize**:
- > 1,000 OKRs: Consider partitioning by year
- > 10,000 components: Add Redis caching for weight sums
- > 100 concurrent admins: Add queue for weight validation

---

## Security Considerations

### Input Validation

**Current**: Basic validation (required fields, ranges, types)  
**Missing**: 
- SQL injection protection (Supabase sanitizes, but not explicitly checked)
- XSS protection (frontend responsibility)
- Rate limiting (not implemented)

**Future**: Add express-validator middleware

### Access Control

**Current**: Middleware checks `is_manager >= 3`  
**Missing**: 
- Team-based permissions
- Role-based permissions (all admins can edit all OKRs)
- Audit log protection (admins can't edit own audit logs)

**Future**: Implement in Phase 7 (multi-tenant preparation)

---

## Technical Debt Register

| ID | Issue | Impact | Effort | Priority | Target Phase |
|----|-------|--------|--------|----------|--------------|
| TD-001 | Row-level locking for weight validation | Medium | 4h | P2 | Phase 7 |
| TD-002 | Database triggers for atomic audit logging | High | 6h | P1 | Phase 6 |
| TD-003 | Optimistic locking (version field) | Low | 2h | P3 | Phase 8 |
| TD-004 | Query result caching (Redis) | Low | 8h | P3 | Post-MVP |
| TD-005 | Comprehensive input sanitization | Medium | 3h | P2 | Phase 5 |
| TD-006 | Rate limiting on mutation endpoints | Medium | 2h | P2 | Phase 5 |
| TD-007 | Team-based access control | Medium | 6h | P2 | Phase 7 |

---

## Testing Gaps

**Unit Tests Needed** (Sprint 4):
- Weight validation with concurrent requests (simulate race condition)
- Audit logging failure recovery
- Deadline calculation for all edge cases (leap years, DST, etc.)
- Error handling paths

**Integration Tests Needed** (Sprint 4):
- Full OKR create/update/delete cycle with audit trail verification
- Weight validation across multiple OKRs
- Component weight validation
- Access control enforcement

**Load Tests** (Post-MVP):
- 10 concurrent admins creating OKRs
- 1000 OKRs, validate query performance
- Audit log write throughput

---

## Monitoring & Alerting

**Needed Before Production**:
- Alert if audit log insert fails
- Alert if weight validation race condition detected (sum ≠ 100%)
- Track API response times for validation queries
- Log all 409 Conflict responses

**Dashboard Metrics**:
- OKRs created/updated/deleted per day
- Weight validation failures per day
- Audit log success rate
- Average API response time

---

## Migration Path to Production

**Phase 3 MVP → Production Checklist**:
- [ ] Implement database triggers for audit logging (TD-002)
- [ ] Add row-level locking for weight validation (TD-001)
- [ ] Set up monitoring and alerting
- [ ] Load test with 100 OKRs
- [ ] Security audit (input validation, access control)
- [ ] Comprehensive test suite (80%+ coverage)
- [ ] Disaster recovery plan (backup/restore procedures)

**Estimated Effort**: 20 hours post-MVP
