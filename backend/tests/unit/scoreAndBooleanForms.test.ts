/**
 * Score & Boolean Forms Unit Tests - Phase 4 Sprint 2
 */

import { describe, it, expect } from '@jest/globals';
import {
  validateScoreForm,
  validateBooleanForm
} from '../../src/services/kpiDataValidationService';
import { ScoreFormInput, BooleanFormInput } from '../../src/types/kpiData';

describe('Score Form Validation', () => {
  const validScore: ScoreFormInput = {
    kpi_component_id: '550e8400-e29b-41d4-a716-446655440000',
    score_value: 3.5,
    response_count: 15,
    evidence_link: 'https://jotform.com/report/abc123',
    data_source: 0
  };

  it('validates correct score', () => {
    expect(() => validateScoreForm(validScore)).not.toThrow();
  });

  it('accepts 0.0 and 5.0', () => {
    expect(() => validateScoreForm({ ...validScore, score_value: 0.0 })).not.toThrow();
    expect(() => validateScoreForm({ ...validScore, score_value: 5.0 })).not.toThrow();
  });

  it('rejects 2 decimals (3.55)', () => {
    expect(() => validateScoreForm({ ...validScore, score_value: 3.55 })).toThrow('exactly 1 decimal');
  });

  it('rejects out of range', () => {
    expect(() => validateScoreForm({ ...validScore, score_value: 5.5 })).toThrow('between 0.0 and 5.0');
    expect(() => validateScoreForm({ ...validScore, score_value: -0.5 })).toThrow('between 0.0 and 5.0');
  });

  it('rejects zero response_count', () => {
    expect(() => validateScoreForm({ ...validScore, response_count: 0 })).toThrow('must be greater than 0');
  });
});

describe('Boolean Form Validation', () => {
  const validBoolean: BooleanFormInput = {
    kpi_component_id: '550e8400-e29b-41d4-a716-446655440000',
    completed: 1,
    evidence_link: 'https://docs.google.com/doc/proof',
    data_source: 0
  };

  it('validates completed=1 and completed=0', () => {
    expect(() => validateBooleanForm(validBoolean)).not.toThrow();
    expect(() => validateBooleanForm({ ...validBoolean, completed: 0 })).not.toThrow();
  });

  it('rejects boolean true/false', () => {
    expect(() => validateBooleanForm({ ...validBoolean, completed: true as any })).toThrow('must be a number');
    expect(() => validateBooleanForm({ ...validBoolean, completed: false as any })).toThrow('must be a number');
  });

  it('rejects string coercion', () => {
    expect(() => validateBooleanForm({ ...validBoolean, completed: "1" as any })).toThrow('must be a number');
  });

  it('rejects invalid numbers', () => {
    expect(() => validateBooleanForm({ ...validBoolean, completed: 2 })).toThrow('exactly 0 or 1');
    expect(() => validateBooleanForm({ ...validBoolean, completed: -1 })).toThrow('exactly 0 or 1');
  });
});
