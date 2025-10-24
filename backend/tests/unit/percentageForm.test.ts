/**
 * Percentage Form Unit Tests - Phase 4 Sprint 2
 */

import { describe, it, expect } from '@jest/globals';
import {
  validatePercentageForm,
  calculatePercentage
} from '../../src/services/kpiDataValidationService';
import { PercentageFormInput } from '../../src/types/kpiData';
import { ValidationError } from '../../src/middleware/errorHandler';

describe('Percentage Form Validation', () => {
  const validInput: PercentageFormInput = {
    kpi_component_id: '550e8400-e29b-41d4-a716-446655440000',
    numerator: 8,
    denominator: 10,
    evidence_link: 'https://docs.google.com/spreadsheets/d/abc123',
    notes: 'Test submission',
    data_source: 0
  };

  describe('Happy Path', () => {
    it('validates correct percentage input', () => {
      expect(() => validatePercentageForm(validInput)).not.toThrow();
    });

    it('accepts zero numerator', () => {
      expect(() => validatePercentageForm({ ...validInput, numerator: 0 })).not.toThrow();
    });

    it('accepts overachievement', () => {
      expect(() => validatePercentageForm({ ...validInput, numerator: 15, denominator: 10 })).not.toThrow();
    });
  });

  describe('Numerator Validation', () => {
    it('rejects missing numerator', () => {
      const input = { ...validInput, numerator: undefined as any };
      expect(() => validatePercentageForm(input)).toThrow('numerator is required');
    });

    it('rejects negative numerator', () => {
      expect(() => validatePercentageForm({ ...validInput, numerator: -5 })).toThrow('greater than or equal to 0');
    });
  });

  describe('Denominator Validation', () => {
    it('rejects zero denominator', () => {
      expect(() => validatePercentageForm({ ...validInput, denominator: 0 })).toThrow('division by zero');
    });
  });
});

describe('Percentage Calculation', () => {
  it('calculates 8/10 = 80.00%', () => {
    expect(calculatePercentage(8, 10)).toBe(80.00);
  });

  it('calculates 3/7 = 42.86%', () => {
    expect(calculatePercentage(3, 7)).toBe(42.86);
  });

  it('handles overachievement 150%', () => {
    expect(calculatePercentage(15, 10)).toBe(150.00);
  });

  it('throws on division by zero', () => {
    expect(() => calculatePercentage(5, 0)).toThrow('denominator is zero');
  });
});
