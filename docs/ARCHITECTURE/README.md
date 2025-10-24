# Architecture Overview

This directory is the canonical source for platform-wide design decisions. Use it to understand how each tier fits together before diving into feature-level docs.

## Contents

- `overview.md` — current end-to-end architecture snapshot (infrastructure, services, data flow).

## Related References

- `../concepts/database-schema.md` — entity relationships and guarantees.
- `../concepts/authentication-flow.md` — identity, session, and RLS model.
- `../concepts/business-logic.md` — OKR/KPI domain rules and invariants.

## Ownership & Maintenance

- **Primary Owner:** Platform Architecture lead.
- **Update Cadence:** Review after any major architectural change (migration, new service, topology shift).
- **History:** Previous iterations should move to `../ARCHIVED/reports/` with a timestamped summary if replaced.
