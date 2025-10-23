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
  
  describe('POST /api/kpi-components', () => {
    it('should create component with valid data', async () => {
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
    
    it('should reject invalid measurement_type', async () => {
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
    
    it('should reject negative target_value', async () => {
      if (!okrId) return;
      const res = await request(app)
        .post('/api/kpi-components')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          okr_id: okrId,
          component_name: 'Test',
          component_weight: 10,
          measurement_type: 0,
          target_value: -5,
          unit: 'items'
        });
      expect(res.status).toBe(400);
    });
  });
  
  describe('GET /api/kpi-components', () => {
    it('should list components for OKR', async () => {
      if (!okrId) return;
      const res = await request(app)
        .get(`/api/kpi-components?okr_id=${okrId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
    
    it('should reject invalid UUID', async () => {
      const res = await request(app)
        .get('/api/kpi-components?okr_id=invalid')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(400);
    });
  });
  
  describe('PUT /api/kpi-components/:id', () => {
    it('should update component', async () => {
      if (!componentId) return;
      const res = await request(app)
        .put(`/api/kpi-components/${componentId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ component_name: 'Updated Name' });
      expect(res.status).toBe(200);
      expect(res.body.component_name).toBe('Updated Name');
    });
    
    it('should reject empty update', async () => {
      if (!componentId) return;
      const res = await request(app)
        .put(`/api/kpi-components/${componentId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({});
      expect(res.status).toBe(400);
    });
  });
  
  describe('DELETE /api/kpi-components/:id', () => {
    it('should delete component', async () => {
      if (!componentId) return;
      const res = await request(app)
        .delete(`/api/kpi-components/${componentId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(204);
    });
  });
});
