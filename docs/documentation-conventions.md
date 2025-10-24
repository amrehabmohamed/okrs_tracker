# Documentation Conventions

These conventions keep the knowledge base predictable and discoverable. Follow them when adding or updating docs.

## Directory Taxonomy

- `API/` — Endpoint reference, OpenAPI spec, error/rate-limit catalogs.
- `ARCHITECTURE/` — Platform-wide diagrams and system snapshots.
- `ARCHIVED/` — Historical artifacts (completed phases, audits, postmortems). Do not place active guidance here.
- `concepts/` — Deep conceptual explanations that outlive a single sprint.
- `GUIDES/` — How-to and operational playbooks. Sprint-specific guides live in `GUIDES/implementation/`.
- `SETUP/` — Environment provisioning and tooling setup.
- `TESTING/` — Verification plans, known limitations, and execution logs.
- `project/` — Product context: overview, roadmap, requirements.

## File Naming

- Use lowercase-kebab-case (`phase-4-sprint-plan.md`) unless legacy naming enforces otherwise.
- Prefix phase/sprint material with the relevant phase (`phase-4-*`) to preserve chronology.
- Reports should include the focus area (`blocker`, `migration`, `audit`), e.g., `blocker1-summary.md`.

## Linking

- Prefer relative links (e.g., `../ARCHITECTURE/overview.md`) to keep cross-platform compatibility.
- Update inbound links whenever files move; run a quick `rg 'old-path' docs` to confirm nothing is stale.

## Metadata & Ownership

- Include a “Last Updated” line near the top for living documents.
- Note the primary owner or responsible team when the doc requires stewardship.
- If a doc becomes obsolete, add a pointer to its replacement before moving it to `ARCHIVED/`.

## Pull Request Checklist

- [ ] Navigation (`docs/README.md`) reflects any new top-level docs.
- [ ] `GETTING_STARTED.md` still links newcomers to the right resources.
- [ ] Archived files moved into `ARCHIVED/` with directories updated as needed.
- [ ] Broken link scan (e.g., `npx markdown-link-check` when available) passes.

Keeping these guardrails in place ensures the next contributor—and the next Codex session—can scale the platform with confidence.
