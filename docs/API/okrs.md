# OKRs API Reference

**Version:** 1.0  
**Base URL:** `http://localhost:3000/api/okrs`  
**Authentication:** Required (Bearer token)  
**Authorization:** Admin only (is_manager >= 3)

---

## Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | List OKRs with filters |
| POST | `/` | Create new OKR |
| GET | `/:id` | Get single OKR with components |
| PUT | `/:id` | Update OKR |
| DELETE | `/:id` | Archive OKR |
| GET | `/weight-sum/:role_id/:year/:quarter` | Get current weight sum |

---

## 1. List OKRs

**GET** `/api/okrs`

Query params: `role_id`, `year`, `quarter`, `status`, `tags`, `limit`, `offset`

### Response 200
```json
{
  "okrs": [...],
  "count": 7,
  "pagination": { "limit": 10, "offset": 0, "total": 7 }
}
```

---

## 2. Create OKR

**POST** `/api/okrs`

### Request Body
```json
{
  "role_id": 1,
  "year": 2025,
  "quarter": 4,
  "okr_number": 1,
  "okr_title": "Discovery & Customer Alignment",
  "description": "Conduct customer research...",
  "weight": 15,
  "type": 1,
  "tags": "customer,research"
}
```

### Response 201
```json
{
  "okr": { "id": "...", ... },
  "message": "OKR created successfully"
}
```

### Errors
- **400** - Weight sum validation failed
- **409** - OKR number already exists

---

## 3. Get Single OKR

**GET** `/api/okrs/:id?include_archived=false`

### Response 200
```json
{
  "okr": {
    "id": "...",
    "okr_title": "...",
    "components": [...]
  }
}
```

---

## 4. Update OKR

**PUT** `/api/okrs/:id`

Supports partial updates. Validates weight if changed.

### Request Body
```json
{
  "weight": 20,
  "description": "Updated description"
}
```

---

## 5. Archive OKR

**DELETE** `/api/okrs/:id`

Soft delete - sets status=3 (archived). Cascades to components.

### Request Body (Optional)
```json
{
  "reason": "No longer relevant"
}
```

---

## 6. Get Weight Sum

**GET** `/api/okrs/weight-sum/:role_id/:year/:quarter`

Returns current sum of OKR weights for validation.

### Response 200
```json
{
  "role_id": 1,
  "year": 2025,
  "quarter": 4,
  "weight_sum": 85,
  "remaining": 15
}
```

---

## Error Codes

| Code | Message | Solution |
|------|---------|----------|
| 400 | Weight validation failed | Adjust weights to sum to 100% |
| 404 | OKR not found | Verify OKR ID |
| 409 | OKR number exists | Use different okr_number |

---

## Weight Validation

All active OKRs for a (role_id, year, quarter) must sum to exactly 100%.

**Example:**
```
OKR 1: 15%
OKR 2: 20%
OKR 3: 20%
OKR 4: 15%
OKR 5: 20%
OKR 6: 5%
OKR 7: 5%
Total: 100% ✓
```

See `API_KPI_COMPONENTS.md` for component-level weight validation.
