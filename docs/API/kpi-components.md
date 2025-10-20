# KPI Components API Reference

**Version:** 1.0  
**Base URL:** `http://localhost:3000/api/kpi-components`  
**Authentication:** Required (Bearer token)  
**Authorization:** Admin only (is_manager >= 3)

---

## Endpoints Overview

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | List components for an OKR |
| POST | `/` | Create new component |
| GET | `/:id` | Get single component |
| PUT | `/:id` | Update component |
| DELETE | `/:id` | Archive component |

---

## Authentication

All endpoints require JWT authentication in the Authorization header:

```
Authorization: Bearer <token>
```

User must have `is_manager >= 3` (VP or CTO) to access these endpoints.

---

## 1. List Components

**GET** `/api/kpi-components?okr_id={okr_id}&include_archived={boolean}`

Returns all components for a specific OKR.

### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| okr_id | UUID | Yes | Parent OKR ID |
| include_archived | boolean | No | Include archived components (default: false) |

### Request Example

```bash
curl -X GET "http://localhost:3000/api/kpi-components?okr_id=231b3701-637a-4c1c-85b2-cdcf1ce190b1" \
  -H "Authorization: Bearer <token>"
```

### Response 200 OK

```json
{
  "components": [
    {
      "id": "e995c35a-980e-4cdf-8b32-5d7b992fa9c6",
      "okr_id": "231b3701-637a-4c1c-85b2-cdcf1ce190b1",
      "component_name": "Conduct at least ONE direct customer interview",
      "component_weight": 40,
      "measurement_type": 0,
      "target_value": 1.00,
      "unit": "interviews",
      "description": "One-on-one customer conversations to validate problems",
      "sort_order": 1,
      "deadline_at": "2025-11-13T23:59:59.000Z",
      "deadline_missed": false,
      "completed_date": null,
      "counting_method": 0,
      "status": 0,
      "created_at": "2025-10-01T09:00:00.000Z"
    },
    {
      "id": "c303ba38-c276-4365-b408-f40878fa5e43",
      "okr_id": "231b3701-637a-4c1c-85b2-cdcf1ce190b1",
      "component_name": "Lead at least ONE research initiative",
      "component_weight": 35,
      "measurement_type": 0,
      "target_value": 1.00,
      "unit": "initiatives",
      "description": "User research, analytics deep-dive, or usability testing",
      "sort_order": 2,
      "deadline_at": "2025-11-13T23:59:59.000Z",
      "deadline_missed": false,
      "completed_date": null,
      "counting_method": 0,
      "status": 0,
      "created_at": "2025-10-01T09:00:00.000Z"
    }
  ],
  "count": 2
}
```

### Error Responses

**400 Bad Request** - Missing okr_id parameter
```json
{
  "error": "okr_id query parameter is required"
}
```

**403 Forbidden** - Not admin
```json
{
  "status": 403,
  "message": "Admin access required"
}
```

---

## 2. Create Component

**POST** `/api/kpi-components`

Creates a new KPI component within an OKR.

### Request Body

```json
{
  "okr_id": "231b3701-637a-4c1c-85b2-cdcf1ce190b1",
  "component_name": "Conduct at least ONE direct customer interview",
  "component_weight": 40,
  "measurement_type": 0,
  "target_value": 1.00,
  "unit": "interviews",
  "description": "One-on-one customer conversations",
  "sort_order": 1,
  "counting_method": 0
}
```

### Field Descriptions

| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| okr_id | UUID | Yes | Must exist | Parent OKR ID |
| component_name | string | Yes | Non-empty | Component title |
| component_weight | number | Yes | 0-100 | Weight as % of OKR |
| measurement_type | number | Yes | 0-3 | 0=count, 1=percentage, 2=score, 3=boolean |
| target_value | number | Yes | >= 0 | Target to achieve |
| unit | string | Yes | Non-empty | Unit of measurement |
| description | string | No | - | Detailed description |
| sort_order | number | No | >= 0 | Display order (auto-assigned if omitted) |
| counting_method | number | No | 0-2 | 0=cumulative, 1=individual, 2=per_period |

### Request Example

```bash
curl -X POST "http://localhost:3000/api/kpi-components" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "okr_id": "231b3701-637a-4c1c-85b2-cdcf1ce190b1",
    "component_name": "Deliver at least ONE competitive brief",
    "component_weight": 25,
    "measurement_type": 0,
    "target_value": 1.00,
    "unit": "briefs",
    "description": "Analysis of 3+ competitors",
    "counting_method": 0
  }'
```

### Response 201 Created

```json
{
  "component": {
    "id": "e09932fd-d1b4-4b6c-9f53-009e75efda9d",
    "okr_id": "231b3701-637a-4c1c-85b2-cdcf1ce190b1",
    "component_name": "Deliver at least ONE competitive brief",
    "component_weight": 25,
    "measurement_type": 0,
    "target_value": 1.00,
    "unit": "briefs",
    "description": "Analysis of 3+ competitors",
    "sort_order": 3,
    "deadline_at": "2025-11-13T23:59:59.000Z",
    "deadline_missed": false,
    "completed_date": null,
    "counting_method": 0,
    "status": 0,
    "created_at": "2025-10-18T14:30:00.000Z"
  },
  "message": "Component created successfully"
}
```

### Error Responses

**400 Bad Request** - Validation error
```json
{
  "status": 400,
  "message": "Invalid component data",
  "details": {
    "errors": [
      "component_name is required",
      "component_weight must be between 0 and 100"
    ]
  }
}
```

**400 Bad Request** - Weight sum exceeds 100%
```json
{
  "status": 400,
  "message": "Component weight validation failed: Total would be 110%, must equal 100%",
  "details": {
    "okr_id": "231b3701-637a-4c1c-85b2-cdcf1ce190b1",
    "current_sum": 75,
    "new_weight": 35,
    "total": 110,
    "required": 100,
    "deficit": -10,
    "existing_components": [
      {
        "id": "e995c35a-980e-4cdf-8b32-5d7b992fa9c6",
        "name": "Conduct at least ONE direct customer interview",
        "weight": 40
      },
      {
        "id": "c303ba38-c276-4365-b408-f40878fa5e43",
        "name": "Lead at least ONE research initiative",
        "weight": 35
      }
    ]
  }
}
```

**404 Not Found** - Parent OKR doesn't exist
```json
{
  "status": 404,
  "message": "Parent OKR not found with id: 231b3701-637a-4c1c-85b2-cdcf1ce190b1"
}
```

---

## 3. Get Single Component

**GET** `/api/kpi-components/:id`

Returns a single component by ID.

### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| id | UUID | Yes | Component ID |

### Request Example

```bash
curl -X GET "http://localhost:3000/api/kpi-components/e995c35a-980e-4cdf-8b32-5d7b992fa9c6" \
  -H "Authorization: Bearer <token>"
```

### Response 200 OK

```json
{
  "component": {
    "id": "e995c35a-980e-4cdf-8b32-5d7b992fa9c6",
    "okr_id": "231b3701-637a-4c1c-85b2-cdcf1ce190b1",
    "component_name": "Conduct at least ONE direct customer interview",
    "component_weight": 40,
    "measurement_type": 0,
    "target_value": 1.00,
    "unit": "interviews",
    "description": "One-on-one customer conversations",
    "sort_order": 1,
    "deadline_at": "2025-11-13T23:59:59.000Z",
    "deadline_missed": false,
    "completed_date": null,
    "counting_method": 0,
    "status": 0,
    "created_at": "2025-10-01T09:00:00.000Z"
  }
}
```

### Error Responses

**404 Not Found**
```json
{
  "status": 404,
  "message": "Component not found with id: e995c35a-980e-4cdf-8b32-5d7b992fa9c6"
}
```

---

## 4. Update Component

**PUT** `/api/kpi-components/:id`

Updates an existing component. Supports partial updates.

### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| id | UUID | Yes | Component ID |

### Request Body (Partial Update)

```json
{
  "component_weight": 45,
  "description": "Updated description"
}
```

### Updatable Fields

All fields from create are updatable except `okr_id`. Only include fields you want to change.

### Request Example

```bash
curl -X PUT "http://localhost:3000/api/kpi-components/e995c35a-980e-4cdf-8b32-5d7b992fa9c6" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "component_weight": 45
  }'
```

### Response 200 OK

```json
{
  "component": {
    "id": "e995c35a-980e-4cdf-8b32-5d7b992fa9c6",
    "okr_id": "231b3701-637a-4c1c-85b2-cdcf1ce190b1",
    "component_name": "Conduct at least ONE direct customer interview",
    "component_weight": 45,
    "measurement_type": 0,
    "target_value": 1.00,
    "unit": "interviews",
    "description": "One-on-one customer conversations",
    "sort_order": 1,
    "deadline_at": "2025-11-13T23:59:59.000Z",
    "deadline_missed": false,
    "completed_date": null,
    "counting_method": 0,
    "status": 0,
    "created_at": "2025-10-01T09:00:00.000Z"
  },
  "message": "Component updated successfully"
}
```

### Error Responses

**400 Bad Request** - Cannot update archived component
```json
{
  "status": 400,
  "message": "Cannot update archived component. Restore it first."
}
```

**400 Bad Request** - Weight validation failed
```json
{
  "status": 400,
  "message": "Component weight validation failed: Total would be 105%, must equal 100%",
  "details": {
    "okr_id": "231b3701-637a-4c1c-85b2-cdcf1ce190b1",
    "current_sum": 60,
    "new_weight": 45,
    "total": 105,
    "required": 100,
    "deficit": -5
  }
}
```

**404 Not Found**
```json
{
  "status": 404,
  "message": "Component not found with id: e995c35a-980e-4cdf-8b32-5d7b992fa9c6"
}
```

---

## 5. Archive Component

**DELETE** `/api/kpi-components/:id`

Archives (soft deletes) a component. Sets status=1, never removes from database.

### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| id | UUID | Yes | Component ID |

### Request Body (Optional)

```json
{
  "reason": "No longer relevant for this quarter"
}
```

### Request Example

```bash
curl -X DELETE "http://localhost:3000/api/kpi-components/e09932fd-d1b4-4b6c-9f53-009e75efda9d" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "reason": "Replaced by more specific components"
  }'
```

### Response 200 OK

```json
{
  "component": {
    "id": "e09932fd-d1b4-4b6c-9f53-009e75efda9d",
    "okr_id": "231b3701-637a-4c1c-85b2-cdcf1ce190b1",
    "component_name": "Deliver at least ONE competitive brief",
    "component_weight": 25,
    "measurement_type": 0,
    "target_value": 1.00,
    "unit": "briefs",
    "status": 1,
    "created_at": "2025-10-01T09:00:00.000Z"
  },
  "message": "Component archived successfully"
}
```

### Error Responses

**404 Not Found**
```json
{
  "status": 404,
  "message": "Component not found with id: e09932fd-d1b4-4b6c-9f53-009e75efda9d"
}
```

---

## Error Codes Reference

| Code | Message | Cause | Solution |
|------|---------|-------|----------|
| 400 | Invalid component data | Missing required fields or invalid values | Check request body against schema |
| 400 | Weight validation failed | Component weights don't sum to 100% | Adjust weights to sum exactly to 100% |
| 400 | Cannot update archived component | Trying to update status=1 component | Restore component first (future feature) |
| 401 | No token provided | Missing Authorization header | Include Bearer token |
| 401 | Invalid or expired token | Token invalid or expired | Re-authenticate |
| 403 | Admin access required | User is_manager < 3 | Use admin account |
| 404 | Component not found | Component ID doesn't exist | Verify component ID |
| 404 | Parent OKR not found | OKR ID doesn't exist | Verify OKR exists first |

---

## Postman Collection Examples

### Setup Environment Variables

```json
{
  "baseUrl": "http://localhost:3000",
  "token": "<your-jwt-token>",
  "okr_id": "231b3701-637a-4c1c-85b2-cdcf1ce190b1",
  "component_id": "e995c35a-980e-4cdf-8b32-5d7b992fa9c6"
}
```

### Collection Structure

```
KPI Components API
├── Auth
│   └── Login (get token)
├── Components
│   ├── 1. List Components
│   ├── 2. Create Component
│   ├── 3. Get Component
│   ├── 4. Update Component
│   └── 5. Archive Component
└── Tests
    ├── Weight Validation Test
    └── Archive Idempotency Test
```

### Example Test: Weight Validation

```javascript
// Pre-request Script
pm.environment.set("okr_id", "231b3701-637a-4c1c-85b2-cdcf1ce190b1");

// Test Script
pm.test("Status code is 400", function () {
    pm.response.to.have.status(400);
});

pm.test("Weight sum error returned", function () {
    var jsonData = pm.response.json();
    pm.expect(jsonData.message).to.include("Total would be");
    pm.expect(jsonData.details.total).to.be.above(100);
});
```

---

## Integration Testing Scenarios

### Scenario 1: Create Full Component Structure

```bash
# 1. Create first component (40%)
curl -X POST "http://localhost:3000/api/kpi-components" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"okr_id":"'$OKR_ID'","component_name":"Component 1","component_weight":40,"measurement_type":0,"target_value":1,"unit":"items"}'

# 2. Create second component (35%)
curl -X POST "http://localhost:3000/api/kpi-components" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"okr_id":"'$OKR_ID'","component_name":"Component 2","component_weight":35,"measurement_type":0,"target_value":1,"unit":"items"}'

# 3. Create third component (25%) - sum = 100%
curl -X POST "http://localhost:3000/api/kpi-components" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"okr_id":"'$OKR_ID'","component_name":"Component 3","component_weight":25,"measurement_type":0,"target_value":1,"unit":"items"}'

# 4. Try fourth component (10%) - should fail (sum = 110%)
curl -X POST "http://localhost:3000/api/kpi-components" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"okr_id":"'$OKR_ID'","component_name":"Component 4","component_weight":10,"measurement_type":0,"target_value":1,"unit":"items"}'
# Expected: 400 Bad Request
```

### Scenario 2: Update and Rebalance

```bash
# 1. Update component 1 from 40% to 50%
curl -X PUT "http://localhost:3000/api/kpi-components/$COMPONENT_1_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"component_weight":50}'
# Expected: 400 Bad Request (sum = 110%)

# 2. First update component 3 from 25% to 15%
curl -X PUT "http://localhost:3000/api/kpi-components/$COMPONENT_3_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"component_weight":15}'
# Expected: 200 OK

# 3. Now update component 1 from 40% to 50%
curl -X PUT "http://localhost:3000/api/kpi-components/$COMPONENT_1_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"component_weight":50}'
# Expected: 200 OK (sum = 100%)
```

---

## Developer Quick Reference

### Measurement Types

```typescript
0 = count      // "Conduct 5 interviews"
1 = percentage // "80% of PRDs complete"
2 = score      // "Maintain 3.5/5.0 rating"
3 = boolean    // "All projects include PD"
```

### Counting Methods

```typescript
0 = cumulative  // Sum all submissions
1 = individual  // Each submission counted separately
2 = per_period  // Only current period counts
```

### Component Status

```typescript
0 = active   // Normal state, included in calculations
1 = archived // Soft deleted, excluded from queries
```

### Weight Validation Rules

- All active components within OKR must sum to exactly 100%
- Creating/updating validates against active components only
- Archiving doesn't trigger validation (admin manually rebalances)
- Race condition possible with concurrent updates (acceptable for MVP)

### Database Schema

```sql
kpi_components (
  id UUID PRIMARY KEY,
  okr_id UUID REFERENCES okrs(id),
  component_name VARCHAR(255) NOT NULL,
  component_weight INT NOT NULL CHECK (component_weight >= 0 AND component_weight <= 100),
  measurement_type INT NOT NULL CHECK (measurement_type IN (0,1,2,3)),
  target_value DECIMAL(5,2) NOT NULL CHECK (target_value >= 0),
  unit VARCHAR(50) NOT NULL,
  description TEXT,
  sort_order INT NOT NULL CHECK (sort_order >= 0),
  deadline_at TIMESTAMP NOT NULL,
  deadline_missed BOOLEAN NOT NULL DEFAULT FALSE,
  completed_date TIMESTAMP,
  counting_method INT NOT NULL DEFAULT 0 CHECK (counting_method IN (0,1,2)),
  status INT NOT NULL DEFAULT 0 CHECK (status IN (0,1)),
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_kpi_components_okr_status ON kpi_components(okr_id, status);
```

---

## Known Limitations

1. **Race Condition:** Weight validation not transactionally safe with concurrent updates
2. **No Auto-Rebalancing:** Archiving component requires manual weight redistribution
3. **No Component-Level Deadline Override:** Inherits parent OKR deadline only
4. **Sort Order Gaps:** Archiving leaves gaps in sequence (1, 2, 4, 5)

All limitations documented as acceptable for MVP in `PHASE_3_KNOWN_LIMITATIONS.md`.
