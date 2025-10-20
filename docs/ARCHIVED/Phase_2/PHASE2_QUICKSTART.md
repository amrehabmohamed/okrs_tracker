# Phase 2 Quick Start

## 1. Setup Supabase (5 minutes)

1. Create project at https://supabase.com
2. Get credentials: Settings → API
3. Update `.env`:
   ```env
   SUPABASE_URL=https://xxx.supabase.co
   SUPABASE_ANON_KEY=eyJhbG...
   SUPABASE_SERVICE_ROLE_KEY=eyJhbG...
   FRONTEND_URL=http://localhost:5173
   ```

## 2. Run Database Migration (2 minutes)

1. Open Supabase → SQL Editor
2. Copy content from `backend/src/migrations/001_auth_setup.sql`
3. Paste and run
4. Verify: `SELECT * FROM public."Users";`

## 3. Configure Email Auth (3 minutes)

1. Supabase → Authentication → Providers
2. Enable Email
3. Check "Confirm email"
4. Add redirect URL: `http://localhost:5173/auth/verify-email`

## 4. Start Backend (1 minute)

```bash
cd backend
npm install
npm run dev
```

## 5. Test Endpoints (2 minutes)

```bash
# Health check
curl http://localhost:3000/health

# Signup
curl -X POST http://localhost:3000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@test.com",
    "password": "Password123!",
    "first_name": "Test",
    "last_name": "User"
  }'
```

## 6. Create Admin (1 minute)

1. Sign up via API
2. Find user in Supabase → Authentication → Users
3. Copy UUID
4. Run in SQL Editor:
   ```sql
   UPDATE public."Users" 
   SET status = 'approved', is_manager = 4 
   WHERE id = 'YOUR_UUID';
   ```

## Done! ✅

**Total time: ~15 minutes**

Test full flow: See `docs/PHASE2_TESTING.md`
