# Supabase Auth Setup Guide

## Prerequisites
- Supabase account created at https://supabase.com
- Project created in Supabase dashboard

---

## Step 1: Enable Email Auth

1. Go to **Authentication** → **Providers** in Supabase dashboard
2. Enable **Email** provider
3. Configure settings:
   - ✅ Enable email provider
   - ✅ Confirm email (REQUIRED - prevents fake signups)
   - ✅ Secure email change (prevents account takeover)
   - ⏱️ Email rate limit: 5 requests per hour (prevents spam)

---

## Step 2: Configure Email Templates

Navigate to **Authentication** → **Email Templates**

### A. Confirm Signup Template
```html
<h2>Confirm Your Email</h2>
<p>Thanks for signing up for OKRs Tracker!</p>
<p>Click the link below to verify your email address:</p>
<p><a href="{{ .ConfirmationURL }}">Verify Email</a></p>
<p>If you didn't create this account, you can safely ignore this email.</p>
```

### B. Magic Link Template (Optional)
```html
<h2>Sign in to OKRs Tracker</h2>
<p>Click the link below to sign in:</p>
<p><a href="{{ .ConfirmationURL }}">Sign In</a></p>
<p>This link expires in 1 hour.</p>
```

### C. Password Reset Template
```html
<h2>Reset Your Password</h2>
<p>You requested to reset your password for OKRs Tracker.</p>
<p>Click the link below to create a new password:</p>
<p><a href="{{ .ConfirmationURL }}">Reset Password</a></p>
<p>If you didn't request this, you can safely ignore this email.</p>
<p>This link expires in 1 hour.</p>
```

### D. Email Change Template
```html
<h2>Confirm Email Change</h2>
<p>You requested to change your email address.</p>
<p>Click the link below to confirm this change:</p>
<p><a href="{{ .ConfirmationURL }}">Confirm Email Change</a></p>
<p>If you didn't request this, contact support immediately.</p>
```

---

## Step 3: Configure Auth Settings

Go to **Authentication** → **URL Configuration**

### Site URL
```
Development: http://localhost:5173
Production: https://yourapp.com
```

### Redirect URLs (Add these)
```
http://localhost:5173/auth/verify-email
http://localhost:5173/auth/reset-password
http://localhost:5173/auth/callback
https://yourapp.com/auth/verify-email
https://yourapp.com/auth/reset-password
https://yourapp.com/auth/callback
```

---

## Step 4: Security Settings

Go to **Authentication** → **Settings**

### Session Settings
- **JWT Expiry**: 3600 seconds (1 hour)
- **Refresh Token Expiry**: 2592000 seconds (30 days)
- **Maximum Session Duration**: 604800 seconds (7 days)

### Password Requirements
- ✅ Minimum password length: 8 characters
- ⚠️ Consider enabling: Password complexity rules (Phase 9+)

### Rate Limiting
- **Max requests per hour**: 100 (per IP)
- **Email rate limit**: 5 per hour (prevents spam)

---

## Step 5: Run Database Migrations

1. Copy migration content from:
   ```
   backend/src/migrations/001_auth_setup.sql
   ```

2. In Supabase dashboard:
   - Go to **SQL Editor**
   - Click **New Query**
   - Paste entire migration script
   - Click **Run**

3. Verify tables created:
   ```sql
   SELECT * FROM public."Users" LIMIT 1;
   SELECT * FROM public."User_Status_Audit" LIMIT 1;
   ```

---

## Step 6: Create First Admin User

### Option A: Via UI (Recommended)
1. Sign up via frontend as normal user
2. In Supabase dashboard → **Authentication** → **Users**
3. Find your user, copy UUID
4. Run in SQL Editor:
   ```sql
   UPDATE public."Users" 
   SET status = 'approved', is_manager = 4 
   WHERE id = 'your-user-uuid-here';
   ```

### Option B: Manual Insert (Dangerous)
```sql
-- Only use if absolutely necessary
-- Replace values with real data
INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_user_meta_data,
  created_at,
  updated_at
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  gen_random_uuid(),
  'authenticated',
  'authenticated',
  'admin@company.com',
  crypt('YourPassword123!', gen_salt('bf')),
  NOW(),
  '{"first_name":"Admin","last_name":"User"}',
  NOW(),
  NOW()
);

-- Then approve in Users table
UPDATE public."Users" 
SET status = 'approved', is_manager = 4 
WHERE email = 'admin@company.com';
```

---

## Step 7: Test Auth Flow

### Test Signup
```bash
curl -X POST http://localhost:3000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Password123!",
    "first_name": "Test",
    "last_name": "User"
  }'
```

Expected response:
```json
{
  "success": true,
  "message": "Registration successful. Please check your email to verify your account.",
  "data": {
    "user_id": "uuid-here",
    "email": "test@example.com",
    "email_confirmed": false,
    "status": "pending"
  }
}
```

### Test Login (Before Email Verification)
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Password123!"
  }'
```

Expected error:
```json
{
  "status": 403,
  "message": "Please verify your email before logging in"
}
```

### After Email Verification (But Before Approval)
Expected error:
```json
{
  "status": 403,
  "message": "Account is pending. Please wait for admin approval."
}
```

### After Admin Approval
Should return access token and user data.

---

## Step 8: Environment Variables

Update `.env` with Supabase credentials:

```env
# Get these from Supabase Dashboard → Settings → API
SUPABASE_URL=https://yourproject.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Frontend URL (for email redirects)
FRONTEND_URL=http://localhost:5173

# Server config
PORT=3000
NODE_ENV=development
```

---

## Common Issues & Solutions

### Issue 1: "User not found" after signup
**Cause**: Trigger didn't fire
**Fix**: Run trigger creation script again, check Supabase logs

### Issue 2: Email not sending
**Cause**: Email provider not enabled or SMTP not configured
**Fix**: Check Authentication → Providers → Email is enabled

### Issue 3: "Invalid token" on protected routes
**Cause**: Token expired or malformed
**Fix**: Re-login to get fresh token

### Issue 4: RLS policy blocking queries
**Cause**: RLS enabled but no matching policy
**Fix**: Run RLS policies from migration script

### Issue 5: User can login before email verification
**Cause**: "Confirm email" setting disabled
**Fix**: Enable in Authentication → Providers → Email settings

---

## Security Checklist

- [x] Email confirmation required
- [x] RLS policies enabled on Users table
- [x] Admin approval workflow implemented
- [x] Rate limiting on auth endpoints
- [x] Password minimum length enforced
- [x] Secure email change enabled
- [x] JWT expiry set to 1 hour
- [x] Refresh tokens expire after 30 days
- [x] Status audit log captures all changes

---

## Next Steps (Phase 3)

Once auth is working:
1. Create Teams table
2. Add team_id validation on signup
3. Implement manager hierarchy
4. Build OKR configuration endpoints

---

## Support Resources

- [Supabase Auth Docs](https://supabase.com/docs/guides/auth)
- [Supabase RLS Guide](https://supabase.com/docs/guides/auth/row-level-security)
- [Email Templates Guide](https://supabase.com/docs/guides/auth/auth-email-templates)
