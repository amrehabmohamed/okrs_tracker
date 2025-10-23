# Error Handling & RFC 7807 Error Catalog

**Version:** 1.0.0  
**Last Updated:** 2025-10-23  
**Standard:** RFC 7807 (Problem Details for HTTP APIs)

---

## Error Response Format

All API errors follow RFC 7807 standard with consistent structure:

```json
{
  "type": "https://api.kpi-platform.com/errors/{error-type}",
  "title": "Human-Readable Error Title",
  "status": 400,
  "detail": "Detailed explanation of what went wrong",
  "instance": "/api/endpoint/that/failed",
  "requestId": "550e8400-e29b-41d4-a716-446655440000",
  "errors": [
    {
      "field": "email",
      "message": "Email is required"
    }
  ]
}
```

### Field Descriptions

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | URI | Yes | Stable error type identifier (use for programmatic handling) |
| `title` | string | Yes | Short human-readable summary |
| `status` | integer | Yes | HTTP status code |
| `detail` | string | Yes | Detailed explanation (may change, don't parse) |
| `instance` | string | Yes | API endpoint that returned error |
| `requestId` | UUID | Yes | Unique request ID for tracking/debugging |
| `errors` | array | No | Field-level validation errors (optional) |

---

## HTTP Status Codes

| Code | Name | Usage |
|------|------|-------|
| 200 | OK | Successful GET, PUT |
| 201 | Created | Successful POST (resource created) |
| 204 | No Content | Successful DELETE |
| 400 | Bad Request | Invalid input, validation error |
| 401 | Unauthorized | Missing or invalid authentication |
| 403 | Forbidden | Authenticated but insufficient permissions |
| 404 | Not Found | Resource doesn't exist |
| 409 | Conflict | Duplicate resource or concurrent modification |
| 422 | Unprocessable Entity | Business logic validation failed |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Server Error | Unexpected server error |
| 503 | Service Unavailable | Temporary service disruption |

---

## Error Catalog

### 400 - Bad Request Errors

#### validation-error

**When:** Invalid input format, missing required fields, type mismatches

```json
{
  "type": "https://api.kpi-platform.com/errors/validation-error",
  "title": "Validation Error",
  "status": 400,
  "detail": "One or more fields failed validation",
  "instance": "/api/auth/signup",
  "requestId": "550e8400-e29b-41d4-a716-446655440000",
  "errors": [
    {
      "field": "email",
      "message": "Email must be valid format"
    },
    {
      "field": "password",
      "message": "Password must be at least 12 characters"
    }
  ]
}
```

**Common causes:**
- Missing required field
- Invalid email format
- Password too short
- Invalid UUID format
- Type mismatch (string vs number)
- Out of range value

**How to fix:** Check request body against OpenAPI schema

---

#### invalid-token

**When:** Malformed JWT token, invalid verification token, expired token

```json
{
  "type": "https://api.kpi-platform.com/errors/invalid-token",
  "title": "Invalid Token",
  "status": 400,
  "detail": "The provided token is invalid or has expired",
  "instance": "/api/auth/verify-email",
  "requestId": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Common causes:**
- Token expired (email verification: 24h, password reset: 1h)
- Token already used (single-use tokens)
- Token tampered with
- Malformed token structure

**How to fix:** Request new token (resend verification, request new reset)

---

#### invalid-query-params

**When:** Query parameters have invalid values

```json
{
  "type": "https://api.kpi-platform.com/errors/invalid-query-params",
  "title": "Invalid Query Parameters",
  "status": 400,
  "detail": "Quarter must be between 1 and 4",
  "instance": "/api/okrs",
  "requestId": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Common causes:**
- quarter not 1-4
- year < 2025
- status not in valid enum
- Invalid UUID format in filter

**How to fix:** Check query parameter constraints in API docs

---

### 401 - Unauthorized Errors

#### unauthorized

**When:** Missing authentication token or token invalid

```json
{
  "type": "https://api.kpi-platform.com/errors/unauthorized",
  "title": "Unauthorized",
  "status": 401,
  "detail": "Missing or invalid authentication token",
  "instance": "/api/auth/me",
  "requestId": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Common causes:**
- No `Authorization` header
- Bearer token missing
- JWT signature invalid
- JWT expired (> 1 hour)

**How to fix:** 
1. Login via `/api/auth/login`
2. Include token: `Authorization: Bearer <token>`
3. If expired, refresh or re-login

---

#### invalid-credentials

**When:** Wrong email/password combination

```json
{
  "type": "https://api.kpi-platform.com/errors/invalid-credentials",
  "title": "Invalid Credentials",
  "status": 401,
  "detail": "Invalid email or password",
  "instance": "/api/auth/login",
  "requestId": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Common causes:**
- Wrong password
- Email not registered
- Typo in credentials

**How to fix:** Verify credentials, use password reset if forgotten

---

#### session-expired

**When:** JWT token expired

```json
{
  "type": "https://api.kpi-platform.com/errors/session-expired",
  "title": "Session Expired",
  "status": 401,
  "detail": "Your session has expired. Please login again.",
  "instance": "/api/okrs",
  "requestId": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Common causes:**
- Token > 1 hour old
- Token invalidated (password changed, logout)

**How to fix:** Call `/api/auth/refresh` or re-login

---

### 403 - Forbidden Errors

#### forbidden

**When:** User authenticated but lacks permission for action

```json
{
  "type": "https://api.kpi-platform.com/errors/forbidden",
  "title": "Forbidden",
  "status": 403,
  "detail": "You do not have permission to perform this action",
  "instance": "/api/okrs",
  "requestId": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Common causes:**
- Regular user trying to create OKR (admin only)
- User trying to view other user's data
- Manager trying to approve outside their team
- Non-manager accessing manager endpoints

**How to fix:** Check role requirements in API docs

---

#### email-not-verified

**When:** Attempting login before email verification

```json
{
  "type": "https://api.kpi-platform.com/errors/email-not-verified",
  "title": "Email Not Verified",
  "status": 403,
  "detail": "Please verify your email address. Check your inbox for verification link.",
  "instance": "/api/auth/login",
  "requestId": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Common causes:**
- User didn't click verification link
- Verification email not received

**How to fix:** Call `/api/auth/resend-verification`

---

#### account-pending-approval

**When:** Email verified but admin hasn't approved

```json
{
  "type": "https://api.kpi-platform.com/errors/account-pending-approval",
  "title": "Account Pending Approval",
  "status": 403,
  "detail": "Your account is awaiting admin approval. You will receive an email once approved.",
  "instance": "/api/auth/login",
  "requestId": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Common causes:**
- Admin hasn't processed approval yet

**How to fix:** Wait for admin approval, contact admin if urgent

---

#### deadline-exceeded

**When:** Attempting to submit/edit after deadline

```json
{
  "type": "https://api.kpi-platform.com/errors/deadline-exceeded",
  "title": "Deadline Exceeded",
  "status": 403,
  "detail": "OKR 'Discovery & Customer Alignment' closed on 2025-11-13. Cannot submit or edit.",
  "instance": "/api/kpi-data",
  "requestId": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Common causes:**
- Quarter deadline passed (default: quarter end + 14 days)
- OKR manually locked by admin

**How to fix:** Cannot submit after deadline (by design)

---

#### access-denied

**When:** Row-level security (RLS) blocks access

```json
{
  "type": "https://api.kpi-platform.com/errors/access-denied",
  "title": "Access Denied",
  "status": 403,
  "detail": "You cannot access data for user ID 456",
  "instance": "/api/users/456/progress",
  "requestId": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Common causes:**
- User trying to view another user's submissions
- Manager trying to view outside their team
- RLS policy blocking query

**How to fix:** Only access your own data or your team's data (if manager)

---

### 404 - Not Found Errors

#### not-found

**When:** Resource doesn't exist

```json
{
  "type": "https://api.kpi-platform.com/errors/not-found",
  "title": "Not Found",
  "status": 404,
  "detail": "OKR with ID '550e8400-e29b-41d4-a716-446655440000' not found",
  "instance": "/api/okrs/550e8400-e29b-41d4-a716-446655440000",
  "requestId": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Common causes:**
- Invalid UUID
- Resource deleted/archived
- Typo in ID
- RLS filtered out the resource

**How to fix:** Verify ID, check if resource exists via list endpoint

---

#### endpoint-not-found

**When:** Invalid API endpoint

```json
{
  "type": "https://api.kpi-platform.com/errors/endpoint-not-found",
  "title": "Endpoint Not Found",
  "status": 404,
  "detail": "The requested endpoint '/api/invalid' does not exist",
  "instance": "/api/invalid",
  "requestId": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Common causes:**
- Typo in URL
- Wrong API version
- Endpoint not implemented yet

**How to fix:** Check API documentation for correct endpoint

---

### 409 - Conflict Errors

#### duplicate-resource

**When:** Attempting to create duplicate resource

```json
{
  "type": "https://api.kpi-platform.com/errors/duplicate-resource",
  "title": "Duplicate Resource",
  "status": 409,
  "detail": "Email 'user@company.com' already exists",
  "instance": "/api/auth/signup",
  "requestId": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Common causes:**
- Email already registered
- Duplicate submission (idempotency issue)

**How to fix:** Use existing resource or modify unique field

---

#### concurrent-modification

**When:** Resource modified by another request

```json
{
  "type": "https://api.kpi-platform.com/errors/concurrent-modification",
  "title": "Concurrent Modification",
  "status": 409,
  "detail": "This resource was modified by another request. Please retry.",
  "instance": "/api/okrs/550e8400-e29b-41d4-a716-446655440000",
  "requestId": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Common causes:**
- Two users editing same OKR simultaneously
- Race condition in concurrent requests

**How to fix:** Reload resource and retry operation

---

### 422 - Unprocessable Entity Errors

#### weight-validation-failed

**When:** Component weights don't sum to 100%

```json
{
  "type": "https://api.kpi-platform.com/errors/weight-validation-failed",
  "title": "Weight Validation Failed",
  "status": 422,
  "detail": "Component weights sum to 110%. Must equal exactly 100%.",
  "instance": "/api/kpi-components",
  "requestId": "550e8400-e29b-41d4-a716-446655440000",
  "currentSum": 110,
  "expectedSum": 100
}
```

**Common causes:**
- Adding component pushes total over 100%
- Deleting component drops total below 100%
- Editing component weight breaks 100% rule

**How to fix:** Adjust weights so all components sum to exactly 100%

---

#### business-logic-error

**When:** Operation violates business rules

```json
{
  "type": "https://api.kpi-platform.com/errors/business-logic-error",
  "title": "Business Logic Error",
  "status": 422,
  "detail": "Cannot archive OKR with approved submissions",
  "instance": "/api/okrs/550e8400-e29b-41d4-a716-446655440000",
  "requestId": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Common causes:**
- Cannot delete OKR with approved data
- Cannot resubmit while pending
- Cannot approve already-approved submission

**How to fix:** Check business rules in documentation

---

### 429 - Rate Limit Errors

#### rate-limit-exceeded

**When:** Too many requests in time window

```json
{
  "type": "https://api.kpi-platform.com/errors/rate-limit-exceeded",
  "title": "Rate Limit Exceeded",
  "status": 429,
  "detail": "Rate limit of 5 requests per 15 minutes exceeded. Try again in 12 minutes.",
  "instance": "/api/auth/login",
  "requestId": "550e8400-e29b-41d4-a716-446655440000",
  "retryAfter": 720
}
```

**Headers:**
```http
X-RateLimit-Limit: 5
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1635945600
Retry-After: 720
```

**Common causes:**
- Brute force attempts
- Automated scripts without rate limiting
- Multiple failed logins

**How to fix:** Wait for time window to reset, implement exponential backoff

---

### 500 - Server Errors

#### internal-server-error

**When:** Unexpected server error

```json
{
  "type": "https://api.kpi-platform.com/errors/internal-server-error",
  "title": "Internal Server Error",
  "status": 500,
  "detail": "An unexpected error occurred. Our team has been notified.",
  "instance": "/api/okrs",
  "requestId": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Common causes:**
- Unhandled exception
- Database connection failure
- Third-party service down

**How to fix:** 
1. Retry request (may be transient)
2. If persists, report with `requestId`
3. Check status page for known issues

---

#### database-error

**When:** Database operation failed

```json
{
  "type": "https://api.kpi-platform.com/errors/database-error",
  "title": "Database Error",
  "status": 500,
  "detail": "Database operation failed. Please try again.",
  "instance": "/api/okrs",
  "requestId": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Common causes:**
- Database timeout
- Connection pool exhausted
- Constraint violation (bug)

**How to fix:** Retry request, report if persists

---

### 503 - Service Unavailable

#### service-unavailable

**When:** Service temporarily unavailable

```json
{
  "type": "https://api.kpi-platform.com/errors/service-unavailable",
  "title": "Service Unavailable",
  "status": 503,
  "detail": "Service temporarily unavailable. Please try again in a few minutes.",
  "instance": "/api/okrs",
  "requestId": "550e8400-e29b-41d4-a716-446655440000",
  "retryAfter": 120
}
```

**Headers:**
```http
Retry-After: 120
```

**Common causes:**
- Maintenance window
- Database overload
- External API down

**How to fix:** Wait and retry after `Retry-After` seconds

---

## Error Handling Best Practices

### For Frontend Developers

```typescript
async function callAPI() {
  try {
    const response = await fetch('/api/okrs', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const error = await response.json();
      
      // Handle specific error types
      switch (error.type) {
        case 'https://api.kpi-platform.com/errors/unauthorized':
        case 'https://api.kpi-platform.com/errors/session-expired':
          // Redirect to login
          window.location.href = '/login';
          break;
          
        case 'https://api.kpi-platform.com/errors/rate-limit-exceeded':
          // Show retry message
          showError(`Too many requests. Try again in ${error.retryAfter} seconds.`);
          break;
          
        case 'https://api.kpi-platform.com/errors/validation-error':
          // Show field-level errors
          error.errors.forEach(e => {
            showFieldError(e.field, e.message);
          });
          break;
          
        default:
          // Generic error handling
          showError(error.detail);
      }
      
      // Log for debugging
      console.error('API Error:', error.requestId, error);
      
      return null;
    }

    return await response.json();
    
  } catch (error) {
    // Network error, timeout, etc
    showError('Network error. Please check your connection.');
    console.error('Network error:', error);
    return null;
  }
}
```

### For Backend Developers

```typescript
// Centralized error handler
app.use((err, req, res, next) => {
  // Generate request ID
  const requestId = req.id || uuidv4();
  
  // Log error
  logger.error({
    requestId,
    error: err.message,
    stack: err.stack,
    endpoint: req.path,
    method: req.method,
    userId: req.user?.id
  });
  
  // Determine error type
  let errorResponse;
  
  if (err.name === 'ValidationError') {
    errorResponse = {
      type: 'https://api.kpi-platform.com/errors/validation-error',
      title: 'Validation Error',
      status: 400,
      detail: err.message,
      instance: req.path,
      requestId,
      errors: err.errors // Field-level errors
    };
  } else if (err.name === 'UnauthorizedError') {
    errorResponse = {
      type: 'https://api.kpi-platform.com/errors/unauthorized',
      title: 'Unauthorized',
      status: 401,
      detail: 'Missing or invalid authentication token',
      instance: req.path,
      requestId
    };
  } else {
    // Default to 500
    errorResponse = {
      type: 'https://api.kpi-platform.com/errors/internal-server-error',
      title: 'Internal Server Error',
      status: 500,
      detail: 'An unexpected error occurred',
      instance: req.path,
      requestId
    };
  }
  
  res.status(errorResponse.status).json(errorResponse);
});
```

---

## Debugging Errors

### Using Request ID

Every error includes a `requestId` for tracking:

```bash
# Search logs by request ID
grep "550e8400-e29b-41d4-a716-446655440000" /var/log/api.log

# Or query logging service
curl -X POST https://logs.example.com/search \
  -d '{"query": "requestId:550e8400-e29b-41d4-a716-446655440000"}'
```

### Common Debugging Steps

1. **Check error type** - Stable identifier for programmatic handling
2. **Read detail message** - Human explanation of what went wrong
3. **Check instance** - Which endpoint failed
4. **Use requestId** - Search logs for full context
5. **Check status code** - Category of error
6. **Review errors array** - Field-level validation details

---

## Testing Error Scenarios

### Manual Testing

```bash
# 400 - Validation error
curl -X POST http://localhost:3001/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"invalid","password":"short"}'

# 401 - Unauthorized
curl -X GET http://localhost:3001/api/auth/me

# 403 - Forbidden (non-admin creates OKR)
curl -X POST http://localhost:3001/api/okrs \
  -H "Authorization: Bearer <user-token>" \
  -d '{"okr_title":"Test"}'

# 404 - Not found
curl -X GET http://localhost:3001/api/okrs/invalid-uuid

# 429 - Rate limit
for i in {1..6}; do
  curl -X POST http://localhost:3001/api/auth/login \
    -d '{"email":"test@example.com","password":"wrong"}'
done
```

### Automated Testing

See `backend/tests/integration/errors.test.ts`

---

**For authentication errors:** See [authentication.md](./authentication.md)  
**For rate limiting:** See [rate-limiting.md](./rate-limiting.md)  
**For API reference:** See [openapi.yaml](./openapi.yaml)
