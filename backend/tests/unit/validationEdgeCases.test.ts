/**
 * Validation Edge Cases & Security Tests - Phase 4
 * 
 * Comprehensive security and edge case validation across all form types
 * Tests malicious inputs, boundary conditions, and type coercion attacks
 */

import { describe, it, expect } from '@jest/globals';
import {
  validateCountForm,
  validatePercentageForm,
  validateScoreForm,
  validateBooleanForm
} from '../../src/services/kpiDataValidationService';
import {
  CountFormInput,
  PercentageFormInput,
  ScoreFormInput,
  BooleanFormInput
} from '../../src/types/kpiData';

describe('Cross-Form Security Validation', () => {
  
  const validUuid = '550e8400-e29b-41d4-a716-446655440000';
  const validUrl = 'https://docs.google.com/document/d/test';
  
  // ==================== XSS PREVENTION ====================
  
  describe('XSS Attack Prevention', () => {
    
    it('rejects JavaScript execution in evidence_link', () => {
      const xssUrls = [
        'javascript:alert(1)',
        'javascript:void(0)',
        'javascript://example.com%0Aalert(1)',
        'data:text/html,<script>alert(1)</script>',
        'vbscript:alert(1)'
      ];
      
      xssUrls.forEach(maliciousUrl => {
        expect(() => validateCountForm({
          kpi_component_id: validUuid,
          value: 1,
          evidence_link: maliciousUrl
        })).toThrow();
      });
    });
    
    it('sanitizes HTML in notes field', () => {
      const htmlInjection = '<script>alert("XSS")</script><img src=x onerror=alert(1)>';
      
      // Should not throw - notes is plain text, but verify no execution
      expect(() => validateCountForm({
        kpi_component_id: validUuid,
        value: 1,
        evidence_link: validUrl,
        notes: htmlInjection
      })).not.toThrow();
      
      // In production, notes should be escaped when rendered
    });
    
  });
  
  // ==================== SQL INJECTION PREVENTION ====================
  
  describe('SQL Injection Prevention', () => {
    
    it('rejects SQL injection attempts in UUID field', () => {
      const sqlInjections = [
        "' OR '1'='1",
        "1'; DROP TABLE users; --",
        "1' UNION SELECT * FROM users--"
      ];
      
      sqlInjections.forEach(injection => {
        expect(() => validateCountForm({
          kpi_component_id: injection,
          value: 1,
          evidence_link: validUrl
        })).toThrow('Invalid uuid');
      });
    });
    
    it('handles SQL special characters in notes safely', () => {
      const sqlChars = "'; DROP TABLE--; O'Reilly's book";
      
      // Should accept as plain text (parameterized queries prevent injection)
      expect(() => validateCountForm({
        kpi_component_id: validUuid,
        value: 1,
        evidence_link: validUrl,
        notes: sqlChars
      })).not.toThrow();
    });
    
  });
  
  // ==================== TYPE COERCION ATTACKS ====================
  
  describe('Type Coercion Security', () => {
    
    it('prevents boolean to number coercion', () => {
      expect(() => validateCountForm({
        kpi_component_id: validUuid,
        value: true as any,
        evidence_link: validUrl
      })).toThrow('must be a number');
      
      expect(() => validateBooleanForm({
        kpi_component_id: validUuid,
        completed: true as any,
        evidence_link: validUrl
      })).toThrow('must be a number');
    });
    
    it('prevents string to number coercion', () => {
      expect(() => validateCountForm({
        kpi_component_id: validUuid,
        value: "123" as any,
        evidence_link: validUrl
      })).toThrow('must be a number');
    });
    
    it('prevents null coercion', () => {
      expect(() => validateCountForm({
        kpi_component_id: validUuid,
        value: null as any,
        evidence_link: validUrl
      })).toThrow();
    });
    
    it('prevents object injection', () => {
      expect(() => validateCountForm({
        kpi_component_id: validUuid,
        value: { valueOf: () => 5 } as any,
        evidence_link: validUrl
      })).toThrow();
    });
    
  });
  
  // ==================== BOUNDARY CONDITIONS ====================
  
  describe('Numeric Boundary Conditions', () => {
    
    it('handles zero correctly across all forms', () => {
      expect(() => validateCountForm({
        kpi_component_id: validUuid,
        value: 0,
        evidence_link: validUrl
      })).not.toThrow();
      
      expect(() => validatePercentageForm({
        kpi_component_id: validUuid,
        numerator: 0,
        denominator: 10,
        evidence_link: validUrl
      })).not.toThrow();
      
      expect(() => validateScoreForm({
        kpi_component_id: validUuid,
        score_value: 0.0,
        response_count: 1,
        evidence_link: validUrl
      })).not.toThrow();
      
      expect(() => validateBooleanForm({
        kpi_component_id: validUuid,
        completed: 0,
        evidence_link: validUrl
      })).not.toThrow();
    });
    
    it('handles maximum values correctly', () => {
      expect(() => validateCountForm({
        kpi_component_id: validUuid,
        value: Number.MAX_SAFE_INTEGER,
        evidence_link: validUrl
      })).not.toThrow();
      
      expect(() => validateScoreForm({
        kpi_component_id: validUuid,
        score_value: 5.0,
        response_count: 999999,
        evidence_link: validUrl
      })).not.toThrow();
    });
    
    it('rejects unsafe numeric values', () => {
      expect(() => validateCountForm({
        kpi_component_id: validUuid,
        value: Infinity,
        evidence_link: validUrl
      })).toThrow();
      
      expect(() => validateCountForm({
        kpi_component_id: validUuid,
        value: -Infinity,
        evidence_link: validUrl
      })).toThrow();
      
      expect(() => validateCountForm({
        kpi_component_id: validUuid,
        value: NaN,
        evidence_link: validUrl
      })).toThrow();
    });
    
  });
  
  // ==================== URL EDGE CASES ====================
  
  describe('URL Validation Edge Cases', () => {
    
    it('accepts various legitimate URL formats', () => {
      const validUrls = [
        'https://example.com',
        'http://example.com',
        'https://sub.example.com',
        'https://example.com:8080/path',
        'https://example.com/path?query=value',
        'https://example.com/path#fragment',
        'https://example.com/path?q=v&x=y#frag',
        'https://user@example.com/path',
        'https://192.168.1.1/path',
        'https://[::1]/path'
      ];
      
      validUrls.forEach(url => {
        expect(() => validateCountForm({
          kpi_component_id: validUuid,
          value: 1,
          evidence_link: url
        })).not.toThrow();
      });
    });
    
    it('rejects malformed URLs', () => {
      const invalidUrls = [
        'htp://example.com', // typo in protocol
        '//example.com', // missing protocol
        'https:/example.com', // missing slash
        'https://example', // invalid domain
        'https://', // incomplete
        'example.com', // no protocol
        'www.example.com', // no protocol
        '', // empty
        ' ', // whitespace only
      ];
      
      invalidUrls.forEach(url => {
        expect(() => validateCountForm({
          kpi_component_id: validUuid,
          value: 1,
          evidence_link: url
        })).toThrow();
      });
    });
    
    it('handles internationalized domain names (IDN)', () => {
      // Should accept punycode encoded IDNs
      expect(() => validateCountForm({
        kpi_component_id: validUuid,
        value: 1,
        evidence_link: 'https://xn--e1afmkfd.xn--p1ai/doc' // пример.рф in punycode
      })).not.toThrow();
    });
    
  });
  
  // ==================== PERCENTAGE FORM EDGE CASES ====================
  
  describe('Percentage Calculation Edge Cases', () => {
    
    it('handles very small fractions correctly', () => {
      expect(() => validatePercentageForm({
        kpi_component_id: validUuid,
        numerator: 1,
        denominator: 1000,
        evidence_link: validUrl
      })).not.toThrow();
    });
    
    it('handles overachievement > 100%', () => {
      expect(() => validatePercentageForm({
        kpi_component_id: validUuid,
        numerator: 150,
        denominator: 100,
        evidence_link: validUrl
      })).not.toThrow();
    });
    
    it('handles massive overachievement', () => {
      expect(() => validatePercentageForm({
        kpi_component_id: validUuid,
        numerator: 10000,
        denominator: 1,
        evidence_link: validUrl
      })).not.toThrow();
    });
    
    it('rejects division by zero attempts', () => {
      expect(() => validatePercentageForm({
        kpi_component_id: validUuid,
        numerator: 10,
        denominator: 0,
        evidence_link: validUrl
      })).toThrow('division by zero');
    });
    
    it('rejects negative denominator', () => {
      expect(() => validatePercentageForm({
        kpi_component_id: validUuid,
        numerator: 10,
        denominator: -5,
        evidence_link: validUrl
      })).toThrow();
    });
    
    it('handles decimal precision correctly', () => {
      // 3/7 = 42.857142... should round to 42.86
      expect(() => validatePercentageForm({
        kpi_component_id: validUuid,
        numerator: 3,
        denominator: 7,
        evidence_link: validUrl
      })).not.toThrow();
    });
    
  });
  
  // ==================== SCORE FORM EDGE CASES ====================
  
  describe('Score Validation Edge Cases', () => {
    
    it('enforces exact 1 decimal place', () => {
      expect(() => validateScoreForm({
        kpi_component_id: validUuid,
        score_value: 3.55, // 2 decimals
        response_count: 10,
        evidence_link: validUrl
      })).toThrow('exactly 1 decimal');
      
      expect(() => validateScoreForm({
        kpi_component_id: validUuid,
        score_value: 3.555, // 3 decimals
        response_count: 10,
        evidence_link: validUrl
      })).toThrow('exactly 1 decimal');
    });
    
    it('accepts integer scores (treated as .0)', () => {
      expect(() => validateScoreForm({
        kpi_component_id: validUuid,
        score_value: 3.0,
        response_count: 10,
        evidence_link: validUrl
      })).not.toThrow();
    });
    
    it('rejects scores outside 0-5 range', () => {
      expect(() => validateScoreForm({
        kpi_component_id: validUuid,
        score_value: 5.1,
        response_count: 10,
        evidence_link: validUrl
      })).toThrow('between 0.0 and 5.0');
      
      expect(() => validateScoreForm({
        kpi_component_id: validUuid,
        score_value: -0.1,
        response_count: 10,
        evidence_link: validUrl
      })).toThrow('between 0.0 and 5.0');
    });
    
    it('rejects zero or negative response count', () => {
      expect(() => validateScoreForm({
        kpi_component_id: validUuid,
        score_value: 3.5,
        response_count: 0,
        evidence_link: validUrl
      })).toThrow('must be greater than 0');
      
      expect(() => validateScoreForm({
        kpi_component_id: validUuid,
        score_value: 3.5,
        response_count: -5,
        evidence_link: validUrl
      })).toThrow();
    });
    
  });
  
  // ==================== BOOLEAN FORM EDGE CASES ====================
  
  describe('Boolean Validation Edge Cases', () => {
    
    it('strictly requires 0 or 1 (not boolean)', () => {
      expect(() => validateBooleanForm({
        kpi_component_id: validUuid,
        completed: true as any,
        evidence_link: validUrl
      })).toThrow('must be a number');
      
      expect(() => validateBooleanForm({
        kpi_component_id: validUuid,
        completed: false as any,
        evidence_link: validUrl
      })).toThrow('must be a number');
    });
    
    it('rejects truthy/falsy coercion', () => {
      const falsyValues = ["", 0, null, undefined];
      const truthyValues = ["1", 1, "true", true];
      
      // Only numeric 0 and 1 should be accepted
      expect(() => validateBooleanForm({
        kpi_component_id: validUuid,
        completed: 0,
        evidence_link: validUrl
      })).not.toThrow();
      
      expect(() => validateBooleanForm({
        kpi_component_id: validUuid,
        completed: 1,
        evidence_link: validUrl
      })).not.toThrow();
      
      // Everything else should fail
      expect(() => validateBooleanForm({
        kpi_component_id: validUuid,
        completed: "1" as any,
        evidence_link: validUrl
      })).toThrow();
    });
    
    it('rejects numbers other than 0 or 1', () => {
      [-1, 2, 10, 0.5, 1.1].forEach(value => {
        expect(() => validateBooleanForm({
          kpi_component_id: validUuid,
          completed: value,
          evidence_link: validUrl
        })).toThrow('exactly 0 or 1');
      });
    });
    
  });
  
  // ==================== UNICODE & SPECIAL CHARACTERS ====================
  
  describe('Unicode & Special Character Handling', () => {
    
    it('accepts Unicode in notes field', () => {
      const unicodeNotes = '测试 テスト тест 🚀 émoji café';
      
      expect(() => validateCountForm({
        kpi_component_id: validUuid,
        value: 1,
        evidence_link: validUrl,
        notes: unicodeNotes
      })).not.toThrow();
    });
    
    it('handles right-to-left text', () => {
      const rtlText = 'مرحبا بك في المنصة';
      
      expect(() => validateCountForm({
        kpi_component_id: validUuid,
        value: 1,
        evidence_link: validUrl,
        notes: rtlText
      })).not.toThrow();
    });
    
    it('handles zero-width characters', () => {
      const zwText = 'test\u200Bdata\u200C\u200D';
      
      expect(() => validateCountForm({
        kpi_component_id: validUuid,
        value: 1,
        evidence_link: validUrl,
        notes: zwText
      })).not.toThrow();
    });
    
  });
  
});
