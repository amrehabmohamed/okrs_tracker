# KPI Data Submission API

**Phase 4 Sprint 1: Count Form Submissions**

## Overview

The KPI Data API enables users to submit progress data for their assigned KPI components. Sprint 4.1 implements count-based submissions with version tracking, deadline enforcement, and manager approval workflow.

---

## Endpoints

### 1. Submit KPI Data

Submit progress data for a KPI component.

**Endpoint:** `POST /api/kpi-data`

**Authentication:** Required (JWT Bearer token)

**Content-Type:** `application/json`

#### Request Body

```json
{
  "kpi_component_id": "550e8400-e29b-41d4-a716-446655440000",
  "value": 2,
  "evidence_link": "https://docs.google.com/document/d/abc123",
  "notes": "Completed two customer interviews this week",
  "data_source": 0
}
```

**Field Descriptions:**

| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| `kpi_component_id` | UUID | Yes | Valid UUID | ID of the KPI component you're submitting for |
| `value` | number | Yes | Integer >= 0 | Count value (no decimals allowed) |
| `evidence_link` | string | Yes | Valid URL (http/https) | Link to supporting documentation |
| `notes` | string | No | Max 500 chars | Optional explanation of submission |
| `data_source` | number | No | 0, 1, or 2 | 0=Manual (default), 1=JotForm, 2=Auto |

#### Success Response (201 Created)

```json
{
  "success": true,
  "message": "Submission created successfully and pending approval",
  "data": {
    "id": "770e8400-e29b-41d4-a716-446655440002",
    "user_id": "auth-user-uuid",
    "kpi_component": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "name": "Conduct at least ONE direct customer interview",
      "target_value": 1.00,
      "unit": "interviews",
      "measurement_type": 0
    },
    "okr": {
      "id": "okr-uuid",
      "title": "Discovery & Customer Alignment",
      "year": 2025,
      "quarter": 4,
      "deadline_at": "2026-01-14T23:59:59.000Z"
    },
    "value": 2.00,
    "version_number": 1,
    "status": 0,
    "status_label": "Pending",
    "evidence_link": "https://docs.google.com/document/d/abc123",
    "submitted_date": "2025-10-23T15:30:00.000Z",
    "notes": "Completed two customer interviews this week",
    "data_source": 0,
    "data_source_label": "Manual"
  }
}
```

#### Error Responses

**400 Bad Request - Validation Error**

```json
{
  "error": "count_value must be greater than or equal to 0",
  "statusCode": 400
}
```

Common validation errors:
- `count_value is required`
- `count_value must be a valid number`
- `count_value must be greater than or equal to 0`
- `count_value must be an integer (no decimal places)`
- `evidence_link is required`
- `evidence_link must be a valid URL (http:// or https://)`
- `notes must not exceed 500 characters`
- `kpi_component_id is required`

**401 Unauthorized**

```json
{
  "error": "No token provided",
  "statusCode": 401
}
```

**403 Forbidden - Deadline Passed**

```json
{
  "error": "Submission deadline has passed for OKR \"Discovery & Customer Alignment\". Deadline was 2026-01-14. Contact your manager if you need to submit late.",
  "statusCode": 403
}
```

**403 Forbidden - Wrong Role**

```json
{
  "error": "This KPI component belongs to a different role. Your role: Product Designer, Required role ID: 1",
  "statusCode": 403
}
```

**404 Not Found**

```json
{
  "error": "KPI Component with ID 550e8400-e29b-41d4-a716-446655440000 not found",
  "statusCode": 404
}
```

**409 Conflict - Pending Submission Exists**

```json
{
  "error": "You already have a pending submission for this component. Wait for manager approval before submitting again.",
  "statusCode": 409
}
```

#### Example Usage

**cURL:**

```bash
curl -X POST http://localhost:3000/api/kpi-data \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "kpi_component_id": "550e8400-e29b-41d4-a716-446655440000",
    "value": 2,
    "evidence_link": "https://docs.google.com/document/d/abc123",
    "notes": "Completed interviews with users from Target and Amazon"
  }'
```

**JavaScript (Fetch API):**

```javascript
const response = await fetch('http://localhost:3000/api/kpi-data', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    kpi_component_id: '550e8400-e29b-41d4-a716-446655440000',
    value: 2,
    evidence_link: 'https://docs.google.com/document/d/abc123',
    notes: 'Completed two customer interviews'
  })
});

const data = await response.json();
console.log(data);
```

---

### 2. Get User's Submissions

Retrieve all KPI data submissions for the authenticated user.

**Endpoint:** `GET /api/kpi-data`

**Authentication:** Required (JWT Bearer token)

#### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `okr_id` | UUID | No | Filter by specific OKR |
| `kpi_component_id` | UUID | No | Filter by specific component |
| `status` | number | No | Filter by status: 0=pending, 1=approved, 2=rejected |
| `include_history` | boolean | No | Include all versions (default: false) |

#### Success Response (200 OK)

```json
{
  "success": true,
  "data": [
    {
      "id": "submission-uuid",
      "user_id": "user-uuid",
      "kpi_component": { ... },
      "okr": { ... },
      "value": 2.00,
      "version_number": 1,
      "status": 0,
      "status_label": "Pending",
      "submitted_date": "2025-10-23T15:30:00.000Z",
      ...
    }
  ],
  "count": 1
}
```

#### Example Usage

**Get all submissions:**

```bash
curl http://localhost:3000/api/kpi-data \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Get pending submissions only:**

```bash
curl "http://localhost:3000/api/kpi-data?status=0" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Get submissions for specific OKR:**

```bash
curl "http://localhost:3000/api/kpi-data?okr_id=okr-uuid-here" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

### 3. Get Submission History

Get all versions of submissions for a specific KPI component.

**Endpoint:** `GET /api/kpi-data/history/:component_id`

**Authentication:** Required (JWT Bearer token)

#### URL Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `component_id` | UUID | KPI Component ID |

#### Success Response (200 OK)

```json
{
  "success": true,
  "data": {
    "component": {
      "id": "component-uuid",
      "name": "Conduct at least ONE direct customer interview",
      "target_value": 1.00,
      "unit": "interviews",
      "measurement_type": 0
    },
    "okr": {
      "id": "okr-uuid",
      "title": "Discovery & Customer Alignment",
      "year": 2025,
      "quarter": 4,
      "deadline_at": "2026-01-14T23:59:59.000Z"
    },
    "submissions": [
      {
        "id": "submission-v2-uuid",
        "value": 2.00,
        "version_number": 2,
        "status": 0,
        "status_label": "Pending",
        "submitted_date": "2025-10-25T10:00:00.000Z",
        ...
      },
      {
        "id": "submission-v1-uuid",
        "value": 1.00,
        "version_number": 1,
        "status": 2,
        "status_label": "Rejected",
        "submitted_date": "2025-10-23T15:30:00.000Z",
        ...
      }
    ],
    "latest": { ... },
    "total_versions": 2
  }
}
```

#### Example Usage

```bash
curl "http://localhost:3000/api/kpi-data/history/550e8400-e29b-41d4-a716-446655440000" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

## Business Rules

### Validation Rules

1. **Count Value:**
   - Must be integer >= 0
   - No decimals allowed
   - Zero is valid (represents no progress)

2. **Evidence Link:**
   - Required for all submissions
   - Must be valid URL format
   - Supports http:// and https://
   - URL accessibility is NOT validated

3. **Notes:**
   - Optional field
   - Maximum 500 characters
   - HTML tags stripped for security
   - Special characters escaped

4. **Version Number:**
   - Always 1 for Sprint 4.1
   - Future sprints will support resubmissions

### Authorization Rules

1. **Component Ownership:**
   - User's role must match component's OKR role
   - Cannot submit for other roles' components
   - Archived OKRs reject submissions

2. **Deadline Enforcement:**
   - Submissions rejected after deadline
   - Deadline calculated as: quarter end + 14 days (configurable)
   - Deadline checked on every submission

3. **Pending Submission Limit:**
   - Only ONE pending submission per component
   - Cannot submit again until approved/rejected
   - Prevents duplicate submissions

### Status Workflow

```
User submits → Status = 0 (Pending)
              ↓
         Manager reviews
              ↓
    ┌─────────────────┐
    ↓                 ↓
Status = 1        Status = 2
(Approved)        (Rejected)
Counts toward     User can resubmit
progress          (Sprint 4.4)
```

---

## Data Types Reference

### Measurement Types

| Value | Type | Description | Sprint |
|-------|------|-------------|--------|
| 0 | Count | Integer counting | 4.1 ✅ |
| 1 | Percentage | Numerator/denominator | 4.2 |
| 2 | Score | Average score 0.0-5.0 | 4.3 |
| 3 | Boolean | Completed (0 or 1) | 4.3 |

### Submission Status

| Value | Label | Description |
|-------|-------|-------------|
| 0 | Pending | Awaiting manager approval |
| 1 | Approved | Counts toward progress calculation |
| 2 | Rejected | Does not count, user can resubmit |

### Data Source

| Value | Label | Description |
|-------|-------|-------------|
| 0 | Manual | User submitted via web/API |
| 1 | JotForm | Auto-imported from survey (Phase 8) |
| 2 | Auto | System-generated |

---

## Error Handling

All errors follow consistent format:

```json
{
  "error": "Human-readable error message",
  "statusCode": 400
}
```

### HTTP Status Codes

| Code | Meaning | When It Occurs |
|------|---------|----------------|
| 200 | OK | Successful GET request |
| 201 | Created | Successful submission |
| 400 | Bad Request | Validation error |
| 401 | Unauthorized | Missing/invalid token |
| 403 | Forbidden | Deadline passed or wrong role |
| 404 | Not Found | Component doesn't exist |
| 409 | Conflict | Pending submission exists |
| 500 | Internal Server Error | Unexpected server error |

---

## Performance

- **Target response time:** < 200ms average
- **Maximum response time:** 500ms
- **Rate limiting:** 100 requests per 15 minutes (shared across all API endpoints)
- **Database queries:** Optimized with JOINs to avoid N+1 queries

---

## Security

1. **Authentication:** All endpoints require valid JWT token
2. **Authorization:** RLS policies enforce user_id matching at database level
3. **Input Sanitization:** HTML tags stripped, special characters escaped
4. **SQL Injection Prevention:** Parameterized queries via Supabase
5. **XSS Prevention:** Input sanitization before storage

---

## Future Enhancements (Upcoming Sprints)

- **Sprint 4.2:** Percentage form submissions (numerator/denominator)
- **Sprint 4.3:** Score and boolean form submissions
- **Sprint 4.4:** Resubmission and versioning logic
- **Sprint 4.5:** Deadline enforcement enhancements
- **Sprint 4.6:** History query with pagination
- **Phase 5:** Progress calculation based on approved submissions
- **Phase 6:** Manager approval workflow and notifications

---

## Testing

### Manual Testing Checklist

- [ ] Submit valid count form → 201 Created
- [ ] Submit with negative value → 400 error
- [ ] Submit without evidence_link → 400 error
- [ ] Submit with invalid URL → 400 error
- [ ] Submit with notes > 500 chars → 400 error
- [ ] Submit after deadline → 403 error
- [ ] Submit for other role's component → 403 error
- [ ] Submit duplicate (while pending) → 409 error
- [ ] Query submissions → 200 OK with data
- [ ] Query history → 200 OK with versions

### Performance Testing

```bash
# Load test with 10 concurrent requests
ab -n 100 -c 10 \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -p payload.json \
  http://localhost:3000/api/kpi-data
```

---

## Support

For issues or questions:
- Check error message for specific field validation
- Verify your JWT token is valid
- Confirm component ID exists and matches your role
- Ensure deadline hasn't passed
- Contact your manager if you need late submission permission

---

**Last Updated:** October 23, 2025
**API Version:** 1.0 (Phase 4 Sprint 1)
**Status:** ✅ Production Ready
