# Documentation Index

**Last Updated:** October 18, 2025  
**Current Phase:** Phase 3 (75% Complete)

---

## Quick Navigation

| Section | Description | When to Use |
|---------|-------------|-------------|
| [Strategic Docs](#strategic-docs) | Roadmap, technical plan, PRD | Exec syncs, planning sessions |
| [Architecture](#architecture) | System-wide design source of truth | Platform decisions, onboarding |
| [API](#api-reference) | Endpoint documentation | Integrations, backend work |
| [Setup](#setup--onboarding) | Environment and workflow setup | New developer onboarding |
| [Testing](#testing-guides) | Test suites and validation status | QA, release readiness |
| [Operational Guides](#operational-guides) | Sprint playbooks & delivery guides | Daily execution, handoffs |
| [Archived](#archived-documentation) | Historical reports & closed sprints | Reference only |

---

## Strategic Docs

- **[Implementation Roadmap](implementation-roadmap.md)** - Phase-by-phase delivery milestones
- **[Technical Implementation Plan](technical-implementation-plan.md)** - System design and build order
- **[Project Overview](project/overview.md)** - Product context and goals
- **[Requirements (PRD)](project/requirements.md)** - Canonical acceptance criteria
- **[Product Roadmap](project/roadmap.md)** - Big-picture sequencing and release targets

## Architecture

- **[System Architecture Overview](ARCHITECTURE/overview.md)** - Current platform blueprint (SSoT)
- **[Authentication Flow](concepts/authentication-flow.md)** - Identity and auth stack
- **[Business Logic](concepts/business-logic.md)** - KPI/OKR domain model decisions
- **[Database Schema](concepts/database-schema.md)** - Entity relationships and constraints

---

## API Reference

Complete API documentation for all endpoints. The OpenAPI specification drives generated clients.

### Active APIs
- **[OKRs](API/okrs.md)** - CRUD operations, weight validation
- **[KPI Components](API/kpi-components.md)** - Component lifecycle and rules
- **[KPI Data](API/kpi-data.md)** - Phase 4 submission contract (in progress)
- **[Rate Limiting](API/rate-limiting.md)** - Enforcement strategy per resource

### Supporting Assets
- **[Authentication](API/authentication.md)** - JWT, Supabase policies, RLS alignment
- **[Error Handling](API/errors.md)** - RFC7807 catalog and response shapes
- **[Quick Reference](API/QUICK_REFERENCE.md)** - Endpoint matrix for fast lookups
- **[OpenAPI Specification](API/openapi.yaml)** - Machine-readable schema for tooling

---

## Setup & Onboarding

### Initial Setup
- **[Getting Started](GETTING_STARTED.md)** - Fast path to a working environment
- **[Supabase Authentication Setup](SETUP/supabase-auth-setup.md)** - Configure auth, create admin users
- **[Local Environment Setup](SETUP/local-setup.md)** - Full-stack local workflow

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

## Operational Guides

- **[Deployment Playbook](GUIDES/DEPLOYMENT.md)** - Release automation and checkpoints
- **Implementation Guides** *(by sprint)*:
  - [Phase 3 Sprint Guide](GUIDES/implementation/phase-3-sprint-guide.md)
  - [Phase 3 Sprint 3 Plan](GUIDES/implementation/phase-3-sprint-3.md)
  - [Phase 4 Sprint Plan](GUIDES/implementation/phase-4-sprint-plan.md)
- **Validation Status** - see [Archive reports](#archived-documentation) for historical audits

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

### Reports & Audits
- [Security Audit - Blocker #1](ARCHIVED/reports/SECURITY_AUDIT_BLOCKER1.md)
- [Blocker #1 Summary](ARCHIVED/reports/BLOCKER1_SUMMARY.md)
- [Blocker #1 Fix Progress](ARCHIVED/reports/BLOCKER1_FIX_PROGRESS.md)
- [Blocker #4 Error Handling](ARCHIVED/reports/BLOCKER4_ERROR_HANDLING_COMPLETE.md)
- [Validation Status Tracker](ARCHIVED/reports/VALIDATION_STATUS.md)
- [Phase 2 Showstoppers Plan](ARCHIVED/reports/PHASE2_SHOWSTOPPERS_ULTRATHINK.md)
- [Phase 4 Migration Report](ARCHIVED/reports/PHASE4_MIGRATION_REPORT.md)
- [Full Project Review](ARCHIVED/reports/FULL_PROJECT_REVIEW.md)

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
- See [Documentation Conventions](documentation-conventions.md) for full taxonomy guidance.

### Directory Structure
```
docs/
├── README.md (this file)
├── GETTING_STARTED.md
├── implementation-roadmap.md
├── technical-implementation-plan.md
├── API/
├── ARCHITECTURE/
├── ARCHIVED/
│   ├── Phase_2/
│   ├── Phase_3_Sprints/
│   └── reports/
├── GUIDES/
├── SETUP/
├── TESTING/
├── concepts/
└── project/
```

---

## For New Developers

**Start here:**
1. Read [Implementation Roadmap](implementation-roadmap.md) for current phase context
2. Follow [Getting Started](GETTING_STARTED.md) to configure your environment
3. Review [API docs](API/) when you need endpoint details
4. Run [Sprint 3 tests](TESTING/SPRINT_3_TEST_SUITE.md) to verify setup

**Time to productivity:** ~30 minutes

---

## For Product/Project Managers

**Check status:**
- [Implementation Roadmap](implementation-roadmap.md) - Phase progress snapshot
- [Project Roadmap](project/roadmap.md) - Upcoming releases and milestones

**Review deliverables:**
- [Phase 3 Sprint Guide](GUIDES/implementation/phase-3-sprint-guide.md) - Execution details
- [Phase 4 Sprint Plan](GUIDES/implementation/phase-4-sprint-plan.md) - Next-phase planning

---

## Contact & Support

- **Technical Questions:** Check API docs first
- **Testing Issues:** Run test suite, check known limitations
- **Documentation Gaps:** Add to this README, update relevant section docs
