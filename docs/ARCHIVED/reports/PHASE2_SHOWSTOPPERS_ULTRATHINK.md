# Phase 2 Showstopper Fixes - Strategic Implementation Plan
**Build Standard:** State-of-the-Art Platform  
**Priority:** CRITICAL BLOCKERS  
**Timeline:** 40-50 hours (can execute in parallel)  
**Outcome:** Production-Ready Phase 2 before Phase 4 start

---

## STRATEGIC ANALYSIS

### The Real Problem
These aren't just "nice-to-have" fixes. They're architectural debt that will:
- **Security:** Data leaks in production (RLS bypass, validation holes)
- **Reliability:** Cascading bugs through Phases 4-8 (broken validation → broken calculations)
- **Maintainability:** Every bug fix retroactively requires fixing 6 other things
- **Performance:** Every user request does 2x database queries it should (token verification)

### Root Cause
Phase 1-3 were built with MVP mentality ("just make it work"). State-of-the-art requires "make it work + make it secure + make it maintainable + make it scalable."

### Strategic Approach
**NOT sequential cleanup.** Instead:

1. **Create reusable patterns/templates** (1x investment, 10x reuse)
2. **Execute in parallel** (security audit + validation schemas + test suite simultaneously)
3. **Automate what's repeatable** (generate tests, generate docs)
4. **Gate Phase 4 with quality checks** (cannot start without passing criteria)

---

## BLOCKER #1: SECURITY AUDIT (RLS + Token + Validation + Rate Limit)
**Impact:** Data breach risk | **Effort:** 6-8 hours | **Parallelizable:** YES (audit ≠ fixes)

### The Issues (Deep Analysis)

#### Issue 1A: RLS Policies Not Verified
**Current state:** Policies exist but nobody verified they actually work.
```sql
-- Example: Does this REALLY prevent User A from seeing User B's data?
CREATE POLICY user_see_own_data ON user_kpi_data
FOR SELECT USING (user_id = auth.uid());

-- UNTESTED SCENARIOS:
-- - Does it work when user switches teams?
-- - Does it work for deleted users?
-- - Does manager access work correctly?
-- - Does VP access bypass correctly?
```

**Risk:** Production goes live → User A accesses User B's salary OKR data → lawsuit

#### Issue 1B: Token Handling Anti-Pattern
**Current pattern:**
```typescript
// ❌ EVERY protected request does this:
const { user } = await supabase.auth.getUser(token);  // DB call
const userData = await supabase
  .from('"Users"')
  .select(...)
  .eq('id', user.id)
  .single();  // ANOTHER DB call
```

**Cost analysis at scale:**
- 100 req/sec × 2 DB calls = 200 DB calls/sec
- Supabase free tier: ~5 concurrent connections
- Result: Connection pool exhaustion, 503 errors
- At 10,000 users: Each page load = 2 wasted queries = $$$

**Risk:** Performance degradation under load; unnecessary AWS/Supabase costs

#### Issue 1C: No Input Validation (Zod Not Used)
```typescript
// ❌ CURRENT - accepts anything
const weight = req.body.weight;  // "abc"? Null? -5? All accepted

// Then query fails silently or produces garbage data:
await supabase.from('OKRs').insert({ weight: "abc" });
// Silently fails or corrupts data
```

**Risk:** Bad data in production; calculations wrong; difficult to debug

#### Issue 1D: No Protected Endpoint Rate Limiting
```typescript
// ✅ Auth endpoints: 5 req/15 min
// ❌ Protected endpoints: 20 req/15 min (too permissive)
// Result: Brute force attacks, DOS possible
```

### Strategic Fix (Parallel Execution)

**Phase 1: Security Audit (2-3 hours, non-blocking)**
Create test matrix document:

```markdown
# RLS Policy Test Matrix

## Test Case 1: User Cannot See Other User's Data
- User A logs in (token='a')
- Query: SELECT * FROM user_kpi_data (should get nothing or only own data)
- Expected: 0 rows OR only user_a's rows
- Result: ✓/✗

## Test Case 2: Manager Can See Team Member's Data
- Manager of Team A logs in
- Query: SELECT * FROM user_kpi_data WHERE user_id='team_member'
- Expected: All rows for team members in Manager's team
- Result: ✓/✗

## Test Case 3: VP Can See All Data
- VP account logs in
- Query: SELECT * FROM user_kpi_data
- Expected: All rows in table
- Result: ✓/✗

## Test Case 4: Deleted User Access Revoked
- User account deleted from Auth
- Try to use old token
- Expected: 401 Unauthorized
- Result: ✓/✗
```

**Execute manually in Supabase console:** 30 min to verify, document results

**Phase 2: Token Optimization (2-3 hours)**
```typescript
// ✅ OPTIMIZED - cache user in JWT payload
// Supabase JWT already contains custom claims, use it

export const authenticate = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const token = extractBearerToken(req);
    
    // Verify signature + expiry with Supabase
    const decoded = await supabase.auth.getUser(token);
    
    // Extract cached user data (no DB query!)
    req.user = {
      id: decoded.user.id,
      email: decoded.user.email,
      // These should be in auth.users custom_claims:
      role: decoded.user.user_metadata?.role,
      team_id: decoded.user.user_metadata?.team_id,
      is_manager: decoded.user.user_metadata?.is_manager
    };
    next();
  } catch (error) {
    next(new AppError('Invalid token', 401));
  }
};
```

**Migration:** Add custom_claims to auth.users on login (Phase 2 auth controller)
```typescript
// In authController.ts login function
const { data, error } = await supabase.auth.signInWithPassword({
  email,
  password
});

// Add custom claims
await supabase.auth.admin.updateUserById(data.user.id, {
  user_metadata: {
    role: userData.role,
    team_id: userData.team_id,
    is_manager: userData.is_manager
  }
});
```

**Phase 3: Strict Rate Limiting (1 hour)**
```typescript
// Create separate limiters per endpoint sensitivity
const publicLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5
});

const protectedLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,  // Strict on mutations
  skip: (req) => req.method === 'GET'  // GET can be higher
});

const mutationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,  // VERY strict on POST/PUT/DELETE
  skip: (req) => !['POST', 'PUT', 'DELETE'].includes(req.method)
});

// Usage:
router.post('/api/kpi-data', authenticate, mutationLimiter, ...)
```

### Success Criteria
- ✓ RLS audit completed: 4/4 test cases pass
- ✓ Token optimization: No extra DB queries on protected requests
- ✓ All endpoints protected by appropriate rate limiters
- ✓ Security documentation updated

---

## BLOCKER #2: INPUT VALIDATION (ZOD SCHEMAS)
**Impact:** Data integrity + security | **Effort:** 8-10 hours | **Parallelizable:** YES

### The Real Problem
Without validation, ANYTHING gets through:
```typescript
// POST /api/okrs/create
// This succeeds:
{
  "okr_title": null,
  "weight": "abc",
  "type": 99,
  "year": 2030
}
// Result: Garbage in database, calculations break, hard to debug
```

### Strategic Approach: Template-First

**Step 1: Create validation schema template (1 hour)**

```typescript
// src/validation/schemas.ts
import { z } from 'zod';

// ===== REUSABLE BASE SCHEMAS =====
export const IdSchema = z.string().uuid();
export const EmailSchema = z.string().email().max(255);
export const UrlSchema = z.string().url();
export const DateSchema = z.coerce.date();

// ===== AUTH SCHEMAS =====
export const SignupSchema = z.object({
  email: EmailSchema,
  password: z.string()
    .min(8, 'Password must be 8+ chars')
    .regex(/[A-Z]/, 'Must have uppercase')
    .regex(/[0-9]/, 'Must have number')
    .regex(/[!@#$%^&*]/, 'Must have special char'),
  first_name: z.string().min(1).max(100),
  last_name: z.string().min(1).max(100),
  team_id: z.number().int().positive()
});

// ===== OKR SCHEMAS =====
export const CreateOKRSchema = z.object({
  role_id: z.number().int().positive(),
  year: z.number().int().min(2020).max(2050),
  quarter: z.number().int().min(1).max(4),
  okr_number: z.number().int().min(1).max(10),
  okr_title: z.string().min(1).max(255),
  weight: z.number().int().min(0).max(100),
  description: z.string().max(1000).optional(),
  type: z.enum(['0', '1']), // Qualitative vs Quantitative
  deadline_at: DateSchema
});

export const CreateKPIComponentSchema = z.object({
  okr_id: IdSchema,
  component_name: z.string().min(1).max(255),
  component_weight: z.number().int().min(0).max(100),
  measurement_type: z.number().int().min(0).max(3),
  target_value: z.number().positive(),
  unit: z.string().min(1).max(50),
  description: z.string().max(500).optional()
});

// ===== KPI DATA SUBMISSION SCHEMAS =====
// Form Type 0: Count
export const CountFormSchema = z.object({
  kpi_component_id: IdSchema,
  count_value: z.number().int().min(0),
  evidence_link: UrlSchema,
  notes: z.string().max(500).optional()
});

// Form Type 1: Percentage
export const PercentageFormSchema = z.object({
  kpi_component_id: IdSchema,
  numerator: z.number().nonnegative(),
  denominator: z.number().positive(),
  evidence_link: UrlSchema,
  notes: z.string().max(500).optional()
}).refine(
  (data) => data.numerator <= data.denominator,
  { message: "Numerator cannot exceed denominator", path: ["numerator"] }
);

// Form Type 2: Score
export const ScoreFormSchema = z.object({
  kpi_component_id: IdSchema,
  score_value: z.number().min(0).max(5).multipleOf(0.1),
  response_count: z.number().int().positive(),
  evidence_link: UrlSchema,
  notes: z.string().max(500).optional()
});

// Form Type 3: Boolean
export const BooleanFormSchema = z.object({
  kpi_component_id: IdSchema,
  completed: z.enum(['0', '1']),
  evidence_link: UrlSchema,
  notes: z.string().max(500).optional()
});

// Union for dynamic routing
export const KPIDataSubmissionSchema = z.discriminatedUnion('measurement_type', [
  CountFormSchema.extend({ measurement_type: z.literal(0) }),
  PercentageFormSchema.extend({ measurement_type: z.literal(1) }),
  ScoreFormSchema.extend({ measurement_type: z.literal(2) }),
  BooleanFormSchema.extend({ measurement_type: z.literal(3) })
]);

// ===== ERROR MESSAGE MAPPER =====
export function formatValidationError(error: z.ZodError) {
  return {
    status: 'validation_error',
    errors: error.issues.map(issue => ({
      field: issue.path.join('.'),
      message: issue.message,
      code: issue.code
    }))
  };
}
```

**Step 2: Create validation middleware (30 min)**
```typescript
// src/middleware/validation.ts
import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { AppError } from './errorHandler';

export const validateBody = (schema: z.ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    
    if (!result.success) {
      return next(new AppError('Validation failed', 400, {
        errors: result.error.issues.map(issue => ({
          field: issue.path.join('.'),
          message: issue.message
        }))
      }));
    }
    
    req.body = result.data;
    next();
  };
};

export const validateQuery = (schema: z.ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.query);
    
    if (!result.success) {
      return next(new AppError('Invalid query parameters', 400, {
        errors: result.error.issues
      }));
    }
    
    req.query = result.data;
    next();
  };
};
```

**Step 3: Apply to all endpoints (6-7 hours)**

Template for each route file:
```typescript
// Example: src/routes/okr.ts
import { Router } from 'express';
import { validateBody } from '../middleware/validation';
import { CreateOKRSchema, CreateKPIComponentSchema } from '../validation/schemas';
import * as okrController from '../controllers/okrController';
import { authenticate, requireAdmin } from '../middleware/auth';

const router = Router();

// POST /api/okrs
router.post(
  '/',
  authenticate,
  requireAdmin,
  validateBody(CreateOKRSchema),  // ← VALIDATION
  okrController.createOKR
);

// POST /api/okrs/:id/components
router.post(
  '/:id/components',
  authenticate,
  requireAdmin,
  validateBody(CreateKPIComponentSchema),  // ← VALIDATION
  okrController.createComponent
);

export default router;
```

**Apply pattern to all routes:**
- auth.ts routes (4 endpoints)
- okr.ts routes (6 endpoints)
- kpiComponent.ts routes (4 endpoints)
- kpiData.ts routes (3 endpoints) ← Will add in Phase 4

### Success Criteria
- ✓ 20+ validation schemas created and tested
- ✓ All endpoints use validateBody/validateQuery middleware
- ✓ Invalid requests return 400 with clear error messages
- ✓ All field types validated (types, ranges, formats)
- ✓ Custom validation rules work (numerator <= denominator)

---

## BLOCKER #3: TESTING COVERAGE (~40% → 80%+)
**Impact:** Regression prevention | **Effort:** 18-20 hours | **Parallelizable:** YES (but needs templates)

### Strategic Approach: Test Template First

**Step 1: Create test suite template (2 hours)**

```typescript
// tests/setup.ts - Shared test utilities
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import app from '../src/app';

// Test user fixtures
export const TEST_USERS = {
  admin: { email: 'admin@test.com', password: 'TestPass123!' },
  manager: { email: 'manager@test.com', password: 'TestPass123!' },
  user: { email: 'user@test.com', password: 'TestPass123!' }
};

export const TEST_DATA = {
  okr: {
    role_id: 1,
    year: 2025,
    quarter: 4,
    okr_number: 1,
    okr_title: 'Test OKR',
    weight: 50,
    type: 1,
    deadline_at: new Date('2025-11-13').toISOString()
  },
  kpiComponent: {
    component_name: 'Test Component',
    component_weight: 100,
    measurement_type: 0,
    target_value: 1,
    unit: 'items'
  }
};

// Helper: Get auth token
export async function getAuthToken(user: typeof TEST_USERS.admin) {
  const res = await request(app)
    .post('/api/auth/login')
    .send(user);
  return res.body.token;
}

// Helper: Make authenticated request
export async function authRequest(method: string, path: string, token: string) {
  return request(app)[method](path)
    .set('Authorization', `Bearer ${token}`);
}
```

**Step 2: Create test templates for each feature**

```typescript
// tests/auth.test.ts - Template
import { describe, it, expect, beforeAll } from '@jest/globals';
import request from 'supertest';
import app from '../src/app';
import { TEST_USERS } from './setup';

describe('Authentication', () => {
  
  describe('POST /api/auth/signup', () => {
    
    it('should create user with valid email and password', async () => {
      const res = await request(app)
        .post('/api/auth/signup')
        .send({
          email: 'newuser@test.com',
          password: 'SecurePass123!',
          first_name: 'John',
          last_name: 'Doe',
          team_id: 1
        });
      
      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('data.user_id');
      expect(res.body.data.status).toBe('pending_approval');
    });
    
    it('should reject invalid email format', async () => {
      const res = await request(app)
        .post('/api/auth/signup')
        .send({
          email: 'not-an-email',
          password: 'SecurePass123!',
          first_name: 'John',
          last_name: 'Doe',
          team_id: 1
        });
      
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.errors).toContainEqual(
        expect.objectContaining({ field: 'email' })
      );
    });
    
    it('should reject weak password', async () => {
      const res = await request(app)
        .post('/api/auth/signup')
        .send({
          email: 'user@test.com',
          password: 'weak',  // ← Too weak
          first_name: 'John',
          last_name: 'Doe',
          team_id: 1
        });
      
      expect(res.status).toBe(400);
      expect(res.body.error.errors[0].field).toBe('password');
    });
    
    it('should reject duplicate email', async () => {
      // First signup
      await request(app)
        .post('/api/auth/signup')
        .send({ email: 'dup@test.com', password: 'Pass123!', ... });
      
      // Second signup with same email
      const res = await request(app)
        .post('/api/auth/signup')
        .send({ email: 'dup@test.com', password: 'Pass123!', ... });
      
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('EMAIL_EXISTS');
    });
  });
  
  describe('POST /api/auth/login', () => {
    
    it('should login user with valid credentials', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send(TEST_USERS.admin);
      
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('token');
      expect(res.body).toHaveProperty('user.id');
    });
    
    it('should reject wrong password', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: TEST_USERS.admin.email,
          password: 'WrongPass123!'
        });
      
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
    });
    
    it('should rate limit after 5 failed attempts', async () => {
      // Make 5 failed attempts
      for (let i = 0; i < 5; i++) {
        await request(app)
          .post('/api/auth/login')
          .send({ email: TEST_USERS.admin.email, password: 'Wrong!' });
      }
      
      // 6th attempt should be rate limited
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: TEST_USERS.admin.email, password: 'Wrong!' });
      
      expect(res.status).toBe(429);
    });
  });
  
  describe('Access Control', () => {
    
    it('should reject request without token', async () => {
      const res = await request(app)
        .get('/api/okrs');
      
      expect(res.status).toBe(401);
    });
    
    it('should reject request with invalid token', async () => {
      const res = await request(app)
        .get('/api/okrs')
        .set('Authorization', 'Bearer invalid_token_xyz');
      
      expect(res.status).toBe(401);
    });
  });
});
```

**Step 3: Test all Phase 2 & 3 features (16 hours)**

Tests needed:
```
Phase 2 Auth (15 tests):
- signup (4 tests: valid, invalid email, weak pass, duplicate)
- login (4 tests: valid, wrong pass, rate limit, token expired)
- password reset (3 tests)
- access control (4 tests: no token, invalid token, manager access, admin access)

Phase 3 OKR Config (20 tests):
- create OKR (5 tests: valid, invalid weight, unauthorized, duplicate)
- update OKR (5 tests: valid, invalid weight, soft delete)
- create component (5 tests: valid, weight validation, unauthorized)
- list endpoints (5 tests: pagination, filtering, access control)

Phase 2 Access Control (10 tests):
- user cannot see other user data (3 tests)
- manager can see team member data (3 tests)
- VP can see all data (2 tests)
- RLS policies enforced (2 tests)

Total: 45 tests = ~18 hours at 20 min per test avg
```

### Success Criteria
- ✓ 45+ tests written and passing
- ✓ Coverage > 80% for Phase 2 & 3 code
- ✓ All happy path + unhappy path scenarios covered
- ✓ Access control matrix tested
- ✓ Rate limiting verified
- ✓ Jest config working with test database

---

## BLOCKER #4: ERROR HANDLING STANDARDIZATION
**Impact:** Debugging + user experience | **Effort:** 6-8 hours | **Parallelizable:** YES

### Strategic Approach: Unified Error System

**Step 1: Create error code system (1 hour)**

```typescript
// src/types/errors.ts
export enum ErrorCode {
  // Authentication (1000-1999)
  AUTH_INVALID_CREDENTIALS = 'AUTH_INVALID_CREDENTIALS',
  AUTH_TOKEN_EXPIRED = 'AUTH_TOKEN_EXPIRED',
  AUTH_TOKEN_INVALID = 'AUTH_TOKEN_INVALID',
  AUTH_UNAUTHORIZED = 'AUTH_UNAUTHORIZED',
  AUTH_FORBIDDEN = 'AUTH_FORBIDDEN',
  AUTH_EMAIL_EXISTS = 'AUTH_EMAIL_EXISTS',
  AUTH_EMAIL_NOT_VERIFIED = 'AUTH_EMAIL_NOT_VERIFIED',
  AUTH_NOT_APPROVED = 'AUTH_NOT_APPROVED',
  
  // Validation (2000-2999)
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  VALIDATION_WEIGHT_SUM = 'VALIDATION_WEIGHT_SUM',
  VALIDATION_DUPLICATE = 'VALIDATION_DUPLICATE',
  VALIDATION_CONSTRAINT = 'VALIDATION_CONSTRAINT',
  
  // Resource (3000-3999)
  RESOURCE_NOT_FOUND = 'RESOURCE_NOT_FOUND',
  RESOURCE_ALREADY_EXISTS = 'RESOURCE_ALREADY_EXISTS',
  RESOURCE_CONFLICT = 'RESOURCE_CONFLICT',
  
  // Business Logic (4000-4999)
  DEADLINE_MISSED = 'DEADLINE_MISSED',
  STATUS_INVALID = 'STATUS_INVALID',
  OPERATION_NOT_ALLOWED = 'OPERATION_NOT_ALLOWED',
  
  // Database (5000-5999)
  DATABASE_ERROR = 'DATABASE_ERROR',
  DATABASE_CONSTRAINT = 'DATABASE_CONSTRAINT',
  
  // Server (6000-6999)
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  
  // Rate Limiting (7000-7999)
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED'
}

export interface ErrorContext {
  field?: string;
  value?: unknown;
  constraint?: string;
  suggestion?: string;
  requestId?: string;
  timestamp?: string;
}

export interface ErrorResponse {
  status: 'error';
  statusCode: number;
  error: {
    code: ErrorCode;
    message: string;
    context?: ErrorContext;
    errors?: Array<{
      field?: string;
      message: string;
      code: string;
    }>;
  };
  requestId: string;
  timestamp: string;
}
```

**Step 2: Refactor AppError class (1 hour)**

```typescript
// src/middleware/errorHandler.ts
import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { ErrorCode, ErrorContext } from '../types/errors';

export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly statusCode: number;
  public readonly context?: ErrorContext;
  public readonly requestId: string = uuidv4();

  constructor(
    code: ErrorCode,
    message: string,
    statusCode: number,
    context?: ErrorContext
  ) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
    this.context = context;
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

// Global error handler
export const errorHandler = (
  err: Error | AppError,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const timestamp = new Date().toISOString();
  
  // Log all errors
  console.error({
    timestamp,
    error: err.message,
    code: (err as AppError).code || 'UNKNOWN',
    requestId: (err as AppError).requestId,
    path: req.path,
    method: req.method,
    ip: req.ip,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
  
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      status: 'error',
      statusCode: err.statusCode,
      error: {
        code: err.code,
        message: err.message,
        context: err.context
      },
      requestId: err.requestId,
      timestamp
    });
  }
  
  // Unknown error
  res.status(500).json({
    status: 'error',
    statusCode: 500,
    error: {
      code: ErrorCode.INTERNAL_ERROR,
      message: 'An unexpected error occurred',
      context: {
        suggestion: 'Contact support with the requestId'
      }
    },
    requestId: (err as AppError).requestId || uuidv4(),
    timestamp
  });
};
```

**Step 3: Standardize response format (1 hour)**

```typescript
// src/utils/response.ts
import { Response } from 'express';
import { v4 as uuidv4 } from 'uuid';

export interface SuccessResponse<T> {
  status: 'success';
  statusCode: number;
  data: T;
  requestId: string;
  timestamp: string;
}

export function sendSuccess<T>(
  res: Response,
  data: T,
  statusCode: number = 200,
  requestId?: string
) {
  res.status(statusCode).json({
    status: 'success',
    statusCode,
    data,
    requestId: requestId || uuidv4(),
    timestamp: new Date().toISOString()
  });
}

// Usage in controllers:
export async function createOKR(req: Request, res: Response, next: NextFunction) {
  try {
    const okr = await okrService.create(req.body);
    sendSuccess(res, okr, 201);  // ← Simple, consistent
  } catch (error) {
    next(error);
  }
}
```

**Step 4: Update all error throws (4-5 hours)**

Template for each controller:
```typescript
// Before:
if (!user) {
  res.status(404).json({ error: 'User not found' });
}

// After:
if (!user) {
  throw new AppError(
    ErrorCode.RESOURCE_NOT_FOUND,
    'User not found',
    404,
    { suggestion: 'Verify user ID and try again' }
  );
}
```

Apply to:
- authController.ts
- okrController.ts
- kpiComponentController.ts
- All middleware

### Success Criteria
- ✓ 60+ error codes defined and documented
- ✓ All endpoints return consistent response format
- ✓ All errors include requestId for tracing
- ✓ Error responses include helpful context/suggestions
- ✓ Logging captures all errors with context

---

## BLOCKER #5: API DOCUMENTATION
**Impact:** Frontend development + onboarding | **Effort:** 4-6 hours | **Parallelizable:** YES (after code standardization)

### Strategic Approach: Automated Generation + Manual Polish

**Step 1: Generate OpenAPI spec from code (2 hours)**

```typescript
// scripts/generateOpenAPI.ts
import express from 'express';
import swaggerJsdoc from 'swagger-jsdoc';
import fs from 'fs';

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'KPI Platform API',
      version: '1.0.0',
      description: 'OKR tracking platform backend'
    },
    servers: [
      { url: 'http://localhost:3001/api', description: 'Development' },
      { url: 'https://api.okrs.example.com/api', description: 'Production' }
    ]
  },
  apis: ['./src/routes/**/*.ts']
};

const spec = swaggerJsdoc(options);
fs.writeFileSync('./docs/openapi.json', JSON.stringify(spec, null, 2));
console.log('✓ OpenAPI spec generated');
```

**Step 2: Add JSDoc annotations to routes (2 hours)**

Template:
```typescript
/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: Login user
 *     tags:
 *       - Authentication
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *                 example: user@company.com
 *               password:
 *                 type: string
 *                 example: SecurePass123!
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   type: object
 *                   properties:
 *                     token:
 *                       type: string
 *                     user:
 *                       type: object
 *       401:
 *         description: Invalid credentials
 */
router.post('/login', validateBody(LoginSchema), authController.login);
```

Apply to all 17 endpoints.

**Step 3: Generate Postman collection (1 hour)**

```bash
# Use openapi-to-postman package
npm install openapi-to-postman
npx openapi2postman -s docs/openapi.json -o docs/postman.json
```

Result: Ready-to-import Postman collection with auth, examples, tests

**Step 4: Create documentation site (1-2 hours)**

```markdown
# API Documentation - /docs/API/README.md

## Quick Start

1. Import Postman collection: `docs/postman.json`
2. Set environment variables: `base_url`, `auth_token`
3. Run requests

## Authentication

All protected endpoints require:
```
Authorization: Bearer <token>
```

Get token via POST /auth/login

## Error Codes

See ErrorCode enum in src/types/errors.ts

### Examples:

**AUTH_UNAUTHORIZED (401)**
```json
{
  "error": {
    "code": "AUTH_UNAUTHORIZED",
    "message": "User not approved by admin"
  }
}
```

## Endpoints by Category

### Authentication (5 endpoints)
- POST /auth/signup
- POST /auth/login
- POST /auth/logout
- POST /auth/password-reset
- POST /auth/password-change

### OKRs (6 endpoints)
- GET /okrs
- POST /okrs
- PUT /okrs/:id
- DELETE /okrs/:id
- GET /okrs/:id/components
- POST /okrs/:id/components

### KPI Data (3 endpoints - Phase 4)
- POST /kpi-data
- GET /kpi-data
- GET /kpi-data/:id/history
```

### Success Criteria
- ✓ OpenAPI spec generated and valid
- ✓ Postman collection working (can make requests)
- ✓ All 17 current endpoints documented
- ✓ Error codes documented
- ✓ Authentication flow documented
- ✓ Frontend team can start integration

---

## EXECUTION STRATEGY

### Timeline & Parallelization

```
Week 1 (Oct 23-30) - Parallel Execution
├─ Track 1: Security (6-8 hrs)
│  ├─ Oct 24: RLS audit (2-3 hrs)
│  ├─ Oct 25: Token optimization (2-3 hrs)
│  └─ Oct 26: Rate limiting (1 hr)
│
├─ Track 2: Validation Schemas (8-10 hrs)
│  ├─ Oct 23: Template creation (1 hr)
│  └─ Oct 24-27: Apply to endpoints (7-9 hrs)
│
├─ Track 3: Error Handling (6-8 hrs)
│  ├─ Oct 23: Error code system (1 hr)
│  ├─ Oct 24: AppError refactor (1 hr)
│  └─ Oct 25-27: Update all controllers (4-6 hrs)
│
└─ Track 4: Testing (18-20 hrs)
   ├─ Oct 23: Test template (2 hrs)
   ├─ Oct 24-28: Write tests (16-18 hrs)
   └─ Oct 29: Fix failing tests (2 hrs)

Week 2 (Oct 30-Nov 1) - Documentation + Integration
├─ Oct 30: API Documentation (4-6 hrs)
└─ Nov 1: Final validation & sign-off (2 hrs)

TOTAL: 42-52 hours
```

### Sequential Tasks (Must Follow Order)
1. Error code system (prerequisite for validation + testing)
2. Validation schemas (prerequisite for applying to endpoints)
3. Test templates (prerequisite for writing tests)
4. Everything else can run in parallel

### Code Review Gates Before Phase 4

**NO Phase 4 start until:**

```
Security:
  ☐ RLS audit: 4/4 test cases pass
  ☐ Token optimization deployed (no extra DB calls)
  ☐ Protected endpoint rate limiting enforced
  ☐ Security review signed off

Validation:
  ☐ 20+ schemas implemented
  ☐ All 17 endpoints use validateBody/validateQuery
  ☐ Invalid requests return 400 with error codes
  ☐ Edge cases tested (null, wrong type, boundary values)

Testing:
  ☐ 45+ tests passing
  ☐ Coverage > 80% for Phase 2 & 3
  ☐ All access control scenarios tested
  ☐ Rate limiting verified

Error Handling:
  ☐ All errors use error codes
  ☐ All responses use standard format
  ☐ All errors include requestId + timestamp
  ☐ Error messages helpful + actionable

Documentation:
  ☐ OpenAPI spec valid
  ☐ Postman collection working
  ☐ All 17 endpoints documented
  ☐ Error codes documented
  ☐ Frontend team can start integration
```

---

## RESOURCE REQUIREMENTS

### For Solo Dev (You)
- Time: 42-52 hours (doable in 1 week intensive)
- Tools: Already have (Zod, Jest, swagger-jsdoc)
- Knowledge: Already have (TypeScript, testing, API design)

### Deliverables
```
src/
├─ validation/
│  └─ schemas.ts (20+ schemas)
├─ types/
│  └─ errors.ts (error code system)
├─ middleware/
│  ├─ errorHandler.ts (refactored)
│  └─ validation.ts (new)
├─ utils/
│  └─ response.ts (standardized responses)
└─ [all controllers updated]

tests/
├─ setup.ts (test utilities)
├─ auth.test.ts (15 tests)
├─ okr.test.ts (20 tests)
├─ kpiComponent.test.ts (10 tests)
└─ accessControl.test.ts (10 tests)

docs/
├─ openapi.json (auto-generated)
├─ postman.json (auto-generated)
├─ API/
│  └─ README.md (manual)
└─ ERROR_CODES.md (manual)
```

---

## SUCCESS METRICS

**Phase 2 Readiness:**
- Security: ✅ Zero RLS violations, optimized token handling
- Validation: ✅ All inputs validated before database
- Testing: ✅ 80%+ code coverage, 45+ tests passing
- Error Handling: ✅ 100% error code usage, consistent responses
- Documentation: ✅ All endpoints documented, frontend ready

**Phase 4 Blockers Removed:**
- ✅ Can now safely accept user submissions (validated)
- ✅ Can reliably reject invalid data (error codes clear)
- ✅ Can debug issues quickly (request tracing)
- ✅ Can scale safely (optimized token handling, rate limiting)
- ✅ Frontend team can develop in parallel (API documented)

---

## CRITICAL SUCCESS FACTORS

1. **Do error codes FIRST** - Everything depends on this
2. **Create templates** - Don't repeat work 17 times
3. **Automate generation** - OpenAPI → Postman is one command
4. **Test as you go** - Don't save testing for the end
5. **Gate Phase 4 strictly** - No shortcuts, no exceptions

**Do this properly, and Phase 4-8 will be smooth.**  
**Skip this, and Phase 4-8 will be chaos.**

---

**Ready to start? Which track do you want to tackle first?**
- Security audit (lowest effort, unblocks everything)
- Error codes (prerequisite for validation)
- Test template (enables parallel test writing)

