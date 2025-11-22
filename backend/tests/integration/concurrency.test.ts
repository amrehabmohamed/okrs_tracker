/**
 * Concurrency & Race Condition Tests - Phase 4
 * 
 * Tests simultaneous submissions and version tracking under load
 * Ensures database constraints and locking mechanisms work correctly
 */

import request from 'supertest';
import app from '../../src/app';
import { supabase } from '../../src/db';

let userToken: string;
let userId: string;
let testComponentId: string;

describe('Concurrency & Race Conditions', () => {
  
  beforeAll(async () => {
    // Authenticate test user
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ 
        email: 'pm1@company.com', 
        password: 'password123' 
      });
    
    if (!loginRes.body.success) {
      throw new Error('Failed to authenticate test user');
    }
    
    userToken = loginRes.body.data.access_token;
    userId = loginRes.body.data.user.id;
    
    // Get a test component
    const { data: component } = await supabase
      .from('kpi_components')
      .select('id')
      .eq('measurement_type', 0) // Count type
      .limit(1)
      .single();
    
    if (!component) {
      throw new Error('No test component found');
    }
    
    testComponentId = component.id;
    
    // Clean any existing submissions for this component
    await supabase
      .from('user_kpi_data')
      .delete()
      .eq('user_id', userId)
      .eq('kpi_component_id', testComponentId);
    
  }, 15000);
  
  afterEach(async () => {
    // Clean up after each test
    await supabase
      .from('user_kpi_data')
      .delete()
      .eq('user_id', userId)
      .eq('kpi_component_id', testComponentId);
  });
  
  // ==================== SIMULTANEOUS SUBMISSIONS ====================
  
  describe('Simultaneous Submission Protection', () => {
    
    it('[C1] prevents duplicate pending submissions from concurrent requests', async () => {
      // Fire 3 identical requests simultaneously
      const requests = [1, 2, 3].map(() =>
        request(app)
          .post('/api/kpi-data')
          .set('Authorization', `Bearer ${userToken}`)
          .send({
            kpi_component_id: testComponentId,
            value: 5,
            evidence_link: 'https://example.com/concurrent'
          })
      );
      
      const responses = await Promise.all(requests);
      
      // Expect: 1 success (201), 2 conflicts (409)
      const successCount = responses.filter(r => r.status === 201).length;
      const conflictCount = responses.filter(r => r.status === 409).length;
      
      expect(successCount).toBe(1);
      expect(conflictCount).toBe(2);
      
      // Verify only 1 submission in database
      const { data: submissions } = await supabase
        .from('user_kpi_data')
        .select('*')
        .eq('user_id', userId)
        .eq('kpi_component_id', testComponentId);
      
      expect(submissions?.length).toBe(1);
      expect(submissions?.[0].version_number).toBe(1);
    });
    
    it('[C2] handles rapid sequential submissions correctly', async () => {
      // First submission
      const res1 = await request(app)
        .post('/api/kpi-data')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          kpi_component_id: testComponentId,
          value: 1,
          evidence_link: 'https://example.com/first'
        });
      
      expect(res1.status).toBe(201);
      
      // Try second submission immediately (should be rejected - pending exists)
      const res2 = await request(app)
        .post('/api/kpi-data')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          kpi_component_id: testComponentId,
          value: 2,
          evidence_link: 'https://example.com/second'
        });
      
      expect(res2.status).toBe(409);
      expect(res2.body.error.code).toBe('RESOURCE_CONFLICT');
    });
    
  });
  
  // ==================== VERSION INCREMENT UNDER LOAD ====================
  
  describe('Version Increment Atomicity', () => {
    
    it('[C3] increments version correctly after rejection', async () => {
      // Submit v1
      const res1 = await request(app)
        .post('/api/kpi-data')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          kpi_component_id: testComponentId,
          value: 1,
          evidence_link: 'https://example.com/v1'
        });
      
      expect(res1.status).toBe(201);
      const submission1Id = res1.body.data.id;
      
      // Manager rejects
      await supabase
        .from('user_kpi_data')
        .update({ status: 2 }) // Rejected
        .eq('id', submission1Id);
      
      // Submit v2
      const res2 = await request(app)
        .post('/api/kpi-data')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          kpi_component_id: testComponentId,
          value: 2,
          evidence_link: 'https://example.com/v2'
        });
      
      expect(res2.status).toBe(201);
      expect(res2.body.data.version_number).toBe(2);
      
      // Verify database has both versions
      const { data: allVersions } = await supabase
        .from('user_kpi_data')
        .select('version_number, status')
        .eq('user_id', userId)
        .eq('kpi_component_id', testComponentId)
        .order('version_number');
      
      expect(allVersions?.length).toBe(2);
      expect(allVersions?.[0].version_number).toBe(1);
      expect(allVersions?.[0].status).toBe(2); // Rejected
      expect(allVersions?.[1].version_number).toBe(2);
      expect(allVersions?.[1].status).toBe(0); // Pending
    });
    
    it('[C4] handles multiple rejection cycles correctly', async () => {
      // Submit v1
      let res = await request(app)
        .post('/api/kpi-data')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          kpi_component_id: testComponentId,
          value: 1,
          evidence_link: 'https://example.com/v1'
        });
      
      expect(res.body.data.version_number).toBe(1);
      
      // Cycle through 3 rejections
      for (let v = 2; v <= 4; v++) {
        // Reject previous version
        await supabase
          .from('user_kpi_data')
          .update({ status: 2 })
          .eq('user_id', userId)
          .eq('kpi_component_id', testComponentId)
          .eq('version_number', v - 1);
        
        // Submit next version
        res = await request(app)
          .post('/api/kpi-data')
          .set('Authorization', `Bearer ${userToken}`)
          .send({
            kpi_component_id: testComponentId,
            value: v,
            evidence_link: `https://example.com/v${v}`
          });
        
        expect(res.status).toBe(201);
        expect(res.body.data.version_number).toBe(v);
      }
      
      // Verify all 4 versions exist
      const { data: allVersions } = await supabase
        .from('user_kpi_data')
        .select('version_number')
        .eq('user_id', userId)
        .eq('kpi_component_id', testComponentId)
        .order('version_number');
      
      expect(allVersions?.length).toBe(4);
      expect(allVersions?.map(v => v.version_number)).toEqual([1, 2, 3, 4]);
    });
    
  });
  
  // ==================== DEADLINE RACE CONDITIONS ====================
  
  describe('Deadline Edge Cases', () => {
    
    it('[C5] handles submission at exact deadline moment', async () => {
      // Set deadline to 1 second from now
      const deadlineTime = new Date(Date.now() + 1000);
      
      await supabase
        .from('kpi_components')
        .update({ deadline_at: deadlineTime.toISOString() })
        .eq('id', testComponentId);
      
      // Submit immediately (should succeed)
      const resNow = await request(app)
        .post('/api/kpi-data')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          kpi_component_id: testComponentId,
          value: 1,
          evidence_link: 'https://example.com/just-in-time'
        });
      
      expect(resNow.status).toBe(201);
      
      // Wait for deadline to pass
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Clean previous submission
      await supabase
        .from('user_kpi_data')
        .delete()
        .eq('user_id', userId)
        .eq('kpi_component_id', testComponentId);
      
      // Try to submit after deadline (should fail)
      const resLate = await request(app)
        .post('/api/kpi-data')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          kpi_component_id: testComponentId,
          value: 2,
          evidence_link: 'https://example.com/too-late'
        });
      
      expect(resLate.status).toBe(403);
      expect(resLate.body.error.message).toContain('deadline');
      
      // Restore deadline
      const futureDeadline = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
      await supabase
        .from('kpi_components')
        .update({ deadline_at: futureDeadline.toISOString() })
        .eq('id', testComponentId);
    }, 10000);
    
  });
  
  // ==================== DATABASE CONSTRAINT VERIFICATION ====================
  
  describe('Database Constraint Enforcement', () => {
    
    it('[C6] prevents version conflicts via unique constraint', async () => {
      // This test verifies database-level protection
      // Even if application logic fails, DB should prevent duplicates
      
      // Submit normally
      const res = await request(app)
        .post('/api/kpi-data')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          kpi_component_id: testComponentId,
          value: 1,
          evidence_link: 'https://example.com/constraint-test'
        });
      
      expect(res.status).toBe(201);
      
      // Try to manually insert duplicate (should fail at DB level)
      const { error } = await supabase
        .from('user_kpi_data')
        .insert({
          user_id: userId,
          okr_id: res.body.data.okr_id,
          kpi_component_id: testComponentId,
          value: 999,
          version_number: 1, // Same version!
          status: 0,
          data_source: 0,
          evidence_link: 'https://example.com/duplicate'
        });
      
      // Should fail due to unique constraint on (user_id, kpi_component_id, version_number)
      expect(error).not.toBeNull();
      expect(error?.code).toBe('23505'); // PostgreSQL unique violation
    });
    
  });
  
  // ==================== PERFORMANCE UNDER LOAD ====================
  
  describe('Performance Benchmarks', () => {
    
    it('[C7] maintains < 500ms response time under concurrent load', async () => {
      // Clean slate
      await supabase
        .from('user_kpi_data')
        .delete()
        .eq('user_id', userId);
      
      // Get 5 different components
      const { data: components } = await supabase
        .from('kpi_components')
        .select('id')
        .eq('measurement_type', 0)
        .limit(5);
      
      if (!components || components.length < 5) {
        console.warn('Skipping load test: insufficient components');
        return;
      }
      
      // Submit to all 5 concurrently
      const startTime = Date.now();
      
      const requests = components.map((comp, i) =>
        request(app)
          .post('/api/kpi-data')
          .set('Authorization', `Bearer ${userToken}`)
          .send({
            kpi_component_id: comp.id,
            value: i + 1,
            evidence_link: `https://example.com/load-${i}`
          })
      );
      
      const responses = await Promise.all(requests);
      const totalTime = Date.now() - startTime;
      const avgTime = totalTime / 5;
      
      // All should succeed
      responses.forEach(res => {
        expect(res.status).toBe(201);
      });
      
      // Average time per request should be reasonable
      expect(avgTime).toBeLessThan(500);
      
      console.log(`Concurrent submission performance: ${avgTime.toFixed(0)}ms average`);
    }, 15000);
    
  });
  
});
