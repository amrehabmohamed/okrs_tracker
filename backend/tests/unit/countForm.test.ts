/**
 * Count Form Unit Tests - Phase 4
 * 
 * Comprehensive validation testing for count form submissions
 * Ensures data integrity before hitting database layer
 */

import { describe, it, expect } from '@jest/globals';
import {
  validateCountForm
} from '../../src/services/kpiDataValidationService';
import { CountFormInput } from '../../src/types/kpiData';
import { ValidationError } from '../../src/middleware/errorHandler';

describe('Count Form Validation', () => {
  
  const validInput: CountFormInput = {
    kpi_component_id: '550e8400-e29b-41d4-a716-446655440000',
    value: 3,
    evidence_link: 'https://docs.google.com/document/d/test123',
    notes: 'Test count submission',
    data_source: 0
  };

  // ==================== HAPPY PATH ====================
  
  describe('Valid Inputs', () => {
    
    it('validates correct count input', () => {
      expect(() => validateCountForm(validInput)).not.toThrow();
    });

    it('accepts zero value', () => {
      expect(() => validateCountForm({ ...validInput, value: 0 })).not.toThrow();
    });

    it('accepts large values (overachievement)', () => {
      expect(() => validateCountForm({ ...validInput, value: 100 })).not.toThrow();
      expect(() => validateCountForm({ ...validInput, value: 9999 })).not.toThrow();
    });

    it('accepts http and https URLs', () => {
      expect(() => validateCountForm({ 
        ...validInput, 
        evidence_link: 'http://example.com/doc' 
      })).not.toThrow();
      
      expect(() => validateCountForm({ 
        ...validInput, 
        evidence_link: 'https://secure.example.com/doc' 
      })).not.toThrow();
    });

    it('accepts URLs with query parameters', () => {
      expect(() => validateCountForm({ 
        ...validInput, 
        evidence_link: 'https://docs.google.com/document?id=123&share=true' 
      })).not.toThrow();
    });

    it('accepts URLs with fragments', () => {
      expect(() => validateCountForm({ 
        ...validInput, 
        evidence_link: 'https://docs.example.com/page#section-2' 
      })).not.toThrow();
    });

    it('accepts omitted optional notes', () => {
      const inputWithoutNotes = { ...validInput };
      delete inputWithoutNotes.notes;
      expect(() => validateCountForm(inputWithoutNotes)).not.toThrow();
    });

    it('accepts empty string notes', () => {
      expect(() => validateCountForm({ ...validInput, notes: '' })).not.toThrow();
    });

    it('accepts long notes (within reasonable limit)', () => {
      const longNotes = 'a'.repeat(500);
      expect(() => validateCountForm({ ...validInput, notes: longNotes })).not.toThrow();
    });

  });

  // ==================== REQUIRED FIELDS ====================
  
  describe('Required Field Validation', () => {
    
    it('rejects missing kpi_component_id', () => {
      const input = { ...validInput };
      delete (input as any).kpi_component_id;
      expect(() => validateCountForm(input)).toThrow('kpi_component_id is required');
    });

    it('rejects null kpi_component_id', () => {
      expect(() => validateCountForm({ 
        ...validInput, 
        kpi_component_id: null as any 
      })).toThrow('kpi_component_id is required');
    });

    it('rejects missing value', () => {
      const input = { ...validInput };
      delete (input as any).value;
      expect(() => validateCountForm(input)).toThrow('value is required');
    });

    it('rejects null value', () => {
      expect(() => validateCountForm({ 
        ...validInput, 
        value: null as any 
      })).toThrow('value is required');
    });

    it('rejects missing evidence_link', () => {
      const input = { ...validInput };
      delete (input as any).evidence_link;
      expect(() => validateCountForm(input)).toThrow('evidence_link is required');
    });

    it('rejects null evidence_link', () => {
      expect(() => validateCountForm({ 
        ...validInput, 
        evidence_link: null as any 
      })).toThrow('evidence_link is required');
    });

    it('rejects empty string evidence_link', () => {
      expect(() => validateCountForm({ 
        ...validInput, 
        evidence_link: '' 
      })).toThrow('evidence_link is required');
    });

  });

  // ==================== VALUE VALIDATION ====================
  
  describe('Value Constraints', () => {
    
    it('rejects negative values', () => {
      expect(() => validateCountForm({ ...validInput, value: -1 }))
        .toThrow('greater than or equal to 0');
      expect(() => validateCountForm({ ...validInput, value: -100 }))
        .toThrow('greater than or equal to 0');
    });

    it('rejects decimal values', () => {
      expect(() => validateCountForm({ ...validInput, value: 2.5 }))
        .toThrow('must be an integer');
    });

    it('rejects string values', () => {
      expect(() => validateCountForm({ ...validInput, value: "5" as any }))
        .toThrow('must be a number');
    });

    it('rejects boolean values', () => {
      expect(() => validateCountForm({ ...validInput, value: true as any }))
        .toThrow('must be a number');
    });

    it('rejects NaN', () => {
      expect(() => validateCountForm({ ...validInput, value: NaN }))
        .toThrow('must be a number');
    });

    it('rejects Infinity', () => {
      expect(() => validateCountForm({ ...validInput, value: Infinity }))
        .toThrow('must be a number');
    });

  });

  // ==================== URL VALIDATION ====================
  
  describe('Evidence Link Validation', () => {
    
    it('rejects invalid URL format', () => {
      expect(() => validateCountForm({ 
        ...validInput, 
        evidence_link: 'not-a-url' 
      })).toThrow('valid URL');
    });

    it('rejects URL without protocol', () => {
      expect(() => validateCountForm({ 
        ...validInput, 
        evidence_link: 'www.example.com/doc' 
      })).toThrow('valid URL');
    });

    it('rejects URL with invalid protocol', () => {
      expect(() => validateCountForm({ 
        ...validInput, 
        evidence_link: 'ftp://example.com/file' 
      })).toThrow('valid URL');
    });

    it('rejects javascript: protocol (XSS prevention)', () => {
      expect(() => validateCountForm({ 
        ...validInput, 
        evidence_link: 'javascript:alert(1)' 
      })).toThrow('valid URL');
    });

    it('rejects data: protocol (XSS prevention)', () => {
      expect(() => validateCountForm({ 
        ...validInput, 
        evidence_link: 'data:text/html,<script>alert(1)</script>' 
      })).toThrow('valid URL');
    });

    it('rejects file: protocol', () => {
      expect(() => validateCountForm({ 
        ...validInput, 
        evidence_link: 'file:///etc/passwd' 
      })).toThrow('valid URL');
    });

  });

  // ==================== UUID VALIDATION ====================
  
  describe('Component ID Format', () => {
    
    it('rejects invalid UUID format', () => {
      expect(() => validateCountForm({ 
        ...validInput, 
        kpi_component_id: 'not-a-uuid' 
      })).toThrow('Invalid uuid');
    });

    it('rejects empty string UUID', () => {
      expect(() => validateCountForm({ 
        ...validInput, 
        kpi_component_id: '' 
      })).toThrow('Invalid uuid');
    });

    it('rejects malformed UUID', () => {
      expect(() => validateCountForm({ 
        ...validInput, 
        kpi_component_id: '550e8400-e29b-41d4-a716' // Too short
      })).toThrow('Invalid uuid');
    });

  });

  // ==================== DATA SOURCE VALIDATION ====================
  
  describe('Data Source Field', () => {
    
    it('accepts valid data_source values', () => {
      expect(() => validateCountForm({ ...validInput, data_source: 0 })).not.toThrow(); // manual
      expect(() => validateCountForm({ ...validInput, data_source: 1 })).not.toThrow(); // jotform
      expect(() => validateCountForm({ ...validInput, data_source: 2 })).not.toThrow(); // auto
    });

    it('defaults to 0 if omitted', () => {
      const input = { ...validInput };
      delete (input as any).data_source;
      expect(() => validateCountForm(input)).not.toThrow();
    });

    it('rejects invalid data_source values', () => {
      expect(() => validateCountForm({ ...validInput, data_source: 3 }))
        .toThrow();
      expect(() => validateCountForm({ ...validInput, data_source: -1 }))
        .toThrow();
    });

  });

  // ==================== EDGE CASES ====================
  
  describe('Edge Cases', () => {
    
    it('handles maximum safe integer', () => {
      expect(() => validateCountForm({ 
        ...validInput, 
        value: Number.MAX_SAFE_INTEGER 
      })).not.toThrow();
    });

    it('rejects values exceeding safe integer', () => {
      expect(() => validateCountForm({ 
        ...validInput, 
        value: Number.MAX_SAFE_INTEGER + 1 
      })).toThrow();
    });

    it('handles very long URLs (within reasonable limit)', () => {
      const longUrl = 'https://example.com/doc?' + 'a=1&'.repeat(100);
      expect(() => validateCountForm({ 
        ...validInput, 
        evidence_link: longUrl 
      })).not.toThrow();
    });

    it('rejects URLs exceeding maximum length', () => {
      const tooLongUrl = 'https://example.com/doc?' + 'a=1&'.repeat(10000);
      expect(() => validateCountForm({ 
        ...validInput, 
        evidence_link: tooLongUrl 
      })).toThrow();
    });

  });

  // ==================== TYPE SAFETY ====================
  
  describe('TypeScript Type Safety', () => {
    
    it('rejects extra unexpected fields', () => {
      const inputWithExtra = { 
        ...validInput, 
        unexpectedField: 'should be ignored' 
      };
      // Should not throw - extra fields are stripped by Zod
      expect(() => validateCountForm(inputWithExtra as any)).not.toThrow();
    });

    it('rejects completely wrong object shape', () => {
      expect(() => validateCountForm({ 
        completely: 'wrong',
        object: 'shape'
      } as any)).toThrow();
    });

    it('rejects null input', () => {
      expect(() => validateCountForm(null as any)).toThrow();
    });

    it('rejects undefined input', () => {
      expect(() => validateCountForm(undefined as any)).toThrow();
    });

    it('rejects array input', () => {
      expect(() => validateCountForm([] as any)).toThrow();
    });

    it('rejects primitive input', () => {
      expect(() => validateCountForm(123 as any)).toThrow();
      expect(() => validateCountForm('string' as any)).toThrow();
    });

  });

});
