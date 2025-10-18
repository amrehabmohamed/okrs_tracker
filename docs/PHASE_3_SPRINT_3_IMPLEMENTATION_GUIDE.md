# Phase 3 Sprint 3: KPI Component Logic - Implementation Guide

**Version:** 1.0
**Created:** October 18, 2025
**Purpose:** Reference document for implementing KPI Component CRUD operations

---

## Overview

Sprint 3 implements the KPI Component management system - the second critical layer of the OKR hierarchy. While Sprint 2 handled OKRs, Sprint 3 handles the individual measurable components within each OKR.

**Core Principle:** Every OKR is composed of KPI Components whose weights must sum to exactly 100%. This ensures proper progress calculation in later phases.

---

## Architecture Decisions

### 1. Soft Delete Pattern (Archive Only)

**Decision:** KPI Components use archive status, NEVER hard delete from database.

**Rationale:**

- Preserves data integrity when User_KPI_Data references exist
- Maintains complete audit trail
- Allows restoration if archived by mistake
- Prevents orphaned foreign key references

**Implementation:**

- Add `status` field to KPI_Components table: 0=active, 1=archived
- DELETE endpoint sets status=1, doesn't remove row
- All queries filter by status (exclude archived by default)
- Archive cascades: When OKR archived → all components archived

**Schema Update Required:**

```sql
ALTER TABLE kpi_components 
ADD COLUMN status INT NOT NULL DEFAULT 0;
-- 0=active, 1=archived
```

### 2. Weight Validation Strategy

**Challenge:** Component weights within an OKR must sum to 100%.

**Approach:**

- **On Create:** Calculate existing component weights for OKR, verify new weight + existing ≤ 100%
- **On Update:** Exclude component being updated, verify new weight + others = 100%
- **On Delete/Archive:** Allow deletion even if remaining weights ≠ 100% (admin can rebalance)

**Known Limitation:** Race condition exists with concurrent updates (acceptable for MVP with small team).

**Validation Flow:**

```
1. Get all active components for OKR (excluding current if update)
2. Sum existing weights
3. Add new weight
4. If sum ≠ 100%, reject with detailed error showing current state
5. If sum = 100%, proceed
```

### 3. Parent OKR Relationship

**Dependency:** Every component MUST belong to an active OKR.

**Validation:**

- Verify parent OKR exists before creating component
- Verify parent OKR not archived
- Inherit deadline_at from parent OKR (components can't override in MVP)
- When OKR archived → cascade archive to all components

**Data Integrity:**

- Foreign key constraint: okr_id → OKRs.id
- Database enforces referential integrity
- Application enforces business rules

### 4. Sort Order Management

**Problem:** Components need display order within OKR.

**Solution:** Auto-assign sort_order as max(existing) + 1

**Implementation:**

```
On Create:
  Query: SELECT MAX(sort_order) FROM kpi_components WHERE okr_id = X
  Assign: new_sort_order = max_value + 1 (or 1 if no components)
  
On Update:
  Allow manual sort_order change
  Validate: sort_order >= 0
  
No Automatic Reordering:
  If component deleted, gaps in sort_order are acceptable
  Admin can manually reorder via update if needed
```

### 5. Measurement Types

**Enum Mapping:**

- 0 = count (e.g., "Conduct 5 interviews")
- 1 = percentage (e.g., "80% of PRDs complete")
- 2 = score (e.g., "Maintain 3.5/5.0 rating")
- 3 = boolean (e.g., "All projects include PD")

**Validation:**

- measurement_type must be 0-3
- target_value must be appropriate for type
- unit must describe what's being measured

**Future Extension:** Type-specific validation rules (Phase 4).

---

## Component Lifecycle

### State Transitions

```
CREATE → active (status=0)
UPDATE → remains active (status=0)
ARCHIVE → archived (status=1)
RESTORE → active (status=0) [Future feature]
```

**Rules:**

- Only active components count toward weight sum
- Archived components excluded from all queries by default
- Cannot create with status=1 (must create active, then archive)
- Cannot update archived component (must restore first)

### Create Flow

```
1. Validate input (validateComponentInput)
2. Verify parent OKR exists and active
3. Get current component weight sum for OKR
4. Validate new weight wouldn't exceed 100%
5. Calculate sort_order (max + 1)
6. Inherit deadline_at from parent OKR
7. Set status=0 (active)
8. Set deadline_missed=false
9. Insert component
10. Log audit trail (entity_type=KPI_Component, action=created)
11. Return created component
```

### Update Flow

```
1. Get existing component (404 if not found)
2. Check component is active (cannot update archived)
3. If weight changed:
   - Get current sum excluding this component
   - Validate new weight + sum = 100%
4. Update only provided fields (partial update)
5. Update updated_at timestamp
6. Log audit with old/new values
7. Return updated component
```

### Archive Flow

```
1. Get component (404 if not found)
2. Check if already archived (idempotent - return success)
3. Set status=1
4. Log audit (action=archived, reason if provided)
5. Return archived component
```

**No User Data Check:** Unlike original plan, we allow archiving even with User_KPI_Data. Data remains visible in historical views, just excluded from active calculations.

### List Flow

```
Query all components for OKR:
- Filter by okr_id
- Filter by status=0 (exclude archived)
- Order by sort_order ASC
- Return array of components
```

### Get Flow

```
Query single component by ID:
- Get by primary key
- Include archived (admin may need to view)
- Return single component or 404
```

---

## Integration Points

### Dependencies

**Services:**

- `validationService` - Weight validation, input validation
- `auditService` - Change tracking for all mutations
- `okrService` - Verify parent OKR exists
- Deadline utils - Auto-calculate deadlines

**Database Tables:**

- `kpi_components` - Primary storage
- `OKRs` - Parent relationship, deadline inheritance
- `audit_log` - Change tracking
- `User_KPI_Data` - Referenced by (read-only check)

### Service Layer Pattern

**Follows okrService pattern exactly:**

```
Service (kpiComponentService.ts):
  - Pure business logic
  - No request/response handling
  - Throws typed errors (ValidationError, NotFoundError, etc.)
  - Returns domain objects (KPIComponent)
  - Handles database operations
  - Triggers audit logging
  
Controller (kpiComponentController.ts):
  - Thin request/response layer
  - Parses req.body, req.params, req.query
  - Extracts user context from req.user
  - Calls service functions
  - Formats JSON responses
  - Wrapped in asyncHandler for error handling
  
Routes (routes/kpiComponent.ts):
  - RESTful endpoint definitions
  - Applies middleware (authenticate, requireAdmin)
  - Maps HTTP methods to controller functions
```

### API Design

**RESTful Conventions:**

```
GET    /api/kpi-components?okr_id=X    - List components for OKR
POST   /api/kpi-components              - Create component
GET    /api/kpi-components/:id          - Get single component
PUT    /api/kpi-components/:id          - Update component
DELETE /api/kpi-components/:id          - Archive component
```

**Authentication:** All endpoints require `authenticate` + `requireAdmin` middleware.

**Response Format:**

```json
{
  "component": { ... },
  "message": "Component created successfully"
}
```

**Error Format:**

```json
{
  "error": "Component weight validation failed: Total would be 110%, must equal 100%",
  "details": {
    "okr_id": "...",
    "current_sum": 65,
    "new_weight": 45,
    "total": 110,
    "required": 100,
    "deficit": -10
  }
}
```

---

## Error Handling

### Error Classes

**ValidationError (400):**

- Invalid input data (missing required fields, wrong types)
- Weight sum ≠ 100%
- Invalid enum values
- Constraint violations

**NotFoundError (404):**

- Component ID doesn't exist
- Parent OKR doesn't exist

**ConflictError (409):**

- [Not currently used for components]
- Reserved for future duplicate detection

**AuthorizationError (403):**

- User not admin (is_manager < 3)
- Handled by middleware, not service

### Error Messages

**Best Practice:** Clear, actionable errors with context.

**Good:**

```
"Component weight validation failed: Total would be 110%, must equal 100%. 
Current components: Interview (40%), Research (35%), Brief (35%). 
Adding your 45% would exceed limit by 10%."
```

**Bad:**

```
"Invalid weight"
```

**Implementation:** Include `details` object with full context for debugging.

---

## Known Limitations

### 1. Race Condition in Weight Validation

**Issue:** Two admins creating components simultaneously could both pass validation but together exceed 100%.

**Likelihood:** Very low with 2-3 admin users.

**Mitigation:** Database unique constraint can't help (weights are dynamic). Future: Optimistic locking with version numbers.

**Acceptable:** Yes for MVP. Document as known limitation.

### 2. No Cascade Weight Rebalancing

**Issue:** Archiving a component leaves remaining weights summing to less than 100%.

**Example:** Components with 40%, 35%, 25%. Archive the 25% → remaining = 75%.

**Solution:** Manual rebalancing required by admin.

**Acceptable:** Yes. Admin explicitly decides how to redistribute weight.

### 3. No Component-Level Deadline Override

**Issue:** All components inherit parent OKR deadline. Can't set different deadlines per component.

**Workaround:** Create separate OKRs if different deadlines needed.

**Future:** Add `custom_deadline_at` field allowing override.

### 4. Sort Order Gaps

**Issue:** Deleting component leaves gaps in sort_order sequence (1, 2, 4, 5).

**Impact:** None. Display order still correct.

**Future:** Add "reorder all" endpoint if needed.

---

## Testing Strategy

### Unit Tests (Service Layer)

**Test: createComponent()**

- ✓ Creates component with valid data
- ✓ Rejects if parent OKR doesn't exist
- ✓ Rejects if weight sum would exceed 100%
- ✓ Auto-assigns sort_order correctly
- ✓ Inherits deadline from parent OKR
- ✓ Logs audit trail

**Test: updateComponent()**

- ✓ Updates component with valid data
- ✓ Allows partial updates
- ✓ Rejects weight change if sum ≠ 100%
- ✓ Returns 404 for non-existent component
- ✓ Logs audit with old/new values

**Test: deleteComponent() [archive]**

- ✓ Archives component successfully
- ✓ Idempotent (archiving archived returns success)
- ✓ Logs audit trail
- ✓ Component excluded from subsequent queries

**Test: listComponents()**

- ✓ Returns all active components for OKR
- ✓ Excludes archived components
- ✓ Sorted by sort_order ASC

**Test: getComponent()**

- ✓ Returns component by ID
- ✓ Returns 404 if not found

### Integration Tests (Full Stack)

**Scenario: Create Full OKR Structure**

```
1. Create OKR with weight=20%
2. Create Component 1 (weight=40%) → Success
3. Create Component 2 (weight=35%) → Success
4. Create Component 3 (weight=25%) → Success (sum=100%)
5. Try create Component 4 (weight=10%) → Reject (sum=110%)
6. Verify audit log has 3 creation records
```

**Scenario: Update Weight Rebalancing**

```
1. Given: 3 components (40%, 35%, 25%)
2. Update Component 1: 40% → 50%
3. Expect: Reject (sum=110%)
4. Update Component 3: 25% → 15%
5. Now update Component 1: 40% → 50%
6. Expect: Success (sum=100%)
7. Verify audit logs show both updates
```

**Scenario: Archive and Rebalance**

```
1. Given: 3 components (40%, 35%, 25%)
2. Archive Component 3 (25%)
3. Verify: Only 2 components in list (40%, 35%)
4. Try create Component 4 (weight=25%) → Success
5. Verify: 3 active components (40%, 35%, 25%)
```

### Edge Cases

**Empty OKR:** Create first component for OKR → sort_order=1, weight can be any value ≤ 100%

**Single Component:** OKR with one 100% component → Valid

**Concurrent Updates:** Two admins update same component → Last write wins (acceptable)

**Archive Cascade:** Archive OKR → All components archived automatically

---

## Success Criteria

Sprint 3 complete when:

✅ All 5 service functions implemented and tested
✅ Soft delete (archive) working, no hard deletes
✅ Weight validation prevents invalid sums
✅ Components inherit deadline from parent OKR
✅ Sort order auto-assigned correctly
✅ Audit trail captures all mutations
✅ Controller follows okrController pattern
✅ Routes follow RESTful conventions
✅ All endpoints protected by auth middleware
✅ Backend compiles without errors
✅ Postman collection updated with component tests

---

## Implementation Checklist

### File 1: Database Migration

- [X] Add `status` column to `kpi_components` table
- [X] Set default value to 0 (active)
- [X] Add index on (okr_id, status) for query performance

### File 2: Service Layer

- [X] `createComponent()` - with weight validation
- [X] `updateComponent()` - with partial updates
- [X] `deleteComponent()` - archive pattern
- [X] `listComponents()` - exclude archived
- [X] `getComponent()` - include archived

### File 3: Controller Layer

- [x] `createComponent` - POST handler
- [x] `listComponents` - GET handler
- [x] `getComponent` - GET/:id handler
- [x] `updateComponent` - PUT/:id handler
- [x] `deleteComponent` - DELETE/:id handler

### File 4: Routes

- [x] Define 5 RESTful endpoints
- [x] Apply authenticate middleware
- [x] Apply requireAdmin middleware
- [x] Wire to controller functions

### File 5: App Integration

- [x] Register routes in app.ts
- [x] Verify middleware order
- [x] Test compilation

### File 6: Documentation

- [x] Update PHASE_3_SPRINT_GUIDE.md
- [x] Add API endpoint examples
- [x] Document error codes
- [x] Add Postman collection examples
- [x] Create comprehensive and short technical documentation document for devs to understand this in future reference, the document should be dynamic and will be updated as we implement

---

## Next Steps (Sprint 4)

After Sprint 3 completes:

1. Comprehensive integration testing
2. Edge case coverage
3. Performance verification with 50+ components
4. Production readiness review
5. Handoff to Phase 4 (User Data Submission)

---

## References

- **Schema:** `/docs/kpi_platform_schema_v2.json`
- **Sprint Guide:** `/docs/PHASE_3_SPRINT_GUIDE.md`
- **Known Limitations:** `/docs/PHASE_3_KNOWN_LIMITATIONS.md`
- **OKR Service:** `/backend/src/services/okrService.ts` (pattern reference)
