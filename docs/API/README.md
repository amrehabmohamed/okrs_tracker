# KPI Platform API Documentation

**Version:** 1.0.0  
**Status:** Active Development  
**Last Updated:** 2025-10-23

---

## Quick Start

### Base URLs

| Environment | URL | Status |
|------------|-----|--------|
| Local | `http://localhost:3001/api` | Active |
| Staging | `https://api-staging.kpi-platform.com/api` | TBD |
| Production | `https://api.kpi-platform.com/api` | TBD |

### Authentication

All authenticated endpoints require a JWT token in the Authorization header:

```http
Authorization: Bearer <your-jwt-token>
```

Get your token via `POST /auth/login`. See [Authentication Guide](./authentication.md) for details.

---

## Documentation Index

| Document | Description |
|----------|-------------|
| [OpenAPI Specification](./openapi.yaml) | Complete API spec (OpenAPI 3.0) |
| [Authentication](./authentication.md) | Auth flows, JWT, RLS, roles |
| [Error Handling](./errors.md) | RFC 7807 error catalog |
| [Rate Limiting](./rate-limiting.md) | Per-endpoint rate limits |
| [Postman Collection](./postman-collection.json) | Import into Postman |

---

## API Overview

### Phase 2: Authentication & User Management ✅ Implemented

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/auth/signup` | POST | No | Create new user account |
| `/auth/verify-email` | POST | No | Verify email address |
| `/auth/login` | POST | No | Login and get JWT token |
| `/auth/logout` | POST | Yes | Logout and invalidate token |
| `/auth/me` | GET | Yes | Get current user info |
| `/auth/password-reset` | POST | No | Request password reset |
| `/auth/password-change` | POST | Yes | Change password (logged in) |
| `/auth/password-update` | POST | No | Update password via reset link |
| `/auth/resend-verification` | POST | No | Resend verification email |
| `/auth/check-email-available` | POST | No | Check if email is available |

### Phase 3: OKR & KPI Configuration ✅ Implemented

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/okrs` | GET | Yes | List OKRs (filterable) |
| `/okrs/:id` | GET | Yes | Get single OKR with components |
| `/okrs` | POST | Admin | Create new OKR |
| `/okrs/:id` | PUT | Admin | Update OKR |
| `/okrs/:id` | DELETE | Admin | Archive OKR (soft delete) |
| `/okrs/:id/restore` | POST | Admin | Restore archived OKR |
| `/kpi-components` | GET | Yes | List KPI components |
| `/kpi-components` | POST | Admin | Create KPI component |
| `/kpi-components/:id` | PUT | Admin | Update KPI component |
| `/kpi-components/:id` | DELETE | Admin | Archive component |

### Phase 4: Data Submission ⏳ Planned

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/kpi-data` | POST | Yes | Submit KPI data (4 form types) |
| `/users/me/kpi-data` | GET | Yes | Get user's submissions |
| `/users/me/submissions-history` | GET | Yes | Get full submission history |

### Phase 5: Progress Calculation ⏳ Planned

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/users/me/progress` | GET | Yes | Get user's progress |
| `/users/me/progress/historical` | GET | Yes | Get historical progress |

### Phase 6: Task Management ⏳ Planned

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/kpi-components/:id/mark-complete` | POST | Yes | Mark component complete (creates task) |
| `/tasks` | GET | Manager | List tasks (approval queue) |
| `/tasks/:id` | GET | Manager | Get task details |
| `/tasks/:id/approve` | PUT | Manager | Approve submission |
| `/tasks/:id/reject` | PUT | Manager | Reject submission |
| `/tasks/:id/due-date` | PUT | Manager | Update task due date |
| `/tasks/:id/add-collaborator` | PUT | Manager | Add task collaborator |
| `/comments` | POST | Yes | Add comment |
| `/comments` | GET | Yes | List comments |

### Phase 7: Manager Dashboard ⏳ Planned

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/manager/team-progress` | GET | Manager | Get team progress |
| `/manager/team-progress-detail/:user_id` | GET | Manager | Get user detail |
| `/manager/team-comparison` | GET | Manager | Compare quarters |
| `/manager/export-team-progress` | POST | Manager | Export to CSV |
| `/admin/audit-logs` | GET | Admin | View audit logs |
| `/admin/system-metrics` | GET | Admin | System health metrics |
| `/admin/system-errors` | GET | Admin | System error log |

### Phase 8: Webhooks ⏳ Planned

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/webhooks/jotform` | POST | HMAC | JotForm survey webhook |

---

## Response Format

### Success Response

```json
{
  "data": { ... },
  "meta": {
    "timestamp": "2025-10-23T15:00:00Z",
    "version": "1.0.0"
  }
}
```

### Error Response (RFC 7807)

```json
{
  "type": "https://api.kpi-platform.com/errors/validation-error",
  "title": "Validation Error",
  "status": 400,
  "detail": "Email is required",
  "instance": "/api/auth/signup",
  "requestId": "550e8400-e29b-41d4-a716-446655440000"
}
```

See [Error Handling](./errors.md) for complete error catalog.

---

## HTTP Status Codes

| Code | Meaning | Usage |
|------|---------|-------|
| 200 | OK | Successful GET, PUT |
| 201 | Created | Successful POST |
| 204 | No Content | Successful DELETE |
| 400 | Bad Request | Validation error |
| 401 | Unauthorized | Missing/invalid token |
| 403 | Forbidden | Insufficient permissions |
| 404 | Not Found | Resource doesn't exist |
| 409 | Conflict | Duplicate/concurrent modification |
| 422 | Unprocessable Entity | Business logic error |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Server Error | Server error |
| 503 | Service Unavailable | Temporary unavailability |

---

## Rate Limiting

See [Rate Limiting Guide](./rate-limiting.md) for per-endpoint limits.

**Default limits:**
- General endpoints: 100 requests / 15 minutes
- Auth endpoints: 5 requests / 15 minutes
- Webhooks: 1000 requests / hour

**Headers:**
```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1635945600
```

---

## Versioning

API version is specified in the `Accept` header:

```http
Accept: application/vnd.kpi-platform.v1+json
```

Breaking changes will increment the major version (v2, v3, etc).

---

## Getting Started

### 1. Import OpenAPI Spec

Import `openapi.yaml` into:
- **Postman**: File → Import → OpenAPI 3.0
- **Insomnia**: Create → Import → From File
- **Swagger UI**: Load spec URL
- **Code Gen**: `openapi-generator-cli generate`

### 2. Get Auth Token

```bash
# Signup
curl -X POST http://localhost:3001/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "SecurePass123!",
    "firstName": "John",
    "lastName": "Doe"
  }'

# Login (after email verification + admin approval)
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "SecurePass123!"
  }'
```

### 3. Make Authenticated Request

```bash
curl -X GET http://localhost:3001/api/auth/me \
  -H "Authorization: Bearer <your-token>"
```

---

## Testing

### Unit Tests
```bash
npm run test:unit
```

### Integration Tests
```bash
npm run test:integration
```

### API Tests (Postman)
1. Import `postman-collection.json`
2. Set environment variables (base_url, token)
3. Run collection

---

## Support

**Questions?** See [Technical Implementation Plan](../technical-implementation-plan.md)

**Bugs?** Check [Implementation Roadmap](../implementation-roadmap.md)

**Security issues?** Email security@kpi-platform.com

---

**Last Updated:** 2025-10-23  
**Status:** Ready for parallel development  
**Next:** See [OpenAPI Spec](./openapi.yaml) for complete API reference
