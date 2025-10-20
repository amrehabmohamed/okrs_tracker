# KPI Platform - Product Requirements Document (PRD)

**Version:** 1.0  
**Last Updated:** October 18, 2025  
**Status:** Phase 3 (75% Complete)  
**Format:** Behavior-Driven Development (BDD)

---

## 1. Product Vision

### Problem Statement
Organizations struggle to track and validate OKR (Objectives and Key Results) progress across product and design teams. Current solutions lack:
- Structured weight-based progress calculation
- Evidence-backed data submission
- Manager approval workflows
- Real-time progress visibility

### Solution
A state-of-the-art OKR tracking platform that:
- Enforces weight validation (must sum to 100%)
- Requires evidence for all submissions
- Implements manager approval workflows
- Provides real-time dashboard analytics
- Maintains complete audit trail

### Success Metrics
- 100% of team members submit quarterly OKRs on time
- 90%+ approval rate on first submission
- <2 days average approval time
- Zero calculation errors in progress tracking

---

## 2. User Roles & Permissions

### Product Manager / Designer (Regular User)
**Can:**
- View own OKRs and components
- Submit progress data with evidence
- Mark components complete
- View own submission history
- See own overall progress

**Cannot:**
- View other users' data
- Approve/reject submissions
- Configure OKRs or components
- Access admin panels

### Product Lead / Design Lead (Manager)
**Can:**
- Everything regular users can do
- View team members' progress
- Approve/reject submissions
- Add comments to rejections
- Assign tasks to collaborators

**Cannot:**
- Configure OKRs (unless also VP/CTO)
- View other teams' data
- Modify approved submissions retroactively

### VP Product / CTO (Admin)
**Can:**
- Everything managers can do
- Configure OKRs and components
- Set weights and targets
- Archive/restore OKRs
- View cross-team analytics
- Access full audit trail

**Cannot:**
- Modify submitted data without audit log
- Delete data (only archive)

---

## 3. Core Features (BDD Format)

### Feature: OKR Configuration

#### Scenario: Admin creates OKR with valid weight
```gherkin
Given I am logged in as admin (is_manager >= 3)
And total OKR weights for Product Manager role in Q4 2025 sum to 85%
When I create an OKR with the following details:
  | field       | value                           |
  | okr_title   | Discovery & Customer Alignment  |
  | weight      | 15                              |
  | type        | Quantitative                    |
  | quarter     | 4                               |
  | year        | 2025                            |
Then the OKR should be created successfully
And the response should include OKR ID
And total weights for Q4 2025 should equal 100%
And an audit log entry should be created
```

#### Scenario: Admin attempts to create OKR with invalid weight sum
```gherkin
Given I am logged in as admin
And total OKR weights for Product Manager role in Q4 2025 sum to 95%
When I create an OKR with weight 10%
Then the request should fail with status 400
And the error message should contain "Total would be 105%, must equal 100%"
And the error details should show:
  | current_sum | 95  |
  | new_weight  | 10  |
  | total       | 105 |
  | required    | 100 |
  | deficit     | -5  |
```

#### Scenario: Regular user attempts to create OKR
```gherkin
Given I am logged in as regular user (is_manager = 0)
When I attempt to create an OKR
Then the request should fail with status 403
And the error message should be "Admin access required"
```

---

### Feature: KPI Component Management

#### Scenario: Admin creates component with valid weight
```gherkin
Given I am logged in as admin
And an OKR exists with ID "okr_123"
And existing components for OKR "okr_123" have weights: [40%, 35%]
When I create a component with the following details:
  | field              | value                        |
  | component_name     | Deliver competitive brief    |
  | component_weight   | 25                           |
  | measurement_type   | count                        |
  | target_value       | 1.00                         |
  | unit               | briefs                       |
Then the component should be created successfully
And the component should have status=0 (active)
And the component should inherit deadline from parent OKR
And sort_order should be auto-assigned to 3
And total component weights should equal 100%
```

#### Scenario: Admin attempts to exceed 100% weight
```gherkin
Given I am logged in as admin
And an OKR exists with components totaling 100% weight
When I create a component with weight 10%
Then the request should fail with status 400
And the error message should contain "Total would be 110%, must equal 100%"
And existing components should be listed in error details
```

#### Scenario: Admin archives component
```gherkin
Given I am logged in as admin
And a component exists with ID "comp_123" and status=0
When I archive the component with reason "No longer relevant"
Then the component status should be set to 1 (archived)
And the component should be excluded from future weight calculations
And an audit log should record the archival with reason
And the component data should remain in database
```

---

### Feature: User Data Submission (Phase 4)

#### Scenario: User submits count-based KPI data
```gherkin
Given I am logged in as regular user
And a component exists with measurement_type=count
And the component target is 1 interview
And the deadline has not passed
When I submit the following data:
  | field         | value                          |
  | count_value   | 2                              |
  | evidence_link | https://docs.google.com/doc123 |
  | notes         | Interviewed 2 key customers    |
Then the submission should be created with status=pending
And my progress should not yet be updated
And a task should be created for my manager
And my manager should receive an email notification
```

#### Scenario: User submits after deadline
```gherkin
Given I am logged in as regular user
And a component exists with deadline in the past
And deadline_missed flag is true
When I attempt to submit data
Then the request should fail with status 400
And the error message should be "Deadline has passed, submissions locked"
```

#### Scenario: User submits without evidence link
```gherkin
Given I am logged in as regular user
And a component requires evidence
When I submit data without evidence_link
Then the request should fail with status 400
And the error should specify "evidence_link is required"
```

---

### Feature: Manager Approval Workflow (Phase 5)

#### Scenario: Manager approves submission
```gherkin
Given I am logged in as manager
And my team member submitted data with status=pending
And the submission has valid evidence link
When I approve the submission
Then the submission status should change to approved
And the user's progress should be recalculated immediately
And the user should see updated progress on dashboard
And an audit log should record the approval
```

#### Scenario: Manager rejects submission
```gherkin
Given I am logged in as manager
And my team member submitted data with status=pending
When I reject the submission with reason "Evidence link broken"
Then the submission status should change to rejected
And the rejection reason should be stored
And the user should receive email notification with feedback
And the user should be able to resubmit with version_number=2
```

#### Scenario: Manager adds collaborator to task
```gherkin
Given I am logged in as Product Lead
And a task exists assigned to me
When I add VP Product as collaborator
Then the collaborator should be stored in Task_Collaborators
And the VP should see the task in their queue
And both users can approve/reject independently
```

---

### Feature: Progress Calculation

#### Scenario: Calculate component progress (cumulative count)
```gherkin
Given a component with:
  | measurement_type | count        |
  | target_value     | 1.00         |
  | counting_method  | cumulative   |
And approved submissions: [1, 1, 2]
When progress is calculated
Then component progress should be (4 / 1) * 100 = 400%
And component weighted score should be 400% * (weight / 100)
```

#### Scenario: Calculate OKR score
```gherkin
Given an OKR with components:
  | component | weight | progress | weighted_score |
  | Interview | 40%    | 200%     | 80             |
  | Research  | 35%    | 150%     | 52.5           |
  | Brief     | 25%    | 100%     | 25             |
When OKR score is calculated
Then OKR score should be 80 + 52.5 + 25 = 157.5 points
And OKR percentage should be 157.5%
```

#### Scenario: Calculate overall user progress
```gherkin
Given a user has 7 OKRs with weights and percentages:
  | okr_number | weight | percentage |
  | 1          | 15%    | 157%       |
  | 2          | 20%    | 180%       |
  | 3          | 20%    | 140%       |
  | 4          | 15%    | 120%       |
  | 5          | 20%    | 90%        |
  | 6          | 5%     | 0%         |
  | 7          | 5%     | 0%         |
When overall progress is calculated
Then overall score should be sum of (percentage * weight) / 100
And result should be approximately 123.55%
```

---

## 4. Data Validation Rules

### OKR Validation
```gherkin
Rule: OKR weights must sum to 100%
  Given multiple OKRs for the same (role_id, year, quarter)
  Then sum of all active OKR weights must equal exactly 100%

Rule: OKR numbers must be unique per quarter
  Given an OKR exists with okr_number=1 for Q4 2025
  Then creating another OKR with okr_number=1 for Q4 2025 must fail

Rule: OKR weight must be 0-100
  When creating or updating an OKR
  Then weight value must be between 0 and 100 inclusive
```

### Component Validation
```gherkin
Rule: Component weights must sum to 100% within OKR
  Given components within an OKR
  Then sum of all active component weights must equal exactly 100%

Rule: Components must have valid parent OKR
  When creating a component
  Then okr_id must reference an existing, active OKR

Rule: Measurement types must be valid enum
  When creating a component
  Then measurement_type must be 0, 1, 2, or 3
```

### Submission Validation
```gherkin
Rule: Evidence required for all submissions
  When submitting KPI data
  Then evidence_link must be a valid URL

Rule: Submissions locked after deadline
  When deadline_at has passed and deadline_missed=true
  Then new submissions must be rejected

Rule: Values must match measurement type
  Given measurement_type=score (0-5 scale)
  When submitting data
  Then value must be between 0.0 and 5.0
```

---

## 5. Non-Functional Requirements

### Performance
```gherkin
Scenario: API response time
  Given any API endpoint
  When a valid request is made
  Then response time should be < 500ms for CRUD operations
  And < 1000ms for aggregate calculations
  And < 200ms for validation queries
```

### Security
```gherkin
Scenario: Authentication required for all endpoints
  Given any API endpoint except /health
  When a request is made without Bearer token
  Then response should be 401 Unauthorized

Scenario: Role-based access control
  Given I am logged in as regular user
  When I attempt to access admin endpoints
  Then response should be 403 Forbidden
```

### Auditability
```gherkin
Scenario: All mutations logged
  Given any create, update, or delete operation
  When the operation completes successfully
  Then an entry must be created in audit_log
  And the entry must include: entity_type, entity_id, action, old_value, new_value, changed_by, changed_at
```

### Data Integrity
```gherkin
Scenario: Soft delete only
  Given any entity in the system
  When a delete operation is performed
  Then the entity must be archived (status changed)
  And the entity must never be removed from database
  And all foreign key references must remain intact
```

---

## 6. Future Enhancements (Post-MVP)

### Multi-tenant Support
```gherkin
Feature: Support multiple organizations
  Scenario: Isolate data by workspace
    Given multiple workspaces exist
    When a user accesses data
    Then they should only see data from their workspace
```

### Advanced Analytics
```gherkin
Feature: Historical trends and forecasting
  Scenario: View progress trends
    Given historical data for 4+ quarters
    When viewing analytics dashboard
    Then user should see trend lines and forecasts
```

### Mobile App
```gherkin
Feature: Native mobile experience
  Scenario: Submit data from mobile
    Given I am using the mobile app
    When I capture evidence photo
    Then I should be able to submit directly
```

### Integration APIs
```gherink
Feature: External system integrations
  Scenario: Auto-populate from Jira
    Given Jira integration is configured
    When sprint completes
    Then delivery metrics should auto-populate
```

---

## 7. Acceptance Criteria Summary

### Phase 3 (Current) - OKR Configuration
- ✅ Admins can create/update/archive OKRs
- ✅ Weight validation prevents invalid configurations
- ✅ Components can be created with weight validation
- ✅ Soft delete implemented (no hard deletes)
- ✅ Complete audit trail for all mutations
- ✅ API fully documented with examples

### Phase 4 (Next) - User Data Submission
- [ ] Users can submit count/percentage/score/boolean data
- [ ] Evidence links required for all submissions
- [ ] Submissions create pending tasks for managers
- [ ] Deadline enforcement prevents late submissions
- [ ] Version tracking for resubmissions

### Phase 5 - Approval Workflow
- [ ] Managers see approval queue
- [ ] Approve/reject with feedback
- [ ] Email notifications on state changes
- [ ] Collaborators can be added to tasks
- [ ] Progress recalculates immediately on approval

### Phase 6 - Manager Dashboard
- [ ] Team progress aggregation
- [ ] Individual progress drill-down
- [ ] Historical quarter comparison
- [ ] Export reports

### Phase 7 - Integrations
- [ ] JotForm webhook for survey data
- [ ] Automated score calculation
- [ ] Error handling and retry logic

### Phase 8 - Production Readiness
- [ ] 80%+ test coverage
- [ ] Performance benchmarks met
- [ ] Security audit complete
- [ ] Documentation complete

---

## 8. Out of Scope (MVP)

- Multi-workspace/multi-tenant support
- Custom deadline per component
- Real-time notifications (email only)
- Mobile app
- Calendar integration
- Slack integration
- Advanced analytics/forecasting
- Custom reporting builder
- Role customization
- Bulk import/export

---

## Appendix: Glossary

**OKR:** Objective and Key Result - high-level quarterly goal  
**KPI Component:** Measurable component within an OKR  
**Weight:** Percentage value (must sum to 100%)  
**Measurement Type:** How progress is tracked (count/percentage/score/boolean)  
**Evidence Link:** URL to proof/documentation  
**Soft Delete:** Archive (status change) vs. hard delete (row removal)  
**Deadline:** Last date for data submission (quarter end + 14 days)  
**Audit Trail:** Immutable log of all system changes
