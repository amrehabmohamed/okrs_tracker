# Test Coverage Setup

**Run:**
```bash
chmod +x setup-tests.sh
./setup-tests.sh
```

**Create these test files in `backend/tests/integration/`:**

## 1. auth.test.ts
```typescript
import request from 'supertest';
import app from '../../src/app';

let userToken: string;
let adminToken: string;

describe('Auth API', () => {
  
  beforeAll(async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'pm1@company.com', password: 'password123' });
    userToken = res.body.token;
    
    const admin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'vp@company.com', password: 'password123' });
    adminToken = admin.body.token;
  });
  
  describe('POST /signup', () => {
    it('valid data → 201', async () => {
      const res = await request(app)
        .post('/api/auth/signup')
        .send({
          email: `test${Date.now()}@test.com`,
          password: 'ValidPass123!',
          firstName: 'Test',
          lastName: 'User'
        });
      expect(res.status).toBe(201);
      expect(res.body.userId).toBeDefined();
    });
    
    it('invalid email → 400', async () => {
      const res = await request(app)
        .post('/api/auth/signup')
        .send({ email: 'invalid', password: 'ValidPass123!', firstName: 'A', lastName: 'B' });
      expect(res.status).toBe(400);
      expect(res.body.errors).toBeDefined();
    });
    
    it('weak password → 400', async () => {
      const res = await request(app)
        .post('/api/auth/signup')
        .send({ email: 'test@test.com', password: 'short', firstName: 'A', lastName: 'B' });
      expect(res.status).toBe(400);
    });
  });
  
  describe('POST /login', () => {
    it('valid credentials → 200 + token', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'pm1@company.com', password: 'password123' });
      expect(res.status).toBe(200);
      expect(res.body.token).toBeDefined();
    });
    
    it('wrong password → 401', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'pm1@company.com', password: 'wrong' });
      expect(res.status).toBe(401);
    });
  });
  
  describe('GET /me', () => {
    it('with token → 200', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${userToken}`);
      expect(res.status).toBe(200);
      expect(res.body.email).toBeDefined();
    });
    
    it('without token → 401', async () => {
      const res = await request(app).get('/api/auth/me');
      expect(res.status).toBe(401);
    });
  });
});
```

## 2. okr.test.ts
```typescript
import request from 'supertest';
import app from '../../src/app';

let adminToken: string;
let userToken: string;
let okrId: string;

describe('OKR API', () => {
  
  beforeAll(async () => {
    const admin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'vp@company.com', password: 'password123' });
    adminToken = admin.body.token;
    
    const user = await request(app)
      .post('/api/auth/login')
      .send({ email: 'pm1@company.com', password: 'password123' });
    userToken = user.body.token;
  });
  
  describe('GET /okrs', () => {
    it('admin can list → 200', async () => {
      const res = await request(app)
        .get('/api/okrs?role_id=1&year=2025&quarter=4')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      if (res.body.data.length > 0) okrId = res.body.data[0].id;
    });
    
    it('user cannot list → 403', async () => {
      const res = await request(app)
        .get('/api/okrs')
        .set('Authorization', `Bearer ${userToken}`);
      expect(res.status).toBe(403);
    });
    
    it('invalid quarter → 400', async () => {
      const res = await request(app)
        .get('/api/okrs?quarter=5')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(400);
    });
  });
  
  describe('POST /okrs', () => {
    it('admin can create → 201', async () => {
      const res = await request(app)
        .post('/api/okrs')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          role_id: 1,
          year: 2025,
          quarter: 4,
          okr_number: 9,
          okr_title: 'Test OKR',
          weight: 5,
          type: 1
        });
      expect(res.status).toBe(201);
      expect(res.body.id).toBeDefined();
    });
    
    it('user cannot create → 403', async () => {
      const res = await request(app)
        .post('/api/okrs')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          role_id: 1,
          year: 2025,
          quarter: 4,
          okr_number: 9,
          okr_title: 'Test',
          weight: 5,
          type: 1
        });
      expect(res.status).toBe(403);
    });
    
    it('invalid weight → 400', async () => {
      const res = await request(app)
        .post('/api/okrs')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          role_id: 1,
          year: 2025,
          quarter: 4,
          okr_number: 9,
          okr_title: 'Test',
          weight: 'abc',
          type: 1
        });
      expect(res.status).toBe(400);
    });
  });
  
  describe('GET /okrs/:id', () => {
    it('valid UUID → 200', async () => {
      if (!okrId) return;
      const res = await request(app)
        .get(`/api/okrs/${okrId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
    });
    
    it('invalid UUID → 400', async () => {
      const res = await request(app)
        .get('/api/okrs/not-a-uuid')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(400);
    });
  });
  
  describe('PUT /okrs/:id', () => {
    it('admin can update → 200', async () => {
      if (!okrId) return;
      const res = await request(app)
        .put(`/api/okrs/${okrId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ okr_title: 'Updated' });
      expect(res.status).toBe(200);
    });
    
    it('user cannot update → 403', async () => {
      if (!okrId) return;
      const res = await request(app)
        .put(`/api/okrs/${okrId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ okr_title: 'Updated' });
      expect(res.status).toBe(403);
    });
  });
});
```

## 3. kpiComponent.test.ts
```typescript
import request from 'supertest';
import app from '../../src/app';

let adminToken: string;
let okrId: string;
let componentId: string;

describe('KPI Component API', () => {
  
  beforeAll(async () => {
    const admin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'vp@company.com', password: 'password123' });
    adminToken = admin.body.token;
    
    const okrs = await request(app)
      .get('/api/okrs?role_id=1&year=2025&quarter=4')
      .set('Authorization', `Bearer ${adminToken}`);
    okrId = okrs.body.data[0]?.id;
  });
  
  describe('POST /kpi-components', () => {
    it('valid data → 201', async () => {
      if (!okrId) return;
      const res = await request(app)
        .post('/api/kpi-components')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          okr_id: okrId,
          component_name: 'Test Component',
          component_weight: 10,
          measurement_type: 0,
          target_value: 5,
          unit: 'items'
        });
      expect(res.status).toBe(201);
      componentId = res.body.id;
    });
    
    it('invalid measurement_type → 400', async () => {
      if (!okrId) return;
      const res = await request(app)
        .post('/api/kpi-components')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          okr_id: okrId,
          component_name: 'Test',
          component_weight: 10,
          measurement_type: 99,
          target_value: 5,
          unit: 'items'
        });
      expect(res.status).toBe(400);
    });
  });
  
  describe('GET /kpi-components', () => {
    it('with okr_id → 200', async () => {
      if (!okrId) return;
      const res = await request(app)
        .get(`/api/kpi-components?okr_id=${okrId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });
  
  describe('PUT /kpi-components/:id', () => {
    it('update component → 200', async () => {
      if (!componentId) return;
      const res = await request(app)
        .put(`/api/kpi-components/${componentId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ component_name: 'Updated Name' });
      expect(res.status).toBe(200);
    });
  });
  
  describe('DELETE /kpi-components/:id', () => {
    it('delete component → 204', async () => {
      if (!componentId) return;
      const res = await request(app)
        .delete(`/api/kpi-components/${componentId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(204);
    });
  });
});
```

**Run tests:**
```bash
cd backend
npm test
npm run test:coverage
```

**Target:** 80%+ coverage on all metrics
