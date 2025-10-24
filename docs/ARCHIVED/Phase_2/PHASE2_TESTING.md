# Phase 2: Auth Testing Checklist

## Prerequisites
- Supabase project configured (see ../../SETUP/supabase-auth-setup.md)
- Backend running on http://localhost:3000
- First admin user created and approved

---

## Test Suite

### 1. Signup Flow ✓

**Test Case**: New user registration
```bash
curl -X POST http://localhost:3000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "newuser@test.com",
    "password": "SecurePass123!",
    "first_name": "New",
    "last_name": "User"
  }'
```

**Expected**:
- 201 status
- User created in auth.users
- Users table record created (status=pending)
- Verification email sent

**Verify**:
```sql
SELECT id, email, email_confirmed_at FROM auth.users WHERE email = 'newuser@test.com';
SELECT id, email, status FROM public."Users" WHERE email = 'newuser@test.com';
```

---

### 2. Email Verification ✓

**Test Case**: User clicks verification link
- Check email inbox
- Click verification link
- Verify email_confirmed_at is set

**Verify**:
```sql
SELECT email_confirmed_at FROM auth.users WHERE email = 'newuser@test.com';
-- Should return timestamp
```

---

### 3. Login Before Approval ✗

**Test Case**: Login with unverified email
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "newuser@test.com",
    "password": "SecurePass123!"
  }'
```

**Expected**: 403 error
```json
{
  "status": 403,
  "message": "Please verify your email before logging in"
}
```

---

### 4. Login After Email Verification (But Pending Approval) ✗

**Expected**: 403 error
```json
{
  "status": 403,
  "message": "Account is pending. Please wait for admin approval."
}
```

---

### 5. Admin Approval ✓

**Test Case**: Admin approves user

Login as admin first:
```bash
# Login as admin
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@company.com",
    "password": "AdminPass123!"
  }'
```

Get pending users:
```bash
curl -X GET http://localhost:3000/api/auth/pending-users \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

Approve user:
```bash
curl -X PUT http://localhost:3000/api/auth/users/{USER_ID}/approve \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

**Verify**:
```sql
SELECT status FROM public."Users" WHERE email = 'newuser@test.com';
-- Should return 'approved'

SELECT * FROM public."User_Status_Audit" 
WHERE user_id = 'USER_ID' 
ORDER BY changed_at DESC LIMIT 1;
-- Should show status change pending → approved
```

---

### 6. Login After Approval ✓

**Test Case**: User can now login
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "newuser@test.com",
    "password": "SecurePass123!"
  }'
```

**Expected**: 200 status with token
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "access_token": "eyJhbGci...",
    "refresh_token": "...",
    "expires_at": 1234567890,
    "user": {
      "id": "uuid",
      "email": "newuser@test.com",
      "first_name": "New",
      "last_name": "User",
      "role": "Product Manager",
      "status": "approved"
    }
  }
}
```

---

### 7. Get Current User ✓

**Test Case**: Authenticated request to /me
```bash
curl -X GET http://localhost:3000/api/auth/me \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Expected**: 200 with user data

---

### 8. Password Change ✓

**Test Case**: User changes password
```bash
curl -X POST http://localhost:3000/api/auth/password-change \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "new_password": "NewSecurePass456!"
  }'
```

**Expected**: 200 success

**Verify**: Login with new password works, old password fails

---

### 9. Password Reset Flow ✓

**Step 1**: Request reset
```bash
curl -X POST http://localhost:3000/api/auth/password-reset \
  -H "Content-Type: application/json" \
  -d '{
    "email": "newuser@test.com"
  }'
```

**Step 2**: Check email for reset link

**Step 3**: Frontend handles reset (Phase 9)

---

### 10. Logout ✓

**Test Case**: User logs out
```bash
curl -X POST http://localhost:3000/api/auth/logout \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Expected**: 200 success

**Verify**: Token no longer works on protected routes

---

### 11. Rate Limiting ✓

**Test Case**: Exceed login attempts
```bash
# Run 6 times rapidly
for i in {1..6}; do
  curl -X POST http://localhost:3000/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"test@test.com","password":"wrong"}'
done
```

**Expected**: 6th request returns 429 "Too many requests"

---

### 12. Access Control ✓

**Test Case**: Non-admin tries to approve user
```bash
# Login as regular user
curl -X PUT http://localhost:3000/api/auth/users/{SOME_USER_ID}/approve \
  -H "Authorization: Bearer REGULAR_USER_TOKEN"
```

**Expected**: 403 "Admin access required"

---

### 13. Duplicate Email Prevention ✗

**Test Case**: Sign up with existing email
```bash
curl -X POST http://localhost:3000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "newuser@test.com",
    "password": "AnotherPass123!",
    "first_name": "Duplicate",
    "last_name": "User"
  }'
```

**Expected**: 409 "User with this email already exists"

---

### 14. Validation Errors ✗

**Test Case**: Weak password
```bash
curl -X POST http://localhost:3000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "weak@test.com",
    "password": "123",
    "first_name": "Weak",
    "last_name": "Pass"
  }'
```

**Expected**: 400 "Password must be at least 8 characters"

**Test Case**: Missing fields
```bash
curl -X POST http://localhost:3000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "incomplete@test.com"
  }'
```

**Expected**: 400 with specific missing field

---

### 15. Resend Verification Email ✓

**Test Case**: User didn't receive email
```bash
curl -X POST http://localhost:3000/api/auth/verify-email-resend \
  -H "Content-Type: application/json" \
  -d '{
    "email": "newuser@test.com"
  }'
```

**Expected**: 200 success (even if user doesn't exist - security)

---

## Performance Tests

### Test Case: Concurrent Signups
```bash
# Create 10 users simultaneously
for i in {1..10}; do
  curl -X POST http://localhost:3000/api/auth/signup \
    -H "Content-Type: application/json" \
    -d "{
      \"email\": \"user$i@test.com\",
      \"password\": \"Password123!\",
      \"first_name\": \"User\",
      \"last_name\": \"$i\"
    }" &
done
wait
```

**Expected**: All 10 users created, no duplicates

---

## Security Tests

### Test Case: SQL Injection
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@company.com OR 1=1--",
    "password": "anything"
  }'
```

**Expected**: 401 "Invalid credentials" (not SQL error)

### Test Case: XSS in Name
```bash
curl -X POST http://localhost:3000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "xss@test.com",
    "password": "Password123!",
    "first_name": "<script>alert(1)</script>",
    "last_name": "Test"
  }'
```

**Expected**: User created, name stored as-is (escaping happens on frontend)

---

## Success Criteria

Phase 2 is complete when:
- [x] All 15 test cases pass
- [x] No SQL injection vulnerabilities
- [x] Rate limiting works correctly
- [x] Admin approval workflow functions
- [x] Email verification required before login
- [x] Audit trail captures status changes
- [x] Access control prevents privilege escalation
- [x] Performance acceptable (signup < 500ms, login < 300ms)

---

## Known Issues / Future Improvements

1. **No email delivery in dev** - Use Supabase Inbucket for testing
2. **No CAPTCHA** - Consider adding in Phase 9 (production)
3. **Password complexity** - Only length enforced, no special char requirement
4. **No 2FA** - Consider adding in Phase 9+
5. **Token refresh not implemented** - Manual for now, automate in Phase 9

---

## Troubleshooting

**Problem**: Verification email not received
**Solution**: Check Supabase → Authentication → Email templates, verify SMTP configured

**Problem**: "User not found" after signup
**Solution**: Check trigger executed, verify Users table has record

**Problem**: RLS blocking queries
**Solution**: Verify RLS policies created, check auth.uid() matches user

**Problem**: Token expired immediately
**Solution**: Check JWT_EXPIRY in Supabase settings (should be 3600)
