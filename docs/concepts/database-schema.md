# Database Schema Documentation

**Version:** 2.0  
**Last Updated:** October 18, 2025  
**Total Tables:** 10  
**Status:** Phase 3 Complete

---

## Schema Overview

The KPI Platform uses a relational PostgreSQL database with the following design principles:

1. **UUID Primary Keys** for distributed generation
2. **Soft Delete Pattern** (status field, never hard delete)
3. **Denormalized Reporting** (okr_id duplicated in user_kpi_data)
4. **Audit Trail** (every mutation logged)
5. **Weight Validation** (OKRs and components must sum to 100%)

---

## Entity Relationship Diagram

```
teams (1) ─────< (N) users
                     │
                     │ (user_id)
                     │
                     ├─────< (N) user_kpi_data ──────> (1) kpi_components
                     │                                         │
                     │                                         │
                     │                                    (1) okrs
                     │                                         │
                     │                                         │
                     └─────< (N) tasks ────────────────────────┘
                             │
                             │
                             └─────< (N) task_collaborators
                             
comments (polymorphic) ──> okrs / kpi_components / tasks
audit_log (polymorphic) ──> ALL entities
deadline_config (singleton or per-role/quarter)
```

---

## Table Definitions

### 1. teams

**Purpose:** Organization teams (Product, Design, Engineering, etc.)

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | INT | PK, AUTO_INCREMENT | Unique team identifier |
| team_name | VARCHAR(100) | NOT NULL, UNIQUE | Team display name |
| created_by | INT | FK → users.id | User who created team |
| created_at | TIMESTAMP | NOT NULL, DEFAULT NOW() | Creation timestamp |

**Indexes:**
- PRIMARY KEY (id)
- UNIQUE (team_name)

**Example:**
```sql
INSERT INTO teams (id, team_name, created_by) VALUES
(1, 'Product Management', 1),
(2, 'Design', 1);
```

---

### 2. users

**Purpose:** Platform users with team assignment and manager roles

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | INT | PK, AUTO_INCREMENT | Unique user identifier |
| email | VARCHAR(255) | NOT NULL, UNIQUE | User email (login) |
| role | VARCHAR(100) | NOT NULL | Job title (Product Manager, Designer) |
| team_id | INT | FK → teams.id | Team membership |
| is_manager | INT | NOT NULL, DEFAULT 0 | Manager role level |
| created_at | TIMESTAMP | NOT NULL, DEFAULT NOW() | Creation timestamp |

**is_manager Values:**
- `0` = Regular user
- `1` = Product Lead (can approve Product team)
- `2` = Design Lead (can approve Design team)
- `3` = VP Product (can approve all, configure OKRs)
- `4` = CTO (full admin access)

**Indexes:**
- PRIMARY KEY (id)
- UNIQUE (email)
- INDEX (team_id)
- INDEX (is_manager)

**Example:**
```sql
INSERT INTO users (email, role, team_id, is_manager) VALUES
('pm.lead@company.com', 'Product Lead', 1, 1),
('vp@company.com', 'VP Product', 1, 3),
('pm1@company.com', 'Product Manager', 1, 0);
```

**Access Control:**
- Regular users: See only own data (`WHERE user_id = ?`)
- Managers: See own team data (`WHERE team_id = ?`)
- VP/CTO: See all data

---

### 3. okrs

**Purpose:** OKR definitions by role, year, and quarter

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | Unique OKR identifier |
| role_id | INT | FK → roles.id | Role this OKR applies to |
| year | INT | NOT NULL | Year (2025, 2026, etc.) |
| quarter | INT | NOT NULL | Quarter (1-4) |
| okr_number | INT | NOT NULL | Display order (1, 2, 3...) |
| okr_title | VARCHAR(255) | NOT NULL | OKR name |
| description | TEXT | NULL | Optional description |
| weight | INT | NOT NULL | Weight (0-100%) |
| type | INT | NOT NULL | 0=Qualitative, 1=Quantitative |
| status | INT | NOT NULL, DEFAULT 1 | 0=draft, 1=active, 2=complete, 3=archived |
| tags | VARCHAR(255) | NULL | Comma-separated tags |
| deadline_at | TIMESTAMP | NOT NULL | Submission deadline |
| deadline_missed | BOOLEAN | NOT NULL, DEFAULT FALSE | Deadline exceeded flag |
| completed_date | TIMESTAMP | NULL | When marked complete |
| created_by | INT | FK → users.id | Creator user |
| created_at | TIMESTAMP | NOT NULL, DEFAULT NOW() | Creation timestamp |
| updated_at | TIMESTAMP | NOT NULL, DEFAULT NOW() | Last update timestamp |

**Business Rules:**
- OKR weights per role/year/quarter must sum to 100%
- `deadline_at` defaults to quarter_end + 14 days
- If `deadline_missed=TRUE`, no more submissions allowed

**Indexes:**
- PRIMARY KEY (id)
- INDEX (role_id, year, quarter)
- INDEX (status)
- INDEX (deadline_missed)

**Example:**
```sql
INSERT INTO okrs (id, role_id, year, quarter, okr_number, okr_title, weight, type, status, deadline_at, created_by) VALUES
('550e8400-e29b-41d4-a716-446655440000', 1, 2025, 4, 1, 'Discovery & Customer Alignment', 15, 1, 1, '2025-11-13 23:59:59', 1);
```

**Validation Query:**
```sql
-- Check weights sum to 100% for a quarter
SELECT SUM(weight) as total_weight 
FROM okrs 
WHERE role_id = 1 AND year = 2025 AND quarter = 4 AND status != 3;
-- Must return 100
```

---

### 4. kpi_components

**Purpose:** Individual KPI components that make up each OKR

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | Unique component identifier |
| okr_id | UUID | FK → okrs.id | Parent OKR |
| component_name | VARCHAR(255) | NOT NULL | Component description |
| component_weight | INT | NOT NULL | Weight (0-100%) |
| measurement_type | INT | NOT NULL | 0=count, 1=percentage, 2=score, 3=boolean |
| target_value | DECIMAL(5,2) | NOT NULL | Target to achieve |
| unit | VARCHAR(50) | NOT NULL | Unit label (interviews, %, rating) |
| description | TEXT | NULL | Optional details |
| sort_order | INT | NOT NULL | Display order |
| deadline_at | TIMESTAMP | NOT NULL | Submission deadline (inherited from OKR) |
| deadline_missed | BOOLEAN | NOT NULL, DEFAULT FALSE | Deadline exceeded flag |
| completed_date | TIMESTAMP | NULL | When marked complete |
| counting_method | INT | NOT NULL | 0=cumulative, 1=individual, 2=per_period |
| status | INT | NOT NULL, DEFAULT 0 | 0=active, 3=archived |
| created_at | TIMESTAMP | NOT NULL, DEFAULT NOW() | Creation timestamp |

**measurement_type Examples:**
- `0` (count): "Conduct 5 interviews"
- `1` (percentage): "80% of PRDs complete"
- `2` (score): "3.5/5.0 rating"
- `3` (boolean): "All projects include PD"

**Business Rules:**
- Component weights per OKR must sum to 100%
- `deadline_at` can override parent OKR deadline
- `counting_method` determines how submissions aggregate

**Indexes:**
- PRIMARY KEY (id)
- INDEX (okr_id, status)
- INDEX (sort_order)
- INDEX (deadline_missed)

**Example:**
```sql
INSERT INTO kpi_components (id, okr_id, component_name, component_weight, measurement_type, target_value, unit, sort_order, deadline_at, counting_method, status) VALUES
('660e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440000', 'Conduct at least ONE direct customer interview', 40, 0, 1.00, 'interviews', 1, '2025-11-13 23:59:59', 0, 0);
```

**Validation Query:**
```sql
-- Check component weights sum to 100% for an OKR
SELECT SUM(component_weight) as total_weight 
FROM kpi_components 
WHERE okr_id = '550e8400-e29b-41d4-a716-446655440000' AND status = 0;
-- Must return 100
```

---

### 5. user_kpi_data

**Purpose:** User progress submissions against KPI components (versioned)

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | Unique submission identifier |
| user_id | INT | FK → users.id | User who submitted |
| okr_id | UUID | FK → okrs.id | Parent OKR (denormalized) |
| kpi_component_id | UUID | FK → kpi_components.id | Target component |
| value | DECIMAL(5,2) | NOT NULL | Submitted value |
| numerator | DECIMAL(5,2) | NULL | For percentages (audit trail) |
| denominator | DECIMAL(5,2) | NULL | For percentages (audit trail) |
| version_number | INT | NOT NULL, DEFAULT 1 | Resubmission counter |
| data_source | INT | NOT NULL | 0=manual, 1=jotform, 2=auto |
| evidence_link | VARCHAR(500) | NULL | URL to supporting doc |
| submitted_date | TIMESTAMP | NOT NULL | When submitted |
| status | INT | NOT NULL, DEFAULT 0 | 0=pending, 1=approved, 2=rejected |
| created_at | TIMESTAMP | NOT NULL, DEFAULT NOW() | Creation timestamp |
| updated_at | TIMESTAMP | NOT NULL, DEFAULT NOW() | Last update timestamp |

**status Values:**
- `0` = Pending manager approval
- `1` = Approved (counts toward progress)
- `2` = Rejected (user can resubmit)

**Business Rules:**
- Only `status=1` submissions count toward progress
- `version_number` increments on resubmission after rejection
- `okr_id` denormalized for reporting performance

**Indexes:**
- PRIMARY KEY (id)
- INDEX (user_id, okr_id)
- INDEX (kpi_component_id)
- INDEX (status)
- INDEX (version_number)

**Example:**
```sql
INSERT INTO user_kpi_data (id, user_id, okr_id, kpi_component_id, value, evidence_link, submitted_date, status, version_number, data_source) VALUES
('770e8400-e29b-41d4-a716-446655440002', 12, '550e8400-e29b-41d4-a716-446655440000', '660e8400-e29b-41d4-a716-446655440001', 2.00, 'https://docs.google.com/...', NOW(), 0, 1, 0);
```

**Progress Calculation:**
```sql
-- Calculate component progress
SELECT 
  (SUM(value) / target_value) * 100 as progress_percentage
FROM user_kpi_data ukd
JOIN kpi_components kc ON ukd.kpi_component_id = kc.id
WHERE ukd.user_id = 12 
  AND ukd.kpi_component_id = '660e8400-...' 
  AND ukd.status = 1  -- Only approved
GROUP BY kc.target_value;
```

---

### 6. tasks

**Purpose:** Auto-created approval tasks when user marks component complete

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | Unique task identifier |
| kpi_component_id | UUID | FK → kpi_components.id | Target component |
| user_kpi_data_id | UUID | FK → user_kpi_data.id | Submission to review |
| assigned_to | INT | FK → users.id | Manager user |
| created_by | INT | FK → users.id | User who submitted |
| status | INT | NOT NULL, DEFAULT 0 | 0=pending, 1=approved, 2=rejected, 3=in_review |
| due_date | TIMESTAMP | NOT NULL | Deadline (default +7 days) |
| rejection_reason | TEXT | NULL | Comments if rejected |
| created_at | TIMESTAMP | NOT NULL, DEFAULT NOW() | Creation timestamp |
| updated_at | TIMESTAMP | NOT NULL, DEFAULT NOW() | Last update timestamp |

**Workflow:**
```
User marks complete → Task auto-created → Manager approves/rejects
```

**Indexes:**
- PRIMARY KEY (id)
- INDEX (assigned_to, status)
- INDEX (due_date)
- INDEX (kpi_component_id)

**Example:**
```sql
INSERT INTO tasks (id, kpi_component_id, user_kpi_data_id, assigned_to, created_by, status, due_date) VALUES
('880e8400-e29b-41d4-a716-446655440003', '660e8400-...', '770e8400-...', 1, 12, 0, NOW() + INTERVAL '7 days');
```

---

### 7. task_collaborators

**Purpose:** Additional managers added as collaborators (like ClickUp model)

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | Unique record identifier |
| task_id | UUID | FK → tasks.id | Parent task |
| collaborator_user_id | INT | FK → users.id | Manager added as reviewer |
| added_by | INT | FK → users.id | Who added this collaborator |
| created_at | TIMESTAMP | NOT NULL, DEFAULT NOW() | Creation timestamp |

**Use Case:**
Product Lead assigns task but adds VP as collaborator for visibility.

**Indexes:**
- PRIMARY KEY (id)
- INDEX (task_id)
- INDEX (collaborator_user_id)

---

### 8. comments

**Purpose:** Comments on OKRs, components, and tasks (polymorphic)

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | Unique comment identifier |
| entity_type | VARCHAR(50) | NOT NULL | "OKR", "KPI_Component", "Task" |
| entity_id | VARCHAR(36) | NOT NULL | UUID of target entity |
| comment_text | TEXT | NOT NULL | Comment content |
| is_rejection_flag | BOOLEAN | NOT NULL, DEFAULT FALSE | Triggers email if true |
| created_by | INT | FK → users.id | Comment author |
| created_at | TIMESTAMP | NOT NULL, DEFAULT NOW() | Creation timestamp |

**is_rejection_flag:**
If `true`, triggers email notification to relevant user.

**Indexes:**
- PRIMARY KEY (id)
- INDEX (entity_type, entity_id)
- INDEX (created_by)
- INDEX (is_rejection_flag)

**Example:**
```sql
INSERT INTO comments (id, entity_type, entity_id, comment_text, is_rejection_flag, created_by) VALUES
(UUID(), 'Task', '880e8400-...', 'Evidence link is broken, please resubmit.', TRUE, 1);
```

---

### 9. audit_log

**Purpose:** Immutable audit trail of all platform actions

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | Unique log entry identifier |
| entity_type | VARCHAR(50) | NOT NULL | Type of entity changed |
| entity_id | VARCHAR(36) | NOT NULL | ID of entity (UUID or INT) |
| action | VARCHAR(50) | NOT NULL | created, updated, deleted, approved, rejected |
| old_value | JSON | NULL | Previous state (for updates) |
| new_value | JSON | NULL | New state (for creates/updates) |
| changed_by | INT | FK → users.id | User who made change |
| changed_at | TIMESTAMP | NOT NULL, DEFAULT NOW() | Timestamp of change |
| reason | TEXT | NULL | Optional reason/notes |

**action Values:**
- `created` - New entity
- `updated` - Field changes
- `deleted` - Archive/soft delete
- `approved` - Approval action
- `rejected` - Rejection action
- `reassigned` - Task reassignment

**Indexes:**
- PRIMARY KEY (id)
- INDEX (entity_type, entity_id)
- INDEX (changed_by)
- INDEX (changed_at)
- INDEX (action)

**Example:**
```sql
INSERT INTO audit_log (id, entity_type, entity_id, action, old_value, new_value, changed_by, changed_at) VALUES
(UUID(), 'OKR', '550e8400-...', 'updated', 
  '{"weight": 15, "status": 1}', 
  '{"weight": 20, "status": 1}', 
  1, NOW());
```

**Query Examples:**
```sql
-- Get all changes to an OKR
SELECT * FROM audit_log 
WHERE entity_type = 'OKR' AND entity_id = '550e8400-...' 
ORDER BY changed_at DESC;

-- Get all actions by a user
SELECT * FROM audit_log 
WHERE changed_by = 12 
ORDER BY changed_at DESC;
```

---

### 10. deadline_config

**Purpose:** Configurable deadline settings per quarter/role

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | INT | PK, AUTO_INCREMENT | Unique config identifier |
| role_id | INT | FK → roles.id, NULL | Null = applies to all roles |
| year | INT | NULL | Null = applies to all years |
| quarter | INT | NULL | Null = applies to all quarters |
| days_after_quarter_end | INT | NOT NULL, DEFAULT 14 | Days after quarter ends |
| deadline_exceeded_action | INT | NOT NULL, DEFAULT 0 | 0=stay_pending, 1=auto_reject, 2=auto_approve |
| created_at | TIMESTAMP | NOT NULL, DEFAULT NOW() | Creation timestamp |

**deadline_exceeded_action:**
- `0` = Stay pending (default, manager still decides)
- `1` = Auto-reject (deadline missed = rejected)
- `2` = Auto-approve (lenient mode, not recommended)

**MVP Configuration:**
```sql
-- Global default: 14 days after quarter end, stay pending
INSERT INTO deadline_config (role_id, year, quarter, days_after_quarter_end, deadline_exceeded_action) VALUES
(NULL, NULL, NULL, 14, 0);
```

**Future:** Can override per role/quarter:
```sql
-- Product Manager Q4 2025: 21 days
INSERT INTO deadline_config (role_id, year, quarter, days_after_quarter_end) VALUES
(1, 2025, 4, 21);
```

**Indexes:**
- PRIMARY KEY (id)
- INDEX (role_id, year, quarter)

---

## Common Queries

### 1. Get User's Current Quarter Progress
```sql
SELECT 
  o.okr_title,
  kc.component_name,
  kc.target_value,
  SUM(CASE WHEN ukd.status = 1 THEN ukd.value ELSE 0 END) as achieved_value,
  (SUM(CASE WHEN ukd.status = 1 THEN ukd.value ELSE 0 END) / kc.target_value) * 100 as progress_pct
FROM okrs o
JOIN kpi_components kc ON o.id = kc.okr_id
LEFT JOIN user_kpi_data ukd ON kc.id = ukd.kpi_component_id AND ukd.user_id = ?
WHERE o.year = 2025 AND o.quarter = 4 AND o.status = 1
GROUP BY o.okr_title, kc.component_name, kc.target_value
ORDER BY o.okr_number, kc.sort_order;
```

### 2. Manager Approval Queue
```sql
SELECT 
  t.id as task_id,
  u.email as submitter_email,
  kc.component_name,
  ukd.value,
  ukd.evidence_link,
  t.created_at as submitted_at
FROM tasks t
JOIN user_kpi_data ukd ON t.user_kpi_data_id = ukd.id
JOIN users u ON t.created_by = u.id
JOIN kpi_components kc ON t.kpi_component_id = kc.id
WHERE t.assigned_to = ? AND t.status = 0
ORDER BY t.created_at ASC;
```

### 3. Validate OKR Weights
```sql
SELECT 
  role_id, 
  year, 
  quarter, 
  SUM(weight) as total_weight
FROM okrs
WHERE status != 3  -- Exclude archived
GROUP BY role_id, year, quarter
HAVING SUM(weight) != 100;
-- Should return 0 rows
```

### 4. Audit Trail for Entity
```sql
SELECT 
  al.action,
  al.changed_at,
  u.email as changed_by_email,
  al.old_value,
  al.new_value,
  al.reason
FROM audit_log al
JOIN users u ON al.changed_by = u.id
WHERE al.entity_type = 'OKR' AND al.entity_id = '550e8400-...'
ORDER BY al.changed_at DESC;
```

---

## Migrations

### Phase 3 Sprint 3 Migration (Oct 18, 2025)
```sql
-- Add status column to kpi_components for soft delete
ALTER TABLE kpi_components 
ADD COLUMN status INT NOT NULL DEFAULT 0;

-- Update existing records to active
UPDATE kpi_components SET status = 0;

-- Add indexes
CREATE INDEX idx_kpi_components_okr_status ON kpi_components(okr_id, status);
CREATE INDEX idx_kpi_components_status ON kpi_components(status);
```

### Phase 2 Initial Schema (Oct 15, 2025)
```sql
-- All 10 tables created
-- See /backend/supabase/migrations/001_initial_schema.sql
```

---

## Data Integrity Rules

### 1. Weight Validation
- OKR weights per (role_id, year, quarter) must sum to 100%
- Component weights per (okr_id) must sum to 100%

**Enforced:** Application layer (service validation)

### 2. Soft Delete Cascade
- Archive OKR → Archive all components
- Archive component → DO NOT archive OKR

**Enforced:** Application layer (service logic)

### 3. Audit Logging
- All creates, updates, deletes → audit_log entry
- old_value stored for reversibility

**Enforced:** Application layer (audit service)

### 4. Deadline Enforcement
- If `deadline_missed=TRUE` → No new submissions
- Deadline calculated on OKR creation

**Enforced:** Application layer (service validation)

---

## Performance Optimization

### Indexes Added (Phase 3)
```sql
-- OKRs
CREATE INDEX idx_okrs_role_year_quarter ON okrs(role_id, year, quarter);
CREATE INDEX idx_okrs_status ON okrs(status);
CREATE INDEX idx_okrs_deadline ON okrs(deadline_missed);

-- KPI Components
CREATE INDEX idx_kpi_components_okr ON kpi_components(okr_id);
CREATE INDEX idx_kpi_components_status ON kpi_components(status);

-- User KPI Data
CREATE INDEX idx_user_kpi_data_user_okr ON user_kpi_data(user_id, okr_id);
CREATE INDEX idx_user_kpi_data_component ON user_kpi_data(kpi_component_id);
CREATE INDEX idx_user_kpi_data_status ON user_kpi_data(status);

-- Tasks
CREATE INDEX idx_tasks_assigned_status ON tasks(assigned_to, status);
CREATE INDEX idx_tasks_due_date ON tasks(due_date);

-- Audit Log
CREATE INDEX idx_audit_log_entity ON audit_log(entity_type, entity_id);
CREATE INDEX idx_audit_log_changed_at ON audit_log(changed_at);
```

### Query Performance Targets
- User dashboard: <200ms
- Manager queue: <500ms
- Reporting aggregations: <1s
- Audit trail: <500ms

---

## Backup & Recovery

### Daily Backups (Supabase)
- Automated daily snapshots
- 7-day retention
- Point-in-time recovery

### Disaster Recovery Plan
1. Supabase failure: Restore from snapshot
2. Data corruption: Use audit_log to revert
3. Accidental delete: Restore from status=3 (archived)

---

## References

- [System Architecture](SYSTEM_ARCHITECTURE.md)
- [API Documentation](../API/)
- [Schema JSON](../../kpi_platform_schema_v2.json)
