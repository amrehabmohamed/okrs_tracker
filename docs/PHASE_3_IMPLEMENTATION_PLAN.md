# Phase 3: OKR & KPI Configuration - Implementation Plan

**Status:** Ready to Build  
**Timeline:** 30 hours over 4 sprints  
**Goal:** Build the backbone - admin interface for configuring quarterly OKR structures

---

## 🎯 What Happened Before

**Problem:** In the previous chat, code was written IN CHAT but never saved to actual files.  
**Root Cause:** Filesystem tools were not used - code was displayed as examples instead of written to disk.  
**Solution:** This plan uses `filesystem:write_file` and `filesystem:edit_file` tools exclusively.

---

## 🏗️ Architecture Overview

### **Core Principles**

1. **Layered Architecture**
   - **Routes** (thin): HTTP routing only
   - **Controllers**: Request/response handling, validation orchestration
   - **Services**: Business logic, database transactions
   - **Database**: Queries via Supabase client

2. **Weight Validation Strategy**
   - OKR weights must sum to 100% per (role_id, year, quarter)
   - Component weights must sum to 100% per okr_id
   - Transaction-safe: Lock rows during calculation to prevent race conditions

3. **Audit Logging Pattern**
   - Every mutation (create/update/delete) creates immutable audit record
   - Logged in SAME transaction as main operation (rollback both if either fails)
   - Structure: entity_type, entity_id, action, old_value (JSON), new_value (JSON), changed_by, changed_at

4. **Soft Delete Pattern**
   - DELETE endpoints set status=3 (archived), never remove rows
   - Cascade: Archiving OKR archives all child components
   - Query pattern: All GETs filter WHERE status != 3 by default

5. **Access Control**
   - requireAdmin middleware (is_manager >= 3) already exists
   - Service-level checks: canUserManageOKR() for granular control
   - Future-proof: Ready for team_id and role_id based permissions

---

## 📂 File Structure

```
backend/src/
├── types/
│   └── okr.ts                    # TypeScript interfaces
├── utils/
│   └── deadline.ts               # Deadline calculation utilities
├── services/
│   ├── validationService.ts      # Weight validation logic
│   ├── auditService.ts           # Audit logging
│   ├── okrService.ts             # OKR business logic
│   └── kpiComponentService.ts    # Component business logic
├── controllers/
│   ├── okrController.ts          # OKR request/response handlers
│   └── kpiComponentController.ts # Component handlers
├── routes/
│   ├── okr.ts                    # OKR routes
│   └── kpiComponent.ts           # Component routes
└── middleware/
    └── errorHandler.ts           # (extend with new error classes)
```

---

## 🚀 Sprint 1: Foundation (8 hours)

### **1.1 Error Classes** (1 hour)
**File:** `src/middleware/errorHandler.ts`  
**Action:** Extend existing AppError

```typescript
export class ValidationError extends AppError {
  constructor(message: string, details?: any) {
    super(message, 400);
    this.details = details;
  }
}

export class NotFoundError extends AppError {
  constructor(message: string) {
    super(message, 404);
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 409);
  }
}
```

### **1.2 Type Definitions** (1 hour)
**File:** `src/types/okr.ts`

```typescript
export interface OKR {
  id: string;
  role_id: number;
  year: number;
  quarter: number;
  okr_number: number;
  okr_title: string;
  description?: string;
  weight: number;
  type: 0 | 1; // 0=Qualitative, 1=Quantitative
  status: 0 | 1 | 2 | 3; // 0=draft, 1=active, 2=completed, 3=archived
  tags?: string;
  deadline_at: Date;
  deadline_missed: boolean;
  completed_date?: Date;
  created_by: number;
  created_at: Date;
  updated_at: Date;
}

export interface KPIComponent {
  id: string;
  okr_id: string;
  component_name: string;
  component_weight: number;
  measurement_type: 0 | 1 | 2 | 3; // 0=count, 1=percentage, 2=score, 3=boolean
  target_value: number;
  unit: string;
  description?: string;
  sort_order: number;
  deadline_at: Date;
  deadline_missed: boolean;
  completed_date?: Date;
  counting_method: 0 | 1 | 2; // 0=cumulative, 1=individual, 2=per_period
  created_at: Date;
}

export interface CreateOKRInput {
  role_id: number;
  year: number;
  quarter: number;
  okr_number: number;
  okr_title: string;
  description?: string;
  weight: number;
  type: 0 | 1;
  tags?: string;
}

export interface UpdateOKRInput {
  okr_title?: string;
  description?: string;
  weight?: number;
  type?: 0 | 1;
  status?: 0 | 1 | 2 | 3;
  tags?: string;
}
```

### **1.3 Deadline Utilities** (2 hours)
**File:** `src/utils/deadline.ts`

```typescript
import { supabase } from '../db';

/**
 * Calculate deadline for a given year/quarter based on Deadline_Config
 */
export async function calculateDeadline(
  year: number,
  quarter: number,
  role_id?: number
): Promise<Date> {
  // Try to find specific config, fallback to global
  const { data: config } = await supabase
    .from('Deadline_Config')
    .select('days_after_quarter_end')
    .or(`role_id.is.null,role_id.eq.${role_id || 'null'}`)
    .or(`year.is.null,year.eq.${year}`)
    .or(`quarter.is.null,quarter.eq.${quarter}`)
    .order('role_id', { ascending: false, nullsLast: true })
    .order('year', { ascending: false, nullsLast: true })
    .order('quarter', { ascending: false, nullsLast: true })
    .limit(1)
    .single();

  const daysAfter = config?.days_after_quarter_end || 14;
  const quarterEnd = getQuarterEnd(year, quarter);
  
  const deadline = new Date(quarterEnd);
  deadline.setDate(deadline.getDate() + daysAfter);
  deadline.setHours(23, 59, 59, 999);
  
  return deadline;
}

/**
 * Get the last day of a quarter
 */
export function getQuarterEnd(year: number, quarter: number): Date {
  const quarterEndMonths = [3, 6, 9, 12]; // Mar, Jun, Sep, Dec
  const month = quarterEndMonths[quarter - 1];
  
  // Last day of month
  return new Date(year, month, 0);
}

/**
 * Check if current date has passed deadline
 */
export function isDeadlineMissed(deadline: Date): boolean {
  return new Date() > deadline;
}
```

### **1.4 Validation Service** (2 hours)
**File:** `src/services/validationService.ts`

```typescript
import { supabase } from '../db';
import { ValidationError } from '../middleware/errorHandler';

/**
 * Validate that OKR weights sum to 100% for a given role/year/quarter
 * @param exclude_id - Exclude this OKR from sum (for updates)
 */
export async function validateOKRWeights(
  role_id: number,
  year: number,
  quarter: number,
  new_weight: number,
  exclude_id?: string
): Promise<void> {
  let query = supabase
    .from('OKRs')
    .select('weight')
    .eq('role_id', role_id)
    .eq('year', year)
    .eq('quarter', quarter)
    .neq('status', 3); // Exclude archived

  if (exclude_id) {
    query = query.neq('id', exclude_id);
  }

  const { data: okrs, error } = await query;

  if (error) throw error;

  const currentSum = okrs.reduce((sum, okr) => sum + okr.weight, 0);
  const newSum = currentSum + new_weight;

  if (newSum !== 100) {
    throw new ValidationError(
      `OKR weight validation failed: Total would be ${newSum}%, must equal 100%`,
      {
        current_sum: currentSum,
        new_weight: new_weight,
        total: newSum,
        required: 100,
        deficit: 100 - newSum
      }
    );
  }
}

/**
 * Validate that Component weights sum to 100% for an OKR
 * @param exclude_id - Exclude this component from sum (for updates)
 */
export async function validateComponentWeights(
  okr_id: string,
  new_weight: number,
  exclude_id?: string
): Promise<void> {
  let query = supabase
    .from('KPI_Components')
    .select('component_weight')
    .eq('okr_id', okr_id);

  if (exclude_id) {
    query = query.neq('id', exclude_id);
  }

  const { data: components, error } = await query;

  if (error) throw error;

  const currentSum = components.reduce((sum, c) => sum + c.component_weight, 0);
  const newSum = currentSum + new_weight;

  if (newSum !== 100) {
    throw new ValidationError(
      `Component weight validation failed: Total would be ${newSum}%, must equal 100%`,
      {
        okr_id,
        current_sum: currentSum,
        new_weight: new_weight,
        total: newSum,
        required: 100,
        deficit: 100 - newSum
      }
    );
  }
}
```

### **1.5 Audit Service** (2 hours)
**File:** `src/services/auditService.ts`

```typescript
import { supabase } from '../db';

interface AuditLogParams {
  entity_type: 'OKR' | 'KPI_Component' | 'User_KPI_Data' | 'Task';
  entity_id: string;
  action: 'created' | 'updated' | 'deleted' | 'approved' | 'rejected' | 'archived';
  old_value?: any;
  new_value?: any;
  changed_by: number;
  reason?: string;
}

/**
 * Log an action to the Audit_Log table
 * Must be called in same transaction as the main operation
 */
export async function logAudit(params: AuditLogParams): Promise<void> {
  const {
    entity_type,
    entity_id,
    action,
    old_value,
    new_value,
    changed_by,
    reason
  } = params;

  const { error } = await supabase
    .from('Audit_Log')
    .insert({
      entity_type,
      entity_id,
      action,
      old_value: old_value ? JSON.stringify(old_value) : null,
      new_value: new_value ? JSON.stringify(new_value) : null,
      changed_by,
      changed_at: new Date().toISOString(),
      reason: reason || null
    });

  if (error) {
    console.error('Failed to log audit:', error);
    throw new Error('Audit logging failed - operation rolled back');
  }
}

/**
 * Get audit history for an entity
 */
export async function getAuditHistory(
  entity_type: string,
  entity_id: string
): Promise<any[]> {
  const { data, error } = await supabase
    .from('Audit_Log')
    .select('*')
    .eq('entity_type', entity_type)
    .eq('entity_id', entity_id)
    .order('changed_at', { ascending: false });

  if (error) throw error;

  return data || [];
}
```

---

## 🚀 Sprint 2: OKR Logic (10 hours)

### **2.1 OKR Service** (4 hours)
**File:** `src/services/okrService.ts`

This service contains all OKR business logic:
- `createOKR()` - Creates OKR with weight validation and deadline calculation
- `updateOKR()` - Updates with validation and audit logging
- `deleteOKR()` - Soft deletes (archives) OKR and cascades to components
- `listOKRs()` - Lists OKRs with filters
- `getOKRWithComponents()` - Gets OKR with nested components

### **2.2 OKR Controller** (3 hours)
**File:** `src/controllers/okrController.ts`

Thin controllers that:
- Parse request body/params
- Call service methods
- Handle errors
- Format responses

### **2.3 OKR Routes** (2 hours)
**File:** `src/routes/okr.ts`

```typescript
GET    /api/okrs?role_id=1&year=2025&quarter=4&status=1
POST   /api/okrs
GET    /api/okrs/:id
PUT    /api/okrs/:id
DELETE /api/okrs/:id
```

### **2.4 Unit Tests** (1 hour)
**File:** `src/__tests__/okr.test.ts`

Test weight validation, deadline calculation, soft delete.

---

## 🚀 Sprint 3: Component Logic (8 hours)

### **3.1 Component Service** (3 hours)
**File:** `src/services/kpiComponentService.ts`

Similar to OKR service but for components:
- `createComponent()` - With parent weight validation
- `updateComponent()` - With recalculation
- `deleteComponent()` - Soft delete
- `listComponents()` - By OKR ID

### **3.2 Component Controller** (2 hours)
**File:** `src/controllers/kpiComponentController.ts`

### **3.3 Component Routes** (2 hours)
**File:** `src/routes/kpiComponent.ts`

```typescript
GET    /api/kpi-components?okr_id=abc123
POST   /api/kpi-components
GET    /api/kpi-components/:id
PUT    /api/kpi-components/:id
DELETE /api/kpi-components/:id
```

### **3.4 Update App.ts** (1 hour)
Wire in new routes:

```typescript
import okrRoutes from './routes/okr';
import kpiComponentRoutes from './routes/kpiComponent';

app.use('/api/okrs', okrRoutes);
app.use('/api/kpi-components', kpiComponentRoutes);
```

---

## 🚀 Sprint 4: Testing & Polish (4 hours)

### **4.1 Integration Tests** (2 hours)
- Full CRUD workflows
- Access control verification
- Concurrent modification tests

### **4.2 Edge Cases** (1 hour)
- Missing data handling
- Invalid input validation
- Deadline enforcement

### **4.3 Documentation** (1 hour)
- API documentation
- Error code reference
- Setup instructions

---

## ✅ Success Criteria

- [ ] All 10 API endpoints working
- [ ] Weight validation prevents invalid configurations
- [ ] Audit trail captures all mutations
- [ ] Soft delete works with cascade
- [ ] Access control enforced (is_manager >= 3)
- [ ] Deadline calculation correct for all quarters
- [ ] 80%+ test coverage
- [ ] Zero console errors on startup
- [ ] Ready for Phase 4 (data submission)

---

## 🎯 Key Design Decisions (Locked In)

1. **Weight Validation**: Transaction-safe with row locking
2. **Audit Logging**: Atomic with main operation (same transaction)
3. **Soft Delete**: Archive, never hard delete (preserve audit trail)
4. **Deadline Calculation**: From Deadline_Config with fallback to global
5. **Access Control**: Service-level checks for future granularity
6. **Error Handling**: Typed errors with detailed context for frontend
7. **Scalability**: Indexed queries, denormalization, UUID primary keys
8. **Testing**: Unit (services) + Integration (controllers) + E2E

---

## 🚨 Common Pitfalls to Avoid

1. **Fat Controllers**: Keep business logic in services, not controllers
2. **Missing Audit Logs**: Always log in same transaction as main operation
3. **Hard Deletes**: Never DELETE rows, always UPDATE status=archived
4. **Weight Validation Race Conditions**: Lock tables during sum calculation
5. **Timezone Issues**: Store all timestamps in UTC, convert on frontend
6. **Missing Error Context**: Always include details in ValidationError for helpful UX

---

## 📊 Progress Tracking

| Sprint | Hours | Status | Files Created |
|--------|-------|--------|---------------|
| 1: Foundation | 8 | 🔄 In Progress | 5 files |
| 2: OKR Logic | 10 | ⏳ Pending | 4 files |
| 3: Component Logic | 8 | ⏳ Pending | 4 files |
| 4: Testing & Polish | 4 | ⏳ Pending | 3 files |
| **Total** | **30** | — | **16 files** |

---

**Next:** Begin Sprint 1 by creating error classes, types, and utilities.
