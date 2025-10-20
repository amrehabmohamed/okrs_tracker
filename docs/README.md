# Documentation Index

**Last Updated:** October 18, 2025  
**Current Phase:** Phase 3 (75% Complete)

---

## Quick Navigation

| Section | Description | When to Use |
|---------|-------------|-------------|
| [API](#api-reference) | Endpoint documentation | Building integrations, testing APIs |
| [Setup](#setup-guides) | Initial configuration | New developer onboarding |
| [Testing](#testing-guides) | Test suites and validation | QA, before deployments |
| [Phase Tracking](#phase-tracking) | Sprint progress | Project management, status updates |
| [Archived](#archived-documentation) | Historical docs | Reference only |

---

## API Reference

Complete API documentation for all endpoints.

### Active APIs
- **[OKRs API](API/API_OKRs.md)** - OKR CRUD operations, weight validation
- **[KPI Components API](API/API_KPI_COMPONENTS.md)** - Component management, measurement types

### Future APIs (Phase 4+)
- User KPI Data (data submission)
- Tasks & Approvals (manager workflow)
- Reports & Analytics (progress tracking)

---

## Setup Guides

### Initial Setup
- **[Supabase Authentication Setup](SETUP/SUPABASE_AUTH_SETUP.md)** - Configure auth, create admin users

### Future Setup Docs
- Environment variables guide
- Database seeding scripts
- Local development setup

---

## Testing Guides

### Automated Testing
- **[Sprint 3 Test Suite](TESTING/SPRINT_3_TEST_SUITE.md)** - SQL-based validation tests

### Quality Assurance
- **[Known Limitations](TESTING/PHASE_3_KNOWN_LIMITATIONS.md)** - Documented trade-offs, MVP constraints

### Future Testing Docs
- Integration test suite (Phase 4)
- Performance benchmarks
- Load testing results

---

## Phase Tracking

### Active Development
- **[Phase 3 Sprint Guide](PHASE_3_SPRINT_GUIDE.md)** ⭐ **Master tracking doc** - Sprint status, deliverables, progress
- **[Sprint 3 Implementation Guide](PHASE_3_SPRINT_3_IMPLEMENTATION_GUIDE.md)** - Detailed reference for component logic

### Completed Phases
- Phase 1: Infrastructure ✅
- Phase 2: Authentication ✅
- Phase 3: OKR/Component Config 🏗️ (75% complete)

### Upcoming Phases
- Phase 4: User Data Submission (Week 4-5)
- Phase 5: Approval Workflow (Week 6)
- Phase 6: Manager Dashboard (Week 7)
- Phase 7: Integrations (Week 8)

---

## Archived Documentation

Historical documents preserved for reference.

### Phase 2 Archives
- [Phase 2 Quickstart](ARCHIVED/Phase_2/PHASE2_QUICKSTART.md)
- [Phase 2 Testing](ARCHIVED/Phase_2/PHASE2_TESTING.md)

### Phase 3 Sprint Archives
- [Sprint 1-2 Checklist](ARCHIVED/Phase_3_Sprints/SPRINT_1_TO_2_CHECKLIST.md)
- [Sprint 2 Validation Report](ARCHIVED/Phase_3_Sprints/SPRINT_2_VALIDATION_REPORT.md)
- [Phase 3 Implementation Plan](ARCHIVED/Phase_3_Sprints/PHASE_3_IMPLEMENTATION_PLAN.md)

---

## Documentation Maintenance

### When to Update
- **API docs**: After any endpoint changes
- **Sprint Guide**: At end of each sprint
- **Test suites**: When adding new tests
- **This README**: When adding/moving docs

### Naming Conventions
- API docs: `API_<Resource>.md`
- Setup guides: `<TOOL>_SETUP.md`
- Test suites: `<SPRINT/PHASE>_TEST_SUITE.md`
- Phase tracking: `PHASE_<N>_<TYPE>.md`

### Directory Structure
```
docs/
├── README.md (this file)
├── API/
│   ├── API_OKRs.md
│   └── API_KPI_COMPONENTS.md
├── SETUP/
│   └── SUPABASE_AUTH_SETUP.md
├── TESTING/
│   ├── SPRINT_3_TEST_SUITE.md
│   └── PHASE_3_KNOWN_LIMITATIONS.md
├── ARCHIVED/
│   ├── Phase_2/
│   └── Phase_3_Sprints/
├── PHASE_3_SPRINT_GUIDE.md
└── PHASE_3_SPRINT_3_IMPLEMENTATION_GUIDE.md
```

---

## For New Developers

**Start here:**
1. Read [Phase 3 Sprint Guide](PHASE_3_SPRINT_GUIDE.md) for project status
2. Follow [Supabase Setup](SETUP/SUPABASE_AUTH_SETUP.md) for environment config
3. Review [API docs](API/) for endpoint reference
4. Run [Sprint 3 tests](TESTING/SPRINT_3_TEST_SUITE.md) to verify setup

**Time to productivity:** ~30 minutes

---

## For Product/Project Managers

**Check status:**
- [Phase 3 Sprint Guide](PHASE_3_SPRINT_GUIDE.md) - See progress, blockers, completion %

**Review deliverables:**
- [Sprint 3 Implementation Guide](PHASE_3_SPRINT_3_IMPLEMENTATION_GUIDE.md) - Technical implementation details

---

## Contact & Support

- **Technical Questions:** Check API docs first
- **Testing Issues:** Run test suite, check known limitations
- **Documentation Gaps:** Add to this README, update relevant section docs
