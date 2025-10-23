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
  
  describe('POST /api/auth/signup', () => {
    it('should create user with valid data', async () => {
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
    
    it('should reject invalid email', async () => {
      const res = await request(app)
        .post('/api/auth/signup')
        .send({ email: 'invalid', password: 'ValidPass123!', firstName: 'A', lastName: 'B' });
      expect(res.status).toBe(400);
      expect(res.body.errors).toBeDefined();
    });
    
    it('should reject weak password', async () => {
      const res = await request(app)
        .post('/api/auth/signup')
        .send({ email: 'test@test.com', password: 'short', firstName: 'A', lastName: 'B' });
      expect(res.status).toBe(400);
    });
  });
  
  describe('POST /api/auth/login', () => {
    it('should login with valid credentials', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'pm1@company.com', password: 'password123' });
      expect(res.status).toBe(200);
      expect(res.body.token).toBeDefined();
    });
    
    it('should reject wrong password', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'pm1@company.com', password: 'wrong' });
      expect(res.status).toBe(401);
    });
    
    it('should reject invalid email format', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'invalid', password: 'password123' });
      expect(res.status).toBe(400);
    });
  });
  
  describe('GET /api/auth/me', () => {
    it('should return user with valid token', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${userToken}`);
      expect(res.status).toBe(200);
      expect(res.body.email).toBeDefined();
    });
    
    it('should reject without token', async () => {
      const res = await request(app).get('/api/auth/me');
      expect(res.status).toBe(401);
    });
  });
  
  describe('POST /api/auth/password-change', () => {
    it('should reject invalid old password', async () => {
      const res = await request(app)
        .post('/api/auth/password-change')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          oldPassword: 'wrong',
          newPassword: 'NewPassword123!'
        });
      expect(res.status).toBe(401);
    });
    
    it('should reject weak new password', async () => {
      const res = await request(app)
        .post('/api/auth/password-change')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          oldPassword: 'password123',
          newPassword: 'weak'
        });
      expect(res.status).toBe(400);
    });
  });
});
