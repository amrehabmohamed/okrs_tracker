# Rate Limiting

**Version:** 1.0.0  
**Last Updated:** 2025-10-23

---

## Overview

The KPI Platform implements rate limiting to protect against abuse, ensure fair resource usage, and maintain system stability.

**Key Features:**
- Per-endpoint rate limits
- IP-based and token-based limits
- Sliding window algorithm
- Grace period for burst traffic
- Clear error responses with retry timing

---

## Rate Limit Headers

Every API response includes rate limit headers:

```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1635945600
```

| Header | Description |
|--------|-------------|
| `X-RateLimit-Limit` | Maximum requests allowed in current window |
| `X-RateLimit-Remaining` | Remaining requests in current window |
| `X-RateLimit-Reset` | Unix timestamp when limit resets |

---

## Rate Limit Tiers

### Tier 1: Authentication Endpoints (Strict)

**Reason:** Prevent brute force attacks, credential stuffing

| Endpoint | Limit | Window | Key | Lockout |
|----------|-------|--------|-----|---------|
| `POST /auth/signup` | 5 | 15 min | IP | 15 min |
| `POST /auth/login` | 5 failed | 15 min | IP + email | 15 min |
| `POST /auth/password-reset` | 3 | 15 min | IP | 15 min |
| `POST /auth/verify-email` | 10 | 15 min | IP | - |
| `POST /auth/resend-verification` | 10 | 15 min | IP + email | - |

**Notes:**
- Login counts FAILED attempts only (successful login resets)
- Lockout means all requests return 429 until window resets
- Email verification has higher limit for legitimate retry cases

---

### Tier 2: General API Endpoints (Standard)

**Reason:** Fair resource usage, prevent DOS

| Endpoint Pattern | Limit | Window | Key |
|-----------------|-------|--------|-----|
| `GET /api/*` | 100 | 15 min | Token (user_id) |
| `POST /api/*` | 100 | 15 min | Token (user_id) |
| `PUT /api/*` | 100 | 15 min | Token (user_id) |
| `DELETE /api/*` | 100 | 15 min | Token (user_id) |

**Notes:**
- Applies to all authenticated endpoints not in Tier 1 or 3
- Keyed by user_id from JWT token
- Shared across all general endpoints

---

### Tier 3: Webhook Endpoints (High Volume)

**Reason:** External integrations need higher throughput

| Endpoint | Limit | Window | Key |
|----------|-------|--------|-----|
| `POST /webhooks/jotform` | 1000 | 1 hour | HMAC signature |

**Notes:**
- Higher limit for legitimate automated submissions
- HMAC signature validation required
- Invalid signatures rejected before counting against limit

---

### Tier 4: Manager & Admin Endpoints (Moderate)

**Reason:** Reporting queries can be expensive

| Endpoint Pattern | Limit | Window | Key |
|-----------------|-------|--------|-----|
| `GET /manager/*` | 50 | 15 min | Token (user_id) |
| `GET /admin/*` | 50 | 15 min | Token (user_id) |
| `POST /manager/export-*` | 10 | 15 min | Token (user_id) |

**Notes:**
- Lower limits due to potentially expensive queries
- Export endpoints further restricted
- Admins share same limits (no special treatment)

---

## Rate Limit Algorithm

### Sliding Window Counter

```
Window: 15 minutes (900 seconds)
Limit: 100 requests

Timeline:
┌──────────────────────────────────────┐
│  [==============Window==============] │
│   ^                                ^  │
│   Start                          End  │
│   (now - 15min)                (now)  │
└──────────────────────────────────────┘

Requests counted: All within window
Window slides: Continuously (per request)
```

**Example:**
```
10:00 - Request 1 → Limit: 100, Remaining: 99
10:01 - Request 2 → Limit: 100, Remaining: 98
...
10:14 - Request 100 → Limit: 100, Remaining: 0
10:15 - Request 101 → 429 (rate limit exceeded)
10:16 - (10:00 requests drop off) → Remaining: 1
```

### Why Sliding Window?

- **Fair:** No sudden reset cliff
- **Smooth:** Gradual replenishment
- **Prevents gaming:** Can't wait for reset to burst

---

## Error Response (429)

When rate limit exceeded:

```http
HTTP/1.1 429 Too Many Requests
X-RateLimit-Limit: 5
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1635945600
Retry-After: 720
Content-Type: application/json

{
  "type": "https://api.kpi-platform.com/errors/rate-limit-exceeded",
  "title": "Rate Limit Exceeded",
  "status": 429,
  "detail": "Rate limit of 5 requests per 15 minutes exceeded. Try again in 12 minutes.",
  "instance": "/api/auth/login",
  "requestId": "550e8400-e29b-41d4-a716-446655440000",
  "retryAfter": 720
}
```

**Headers:**
- `Retry-After`: Seconds until next request allowed
- `X-RateLimit-Reset`: Unix timestamp of window reset

---

## Handling Rate Limits

### Frontend Best Practices

#### 1. Check Headers Before Retrying

```typescript
async function callAPI(url: string, options: RequestInit) {
  const response = await fetch(url, options);
  
  // Check rate limit headers
  const limit = parseInt(response.headers.get('X-RateLimit-Limit') || '0');
  const remaining = parseInt(response.headers.get('X-RateLimit-Remaining') || '0');
  const reset = parseInt(response.headers.get('X-RateLimit-Reset') || '0');
  
  // Warn user when approaching limit
  if (remaining < 10 && remaining > 0) {
    showWarning(`${remaining} requests remaining. Rate limit resets at ${new Date(reset * 1000).toLocaleTimeString()}`);
  }
  
  // Handle 429
  if (response.status === 429) {
    const error = await response.json();
    const retryAfter = error.retryAfter || 900; // Default 15 min
    
    showError(`Rate limit exceeded. Try again in ${Math.ceil(retryAfter / 60)} minutes.`);
    return null;
  }
  
  return response;
}
```

#### 2. Implement Exponential Backoff

```typescript
async function callWithRetry(url: string, options: RequestInit, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(url, options);
      
      if (response.status !== 429) {
        return response;
      }
      
      // Get retry timing
      const retryAfter = parseInt(response.headers.get('Retry-After') || '0');
      const delay = retryAfter * 1000 || (Math.pow(2, i) * 1000); // Exponential backoff
      
      console.log(`Rate limited. Retrying in ${delay}ms...`);
      await sleep(delay);
      
    } catch (error) {
      if (i === maxRetries - 1) throw error;
    }
  }
  
  throw new Error('Max retries exceeded');
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
```

#### 3. Batch Requests

```typescript
// BAD: Individual requests
for (const okrId of okrIds) {
  await fetch(`/api/okrs/${okrId}`);
}

// GOOD: Batch request
const okrs = await fetch(`/api/okrs?ids=${okrIds.join(',')}`);
```

#### 4. Cache Aggressively

```typescript
const cache = new Map();

async function getCachedOKR(id: string) {
  // Check cache first
  if (cache.has(id)) {
    return cache.get(id);
  }
  
  // Fetch if not cached
  const okr = await fetch(`/api/okrs/${id}`).then(r => r.json());
  cache.set(id, okr);
  
  // Cache for 5 minutes
  setTimeout(() => cache.delete(id), 5 * 60 * 1000);
  
  return okr;
}
```

---

### Backend Best Practices

#### 1. Check Before Processing

```typescript
import rateLimit from 'express-rate-limit';

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 requests per window
  standardHeaders: true, // Return rate limit headers
  legacyHeaders: false,
  
  // Key by IP + email
  keyGenerator: (req) => {
    return `${req.ip}:${req.body.email}`;
  },
  
  // Custom error response
  handler: (req, res) => {
    res.status(429).json({
      type: 'https://api.kpi-platform.com/errors/rate-limit-exceeded',
      title: 'Rate Limit Exceeded',
      status: 429,
      detail: 'Too many login attempts. Try again in 15 minutes.',
      instance: req.path,
      requestId: req.id,
      retryAfter: 900
    });
  }
});

app.post('/api/auth/login', loginLimiter, loginController);
```

#### 2. Different Limits Per Role

```typescript
const rateLimitByRole = (req, res, next) => {
  const isManager = req.user?.is_manager > 0;
  const limit = isManager ? 200 : 100;
  
  // Apply role-specific limit
  // Implementation depends on rate limiting library
  next();
};
```

#### 3. Monitor & Alert

```typescript
// Log rate limit hits
app.use((req, res, next) => {
  res.on('finish', () => {
    if (res.statusCode === 429) {
      logger.warn({
        event: 'rate_limit_exceeded',
        userId: req.user?.id,
        ip: req.ip,
        endpoint: req.path,
        timestamp: new Date()
      });
    }
  });
  next();
});

// Alert if high rate limit violations
if (rateLimitViolations > 100) {
  alertOps('High rate limit violations detected');
}
```

---

## Burst Protection

### Grace Period

Short bursts (< 10 requests in 1 second) allowed without penalty:

```
Burst window: 1 second
Burst limit: 10 requests

If burst < 10 in 1s: Allow all, count against main limit
If burst >= 10 in 1s: Rate limit immediately
```

**Example:**
```
0.0s - Requests 1-9 → Allowed (burst)
0.5s - Request 10 → Allowed (burst limit)
0.6s - Request 11 → 429 (burst exceeded)
```

### Why Burst Protection?

- User clicks multiple buttons rapidly → OK
- Script hammers endpoint → Blocked
- Legitimate page load → OK
- DOS attack → Blocked

---

## Rate Limit Bypass (Admin)

### IP Whitelist

Trusted IPs bypass rate limits:

```
# In production environment
RATE_LIMIT_WHITELIST=10.0.0.0/8,172.16.0.0/12

# Whitelisted IPs:
- Internal VPN
- CI/CD pipeline
- Monitoring services
- Admin workstations (optional)
```

### API Keys (Future)

Service accounts with higher limits:

```http
POST /api/okrs
X-API-Key: sk_live_abc123...
```

**Not implemented in MVP** - Use JWT auth for now

---

## Rate Limit Testing

### Manual Testing

```bash
# Test login rate limit (5 attempts in 15 min)
for i in {1..6}; do
  echo "Attempt $i"
  curl -X POST http://localhost:3001/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"test@example.com","password":"wrong"}' \
    -i
  sleep 1
done

# Expected: First 5 attempts return 401, 6th returns 429

# Check headers
curl -X GET http://localhost:3001/api/okrs \
  -H "Authorization: Bearer <token>" \
  -i | grep X-RateLimit
```

### Load Testing

```bash
# Apache Bench - 200 requests, 10 concurrent
ab -n 200 -c 10 \
  -H "Authorization: Bearer <token>" \
  http://localhost:3001/api/okrs

# Expected: Some 429 responses after hitting limit
```

### Automated Tests

```typescript
describe('Rate Limiting', () => {
  it('should enforce login rate limit', async () => {
    const email = 'test@example.com';
    
    // Make 5 failed attempts
    for (let i = 0; i < 5; i++) {
      await request(app)
        .post('/api/auth/login')
        .send({ email, password: 'wrong' })
        .expect(401);
    }
    
    // 6th attempt should be rate limited
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email, password: 'wrong' })
      .expect(429);
    
    expect(res.body.type).toBe('https://api.kpi-platform.com/errors/rate-limit-exceeded');
    expect(res.headers['retry-after']).toBeDefined();
  });
  
  it('should include rate limit headers', async () => {
    const res = await request(app)
      .get('/api/okrs')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    
    expect(res.headers['x-ratelimit-limit']).toBe('100');
    expect(res.headers['x-ratelimit-remaining']).toBeDefined();
    expect(res.headers['x-ratelimit-reset']).toBeDefined();
  });
});
```

---

## Troubleshooting

### "Rate limit exceeded but I just started"

**Cause:** Shared IP or cache issue  
**Solution:** 
1. Check if behind proxy/NAT
2. Clear rate limit cache: `redis-cli FLUSHDB`
3. Whitelist IP if legitimate

### "Headers show limit but 429 too early"

**Cause:** Burst protection triggered  
**Solution:** Slow down requests, add delay between calls

### "Different limits on same endpoint"

**Cause:** Multiple rate limit policies  
**Solution:** Most restrictive applies (e.g., auth endpoints have stricter limits)

### "Rate limit not resetting"

**Cause:** Clock skew or cache issue  
**Solution:** 
1. Check server time: `date`
2. Check `X-RateLimit-Reset` timestamp
3. Restart rate limit service

---

## Production Configuration

### Environment Variables

```bash
# Rate limit settings
RATE_LIMIT_ENABLED=true
RATE_LIMIT_STORAGE=redis  # or memory
RATE_LIMIT_REDIS_URL=redis://localhost:6379

# Per-tier limits (requests per window)
RATE_LIMIT_AUTH=5
RATE_LIMIT_GENERAL=100
RATE_LIMIT_WEBHOOK=1000
RATE_LIMIT_MANAGER=50

# Window duration (milliseconds)
RATE_LIMIT_WINDOW=900000  # 15 minutes

# Whitelist (comma-separated IPs)
RATE_LIMIT_WHITELIST=10.0.0.0/8,172.16.0.0/12
```

### Monitoring Queries

```sql
-- Count rate limit violations by endpoint
SELECT 
  endpoint,
  COUNT(*) as violations,
  COUNT(DISTINCT user_id) as affected_users
FROM api_logs
WHERE status_code = 429
  AND timestamp > NOW() - INTERVAL '1 hour'
GROUP BY endpoint
ORDER BY violations DESC;

-- Top offenders
SELECT 
  user_id,
  COUNT(*) as violations
FROM api_logs
WHERE status_code = 429
  AND timestamp > NOW() - INTERVAL '1 day'
GROUP BY user_id
ORDER BY violations DESC
LIMIT 10;
```

---

## Rate Limit Recommendations

### For Different Use Cases

**Interactive UI:**
- Use 100/15min general limit (default)
- Implement client-side debouncing
- Cache responses aggressively

**Background Jobs:**
- Use service account with higher limit
- Implement exponential backoff
- Batch requests when possible

**Webhooks:**
- Use 1000/hour webhook limit
- Validate HMAC before counting
- Implement retry logic

**Admin Tools:**
- Request whitelist for admin IPs
- Batch operations when possible
- Show progress indicators for long operations

---

**For error handling:** See [errors.md](./errors.md)  
**For authentication:** See [authentication.md](./authentication.md)  
**For API reference:** See [openapi.yaml](./openapi.yaml)
