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
  
  describe('GET /api/okrs', () => {
    it('should allow admin to list OKRs', async () => {
      const res = await request(app)
        .get('/api/okrs?role_id=1&year=2025&quarter=4')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      if (res.body.data.length > 0) okrId = res.body.data[0].id;
    });
    
    it('should reject user access', async () => {
      const res = await request(app)
        .get('/api/okrs')
        .set('Authorization', `Bearer ${userToken}`);
      expect(res.status).toBe(403);
    });
    
    it('should reject invalid quarter', async () => {
      const res = await request(app)
        .get('/api/okrs?quarter=5')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(400);
    });
  });
  
  describe('POST /api/okrs', () => {
    it('should allow admin to create OKR', async () => {
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
    
    it('should reject user creation', async () => {
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
    
    it('should reject invalid weight', async () => {
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
    
    it('should reject out of range weight', async () => {
      const res = await request(app)
        .post('/api/okrs')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          role_id: 1,
          year: 2025,
          quarter: 4,
          okr_number: 9,
          okr_title: 'Test',
          weight: 150,
          type: 1
        });
      expect(res.status).toBe(400);
    });
  });
  
  describe('GET /api/okrs/:id', () => {
    it('should get single OKR with valid UUID', async () => {
      if (!okrId) return;
      const res = await request(app)
        .get(`/api/okrs/${okrId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.id).toBe(okrId);
    });
    
    it('should reject invalid UUID', async () => {
      const res = await request(app)
        .get('/api/okrs/not-a-uuid')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(400);
    });
  });
  
  describe('PUT /api/okrs/:id', () => {
    it('should allow admin to update', async () => {
      if (!okrId) return;
      const res = await request(app)
        .put(`/api/okrs/${okrId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ okr_title: 'Updated Title' });
      expect(res.status).toBe(200);
      expect(res.body.okr_title).toBe('Updated Title');
    });
    
    it('should reject user update', async () => {
      if (!okrId) return;
      const res = await request(app)
        .put(`/api/okrs/${okrId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ okr_title: 'Updated' });
      expect(res.status).toBe(403);
    });
    
    it('should reject empty update', async () => {
      if (!okrId) return;
      const res = await request(app)
        .put(`/api/okrs/${okrId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({});
      expect(res.status).toBe(400);
    });
  });
  
  describe('DELETE /api/okrs/:id', () => {
    it('should reject user deletion', async () => {
      if (!okrId) return;
      const res = await request(app)
        .delete(`/api/okrs/${okrId}`)
        .set('Authorization', `Bearer ${userToken}`);
      expect(res.status).toBe(403);
    });
  });
});
