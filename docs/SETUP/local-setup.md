# Local Development Setup

**Time Required:** 30 minutes  
**Prerequisites:** Node.js 20+, Git, Supabase account

---

## Quick Start (5 Commands)

```bash
git clone https://github.com/amrehabmohamed/okrs_tracker.git
cd "OKRs Tracker"
cd backend && npm install && cp .env.example .env
cd ../frontend && npm install
# Edit backend/.env with Supabase credentials
cd backend && npm run dev  # Terminal 1
cd frontend && npm run dev # Terminal 2
```

Visit: http://localhost:3000/health

---

## Detailed Setup

### 1. System Requirements

| Tool | Version | Purpose |
|------|---------|---------|
| Node.js | 20.x | Runtime |
| npm | 10.x | Package manager |
| Git | 2.x | Version control |
| VS Code | Latest | Editor (recommended) |
| Supabase Account | - | Database + Auth |

**Check versions:**
```bash
node --version  # Should be v20.x
npm --version   # Should be 10.x
git --version   # Any 2.x
```

---

### 2. Clone Repository

```bash
git clone <repo-url>
cd "OKRs Tracker"
```

**Project structure:**
```
OKRs Tracker/
├── backend/           # Express API
│   ├── src/
│   ├── .env.example
│   └── package.json
├── frontend/          # React app
│   ├── src/
│   └── package.json
└── docs/             # Documentation
```

---

### 3. Backend Setup (15 min)

#### 3.1 Install Dependencies
```bash
cd backend
npm install
```

**Expected packages:**
- express (API framework)
- typescript (Type safety)
- @supabase/supabase-js (Database client)
- zod (Validation)
- winston (Logging)

#### 3.2 Configure Supabase

**A. Create Supabase Project**

1. Use existing project: https://supabase.com/dashboard/project/gcskudcupdyvnrtepsct
   (Or create new if needed at [supabase.com](https://supabase.com))
2. Project Name: `okr-platform-dev`
4. Database Password: (save this)
5. Region: Closest to you
6. Wait 2 minutes for provisioning

**B. Get API Credentials**

In Supabase Dashboard (https://supabase.com/dashboard/project/gcskudcupdyvnrtepsct):
1. Settings → API
2. Copy:
   - `Project URL`: https://gcskudcupdyvnrtepsct.supabase.co
   - `anon public` key (starts with `eyJ...`)

**C. Create Environment File**

```bash
cp .env.example .env
```

Edit `backend/.env`:
```env
# Supabase
SUPABASE_URL=https://gcskudcupdyvnrtepsct.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Server
PORT=3000
NODE_ENV=development

# Email (Optional for Phase 3)
MAILGUN_API_KEY=
MAILGUN_DOMAIN=
```

#### 3.3 Run Database Migrations

**A. Via Supabase Dashboard:**

1. Supabase Dashboard → SQL Editor
2. Copy contents of `/backend/supabase/migrations/001_initial_schema.sql`
3. Paste into SQL Editor
4. Click "Run"
5. Verify: Should see 10 tables created

**B. Verify Tables:**

Run in SQL Editor:
```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public';
```

**Expected tables:**
- teams
- users
- okrs
- kpi_components
- user_kpi_data
- tasks
- task_collaborators
- comments
- audit_log
- deadline_config

#### 3.4 Seed Test Data

Run in SQL Editor:
```sql
-- Create teams
INSERT INTO teams (team_name, created_by) VALUES
('Product Management', 1),
('Design', 1);

-- Create admin user (Supabase Auth must be configured first)
-- See SETUP/supabase-auth-setup.md for user creation

-- Create deadline config
INSERT INTO deadline_config (role_id, year, quarter, days_after_quarter_end, deadline_exceeded_action)
VALUES (NULL, NULL, NULL, 14, 0);
```

**Note:** For full seed data, see `/backend/supabase/seed.sql`

#### 3.5 Start Backend

```bash
npm run dev
```

**Expected output:**
```
[INFO] Server starting on port 3000
[INFO] Supabase connected
[INFO] Server ready at http://localhost:3000
```

**Test health check:**
```bash
curl http://localhost:3000/health
# Response: {"status":"ok"}
```

---

### 4. Frontend Setup (10 min)

#### 4.1 Install Dependencies
```bash
cd ../frontend
npm install
```

**Expected packages:**
- react (UI framework)
- typescript (Type safety)
- @tanstack/react-query (Server state)
- tailwindcss (Styling)
- react-router-dom (Routing)

#### 4.2 Configure Environment

Create `frontend/.env`:
```env
VITE_API_URL=http://localhost:3000
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Note:** Use same Supabase credentials as backend.

#### 4.3 Start Frontend

```bash
npm run dev
```

**Expected output:**
```
VITE v5.0.0  ready in 500 ms

➜  Local:   http://localhost:5173/
➜  Network: use --host to expose
```

**Open browser:** http://localhost:5173

---

### 5. Verify Setup (5 min)

#### 5.1 Backend Health Check

**Terminal 1:**
```bash
curl http://localhost:3000/health
```

**Expected:** `{"status":"ok"}`

#### 5.2 Database Connection

**Terminal 1:**
```bash
curl http://localhost:3000/api/okrs
```

**Expected:** `[]` (empty array, or OKRs if seeded)

#### 5.3 Frontend Load

**Browser:** http://localhost:5173

**Expected:** Login page loads without errors

#### 5.4 Check Console Logs

**Backend Terminal:**
- No error messages
- Should see `[INFO]` logs only

**Frontend Browser Console (F12):**
- No red errors
- May see warnings (safe to ignore)

---

## Common Issues & Fixes

### Issue: "Supabase URL is not defined"

**Cause:** Missing `.env` file

**Fix:**
```bash
cd backend
cp .env.example .env
# Edit .env with your Supabase credentials
```

---

### Issue: "Port 3000 already in use"

**Cause:** Another app using port 3000

**Fix A - Kill process:**
```bash
lsof -ti:3000 | xargs kill -9
npm run dev
```

**Fix B - Use different port:**

Edit `backend/.env`:
```env
PORT=3001
```

Then update `frontend/.env`:
```env
VITE_API_URL=http://localhost:3001
```

---

### Issue: "Cannot find module '@supabase/supabase-js'"

**Cause:** Dependencies not installed

**Fix:**
```bash
cd backend
rm -rf node_modules package-lock.json
npm install
```

---

### Issue: "relation 'okrs' does not exist"

**Cause:** Database migrations not run

**Fix:**
1. Open Supabase Dashboard → SQL Editor
2. Run migration from `/backend/supabase/migrations/001_initial_schema.sql`
3. Restart backend: `npm run dev`

---

### Issue: "401 Unauthorized" when calling API

**Cause:** Missing Supabase auth token

**Expected:** Phase 3 complete, auth not required yet.

**Verify:** Check if endpoint requires auth:
```typescript
// backend/src/routes/okr.ts
router.get("/", authenticate, requireAdmin, okrController.listOKRs);
//            ^ Auth required  ^ Admin required
```

---

### Issue: Frontend shows "Network Error"

**Cause:** Backend not running or CORS issue

**Fix:**
1. Verify backend running: `curl http://localhost:3000/health`
2. Check CORS config in `backend/src/app.ts`:
```typescript
app.use(cors({
  origin: "http://localhost:5173",
  credentials: true
}));
```

---

## Development Workflow

### Daily Startup

**Terminal 1 - Backend:**
```bash
cd backend
npm run dev
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
```

**Terminal 3 - Git (optional):**
```bash
git status
git pull origin main
```

### Making Changes

**Backend code change:**
- Files auto-reload (nodemon)
- Check Terminal 1 for errors

**Frontend code change:**
- Files auto-reload (Vite HMR)
- Check browser console for errors

**Database schema change:**
1. Create new migration file: `/backend/supabase/migrations/002_your_change.sql`
2. Run in Supabase SQL Editor
3. Restart backend

### Testing Changes

**Backend:**
```bash
# Manual API test
curl http://localhost:3000/api/okrs

# Run test suite (future)
npm test
```

**Frontend:**
- Open http://localhost:5173
- Check browser console (F12)
- Verify UI changes

---

## VS Code Setup (Recommended)

### Install Extensions

1. **ESLint** - Linting
2. **Prettier** - Code formatting
3. **TypeScript** - Type checking
4. **Tailwind CSS IntelliSense** - CSS autocomplete

### Workspace Settings

Create `.vscode/settings.json`:
```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "typescript.tsdk": "node_modules/typescript/lib",
  "eslint.validate": ["typescript", "typescriptreact"]
}
```

### Debugging

Create `.vscode/launch.json`:
```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Debug Backend",
      "program": "${workspaceFolder}/backend/src/index.ts",
      "preLaunchTask": "tsc: build - backend/tsconfig.json",
      "outFiles": ["${workspaceFolder}/backend/dist/**/*.js"]
    }
  ]
}
```

---

## Environment Variables Reference

### Backend (.env)

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| SUPABASE_URL | ✅ | Supabase project URL | https://abc.supabase.co |
| SUPABASE_ANON_KEY | ✅ | Supabase anon key | eyJhbGci... |
| PORT | ❌ | API port (default 3000) | 3000 |
| NODE_ENV | ❌ | Environment | development |
| MAILGUN_API_KEY | ❌ | Email API key | key-abc123... |
| MAILGUN_DOMAIN | ❌ | Email domain | mg.example.com |

### Frontend (.env)

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| VITE_API_URL | ✅ | Backend API URL | http://localhost:3000 |
| VITE_SUPABASE_URL | ✅ | Supabase project URL | https://abc.supabase.co |
| VITE_SUPABASE_ANON_KEY | ✅ | Supabase anon key | eyJhbGci... |

---

## Database Access

### Via Supabase Dashboard

1. Open [app.supabase.com](https://app.supabase.com)
2. Select your project
3. Click "Table Editor" (view data)
4. Click "SQL Editor" (run queries)

### Via SQL Client (Optional)

**Connection String:**
```
postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT].supabase.co:5432/postgres
```

**Tools:**
- pgAdmin
- DBeaver
- DataGrip

---

## Hot Reload Behavior

### Backend (nodemon)
- Watches: `src/**/*.ts`
- Restarts on: File save
- Speed: ~2 seconds

### Frontend (Vite HMR)
- Watches: `src/**/*.tsx`
- Updates on: File save
- Speed: Instant (no reload)

---

## Logs

### Backend Logs

**Location:** Terminal 1

**Format:**
```
[INFO] 2025-10-18 10:30:00 - Server started
[DEBUG] 2025-10-18 10:30:05 - GET /api/okrs
[ERROR] 2025-10-18 10:30:10 - Database connection failed
```

**Log Levels:**
- `INFO` - Normal operations
- `WARN` - Degraded performance
- `ERROR` - Failures (investigate)
- `DEBUG` - Development only

### Frontend Logs

**Location:** Browser Console (F12 → Console tab)

**Common messages:**
- `[React Router] Navigating to /dashboard` - Normal
- `[React Query] Fetching okrs` - Normal
- `[Network Error] Failed to fetch` - Check backend

---

## Performance Benchmarks

### Expected Response Times (Local)

| Endpoint | Target | Threshold |
|----------|--------|-----------|
| GET /health | <10ms | >50ms = investigate |
| GET /api/okrs | <50ms | >200ms = investigate |
| POST /api/okrs | <100ms | >500ms = investigate |
| GET /api/users/me/progress | <200ms | >1s = investigate |

**Measure:**
```bash
curl -w "@curl-format.txt" -o /dev/null -s http://localhost:3000/api/okrs
```

**curl-format.txt:**
```
time_total: %{time_total}s\n
```

---

## Next Steps

**After setup complete:**

1. **Phase 3 Testing:**
   - Run test suite: [TESTING/SPRINT_3_TEST_SUITE.md](../TESTING/SPRINT_3_TEST_SUITE.md)
   - Verify all 11 components exist

2. **API Exploration:**
   - Read [API Documentation](../API/)
   - Try Postman collection (future)

3. **Code Review:**
   - Explore `backend/src/services/okrService.ts`
   - Explore `backend/src/routes/okr.ts`

4. **Next Phase:**
   - Review [Roadmap](../ROADMAP.md)
   - Start Phase 4 (Data Submission)

---

## Cleanup

### Stop Servers

**Terminal 1 (Backend):** `Ctrl+C`  
**Terminal 2 (Frontend):** `Ctrl+C`

### Reset Database (Dangerous)

**Warning:** This deletes all data.

```sql
-- In Supabase SQL Editor
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
-- Re-run migrations
```

### Uninstall

```bash
cd "OKRs Tracker"
rm -rf backend/node_modules
rm -rf frontend/node_modules
# Optionally delete entire project
cd ..
rm -rf "OKRs Tracker"
```

---

## Support

**Issue:** Setup not working  
**Check:** [Common Issues](#common-issues--fixes)

**Issue:** Database query errors  
**Check:** [Database Schema](../ARCHITECTURE/DATABASE_SCHEMA.md)

**Issue:** API errors  
**Check:** [API Documentation](../API/)

**Issue:** Documentation unclear  
**Action:** Create GitHub issue with `docs` label
