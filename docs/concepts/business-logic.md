# Business Logic & Design Decisions

**Purpose:** Explain WHY we made key technical decisions  
**Audience:** Developers, Product Managers, Future Contributors

---

## Weight Validation

### The Rule
- OKR weights per (role, year, quarter) must sum to **exactly 100%**
- Component weights per OKR must sum to **exactly 100%**

### Why 100%?

**Problem:** Without precise weighting, progress calculations are meaningless.

**Example:**
```
OKR 1: Weight 15% → User achieves 200% → Contributes 30 points
OKR 2: Weight 20% → User achieves 100% → Contributes 20 points
Total: 50 points out of possible 100 = 50% overall progress
```

If weights summed to 95%, the math breaks:
- Is 100 points the max? Or 95?
- How do we calculate overall percentage?

**Solution:** Enforce 100% validation at service layer.

```typescript
// Validation in okrService.ts
const totalWeight = await sumOKRWeights(role_id, year, quarter);
if (totalWeight + newOKR.weight !== 100) {
  throw new ValidationError(`Total must equal 100%, currently ${totalWeight}`);
}
```

---

## Soft Delete Pattern

### The Rule
Never hard delete entities. Use `status=3` (archived) instead.

### Why Soft Delete?

**Problem 1: Foreign Key Integrity**

Hard delete OKR → All components become orphans:
```sql
DELETE FROM okrs WHERE id = 'abc123';
-- ERROR: violates foreign key constraint "kpi_components_okr_id_fkey"
```

**Problem 2: Lost Audit Trail**

Hard delete → No history:
```
User: "Where did OKR 5 go?"
Admin: "Someone deleted it, no record exists"
```

**Problem 3: Accidental Deletion**

No way to recover deleted data.

**Solution: Soft Delete**

```typescript
// Archive instead of delete
await supabase
  .from('okrs')
  .update({ status: 3 })
  .eq('id', okrId);
```

**Benefits:**
- Foreign keys remain valid
- Audit trail preserved
- Can restore if needed
- Queries simply filter `WHERE status != 3`

---

## Deadline Inheritance

### The Rule
Components inherit `deadline_at` from parent OKR by default.

### Why Inheritance?

**Problem:** Managing 50+ individual deadlines is tedious.

**User Pain:**
```
Admin creates OKR with 5 components
Must manually set deadline 5 times
If quarter deadline changes, must update 5 places
```

**Solution: Inherit from Parent**

```typescript
// Component creation
component.deadline_at = component.deadline_at || okr.deadline_at;
```

**Override when needed:**
```typescript
// Component-specific deadline
{
  component_name: "Deliver Q4 roadmap",
  deadline_at: "2025-10-31" // Earlier than OKR deadline
}
```

**Benefits:**
- Single source of truth (OKR deadline)
- Flexibility for exceptions
- Consistent quarter-end enforcement

---

## Versioning on Resubmission

### The Rule
Each resubmission creates a new row with `version_number++`.

### Why New Rows?

**Alternative 1: Update in Place**
```sql
UPDATE user_kpi_data SET value = 3 WHERE id = 'abc';
```
**Problem:** Lost audit trail. Can't see what user originally submitted.

**Alternative 2: Store History in JSON**
```sql
UPDATE user_kpi_data SET history = jsonb_append(history, {...});
```
**Problem:** Complex queries. Hard to filter by version.

**Solution: New Row per Version**
```typescript
// Rejection → user resubmits
const latestVersion = await getLatestVersion(component_id, user_id);
await createSubmission({
  ...data,
  version_number: latestVersion + 1
});
```

**Benefits:**
- Simple queries: `WHERE version_number = 2`
- Full audit trail
- Easy to compare versions

**Query Latest:**
```sql
SELECT * FROM user_kpi_data 
WHERE kpi_component_id = 'abc' AND user_id = 12 
ORDER BY version_number DESC LIMIT 1;
```

---

## Status Field Pattern

### The Rule
Use INT enum for status fields, not strings.

### Why INT over String?

**Alternative: String Status**
```sql
status VARCHAR(20) CHECK (status IN ('pending', 'approved', 'rejected'))
```

**Problems:**
- 20 bytes per row (vs 4 bytes for INT)
- Typos possible: "approvd" vs "approved"
- No natural ordering

**Solution: INT Enum**
```typescript
enum Status {
  PENDING = 0,
  APPROVED = 1,
  REJECTED = 2,
  ARCHIVED = 3
}
```

**Benefits:**
- 4 bytes per row
- Type safety in TypeScript
- Easy to extend: `IN_REVIEW = 4`
- Natural ordering: `status < 2` = "not yet approved"

---

## Denormalized `okr_id` in `user_kpi_data`

### The Rule
Store both `kpi_component_id` (normalized) and `okr_id` (denormalized).

### Why Duplicate Data?

**Normalized Approach:**
```sql
-- user_kpi_data only stores kpi_component_id
SELECT * FROM user_kpi_data ukd
JOIN kpi_components kc ON ukd.kpi_component_id = kc.id
WHERE kc.okr_id = 'abc';
```

**Problem:** Every progress query requires JOIN. Slow at scale.

**Denormalized Approach:**
```sql
-- user_kpi_data stores okr_id directly
SELECT * FROM user_kpi_data WHERE okr_id = 'abc';
```

**Trade-off:**
- ✅ Faster queries (no JOIN)
- ❌ Extra 16 bytes per row (UUID)
- ❌ Must update if component moves OKRs (rare)

**Decision:** Performance > Storage for reporting queries.

---

## Evidence Required for All Submissions

### The Rule
`evidence_link` field required for all `user_kpi_data` entries.

### Why Mandatory Evidence?

**Problem: Gaming the System**

Without evidence:
```
User: "I conducted 5 customer interviews"
Manager: "Where are the notes?"
User: "I forgot to document them"
```

**Solution: Block Submission Without Evidence**

```typescript
const schema = z.object({
  value: z.number(),
  evidence_link: z.string().url(), // Required
});
```

**Accepted Evidence:**
- Google Doc (interview notes)
- Spreadsheet (tracking data)
- Jira ticket (completed work)
- Recording link (presentation)
- Figma file (design deliverable)

**Benefits:**
- Forces documentation
- Enables audit trail
- Prevents false claims
- Creates accountability

---

## Manager Approval Required

### The Rule
All submissions start as `status=0` (pending). Manager must approve.

### Why Manual Approval?

**Alternative: Auto-Approve**

User submits → Instantly counts toward progress.

**Problems:**
- Invalid evidence not caught
- Inflated progress (user submits 10 fake interviews)
- No quality gate

**Solution: Approval Workflow**

```
User submits → status=pending
Manager reviews → Approves/Rejects
If approved → status=1, counts toward progress
If rejected → User can resubmit (version++)
```

**Benefits:**
- Quality gate
- Catches errors early
- Builds accountability
- Manager visibility

**Trade-off:**
- Slower (2-day approval time)
- Manager workload increases

**Mitigation:**
- Email notifications for speed
- Batch approval UI for efficiency

---

## Counting Methods

### The Rule
Components define `counting_method`: cumulative, individual, or per_period.

### Why Multiple Methods?

**Problem:** Different KPIs aggregate differently.

**Example 1: Cumulative**
```
Component: "Conduct 5 interviews"
User submits: 2 interviews (Jan)
User submits: 3 interviews (Feb)
Total: 5 interviews → 100% complete
```

**Example 2: Individual**
```
Component: "Maintain 3.5/5.0 rating"
User submits: 3.8 (Event 1)
User submits: 3.6 (Event 2)
Each standalone → Both count as 100%+ each
```

**Example 3: Per Period**
```
Component: "Deliver 80% on-time monthly"
User submits: January (8/10 = 80%) ✓
User submits: February (7/10 = 70%) ✗
Each month independent
```

**Implementation:**
```typescript
enum CountingMethod {
  CUMULATIVE = 0,    // Sum all values
  INDIVIDUAL = 1,    // Each submission standalone
  PER_PERIOD = 2     // Track by time period
}
```

---

## UUID Primary Keys

### The Rule
Use UUID (not auto-increment INT) for OKRs, components, tasks, submissions.

### Why UUID over INT?

**INT Problems:**
- Predictable: `id=1, 2, 3...`
- Not globally unique (only within table)
- Merge conflicts in distributed systems

**UUID Benefits:**
- Globally unique (can generate client-side)
- Unpredictable (security through obscurity)
- No collisions when merging databases

**Trade-off:**
- 16 bytes vs 4 bytes (storage)
- Harder to debug (vs `id=5`)

**Decision:** Security + distributed generation > storage.

---

## Audit Log as Append-Only

### The Rule
`audit_log` table never updated or deleted. Only INSERTs.

### Why Append-Only?

**Problem:** Immutable history required for compliance.

**Anti-pattern:**
```sql
-- ❌ Don't do this
UPDATE audit_log SET action = 'corrected' WHERE id = 'abc';
DELETE FROM audit_log WHERE entity_id = 'xyz';
```

**Pattern:**
```typescript
// ✅ Always INSERT, never UPDATE/DELETE
await auditService.log({
  entity_type: 'OKR',
  entity_id: okrId,
  action: 'updated',
  old_value: {...},
  new_value: {...},
  changed_by: userId
});
```

**Benefits:**
- Tamper-proof history
- Compliance with audit requirements
- Full reversibility

---

## Deadline Enforcement

### The Rule
When `deadline_missed=TRUE`, no new submissions allowed.

### Why Hard Cutoff?

**Problem: Retroactive Submissions**

Without enforcement:
```
Quarter ends: Oct 31
User submits data: Nov 15 (2 weeks late)
Backdated to October
Inflates Q4 metrics artificially
```

**Solution: Database Flag**

```typescript
if (component.deadline_missed) {
  throw new ValidationError('Deadline passed, submissions locked');
}
```

**Cron Job (Daily):**
```typescript
// Check all deadlines
const expired = await supabase
  .from('kpi_components')
  .select('*')
  .lt('deadline_at', new Date())
  .eq('deadline_missed', false);

// Mark as missed
await supabase
  .from('kpi_components')
  .update({ deadline_missed: true })
  .in('id', expired.map(c => c.id));
```

**Benefits:**
- Prevents gaming
- Enforces accountability
- Clear quarter boundaries

**Exception Handling:**
- Admin can manually reset `deadline_missed` if justified
- Logged in audit trail

---

## Real-Time Progress Calculation

### The Rule
Progress calculated on-demand (not cached), but optimized queries.

### Why Not Cache?

**Alternative: Pre-Calculate Progress**

```sql
-- Add column
ALTER TABLE users ADD COLUMN progress_cache DECIMAL;

-- Update on every submission approval
UPDATE users SET progress_cache = calculateProgress(user_id);
```

**Problems:**
- Cache invalidation complex
- Stale data if calculation changes
- Extra storage

**Solution: Calculate on Query**

```typescript
// GET /api/users/me/progress
const progress = await progressService.calculate(userId, year, quarter);
```

**Optimization:**
- Indexed queries: `user_id, okr_id, status`
- Denormalized `okr_id` in `user_kpi_data`
- Query only approved submissions: `WHERE status = 1`

**Performance:**
- <200ms for typical user (10 submissions)
- Scales to 1000 submissions with indexes

**Future:** Add Redis cache if >500ms.

---

## Summary Table

| Decision | Reason | Trade-off |
|----------|--------|-----------|
| Weight Validation (100%) | Precise calculations | Admin effort to balance |
| Soft Delete | Audit trail + recovery | Extra status filtering |
| Deadline Inheritance | Single source of truth | Can't change per-component easily |
| Versioning (new rows) | Full history | More storage |
| INT Status Enum | Storage + type safety | Less readable in DB |
| Denormalized `okr_id` | Query performance | Data duplication |
| Evidence Required | Accountability | User friction |
| Manager Approval | Quality gate | Slower process |
| UUID Primary Keys | Security + distributed | Larger storage |
| Append-Only Audit Log | Immutable history | Cannot correct mistakes |
| Hard Deadline Cutoff | Prevent gaming | No late submissions |
| Real-Time Calculation | Always accurate | Query latency |

---

## References

- [Database Schema](ARCHITECTURE/DATABASE_SCHEMA.md)
- [System Architecture](ARCHITECTURE/SYSTEM_ARCHITECTURE.md)
- [API Documentation](API/)
