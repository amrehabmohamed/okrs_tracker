/**
 * Score & Boolean Forms Unit Tests - Phase 4 Sprint 2
 * Comprehensive validation testing for measurement types 2 & 3
 */

import { describe, it, expect } from '@jest/globals';
import {
  validateScoreForm,
  validateBooleanForm
} from '../services/kpiDataValidationService';
import { ScoreFormInput, BooleanFormInput } from '../types/kpiData';
import { ValidationError } from '../middleware/errorHandler';

describe('Score Form Validation', () => {
  const validScore: ScoreFormInput = {
    kpi_component_id: '550e8400-e29b-41d4-a716-446655440000',
    score_value: 3.5,
    response_count: 15,
    evidence_link: 'https://jotform.com/report/abc123',
    notes: 'Great feedback',
    data_source: 0
  };

  describe('Happy Path', () => {
    it('validates correct score input', () => {
      expect(() => validateScoreForm(validScore)).not.toThrow();
    });

    it('accepts minimum score 0.0', () => {
      expect(() => validateScoreForm({ ...validScore, score_value: 0.0 })).not.toThrow();
    });

    it('accepts maximum score 5.0', () => {
      expect(() => validateScoreForm({ ...validScore, score_value: 5.0 })).not.toThrow();
    });

    it('accepts all valid 1-decimal scores', () => {
      [0.0, 0.5, 1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0, 4.5, 5.0].forEach(score => {
        expect(() => validateScoreForm({ ...validScore, score_value: score })).not.toThrow();
      });
    });

    it('accepts data_source 0 (manual) and 1 (jotform)', () => {
      expect(() => validateScoreForm({ ...validScore, data_source: 0 })).not.toThrow();
      expect(() => validateScoreForm({ ...validScore, data_source: 1 })).not.toThrow();
    });
  });

  describe('Score Value Validation', () => {
    it('rejects missing score_value', () => {
      const input = { ...validScore, score_value: undefined as any };
      expect(() => validateScoreForm(input)).toThrow('score_value is required');
    });

    it('rejects null score_value', () => {
      const input = { ...validScore, score_value: null as any };
      expect(() => validateScoreForm(input)).toThrow('score_value is required');
    });

    it('rejects non-numeric score_value', () => {
      const input = { ...validScore, score_value: 'three point five' as any };
      expect(() => validateScoreForm(input)).toThrow('must be a valid number');
    });

    it('rejects NaN score_value', () => {
      const input = { ...validScore, score_value: NaN };
      expect(() => validateScoreForm(input)).toThrow('must be a valid number');
    });

    it('rejects score_value below 0', () => {
      const input = { ...validScore, score_value: -0.5 };
      expect(() => validateScoreForm(input)).toThrow('between 0.0 and 5.0');
    });

    it('rejects score_value above 5.0', () => {
      const input = { ...validScore, score_value: 5.5 };
      expect(() => validateScoreForm(input)).toThrow('between 0.0 and 5.0');
    });

    it('rejects 2 decimal places (3.55)', () => {
      const input = { ...validScore, score_value: 3.55 };
      expect(() => validateScoreForm(input)).toThrow('exactly 1 decimal place');
    });

    it('rejects 3 decimal places (3.555)', () => {
      const input = { ...validScore, score_value: 3.555 };
      expect(() => validateScoreForm(input)).toThrow('exactly 1 decimal place');
    });

    it('rejects integer without decimal (3)', () => {
      const input = { ...validScore, score_value: 3 };
      expect(() => validateScoreForm(input)).toThrow('exactly 1 decimal place');
    });
  });

  describe('Response Count Validation', () => {
    it('rejects missing response_count', () => {
      const input = { ...validScore, response_count: undefined as any };
      expect(() => validateScoreForm(input)).toThrow('response_count is required');
    });

    it('rejects zero response_count', () => {
      const input = { ...validScore, response_count: 0 };
      expect(() => validateScoreForm(input)).toThrow('must be greater than 0');
    });

    it('rejects negative response_count', () => {
      const input = { ...validScore, response_count: -5 };
      expect(() => validateScoreForm(input)).toThrow('must be greater than 0');
    });

    it('rejects decimal response_count', () => {
      const input = { ...validScore, response_count: 15.5 };
      expect(() => validateScoreForm(input)).toThrow('must be an integer');
    });

    it('rejects non-numeric response_count', () => {
      const input = { ...validScore, response_count: 'fifteen' as any };
      expect(() => validateScoreForm(input)).toThrow('must be a valid number');
    });
  });

  describe('Data Source Validation', () => {
    it('rejects data_source 2 (auto not allowed for scores)', () => {
      const input = { ...validScore, data_source: 2 };
      expect(() => validateScoreForm(input)).toThrow('must be 0 (manual) or 1 (jotform)');
    });

    it('rejects invalid data_source', () => {
      const input = { ...validScore, data_source: 99 };
      expect(() => validateScoreForm(input)).toThrow('must be 0 (manual) or 1 (jotform)');
    });
  });

  describe('Common Validations', () => {
    it('rejects missing evidence_link', () => {
      const input = { ...validScore, evidence_link: '' };
      expect(() => validateScoreForm(input)).toThrow('evidence_link is required');
    });

    it('rejects invalid URL', () => {
      const input = { ...validScore, evidence_link: 'not-a-url' };
      expect(() => validateScoreForm(input)).toThrow('must be a valid URL');
    });

    it('rejects notes exceeding 500 chars', () => {
      const input = { ...validScore, notes: 'a'.repeat(501) };
      expect(() => validateScoreForm(input)).toThrow('must not exceed 500 characters');
    });

    it('sanitizes HTML in notes', () => {
      const input = { ...validScore, notes: '<script>alert("xss")</script>Clean' };
      validateScoreForm(input);
      expect(input.notes).not.toContain('<script>');
    });
  });
});

describe('Boolean Form Validation', () => {
  const validBoolean: BooleanFormInput = {
    kpi_component_id: '550e8400-e29b-41d4-a716-446655440000',
    completed: 1,
    evidence_link: 'https://docs.google.com/document/d/proof123',
    notes: 'Task completed successfully',
    data_source: 0
  };

  describe('Happy Path', () => {
    it('validates correct boolean input with completed=1', () => {
      expect(() => validateBooleanForm(validBoolean)).not.toThrow();
    });

    it('validates correct boolean input with completed=0', () => {
      expect(() => validateBooleanForm({ ...validBoolean, completed: 0 })).not.toThrow();
    });

    it('accepts input without notes', () => {
      const input = { ...validBoolean, notes: undefined };
      expect(() => validateBooleanForm(input)).not.toThrow();
    });
  });

  describe('Completed Field Validation', () => {
    it('rejects missing completed', () => {
      const input = { ...validBoolean, completed: undefined as any };
      expect(() => validateBooleanForm(input)).toThrow('completed is required');
    });

    it('rejects null completed', () => {
      const input = { ...validBoolean, completed: null as any };
      expect(() => validateBooleanForm(input)).toThrow('completed is required');
    });

    it('rejects boolean true', () => {
      const input = { ...validBoolean, completed: true as any };
      expect(() => validateBooleanForm(input)).toThrow('must be a number (0 or 1), not a boolean');
    });

    it('rejects boolean false', () => {
      const input = { ...validBoolean, completed: false as any };
      expect(() => validateBooleanForm(input)).toThrow('must be a number (0 or 1), not a boolean');
    });

    it('rejects string "true"', () => {
      const input = { ...validBoolean, completed: 'true' as any };
      expect(() => validateBooleanForm(input)).toThrow('must be a number (0 or 1), not a string');
    });

    it('rejects string "false"', () => {
      const input = { ...validBoolean, completed: 'false' as any };
      expect(() => validateBooleanForm(input)).toThrow('must be a number (0 or 1), not a string');
    });

    it('rejects string "1"', () => {
      const input = { ...validBoolean, completed: '1' as any };
      expect(() => validateBooleanForm(input)).toThrow('must be a number (0 or 1), not a string');
    });

    it('rejects number 2', () => {
      const input = { ...validBoolean, completed: 2 };
      expect(() => validateBooleanForm(input)).toThrow('must be exactly 0 or 1');
    });

    it('rejects negative number', () => {
      const input = { ...validBoolean, completed: -1 };
      expect(() => validateBooleanForm(input)).toThrow('must be exactly 0 or 1');
    });

    it('rejects decimal number', () => {
      const input = { ...validBoolean, completed: 0.5 };
      expect(() => validateBooleanForm(input)).toThrow('must be exactly 0 or 1');
    });
  });

  describe('Evidence Link Validation', () => {
    it('rejects missing evidence_link', () => {
      const input = { ...validBoolean, evidence_link: '' };
      expect(() => validateBooleanForm(input)).toThrow('evidence_link is required');
    });

    it('rejects invalid URL format', () => {
      const input = { ...validBoolean, evidence_link: 'invalid-url' };
      expect(() => validateBooleanForm(input)).toThrow('must be a valid URL');
    });

    it('accepts HTTP and HTTPS', () => {
      expect(() => validateBooleanForm({ 
        ...validBoolean, 
        evidence_link: 'http://example.com' 
      })).not.toThrow();
      
      expect(() => validateBooleanForm({ 
        ...validBoolean, 
        evidence_link: 'https://example.com' 
      })).not.toThrow();
    });
  });

  describe('Notes Validation', () => {
    it('rejects notes exceeding 500 characters', () => {
      const input = { ...validBoolean, notes: 'x'.repeat(501) };
      expect(() => validateBooleanForm(input)).toThrow('must not exceed 500 characters');
    });

    it('accepts exactly 500 characters', () => {
      const input = { ...validBoolean, notes: 'x'.repeat(500) };
      expect(() => validateBooleanForm(input)).not.toThrow();
    });

    it('rejects non-string notes', () => {
      const input = { ...validBoolean, notes: 123 as any };
      expect(() => validateBooleanForm(input)).toThrow('notes must be a string');
    });

    it('sanitizes HTML in notes', () => {
      const input = { ...validBoolean, notes: '<b>Bold</b> text' };
      validateBooleanForm(input);
      expect(input.notes).not.toContain('<b>');
      expect(input.notes).toContain('text');
    });
  });

  describe('Data Source Validation', () => {
    it('accepts all valid data sources (0, 1, 2)', () => {
      expect(() => validateBooleanForm({ ...validBoolean, data_source: 0 })).not.toThrow();
      expect(() => validateBooleanForm({ ...validBoolean, data_source: 1 })).not.toThrow();
      expect(() => validateBooleanForm({ ...validBoolean, data_source: 2 })).not.toThrow();
    });

    it('rejects invalid data_source', () => {
      const input = { ...validBoolean, data_source: 99 };
      expect(() => validateBooleanForm(input)).toThrow('data_source must be 0');
    });
  });
});
