/**
 * Percentage Form Unit Tests - Phase 4 Sprint 2
 *
 * Comprehensive test suite for percentage form validation and calculation
 * Tests validation logic, calculation accuracy, and edge cases
 */

import { describe, it, expect } from '@jest/globals';
import {
  validatePercentageForm,
  calculatePercentage
} from '../services/kpiDataValidationService';
import { PercentageFormInput } from '../types/kpiData';
import { ValidationError } from '../middleware/errorHandler';

describe('Percentage Form Validation', () => {
  /**
   * Valid input baseline for testing
   */
  const validInput: PercentageFormInput = {
    kpi_component_id: '550e8400-e29b-41d4-a716-446655440000',
    numerator: 8,
    denominator: 10,
    evidence_link: 'https://docs.google.com/spreadsheets/d/abc123',
    notes: 'Test submission',
    data_source: 0
  };

  describe('Happy Path', () => {
    it('should validate correct percentage input', () => {
      expect(() => validatePercentageForm(validInput)).not.toThrow();
    });

    it('should accept zero numerator', () => {
      const input = { ...validInput, numerator: 0 };
      expect(() => validatePercentageForm(input)).not.toThrow();
    });

    it('should accept overachievement (numerator > denominator)', () => {
      const input = { ...validInput, numerator: 15, denominator: 10 };
      expect(() => validatePercentageForm(input)).not.toThrow();
    });

    it('should accept fractional values', () => {
      const input = { ...validInput, numerator: 8.5, denominator: 10.5 };
      expect(() => validatePercentageForm(input)).not.toThrow();
    });

    it('should accept input without notes', () => {
      const input = { ...validInput, notes: undefined };
      expect(() => validatePercentageForm(input)).not.toThrow();
    });

    it('should accept HTTP and HTTPS URLs', () => {
      const httpInput = { ...validInput, evidence_link: 'http://example.com/doc' };
      expect(() => validatePercentageForm(httpInput)).not.toThrow();

      const httpsInput = { ...validInput, evidence_link: 'https://example.com/doc' };
      expect(() => validatePercentageForm(httpsInput)).not.toThrow();
    });
  });

  describe('Numerator Validation', () => {
    it('should reject missing numerator', () => {
      const input = { ...validInput, numerator: undefined as any };
      expect(() => validatePercentageForm(input)).toThrow(ValidationError);
      expect(() => validatePercentageForm(input)).toThrow('numerator is required');
    });

    it('should reject null numerator', () => {
      const input = { ...validInput, numerator: null as any };
      expect(() => validatePercentageForm(input)).toThrow(ValidationError);
      expect(() => validatePercentageForm(input)).toThrow('numerator is required');
    });

    it('should reject non-numeric numerator', () => {
      const input = { ...validInput, numerator: 'eight' as any };
      expect(() => validatePercentageForm(input)).toThrow(ValidationError);
      expect(() => validatePercentageForm(input)).toThrow('numerator must be a valid number');
    });

    it('should reject NaN numerator', () => {
      const input = { ...validInput, numerator: NaN };
      expect(() => validatePercentageForm(input)).toThrow(ValidationError);
      expect(() => validatePercentageForm(input)).toThrow('numerator must be a valid number');
    });

    it('should reject negative numerator', () => {
      const input = { ...validInput, numerator: -5 };
      expect(() => validatePercentageForm(input)).toThrow(ValidationError);
      expect(() => validatePercentageForm(input)).toThrow('numerator must be greater than or equal to 0');
    });

    it('should reject unreasonably high numerator (>10x denominator)', () => {
      const input = { ...validInput, numerator: 150, denominator: 10 };
      expect(() => validatePercentageForm(input)).toThrow(ValidationError);
      expect(() => validatePercentageForm(input)).toThrow('unreasonably high');
    });

    it('should accept exactly 10x ratio', () => {
      const input = { ...validInput, numerator: 100, denominator: 10 };
      expect(() => validatePercentageForm(input)).not.toThrow();
    });
  });

  describe('Denominator Validation', () => {
    it('should reject missing denominator', () => {
      const input = { ...validInput, denominator: undefined as any };
      expect(() => validatePercentageForm(input)).toThrow(ValidationError);
      expect(() => validatePercentageForm(input)).toThrow('denominator is required');
    });

    it('should reject null denominator', () => {
      const input = { ...validInput, denominator: null as any };
      expect(() => validatePercentageForm(input)).toThrow(ValidationError);
      expect(() => validatePercentageForm(input)).toThrow('denominator is required');
    });

    it('should reject non-numeric denominator', () => {
      const input = { ...validInput, denominator: 'ten' as any };
      expect(() => validatePercentageForm(input)).toThrow(ValidationError);
      expect(() => validatePercentageForm(input)).toThrow('denominator must be a valid number');
    });

    it('should reject zero denominator', () => {
      const input = { ...validInput, denominator: 0 };
      expect(() => validatePercentageForm(input)).toThrow(ValidationError);
      expect(() => validatePercentageForm(input)).toThrow('division by zero not allowed');
    });

    it('should reject negative denominator', () => {
      const input = { ...validInput, denominator: -10 };
      expect(() => validatePercentageForm(input)).toThrow(ValidationError);
      expect(() => validatePercentageForm(input)).toThrow('division by zero not allowed');
    });

    it('should reject NaN denominator', () => {
      const input = { ...validInput, denominator: NaN };
      expect(() => validatePercentageForm(input)).toThrow(ValidationError);
      expect(() => validatePercentageForm(input)).toThrow('denominator must be a valid number');
    });
  });

  describe('Evidence Link Validation', () => {
    it('should reject missing evidence_link', () => {
      const input = { ...validInput, evidence_link: '' };
      expect(() => validatePercentageForm(input)).toThrow(ValidationError);
      expect(() => validatePercentageForm(input)).toThrow('evidence_link is required');
    });

    it('should reject invalid URL format', () => {
      const input = { ...validInput, evidence_link: 'not-a-url' };
      expect(() => validatePercentageForm(input)).toThrow(ValidationError);
      expect(() => validatePercentageForm(input)).toThrow('must be a valid URL');
    });

    it('should reject URL without protocol', () => {
      const input = { ...validInput, evidence_link: 'example.com/doc' };
      expect(() => validatePercentageForm(input)).toThrow(ValidationError);
    });

    it('should reject FTP protocol', () => {
      const input = { ...validInput, evidence_link: 'ftp://example.com/doc' };
      expect(() => validatePercentageForm(input)).toThrow(ValidationError);
    });
  });

  describe('Notes Validation', () => {
    it('should reject non-string notes', () => {
      const input = { ...validInput, notes: 123 as any };
      expect(() => validatePercentageForm(input)).toThrow(ValidationError);
      expect(() => validatePercentageForm(input)).toThrow('notes must be a string');
    });

    it('should reject notes exceeding 500 characters', () => {
      const input = { ...validInput, notes: 'a'.repeat(501) };
      expect(() => validatePercentageForm(input)).toThrow(ValidationError);
      expect(() => validatePercentageForm(input)).toThrow('must not exceed 500 characters');
    });

    it('should accept exactly 500 characters', () => {
      const input = { ...validInput, notes: 'a'.repeat(500) };
      expect(() => validatePercentageForm(input)).not.toThrow();
    });

    it('should sanitize HTML in notes', () => {
      const input = { ...validInput, notes: '<script>alert("xss")</script>Safe text' };
      validatePercentageForm(input);
      expect(input.notes).not.toContain('<script>');
      expect(input.notes).toContain('Safe text');
    });
  });

  describe('Data Source Validation', () => {
    it('should accept valid data sources (0, 1, 2)', () => {
      expect(() => validatePercentageForm({ ...validInput, data_source: 0 })).not.toThrow();
      expect(() => validatePercentageForm({ ...validInput, data_source: 1 })).not.toThrow();
      expect(() => validatePercentageForm({ ...validInput, data_source: 2 })).not.toThrow();
    });

    it('should reject invalid data source', () => {
      const input = { ...validInput, data_source: 99 };
      expect(() => validatePercentageForm(input)).toThrow(ValidationError);
      expect(() => validatePercentageForm(input)).toThrow('data_source must be 0');
    });
  });
});

describe('Percentage Calculation', () => {
  describe('Standard Calculations', () => {
    it('should calculate 8/10 = 80.00%', () => {
      expect(calculatePercentage(8, 10)).toBe(80.00);
    });

    it('should calculate 10/10 = 100.00%', () => {
      expect(calculatePercentage(10, 10)).toBe(100.00);
    });

    it('should calculate 0/10 = 0.00%', () => {
      expect(calculatePercentage(0, 10)).toBe(0.00);
    });

    it('should calculate 15/10 = 150.00% (overachievement)', () => {
      expect(calculatePercentage(15, 10)).toBe(150.00);
    });

    it('should calculate 5/5 = 100.00%', () => {
      expect(calculatePercentage(5, 5)).toBe(100.00);
    });
  });

  describe('Rounding Behavior', () => {
    it('should round 3/7 = 42.86% (standard rounding)', () => {
      expect(calculatePercentage(3, 7)).toBe(42.86);
    });

    it('should round 1/3 = 33.33%', () => {
      expect(calculatePercentage(1, 3)).toBe(33.33);
    });

    it('should round 2/3 = 66.67%', () => {
      expect(calculatePercentage(2, 3)).toBe(66.67);
    });

    it('should round 5/7 = 71.43%', () => {
      expect(calculatePercentage(5, 7)).toBe(71.43);
    });

    it('should round 1/6 = 16.67%', () => {
      expect(calculatePercentage(1, 6)).toBe(16.67);
    });

    it('should round 1/11 = 9.09%', () => {
      expect(calculatePercentage(1, 11)).toBe(9.09);
    });
  });

  describe('Edge Cases', () => {
    it('should handle very small denominators', () => {
      expect(calculatePercentage(1, 1000)).toBe(0.10);
    });

    it('should handle very large numerators', () => {
      expect(calculatePercentage(9999, 10)).toBe(99990.00);
    });

    it('should throw error for zero denominator', () => {
      expect(() => calculatePercentage(5, 0)).toThrow(ValidationError);
      expect(() => calculatePercentage(5, 0)).toThrow('denominator is zero');
    });

    it('should handle decimal inputs', () => {
      expect(calculatePercentage(8.5, 10.5)).toBe(80.95);
    });

    it('should return exactly 2 decimal places', () => {
      const result = calculatePercentage(1, 3);
      const decimals = result.toString().split('.')[1];
      expect(decimals?.length).toBeLessThanOrEqual(2);
    });
  });

  describe('Precision Tests', () => {
    it('should maintain precision for 0.1 / 0.3', () => {
      // Test floating point precision issues
      const result = calculatePercentage(0.1, 0.3);
      expect(result).toBe(33.33);
    });

    it('should handle multiple calculations consistently', () => {
      // Same calculation should always return same result
      const calc1 = calculatePercentage(1, 3);
      const calc2 = calculatePercentage(1, 3);
      expect(calc1).toBe(calc2);
    });
  });
});
