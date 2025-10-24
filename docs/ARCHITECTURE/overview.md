# System Architecture

**Version:** 2.0  
**Status:** Phase 3 Complete  
**Last Updated:** October 18, 2025

---

## Overview

The KPI Platform is a role-based OKR tracking system with evidence-backed submissions, manager approval workflows, and real-time progress calculation. Built for 10-50 users in a single-tenant architecture with hooks for future multi-tenant expansion.

---

## Technology Stack

### Backend
- **Runtime:** Node.js 20.x
- **Framework:** Express.js 4.x
- **Language:** TypeScript 5.x
- **Database:** PostgreSQL 15.x (Supabase)
- **Auth:** Supabase Auth (JWT)
- **Email:** Mailgun API v3
- **Hosting:** Railway

### Frontend
- **Framework:** React 18.x
- **Language:** TypeScript 5.x
- **UI:** shadcn/ui + Tailwind CSS 3.x
- **State:** React Query 5.x
- **Forms:** React Hook Form 7.x
- **Hosting:** TBD (Phase 8)

### Infrastructure
- **Database:** Supabase (managed PostgreSQL)
- **File Storage:** Supabase Storage
- **Monitoring:** Sentry (future)
- **Logging:** Winston

---

## System Architecture Diagram

```
┌───────────────────────────────────────────────────────────────┐
│                      CLIENT LAYER                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐        │
│  │  React SPA   │  │ Admin Panel  │  │Manager Queue │        │
│  │   (User)     │  │  (Config)    │  │ (Approvals)  │        │
│  └──────────────┘  └──────────────┘  └──────────────┘        │
└───────────────────────────────────────────────────────────────┘
                            │
                    HTTPS + JWT Token
                            │
┌───────────────────────────────────────────────────────────────┐
│                    API GATEWAY LAYER                           │
│             Express.js + Middleware Stack                      │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐             │
│  │    Auth    │  │Rate Limit  │  │   CORS     │             │
│  │ Middleware │  │(100/min)   │  │  Control   │             │
│  └────────────┘  └────────────┘  └────────────┘             │
└───────────────────────────────────────────────────────────────┘
                            │
┌───────────────────────────────────────────────────────────────┐
│                     ROUTING LAYER                              │
│  /api/auth/*  /api/okrs/*  /api/kpi-components/*             │
│  /api/tasks/*  /api/webhooks/*  /api/reports/*               │
└───────────────────────────────────────────────────────────────┘
                            │
┌───────────────────────────────────────────────────────────────┐
│                   CONTROLLER LAYER                             │
│  Thin HTTP handlers - validation, response mapping            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │okrController │  │kpiController │  │taskController│       │
│  └──────────────┘  └──────────────┘  └──────────────┘       │
└───────────────────────────────────────────────────────────────┘
                            │
┌───────────────────────────────────────────────────────────────┐
│                     SERVICE LAYER                              │
│  Business logic, transactions, external APIs                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │  okrService  │  │  kpiService  │  │ auditService │       │
│  └──────────────┘  └──────────────┘  └──────────────┘       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │validationSvc │  │progressCalc  │  │ emailService │       │
│  └──────────────┘  └──────────────┘  └──────────────┘       │
└───────────────────────────────────────────────────────────────┘
                            │
┌───────────────────────────────────────────────────────────────┐
│                   DATABASE LAYER                               │
│              PostgreSQL 15 (Supabase)                          │
│  ┌──────────────────────────────────────────────────────┐    │
│  │ teams │ users │ okrs │ kpi_components               │    │
│  │ user_kpi_data │ tasks │ comments │ audit_log        │    │
│  │ deadline_config │ task_collaborators                 │    │
│  └──────────────────────────────────────────────────────┘    │
└───────────────────────────────────────────────────────────────┘
                            │
┌───────────────────────────────────────────────────────────────┐
│                  EXTERNAL INTEGRATIONS                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │   JotForm    │  │   Mailgun    │  │  Cron Jobs   │       │
│  │  (Webhooks)  │  │   (SMTP)     │  │  (Deadline)  │       │
│  └──────────────┘  └──────────────┘  └──────────────┘       │
└───────────────────────────────────────────────────────────────┘
```

---

## Data Flow Patterns

### 1. User Submission Flow

```
User → Login → JWT issued
  ↓
Dashboard loads → GET /api/users/me/progress
  ├─ Query user_kpi_data (WHERE user_id = token.user_id)
  ├─ Calculate progress (approved submissions only)
  └─ Return { overall_progress: 85%, okrs: [...] }
  ↓
User submits count form → POST /api/kpi-data
  ├─ Validate input (Zod schema)
  ├─ Check deadline_missed flag
  ├─ Create user_kpi_data row (status=pending)
  └─ Return 201 Created
  ↓
User marks complete → POST /api/kpi-components/:id/mark-complete
  ├─ Create Task (assigned_to=manager_id)
  ├─ Audit log entry
  ├─ Email to manager
  └─ Return task_id
```

### 2. Manager Approval Flow

```
Manager receives email → Clicks link
  ↓
Approval queue → GET /api/tasks?status=pending&assigned_to=me
  ├─ Verify manager owns team
  └─ Return pending tasks
  ↓
Manager reviews → GET /api/tasks/:id
  ├─ Fetch Task + User_KPI_Data + Comments
  └─ Return task details
  ↓
Manager approves → PUT /api/tasks/:id/approve
  ├─ Update task.status = 1
  ├─ Update user_kpi_data.status = 1
  ├─ Audit log entry
  └─ Progress recalculated on next query
  
OR

Manager rejects → PUT /api/tasks/:id/reject
  ├─ Update task.status = 2
  ├─ Create Comment with reason
  ├─ Email user
  └─ User can resubmit (version++)
```

### 3. Admin Configuration Flow

```
Admin creates OKR → POST /api/okrs
  ├─ Validate weights sum to 100% (within quarter/role)
  ├─ Calculate deadline (quarter_end + 14 days)
  ├─ Create OKR row
  ├─ Audit log entry
  └─ Return OKR with ID
  ↓
Admin adds components → POST /api/kpi-components
  ├─ Validate component weights sum to 100% (within OKR)
  ├─ Create component row
  ├─ Audit log entry
  └─ Return component with ID
```

### 4. JotForm Integration Flow (Future - Phase 7)

```
PM generates form → POST /api/form-links
  ├─ Create unique evaluee_id token
  ├─ Store in form_links table
  └─ Return JotForm URL
  ↓
Attendees submit → JotForm webhook fires
  ↓
POST /api/webhooks/jotform
  ├─ Verify HMAC signature
  ├─ Lookup evaluee_id → user_id
  ├─ Parse responses, calculate average
  ├─ Create user_kpi_data (status=1 auto-approved)
  └─ Return 200 OK
```

---

## Security Architecture

### Authentication
- **JWT Tokens** issued by Supabase Auth
- **Expiry:** 24 hours
- **Refresh:** Automatic via Supabase client
- **Storage:** HTTP-only cookies (frontend)

### Authorization (Access Control)
```typescript
// Middleware: authenticate
- Verify JWT signature
- Extract user_id, is_manager
- Attach to req.user

// Middleware: requireAdmin
- Check req.user.is_manager >= 3
- Reject if false (403 Forbidden)

// Service layer: Row-level security
- All queries filter by user_id or team_id
- Managers see own team only
- VP/CTO see all teams
```

### Access Control Matrix

| Role | Own Data | Team Data | All Data | Config OKRs | Approve Tasks |
|------|----------|-----------|----------|-------------|---------------|
| User | ✅ | ❌ | ❌ | ❌ | ❌ |
| Product Lead | ✅ | ✅ | ❌ | ❌ | ✅ (own team) |
| Design Lead | ✅ | ✅ | ❌ | ❌ | ✅ (own team) |
| VP Product | ✅ | ✅ | ✅ | ✅ | ✅ (all teams) |
| CTO | ✅ | ✅ | ✅ | ✅ | ✅ (all teams) |

### Data Protection
- **Passwords:** Hashed via Supabase Auth (bcrypt)
- **Secrets:** Environment variables only
- **Evidence Links:** User-provided URLs (validated format)
- **Audit Trail:** Immutable (append-only)

---

## Database Design Principles

### 1. Soft Delete Pattern
All entities use `status` field for archival:
- `status=0`: Active
- `status=3`: Archived (soft deleted)

**Why:** Preserves foreign key integrity, enables audit trail, allows restoration.

### 2. Weight Validation
- OKR weights per role/quarter must sum to 100%
- Component weights per OKR must sum to 100%

**Why:** Ensures precise progress calculation.

### 3. Versioning
`user_kpi_data` includes `version_number`:
- Initial submission: version=1
- Rejection → resubmit: version=2, 3, etc.

**Why:** Preserves submission history, enables audit trail.

### 4. Denormalization
`user_kpi_data` includes `okr_id` (duplicate):
```sql
user_kpi_data
  ├─ kpi_component_id (normalized)
  └─ okr_id (denormalized for reporting)
```

**Why:** Faster reporting queries (avoid JOIN).

### 5. Audit Logging
Every mutation logged in `audit_log`:
```typescript
{
  entity_type: "OKR",
  entity_id: "uuid",
  action: "updated",
  old_value: {...},
  new_value: {...},
  changed_by: user_id,
  changed_at: timestamp
}
```

---

## Scalability Design

### Current Capacity (MVP)
- **Users:** 10-50
- **OKRs:** 50-100 per quarter
- **Submissions:** 500-1000 per quarter
- **API Load:** <100 req/min

### Bottlenecks Identified
1. **Progress calculation** (N+1 queries)
2. **No caching** (recalculate every request)
3. **No pagination** (fetch all submissions)

### Future Optimizations

#### Phase 5-6 (Pre-launch)
- Add progress calculation cache (Redis)
- Implement pagination (20 items/page)
- Add database indexes (query optimization)

#### Post-MVP (6+ months)
- Partition `user_kpi_data` by user_id + year
- Add read replicas for reporting
- Implement CDN for frontend assets
- Add database connection pooling

---

## Error Handling Strategy

### Error Classes
```typescript
AppError (base)
├─ ValidationError (400)
├─ NotFoundError (404)
├─ AuthorizationError (403)
└─ ConflictError (409)
```

### Error Response Format
```json
{
  "error": {
    "status": 400,
    "message": "OKR weights must sum to 100%",
    "code": "WEIGHT_SUM_INVALID",
    "details": {
      "current_sum": 95,
      "expected_sum": 100
    }
  }
}
```

### Retry Logic
- **Email failures:** 3 retries, exponential backoff
- **Webhook failures:** 3 retries, log error, alert admin
- **Database timeouts:** No retry, return 503

---

## Monitoring & Observability

### Health Checks
- `GET /health` - API server status
- `GET /health/db` - Database connectivity
- `GET /health/email` - Mailgun status (future)

### Logging Levels
```typescript
logger.error() // Critical failures (DB down, auth failed)
logger.warn()  // Degraded (email timeout, webhook retry)
logger.info()  // Normal ops (user login, submission created)
logger.debug() // Development only (query traces)
```

### Metrics (Future - Sentry)
- API response times (P50, P95, P99)
- Error rates by endpoint
- Database query performance
- Email delivery rates

---

## Deployment Architecture

### Development
```
Local → Docker Compose
├─ Backend (port 3000)
├─ Frontend (port 5173)
└─ PostgreSQL (Supabase cloud)
```

### Staging (Phase 8)
```
Railway (backend) + TBD (frontend)
├─ Supabase staging project
└─ Mailgun sandbox
```

### Production (Phase 8)
```
Railway (backend) + TBD (frontend)
├─ Supabase production project
├─ Mailgun production domain
└─ Sentry error tracking
```

---

## Integration Points

### Supabase
- **Database:** PostgreSQL client
- **Auth:** JWT validation
- **Storage:** Evidence file uploads (future)

### Mailgun
- **SMTP:** Transactional emails
- **Templates:** Rejection notifications, task assignments
- **Webhooks:** Bounce/delivery tracking (future)

### JotForm (Phase 7)
- **Webhooks:** Survey response ingestion
- **HMAC:** Signature verification
- **Payload:** JSON response data

---

## Key Design Decisions

### Why Express over Next.js API routes?
- Simpler deployment (Railway single service)
- Better separation of concerns
- Easier to add WebSocket support later

### Why Supabase over raw PostgreSQL?
- Built-in auth saves 2 weeks
- Managed database (no DevOps)
- Free tier sufficient for MVP

### Why shadcn/ui over Material-UI?
- Minimal bundle size
- Full customization
- Tailwind integration

### Why soft delete over hard delete?
- Preserves foreign key integrity
- Enables audit trail
- Allows data restoration
- Prevents accidental loss

### Why JWT over session cookies?
- Stateless (no session store needed)
- Works across domains (future API)
- Supabase native support

---

## Future Architecture Considerations

### Multi-Tenant Support (Post-MVP)
```sql
-- Add workspace_id to all tables
ALTER TABLE users ADD COLUMN workspace_id UUID;
ALTER TABLE okrs ADD COLUMN workspace_id UUID;

-- Row-level security per workspace
WHERE workspace_id = req.user.workspace_id
```

### Microservices Split (12+ months)
```
Current: Monolith (Express)
Future:
  ├─ Auth Service (Supabase)
  ├─ API Gateway (Express)
  ├─ OKR Service (Node.js)
  ├─ Submission Service (Node.js)
  ├─ Notification Service (Node.js)
  └─ Reporting Service (Python/Pandas)
```

### Real-Time Features (Phase 8+)
- WebSocket for live progress updates
- Server-Sent Events for notification feed
- Redis Pub/Sub for multi-instance sync

---

## References

- [Database Schema](DATABASE_SCHEMA.md)
- [API Documentation](../API/)
- [Local Setup Guide](../GUIDES/LOCAL_DEV_SETUP.md)
- [Deployment Guide](../GUIDES/DEPLOYMENT.md)
