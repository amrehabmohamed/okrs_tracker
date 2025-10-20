# Phase 3: OKR & KPI Configuration - Sprint Guide

**Timeline:** 30 hours over 4 sprints  
**Goal:** Build admin interface for configuring quarterly OKR structures  
**Status Tracking:** Updated as sprints complete  
**Last Updated:** October 18, 2025

---

## Overview

Phase 3 creates the backbone of the KPI platform - the configuration system that allows admins to define OKRs and their component KPIs for any role, year, and quarter. This must be bulletproof since all future phases depend on it.

**Core Requirements:**
- OKR CRUD with weight validation (must sum to 100%)
- KPI Component CRUD with parent weight validation
- Automatic deadline calculation from config
- Immutable audit trail for all changes
- Soft delete (archive) pattern
- Admin-only access control

---

## Sprint 1: Foundation (8 hours) ✅ COMPLETE

### Goals
- Extend error handling framework
- Create type definitions for OKRs and components
- Build validation utilities
- Implement audit logging service
- Create deadline calculation utilities

### Deliverables
1. **Error Classes** - ValidationError, NotFoundError, AuthorizationError, ConflictError
2. **Type Definitions** - TypeScript interfaces for OKR, KPIComponent, inputs, filters
3. **Deadline Utilities** - Calculate deadlines, check if missed, quarter helpers
4. **Validation Service** - Weight validation for OKRs and components
5. **Audit Service** - Log all mutations, retrieve audit history
6. **Database Indexes** - Performance indexes for validation queries

### Success Criteria
- [x] All error classes properly extend AppError with correct status codes
- [x] Types align with database schema (lowercase table names)
- [x] Deadline calculation correct for all quarters (Q1-Q4)
- [x] Weight validation prevents sum ≠ 100%
- [x] Audit logging captures entity_type, action, old/new values
- [x] Database indexes created and verified

### Known Limitations
- Weight validation has potential race condition (acceptable for MVP)
- Audit logging not in same transaction as main operation (acceptable for MVP)
- Both documented in PHASE_3_KNOWN_LIMITATIONS.md

---

## Sprint 2: OKR Logic (10 hours) ✅ COMPLETE

### Goals
- Implement complete OKR business logic
- Create OKR controller for request handling
- Wire up OKR routes
- Backend running successfully

### Deliverables
1. **OKR Service** (`services/okrService.ts`) ✅
   - createOKR() - validates weights, calculates deadline, logs audit
   - updateOKR() - validates new weight, updates timestamps, logs audit
   - deleteOKR() - soft deletes (status=3), cascades to components, logs audit
   - listOKRs() - filters by role/year/quarter/status with pagination
   - getOKRWithComponents() - returns OKR with nested components
   - getOKRByNumber() - lookup by role/year/quarter/number
   - getCurrentWeightSum() - get current weight sum for validation

2. **OKR Controller** (`controllers/okrController.ts`) ✅
   - Thin layer: parse requests, call services, format responses
   - Error handling via asyncHandler wrapper
   - Type-safe request handling with AuthRequest interface

3. **OKR Routes** (`routes/okr.ts`) ✅
   - GET /api/okrs - list with filters
   - POST /api/okrs - create new OKR
   - GET /api/okrs/:id - get single OKR with components
   - PUT /api/okrs/:id - update OKR
   - DELETE /api/okrs/:id - soft delete (archive)
   - GET /api/okrs/weight-sum/:role_id/:year/:quarter - get weight sum
   - All routes protected by authenticate + requireAdmin middleware

4. **App Integration** ✅
   - Routes registered in app.ts
   - Middleware order correct
   - Backend compiles and runs successfully

### Success Criteria
- [x] Can create OKR with weight validation
- [x] Can create multiple OKRs with sum validation (sum must = 100%)
- [x] Creating OKR with invalid sum rejected
- [x] Updating OKR weight recalculates and validates correctly
- [x] Deleting OKR sets status=3 (archived)
- [x] All operations use audit logging
- [x] GET /api/okrs returns filtered list with pagination
- [x] Only is_manager >= 3 can access endpoints
- [x] Response format matches TypeScript interfaces
- [x] Backend runs without compilation errors

### Implementation Notes
**Issues Fixed:**
- Type mismatch: Changed user_id from `number` to `string` (UUID) across services
- ConflictError signature: Removed second argument, only accepts message string
- deadline.ts: Removed `nullsLast` option (not supported by Supabase)
- Added AuthRequest interface in controller for type safety

**Files Created/Modified:**
- `src/services/okrService.ts` (330 lines)
- `src/controllers/okrController.ts` (143 lines)
- `src/routes/okr.ts` (47 lines)
- `src/types/express.d.ts` (type augmentation)

### Integration Points
- Uses validationService for weight checks
- Uses auditService for change tracking
- Uses deadline utils for auto-calculation
- Integrates with existing auth middleware

---

## Sprint 3: Component Logic (8 hours) ✅ COMPLETE

### Goals
- Implement KPI Component business logic
- Create component controller and routes
- Validate component weights against parent OKR
- Wire into main application

### Deliverables
1. **Component Service** (`services/kpiComponentService.ts`) ✅
   - createComponent() - validates parent OKR exists, weight validation
   - updateComponent() - validates new weight against siblings
   - deleteComponent() - soft delete (archive pattern)
   - listComponents() - by OKR ID with sorting
   - getComponent() - get single component by ID

2. **Component Controller** (`controllers/kpiComponentController.ts`) ✅
   - Request/response handling
   - Input validation
   - Error formatting

3. **Component Routes** (`routes/kpiComponent.ts`) ✅
   - GET /api/kpi-components?okr_id=X - list for OKR
   - POST /api/kpi-components - create component
   - GET /api/kpi-components/:id - get single
   - PUT /api/kpi-components/:id - update
   - DELETE /api/kpi-components/:id - archive (soft delete)

4. **App Integration** (`app.ts`) ✅
   - Wire in new routes
   - Ensure middleware order correct

5. **Database Migration** ✅
   - Added status column to kpi_components (0=active, 1=archived)
   - Created index on (okr_id, status)

6. **Documentation** ✅
   - API_KPI_COMPONENTS.md - Complete API reference
   - SPRINT_3_TEST_SUITE.md - Automated testing guide

### Success Criteria
- [x] Can create component with weight=40 for OKR
- [x] Can create second component with weight=35
- [x] Can create third component with weight=25 (sum=100%)
- [x] Creating fourth component with weight=10 rejected (sum would be 110%)
- [x] Updating component weight recalculates correctly
- [x] Deleting component uses archive pattern (status=1)
- [x] Components inherit deadline from parent OKR by default
- [x] sort_order determines display order
- [x] All CRUD operations create audit trail
- [x] Cannot create component for non-existent OKR (404)
- [x] Soft delete implemented (no hard deletes)
- [x] All endpoints protected by authenticate + requireAdmin
- [x] Backend compiles and runs without errors

### Integration Points
- Uses okrService to verify parent exists
- Uses validationService for weight checks
- Uses auditService for tracking
- Inherits deadline_at from parent OKR

---

## Sprint 4: Testing & Polish (4 hours) ⏳ PENDING

### Goals
- Comprehensive integration testing
- Edge case coverage
- Documentation completion
- Production readiness verification

### Deliverables
1. **Integration Tests**
   - Full OKR lifecycle: create → update → delete
   - Full component lifecycle within OKR
   - Weight validation across multiple OKRs
   - Concurrent modification scenarios
   - Access control enforcement

2. **Edge Case Tests**
   - Missing required fields
   - Invalid data types
   - Out-of-range values (weights, quarters, years)
   - Deadline enforcement
   - Duplicate OKR numbers
   - Orphaned components

3. **Documentation**
   - API endpoint documentation
   - Error code reference
   - Setup instructions for new developers
   - Known limitations summary

4. **Performance Verification**
   - Query performance with indexes
   - Validation speed with 50+ OKRs
   - Audit log write throughput

### Success Criteria
- [ ] 80%+ test coverage on services
- [ ] All happy paths tested end-to-end
- [ ] All error paths return correct status codes
- [ ] No console errors on application startup
- [ ] All TypeScript types compile without errors
- [ ] Postman collection with 20+ example requests
- [ ] Setup guide allows new developer to run locally in < 30 min
- [ ] Performance targets met (API < 500ms, validation < 200ms)

### Final Checklist
- [ ] All 10 API endpoints documented
- [ ] All error codes documented with examples
- [ ] Known limitations reviewed and accepted
- [ ] Database indexes verified in production
- [ ] Audit trail tested and complete
- [ ] Access control enforced on all routes
- [ ] Ready for Phase 4 data submission

---

## Phase 3 Completion Criteria

**Ready to start Phase 4 when:**
- ✅ All 4 sprints complete
- ✅ 80%+ test coverage
- ✅ All endpoints working and documented
- ✅ Weight validation preventing invalid configurations
- ✅ Audit trail capturing all mutations
- ✅ Soft delete working with cascade
- ✅ Deadline auto-calculation correct
- ✅ Access control enforced
- ✅ Performance targets met
- ✅ Known limitations documented and accepted

**Handoff to Phase 4:**
- Complete OKR/Component configuration system
- Validated and tested API endpoints
- Foundation for user data submissions
- Audit trail for all admin actions
- Performance benchmarks established

---

## Progress Tracking

| Sprint | Hours | Status | Completion Date |
|--------|-------|--------|-----------------|
| Sprint 1: Foundation | 8 | ✅ Complete | Oct 18, 2025 |
| Sprint 2: OKR Logic | 10 | ✅ Complete | Oct 18, 2025 |
| Sprint 3: Component Logic | 8 | ✅ Complete | Oct 18, 2025 |
| Sprint 4: Testing & Polish | 4 | ⏳ Pending | - |
| **Total** | **30** | **75% Complete** | - |

---

## Notes for Future Chats

**Context for AI assistants:**
- Currently on Sprint 4: Testing & Polish
- All code must be written to files using filesystem tools, never in chat
- Reference PHASE_3_KNOWN_LIMITATIONS.md for architectural decisions
- Use sequential-thinking for complex logic planning
- Test each service function before moving to next

**Quick Status Check:**
```
Current Sprint: Sprint 4 - Testing & Polish
Next Task: Comprehensive testing and documentation
Dependencies: okrService, validationService, auditService (all complete)
Blocking Issues: None - ready to proceed
Backend Status: Running successfully on port 3000
```

**Database Validation (Sprint 2):**
- 7 OKRs in database (Q4 2025, Product Manager role)
- Weight sum: 100% exactly ✓
- 11 KPI Components across 4 OKRs
- Component weights all sum to 100% per OKR ✓
- Admin user configured (is_manager=4)
- audit_log table ready
- deadline_config table configured

**Recent Fixes:**
- User ID type changed from number to string (UUID consistency)
- ConflictError constructor fixed (single message argument)
- Deadline utility fixed (removed unsupported nullsLast option)
- Type augmentation for Express Request.user added
