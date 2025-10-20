# Authentication Flow

**Auth Provider:** Supabase Auth  
**Token Type:** JWT (JSON Web Tokens)  
**Expiry:** 24 hours  
**Refresh:** Automatic via Supabase client

---

## Architecture Diagram

```
┌──────────────────────────────────────────────────────────┐
│                    CLIENT (Browser)                       │
│                                                           │
│  User enters email/password                              │
│  Clicks "Sign Up" or "Login"                             │
└─────────────────────┬────────────────────────────────────┘
                      │
                      │ HTTPS POST
                      ↓
┌──────────────────────────────────────────────────────────┐
│                   SUPABASE AUTH API                       │
│                                                           │
│  1. Validate credentials                                 │
│  2. Generate JWT token                                   │
│  3. Return: { access_token, refresh_token, user }        │
└─────────────────────┬────────────────────────────────────┘
                      │
                      │ JWT Token
                      ↓
┌──────────────────────────────────────────────────────────┐
│                    CLIENT STORAGE                         │
│                                                           │
│  Store in: localStorage / sessionStorage                 │
│  Format: { access_token: "eyJhbG...", user: {...} }      │
└─────────────────────┬────────────────────────────────────┘
                      │
                      │ Include in API requests
                      ↓
┌──────────────────────────────────────────────────────────┐
│                 BACKEND API (Express)                     │
│                                                           │
│  Middleware: authenticate()                              │
│  1. Extract Authorization header                         │
│  2. Verify JWT signature with Supabase                   │
│  3. Decode user_id, is_manager                           │
│  4. Attach to req.user                                   │
└─────────────────────┬────────────────────────────────────┘
                      │
                      │ Access Granted
                      ↓
┌──────────────────────────────────────────────────────────┐
│                  CONTROLLER LAYER                         │
│                                                           │
│  req.user available: { id, email, is_manager }           │
│  Apply role-based access control                         │
└──────────────────────────────────────────────────────────┘
```

---

## Sign Up Flow

### 1. User Registration

**Frontend:**
```typescript
// POST /api/auth/signup
const response = await fetch('/api/auth/signup', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'pm1@company.com',
    password: 'SecurePass123!',
    first_name: 'John',
    last_name: 'Doe',
    team_id: 1,
    role: 'Product Manager'
  })
});
```

**Backend (`authController.ts`):**
```typescript
// 1. Validate input (Zod schema)
// 2. Create Supabase Auth user
const { data, error } = await supabase.auth.signUp({
  email,
  password,
  options: {
    data: { first_name, last_name }
  }
});

// 3. Create user record in users table
await supabase.from('users').insert({
  id: data.user.id,
  email,
  role,
  team_id,
  is_manager: 0 // Default regular user
});

// 4. Send verification email (Supabase handles this)
```

**Response:**
```json
{
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "pm1@company.com",
    "email_confirmed_at": null
  },
  "message": "Check your email to verify your account"
}
```

### 2. Email Verification

**Supabase automatically sends:**
```
From: noreply@mail.app.supabase.io
Subject: Confirm your email

Click here to confirm: https://[project].supabase.co/auth/v1/verify?token=...
```

**User clicks link:**
- Supabase marks `email_confirmed_at`
- User can now log in

---

## Login Flow

### 1. User Authentication

**Frontend:**
```typescript
const response = await fetch('/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'pm1@company.com',
    password: 'SecurePass123!'
  })
});
```

**Backend (`authController.ts`):**
```typescript
// 1. Authenticate with Supabase
const { data, error } = await supabase.auth.signInWithPassword({
  email,
  password
});

// 2. Fetch user details from users table
const { data: userData } = await supabase
  .from('users')
  .select('*')
  .eq('id', data.user.id)
  .single();

// 3. Return JWT + user data
```

**Response:**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "v1.refresh_token...",
  "expires_in": 3600,
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "pm1@company.com",
    "role": "Product Manager",
    "team_id": 1,
    "is_manager": 0
  }
}
```

### 2. Store Token

**Frontend (`localStorage`):**
```typescript
localStorage.setItem('access_token', response.access_token);
localStorage.setItem('refresh_token', response.refresh_token);
localStorage.setItem('user', JSON.stringify(response.user));
```

---

## Authenticated API Requests

### Request Format

**Frontend:**
```typescript
const token = localStorage.getItem('access_token');

const response = await fetch('/api/okrs', {
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
});
```

### Backend Validation

**Middleware (`authenticate.ts`):**
```typescript
export async function authenticate(req, res, next) {
  try {
    // 1. Extract token
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }
    
    const token = authHeader.substring(7);
    
    // 2. Verify JWT with Supabase
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error || !user) {
      return res.status(401).json({ error: 'Invalid token' });
    }
    
    // 3. Fetch user details
    const { data: userData } = await supabase
      .from('users')
      .select('*')
      .eq('id', user.id)
      .single();
    
    // 4. Attach to request
    req.user = {
      id: userData.id,
      email: userData.email,
      team_id: userData.team_id,
      is_manager: userData.is_manager
    };
    
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Authentication failed' });
  }
}
```

---

## Role-Based Access Control

### Admin Check Middleware

**Middleware (`requireAdmin.ts`):**
```typescript
export function requireAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  
  // is_manager >= 3 (VP Product or CTO)
  if (req.user.is_manager < 3) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  
  next();
}
```

**Usage in routes:**
```typescript
// Only admins can configure OKRs
router.post('/okrs', authenticate, requireAdmin, okrController.createOKR);
```

### Manager Check Middleware

**Middleware (`requireManager.ts`):**
```typescript
export function requireManager(req, res, next) {
  // is_manager >= 1 (any manager level)
  if (req.user.is_manager < 1) {
    return res.status(403).json({ error: 'Manager access required' });
  }
  
  next();
}
```

**Usage:**
```typescript
// Managers can approve tasks
router.put('/tasks/:id/approve', authenticate, requireManager, taskController.approve);
```

---

## Token Refresh Flow

### Automatic Refresh (Supabase Client)

**Frontend (handled by Supabase):**
```typescript
// Supabase client automatically refreshes expired tokens
const { data, error } = await supabase.auth.refreshSession({
  refresh_token: localStorage.getItem('refresh_token')
});

if (data) {
  localStorage.setItem('access_token', data.access_token);
}
```

**Triggers:**
- Access token expires (24 hours)
- API returns 401 Unauthorized
- User navigates to new page

---

## Logout Flow

**Frontend:**
```typescript
const response = await fetch('/api/auth/logout', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`
  }
});

// Clear local storage
localStorage.removeItem('access_token');
localStorage.removeItem('refresh_token');
localStorage.removeItem('user');

// Redirect to login
window.location.href = '/login';
```

**Backend:**
```typescript
// Supabase session invalidation
await supabase.auth.signOut();
```

---

## Password Reset Flow

### 1. Request Reset

**Frontend:**
```typescript
await fetch('/api/auth/reset-password', {
  method: 'POST',
  body: JSON.stringify({ email: 'pm1@company.com' })
});
```

**Backend:**
```typescript
// Send reset email via Supabase
await supabase.auth.resetPasswordForEmail(email, {
  redirectTo: 'https://app.company.com/reset-password'
});
```

### 2. User Receives Email

```
From: noreply@mail.app.supabase.io
Subject: Reset your password

Click here: https://[project].supabase.co/auth/v1/verify?token=...&type=recovery
```

### 3. Update Password

**Frontend:**
```typescript
await fetch('/api/auth/update-password', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${recovery_token}` },
  body: JSON.stringify({
    password: 'NewSecurePass456!'
  })
});
```

---

## Security Features

### 1. JWT Validation

**What Supabase verifies:**
- Signature (HMAC-SHA256)
- Expiration (`exp` claim)
- Issuer (`iss` claim)
- Audience (`aud` claim)

**JWT Structure:**
```json
{
  "sub": "550e8400-e29b-41d4-a716-446655440000",
  "email": "pm1@company.com",
  "role": "authenticated",
  "aud": "authenticated",
  "exp": 1729346400,
  "iss": "https://[project].supabase.co/auth/v1"
}
```

### 2. Password Requirements

**Enforced by Supabase:**
- Minimum 8 characters
- No maximum (recommendation: 72 chars)
- No complexity requirements (but recommended)

**Recommended validation:**
```typescript
const passwordSchema = z.string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Z]/, 'Must contain uppercase letter')
  .regex(/[a-z]/, 'Must contain lowercase letter')
  .regex(/[0-9]/, 'Must contain number')
  .regex(/[^A-Za-z0-9]/, 'Must contain special character');
```

### 3. Rate Limiting

**Per-endpoint limits:**
```typescript
// Login attempts: 5 per 15 minutes per IP
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: 'Too many login attempts, try again later'
});

router.post('/login', loginLimiter, authController.login);
```

### 4. HTTPS Only

**Production:**
- All traffic encrypted (TLS 1.3)
- Supabase enforces HTTPS
- Backend enforces HTTPS

---

## Access Control Matrix

| Endpoint | Public | User | Manager | Admin |
|----------|--------|------|---------|-------|
| POST /auth/signup | ✅ | ✅ | ✅ | ✅ |
| POST /auth/login | ✅ | ✅ | ✅ | ✅ |
| GET /api/okrs | ❌ | ✅ | ✅ | ✅ |
| POST /api/okrs | ❌ | ❌ | ❌ | ✅ |
| GET /api/users/me/progress | ❌ | ✅ (own) | ✅ (team) | ✅ (all) |
| PUT /api/tasks/:id/approve | ❌ | ❌ | ✅ | ✅ |

---

## Error Codes

| Code | Message | Cause |
|------|---------|-------|
| 401 | Not authenticated | Missing or invalid token |
| 403 | Forbidden | Insufficient permissions |
| 422 | Invalid credentials | Wrong email/password |
| 429 | Too many requests | Rate limit exceeded |

---

## Testing Authentication

### Manual Testing

**1. Sign up:**
```bash
curl -X POST http://localhost:3000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Test123!@#",
    "first_name": "Test",
    "last_name": "User",
    "team_id": 1,
    "role": "Product Manager"
  }'
```

**2. Login:**
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Test123!@#"
  }'

# Copy access_token from response
```

**3. Authenticated request:**
```bash
curl http://localhost:3000/api/okrs \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

---

## Common Issues

### Issue: "Email not confirmed"

**Cause:** User hasn't clicked verification email

**Fix:**
1. Check spam folder
2. Resend verification (Supabase dashboard)
3. Or manually confirm in Supabase → Auth → Users

---

### Issue: "Invalid token"

**Cause:** Token expired or malformed

**Fix:**
- Refresh token
- Re-login
- Check token format in Authorization header

---

### Issue: 403 Forbidden on admin endpoint

**Cause:** User `is_manager < 3`

**Fix:**
- Update user in Supabase:
```sql
UPDATE users SET is_manager = 3 WHERE email = 'admin@company.com';
```

---

## References

- [Supabase Auth Docs](https://supabase.com/docs/guides/auth)
- [JWT Specification](https://jwt.io)
- [System Architecture](../ARCHITECTURE/SYSTEM_ARCHITECTURE.md)
- [Database Schema](../ARCHITECTURE/DATABASE_SCHEMA.md)
