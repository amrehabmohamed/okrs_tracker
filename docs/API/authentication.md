# Authentication & Authorization

**Version:** 1.0.0  
**Last Updated:** 2025-10-23

---

## Overview

The KPI Platform uses JWT (JSON Web Tokens) for stateless authentication combined with Row-Level Security (RLS) for data access control.

**Key Features:**
- Email/password authentication via Supabase Auth
- JWT tokens with 1-hour expiry
- Refresh token support
- Role-based access control (RBAC)
- Row-level security (RLS) enforcement
- Rate limiting on auth endpoints

---

## Authentication Flow

### 1. User Registration

```
User → POST /api/auth/signup
     → Verification email sent
     → Admin approval required
     → Can login after both complete
```

**Request:**
```http
POST /api/auth/signup
Content-Type: application/json

{
  "email": "newuser@company.com",
  "password": "SecurePass123!",
  "firstName": "Jane",
  "lastName": "Doe",
  "team_id": 1
}
```

**Response:**
```json
{
  "userId": 123,
  "status": "pending_verification",
  "message": "Verification email sent to newuser@company.com"
}
```

**States:**
1. `pending_verification` - Email not verified
2. `pending_approval` - Email verified, awaiting admin
3. `approved` - Can login

### 2. Email Verification

User clicks link in email:
```
https://app.kpi-platform.com/verify?token=eyJhbGci...
```

Frontend calls:
```http
POST /api/auth/verify-email
Content-Type: application/json

{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Token expires:** 24 hours

### 3. Admin Approval

Admin approves via dashboard:
```http
PUT /api/admin/users/{id}/approve
```

User receives email notification.

### 4. Login

```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@company.com",
  "password": "SecurePass123!"
}
```

**Response:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoxMjMsImVtYWlsIjoidXNlckBjb21wYW55LmNvbSIsInJvbGUiOiJQcm9kdWN0IE1hbmFnZXIiLCJ0ZWFtX2lkIjoxLCJpc19tYW5hZ2VyIjowLCJpYXQiOjE2MzU5NDU2MDAsImV4cCI6MTYzNTk0OTIwMH0.abc123...",
  "user": {
    "id": 123,
    "email": "user@company.com",
    "firstName": "Jane",
    "lastName": "Doe",
    "role": "Product Manager",
    "team_id": 1,
    "is_manager": 0
  },
  "expiresIn": 3600
}
```

**Error Cases:**
- `400` - Invalid credentials format
- `401` - Wrong password
- `403` - Email not verified or not approved
- `429` - Rate limit exceeded (5 attempts/15 min)

---

## JWT Token Structure

### Token Payload

```json
{
  "user_id": 123,
  "email": "user@company.com",
  "role": "Product Manager",
  "team_id": 1,
  "is_manager": 0,
  "iat": 1635945600,
  "exp": 1635949200
}
```

### Token Claims

| Claim | Type | Description |
|-------|------|-------------|
| `user_id` | integer | User's unique ID |
| `email` | string | User's email |
| `role` | string | User's role name |
| `team_id` | integer | User's team ID |
| `is_manager` | integer | 0=user, 1=product_lead, 2=design_lead, 3=vp_product, 4=cto |
| `iat` | timestamp | Issued at (Unix timestamp) |
| `exp` | timestamp | Expires at (Unix timestamp) |

### Using the Token

**Every authenticated request:**
```http
GET /api/auth/me
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Token validation:**
1. Signature verified
2. Expiry checked
3. Claims extracted
4. RLS policies applied

---

## Authorization Model

### Roles & Permissions

| Role | is_manager | Permissions |
|------|-----------|-------------|
| Regular User | 0 | - View own OKRs<br>- Submit own data<br>- View own progress<br>- Cannot view others |
| Product Lead | 1 | - All user permissions<br>- View team progress<br>- Approve team submissions<br>- Manage team tasks |
| Design Lead | 2 | - All user permissions<br>- View design team<br>- Approve design team<br>- Manage design tasks |
| VP Product | 3 | - All manager permissions<br>- View all teams<br>- Cross-team reporting<br>- Admin functions |
| CTO | 4 | - Full system access<br>- All admin functions<br>- Audit log access<br>- System configuration |

### Row-Level Security (RLS)

**Enforcement:** PostgreSQL RLS policies on all tables

**Example: User_KPI_Data access**

```sql
-- User can only see own data
CREATE POLICY user_kpi_data_select_own ON User_KPI_Data
FOR SELECT
USING (user_id = auth.uid());

-- Manager can see team's data
CREATE POLICY user_kpi_data_select_team ON User_KPI_Data
FOR SELECT
USING (
  team_id IN (
    SELECT team_id FROM Users WHERE id = auth.uid() AND is_manager > 0
  )
);

-- VP can see all
CREATE POLICY user_kpi_data_select_vp ON User_KPI_Data
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM Users WHERE id = auth.uid() AND is_manager >= 3
  )
);
```

### Access Control Matrix

| Resource | Owner | Team Member | Manager | VP/CTO |
|----------|-------|-------------|---------|--------|
| Own OKRs | Read | - | Read | Read |
| Own Submissions | CRUD | - | Read | Read |
| Team Submissions | - | - | Read + Approve | Read + Approve |
| All Submissions | - | - | - | Read + Approve |
| OKR Config | - | - | - | CRUD |
| System Config | - | - | - | CRUD |
| Audit Logs | Own | - | Team | All |

**Legend:**
- CRUD = Create, Read, Update, Delete
- Read = View only
- Approve = Can approve/reject

---

## Password Requirements

### Validation Rules

- **Minimum length:** 12 characters
- **Must include:**
  - At least 1 uppercase letter (A-Z)
  - At least 1 lowercase letter (a-z)
  - At least 1 number (0-9)
- **Cannot be:**
  - Email address
  - Common passwords (checked against list)
  - Previous password (stored hash comparison)

### Password Reset Flow

```
User → POST /auth/password-reset {email}
     → Email sent with reset link (if account exists)
     → User clicks link
     → POST /auth/password-update {token, newPassword}
     → Password updated
     → Confirmation email sent
```

**Reset token expires:** 1 hour  
**Reset link single-use:** Yes

### Password Change (Logged In)

```http
POST /api/auth/password-change
Authorization: Bearer <token>
Content-Type: application/json

{
  "oldPassword": "OldPass123!",
  "newPassword": "NewPass456!"
}
```

**Validation:**
- Old password must be correct
- New password must meet requirements
- New password cannot equal old password

---

## Session Management

### Token Lifecycle

```
Login → Token issued (1h expiry)
      → Store in secure cookie (HTTP-only, Secure, SameSite)
      → Use for authenticated requests
      → Token expires after 1h
      → Refresh or re-login required
```

### Token Refresh

```http
POST /api/auth/refresh
Authorization: Bearer <expired-token>
```

**Response:**
```json
{
  "token": "new-jwt-token...",
  "expiresIn": 3600
}
```

**Refresh conditions:**
- Old token valid but expired within last 24h
- User still approved in system
- No security flags

### Logout

```http
POST /api/auth/logout
Authorization: Bearer <token>
```

**Actions:**
1. Token added to blacklist (Redis)
2. Session cleared
3. Cookie removed

---

## Security Best Practices

### For Frontend Developers

✅ **DO:**
- Store JWT in HTTP-only cookie
- Send token in `Authorization: Bearer` header
- Check token expiry before requests
- Handle 401 errors (redirect to login)
- Clear token on logout
- Use HTTPS in production

❌ **DON'T:**
- Store JWT in localStorage (XSS risk)
- Log JWT tokens
- Share tokens between users
- Hard-code credentials
- Skip HTTPS in production

### For Backend Developers

✅ **DO:**
- Validate JWT signature on every request
- Check token expiry
- Enforce RLS policies in all queries
- Log authentication failures
- Rate limit auth endpoints
- Use bcrypt for password hashing
- Rotate JWT secrets periodically

❌ **DON'T:**
- Trust frontend validation
- Skip RLS checks
- Log passwords or tokens
- Use weak JWT secrets
- Allow brute force attempts
- Trust `is_manager` from request body

---

## Rate Limiting

### Auth Endpoint Limits

| Endpoint | Limit | Window | Lockout |
|----------|-------|--------|---------|
| `/auth/signup` | 5 | 15 min | 15 min |
| `/auth/login` | 5 failed | 15 min | 15 min |
| `/auth/password-reset` | 3 | 15 min | 15 min |
| `/auth/verify-email` | 10 | 15 min | - |
| `/auth/resend-verification` | 10 | 15 min | - |

**Headers:**
```http
X-RateLimit-Limit: 5
X-RateLimit-Remaining: 3
X-RateLimit-Reset: 1635945600
```

**Error (429):**
```json
{
  "type": "https://api.kpi-platform.com/errors/rate-limit-exceeded",
  "title": "Rate Limit Exceeded",
  "status": 429,
  "detail": "Rate limit of 5 requests per 15 minutes exceeded. Try again in 14 minutes.",
  "instance": "/api/auth/login",
  "requestId": "550e8400-e29b-41d4-a716-446655440000"
}
```

---

## Error Handling

### Common Auth Errors

**400 Bad Request**
```json
{
  "type": "https://api.kpi-platform.com/errors/validation-error",
  "title": "Validation Error",
  "status": 400,
  "detail": "Password must be at least 12 characters",
  "instance": "/api/auth/signup",
  "errors": [
    {
      "field": "password",
      "message": "Must be at least 12 characters"
    }
  ]
}
```

**401 Unauthorized**
```json
{
  "type": "https://api.kpi-platform.com/errors/unauthorized",
  "title": "Unauthorized",
  "status": 401,
  "detail": "Invalid email or password",
  "instance": "/api/auth/login"
}
```

**403 Forbidden**
```json
{
  "type": "https://api.kpi-platform.com/errors/forbidden",
  "title": "Forbidden",
  "status": 403,
  "detail": "Email not verified. Check your inbox for verification link.",
  "instance": "/api/auth/login"
}
```

---

## Testing Authentication

### Manual Testing

```bash
# 1. Signup
TOKEN=$(curl -X POST http://localhost:3001/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"TestPass123!","firstName":"Test","lastName":"User"}')

# 2. Verify email (get token from email)
curl -X POST http://localhost:3001/api/auth/verify-email \
  -H "Content-Type: application/json" \
  -d '{"token":"<verification-token>"}'

# 3. Admin approves (separate admin action)

# 4. Login
TOKEN=$(curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"TestPass123!"}' \
  | jq -r '.token')

# 5. Use token
curl -X GET http://localhost:3001/api/auth/me \
  -H "Authorization: Bearer $TOKEN"
```

### Automated Testing

See `backend/tests/integration/auth.test.ts` for comprehensive test suite.

**Key test scenarios:**
- ✅ Signup with valid/invalid data
- ✅ Email verification success/failure
- ✅ Login before/after verification
- ✅ Login before/after approval
- ✅ Token validation
- ✅ Rate limiting
- ✅ Password reset flow
- ✅ RLS policy enforcement

---

## Troubleshooting

### "Token expired"

**Cause:** JWT token past 1-hour expiry  
**Solution:** Call `/auth/refresh` or re-login

### "Email not verified"

**Cause:** User hasn't clicked verification link  
**Solution:** Resend verification email

### "Account pending approval"

**Cause:** Admin hasn't approved account  
**Solution:** Contact admin

### "Rate limit exceeded"

**Cause:** Too many attempts in 15-minute window  
**Solution:** Wait for lockout to expire

### "Forbidden - Insufficient permissions"

**Cause:** User lacks required role/permissions  
**Solution:** Check `is_manager` value and RLS policies

---

## Migration from Previous Auth

**Breaking changes in v1.0:**
- JWT expiry reduced from 24h → 1h
- Added email verification requirement
- Added admin approval requirement
- Stricter password requirements (12 chars min)

**Migration steps:**
1. Existing users auto-verified
2. Existing users auto-approved
3. Passwords must be changed on next login if < 12 chars

---

**For detailed error catalog:** See [errors.md](./errors.md)  
**For rate limiting:** See [rate-limiting.md](./rate-limiting.md)  
**For API reference:** See [openapi.yaml](./openapi.yaml)
