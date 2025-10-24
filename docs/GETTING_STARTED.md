# KPI Platform - Getting Started

**Time to productivity:** 30 minutes  
**Prerequisites:** Node.js 18+, Git, Supabase account

---

## Quick Links

- **[Project Overview](project/overview.md)** - What and why
- **[PRD (BDD Format)](project/requirements.md)** - Complete requirements
- **[Architecture](ARCHITECTURE/overview.md)** - Technical design
- **[Database Schema](concepts/database-schema.md)** - Data model
- **[API Reference](API/)** - Endpoint docs
- **[Local Setup](SETUP/local-setup.md)** - Full setup guide
- **[Authentication Flow](concepts/authentication-flow.md)** - Auth implementation details
- **[Business Logic](concepts/business-logic.md)** - Design decisions explained

---

## For New Developers (30 min)

### 1. Clone & Install (5 min)
```bash
git clone https://github.com/amrehabmohamed/okrs_tracker.git
cd "OKRs Tracker"
cd backend && npm install
cd ../frontend && npm install
```

### 2. Configure Environment (10 min)
Follow [Supabase Auth Setup](SETUP/supabase-auth-setup.md)

Create `backend/.env`:
```
SUPABASE_URL=https://gcskudcupdyvnrtepsct.supabase.co
SUPABASE_ANON_KEY=your-anon-key
PORT=3000
NODE_ENV=development
```

### 3. Run & Verify (5 min)
```bash
# Terminal 1 - Backend
cd backend && npm run dev

# Terminal 2 - Frontend  
cd frontend && npm run dev
```

Visit http://localhost:3000/health - should see `{"status":"ok"}`

### 4. Test Integration (10 min)
Run [Sprint 3 Test Suite](TESTING/SPRINT_3_TEST_SUITE.md) in Supabase SQL Editor

---

## For Product/Project Managers (10 min)

### Current Status
- **Phase 3:** 75% complete (OKR/Component config done)
- **Next:** Phase 4 (User data submission)
- **Timeline:** 8 weeks total, currently week 3

### Review Deliverables
1. [Phase 3 Sprint Guide](GUIDES/implementation/phase-3-sprint-guide.md) - Progress tracking
2. [Requirements (PRD)](project/requirements.md) - All acceptance criteria in BDD format
3. [Roadmap](project/roadmap.md) - Full 8-phase plan

---

## For QA/Testing (15 min)

### Run Tests
1. [Sprint 3 Automated Tests](TESTING/SPRINT_3_TEST_SUITE.md)
2. [Known Limitations](TESTING/PHASE_3_KNOWN_LIMITATIONS.md)

### Manual Testing
Use [API Documentation](API/) with Postman examples

---

## Project Structure
```
OKRs Tracker/
├── backend/           # Node.js + Express API
├── frontend/          # React + TypeScript
└── docs/             # All documentation (you are here)
```

---

## Need Help?

**Documentation Issue:** Check [README.md](README.md) index  
**Setup Problem:** Follow [Local Dev Setup](SETUP/local-setup.md)  
**API Question:** See [API Reference](API/)  
**Understanding Requirements:** Read [Requirements](project/requirements.md)
