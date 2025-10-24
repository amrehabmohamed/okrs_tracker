/**
 * KPI Data Integration Tests - Phase 4 Sprint 2
 * End-to-end testing of all 4 form types through controller → service → database
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import request from 'supertest';
import { app } from '../app';
import { supabase } from '../db';

describe('KPI Data Submission Integration Tests', () => {
  let authToken: string;
  let userId: string;
  let countComponentId: string;
  let percentageComponentId: string;
  let scoreComponentId: string;
  let booleanComponentId: string;

  beforeAll(async () => {
    // Setup test user and components
    // This assumes test data exists from Phase 3 seeding
    const { data: { session } } = await supabase.auth.signInWithPassword({
      email: 'pm1@company.com',
      password: 'TestPassword123'
    });
    
    authToken = session?.access_token || '';
    userId = session?.user?.id || '';

    // Get component IDs for each measurement type
    const { data: components } = await supabase
      .from('"KPI_Components"')
      .select('id, measurement_type')
      .limit(4);

    countComponentId = components?.find(c => c.measurement_type === 0)?.id || '';
    percentageComponentId = components?.find(c => c.measurement_type === 1)?.id || '';
    scoreComponentId = components?.find(c => c.measurement_type === 2)?.id || '';
    booleanComponentId = components?.find(c => c.measurement_type === 3)?.id || '';
  });

  beforeEach(async () => {
    // Clean up any pending submissions before each test
    await supabase
      .from('"User_KPI_Data"')
      .delete()
      .eq('user_id', userId)
      .eq('status', 0);
  });

  afterAll(async () => {
    // Cleanup test data
    await supabase
      .from('"User_KPI_Data"')
      .delete()
      .eq('user_id', userId);
  });

  describe('Count Form (type 0)', () => {
    it('submits valid count form', async () => {
      const response = await request(app)
        .post('/api/kpi-data')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          kpi_component_id: countComponentId,
          value: 2,
          evidence_link: 'https://docs.google.com/doc/test',
          notes: 'Two customer interviews completed'
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.value).toBe(2);
      expect(response.body.data.version_number).toBe(1);
      expect(response.body.data.status).toBe(0);
      expect(response.body.data.status_label).toBe('Pending');
    });

    it('rejects negative count', async () => {
      const response = await request(app)
        .post('/api/kpi-data')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          kpi_component_id: countComponentId,
          value: -5,
          evidence_link: 'https://docs.google.com/doc/test'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('greater than or equal to 0');
    });

    it('rejects decimal count', async () => {
      const response = await request(app)
        .post('/api/kpi-data')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          kpi_component_id: countComponentId,
          value: 2.5,
          evidence_link: 'https://docs.google.com/doc/test'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('must be an integer');
    });

    it('rejects missing evidence_link', async () => {
      const response = await request(app)
        .post('/api/kpi-data')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          kpi_component_id: countComponentId,
          value: 2
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('evidence_link is required');
    });
  });

  describe('Percentage Form (type 1)', () => {
    it('submits valid percentage form', async () => {
      const response = await request(app)
        .post('/api/kpi-data')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          kpi_component_id: percentageComponentId,
          numerator: 8,
          denominator: 10,
          evidence_link: 'https://docs.google.com/spreadsheet/test'
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.value).toBe(80.00);
      expect(response.body.data.numerator).toBe(8);
      expect(response.body.data.denominator).toBe(10);
    });

    it('calculates percentage correctly for 3/7', async () => {
      const response = await request(app)
        .post('/api/kpi-data')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          kpi_component_id: percentageComponentId,
          numerator: 3,
          denominator: 7,
          evidence_link: 'https://docs.google.com/spreadsheet/test'
        });

      expect(response.status).toBe(201);
      expect(response.body.data.value).toBe(42.86);
    });

    it('accepts overachievement (150%)', async () => {
      const response = await request(app)
        .post('/api/kpi-data')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          kpi_component_id: percentageComponentId,
          numerator: 15,
          denominator: 10,
          evidence_link: 'https://docs.google.com/spreadsheet/test'
        });

      expect(response.status).toBe(201);
      expect(response.body.data.value).toBe(150.00);
    });

    it('rejects division by zero', async () => {
      const response = await request(app)
        .post('/api/kpi-data')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          kpi_component_id: percentageComponentId,
          numerator: 5,
          denominator: 0,
          evidence_link: 'https://docs.google.com/spreadsheet/test'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('division by zero');
    });

    it('rejects negative numerator', async () => {
      const response = await request(app)
        .post('/api/kpi-data')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          kpi_component_id: percentageComponentId,
          numerator: -5,
          denominator: 10,
          evidence_link: 'https://docs.google.com/spreadsheet/test'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('greater than or equal to 0');
    });
  });

  describe('Score Form (type 2)', () => {
    it('submits valid score form', async () => {
      const response = await request(app)
        .post('/api/kpi-data')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          kpi_component_id: scoreComponentId,
          score_value: 3.5,
          response_count: 15,
          evidence_link: 'https://jotform.com/report/test'
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.value).toBe(3.5);
      expect(response.body.data.response_count).toBe(15);
    });

    it('accepts minimum score 0.0', async () => {
      const response = await request(app)
        .post('/api/kpi-data')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          kpi_component_id: scoreComponentId,
          score_value: 0.0,
          response_count: 10,
          evidence_link: 'https://jotform.com/report/test'
        });

      expect(response.status).toBe(201);
      expect(response.body.data.value).toBe(0.0);
    });

    it('accepts maximum score 5.0', async () => {
      const response = await request(app)
        .post('/api/kpi-data')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          kpi_component_id: scoreComponentId,
          score_value: 5.0,
          response_count: 20,
          evidence_link: 'https://jotform.com/report/test'
        });

      expect(response.status).toBe(201);
      expect(response.body.data.value).toBe(5.0);
    });

    it('rejects score with 2 decimals (3.55)', async () => {
      const response = await request(app)
        .post('/api/kpi-data')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          kpi_component_id: scoreComponentId,
          score_value: 3.55,
          response_count: 15,
          evidence_link: 'https://jotform.com/report/test'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('exactly 1 decimal place');
    });

    it('rejects score above 5.0', async () => {
      const response = await request(app)
        .post('/api/kpi-data')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          kpi_component_id: scoreComponentId,
          score_value: 5.5,
          response_count: 10,
          evidence_link: 'https://jotform.com/report/test'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('between 0.0 and 5.0');
    });

    it('rejects zero response_count', async () => {
      const response = await request(app)
        .post('/api/kpi-data')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          kpi_component_id: scoreComponentId,
          score_value: 3.5,
          response_count: 0,
          evidence_link: 'https://jotform.com/report/test'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('must be greater than 0');
    });
  });

  describe('Boolean Form (type 3)', () => {
    it('submits valid boolean form with completed=1', async () => {
      const response = await request(app)
        .post('/api/kpi-data')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          kpi_component_id: booleanComponentId,
          completed: 1,
          evidence_link: 'https://docs.google.com/doc/proof'
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.value).toBe(1);
    });

    it('submits valid boolean form with completed=0', async () => {
      const response = await request(app)
        .post('/api/kpi-data')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          kpi_component_id: booleanComponentId,
          completed: 0,
          evidence_link: 'https://docs.google.com/doc/proof'
        });

      expect(response.status).toBe(201);
      expect(response.body.data.value).toBe(0);
    });

    it('rejects boolean true', async () => {
      const response = await request(app)
        .post('/api/kpi-data')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          kpi_component_id: booleanComponentId,
          completed: true,
          evidence_link: 'https://docs.google.com/doc/proof'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('must be a number');
    });

    it('rejects string "1"', async () => {
      const response = await request(app)
        .post('/api/kpi-data')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          kpi_component_id: booleanComponentId,
          completed: "1",
          evidence_link: 'https://docs.google.com/doc/proof'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('must be a number');
    });

    it('rejects number 2', async () => {
      const response = await request(app)
        .post('/api/kpi-data')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          kpi_component_id: booleanComponentId,
          completed: 2,
          evidence_link: 'https://docs.google.com/doc/proof'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('must be exactly 0 or 1');
    });
  });

  describe('Authentication & Authorization', () => {
    it('rejects unauthenticated request', async () => {
      const response = await request(app)
        .post('/api/kpi-data')
        .send({
          kpi_component_id: countComponentId,
          value: 2,
          evidence_link: 'https://docs.google.com/doc/test'
        });

      expect(response.status).toBe(401);
    });

    it('rejects invalid token', async () => {
      const response = await request(app)
        .post('/api/kpi-data')
        .set('Authorization', 'Bearer invalid_token')
        .send({
          kpi_component_id: countComponentId,
          value: 2,
          evidence_link: 'https://docs.google.com/doc/test'
        });

      expect(response.status).toBe(401);
    });
  });

  describe('Duplicate Prevention', () => {
    it('prevents duplicate pending submission', async () => {
      // First submission
      await request(app)
        .post('/api/kpi-data')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          kpi_component_id: countComponentId,
          value: 2,
          evidence_link: 'https://docs.google.com/doc/test'
        });

      // Second submission should fail
      const response = await request(app)
        .post('/api/kpi-data')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          kpi_component_id: countComponentId,
          value: 3,
          evidence_link: 'https://docs.google.com/doc/test2'
        });

      expect(response.status).toBe(409);
      expect(response.body.error).toContain('already have a pending submission');
    });
  });

  describe('Data Retrieval', () => {
    it('retrieves user submissions', async () => {
      // Submit test data
      await request(app)
        .post('/api/kpi-data')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          kpi_component_id: countComponentId,
          value: 2,
          evidence_link: 'https://docs.google.com/doc/test'
        });

      // Retrieve
      const response = await request(app)
        .get('/api/kpi-data')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.count).toBeGreaterThan(0);
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('filters by component_id', async () => {
      const response = await request(app)
        .get(`/api/kpi-data?kpi_component_id=${countComponentId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      response.body.data.forEach((item: any) => {
        expect(item.kpi_component.id).toBe(countComponentId);
      });
    });

    it('filters by status', async () => {
      const response = await request(app)
        .get('/api/kpi-data?status=0')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      response.body.data.forEach((item: any) => {
        expect(item.status).toBe(0);
      });
    });
  });
});
