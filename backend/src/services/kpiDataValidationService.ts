/**
 * KPI Data Validation Service - Phase 4 Sprint 1
 *
 * Provides comprehensive validation for KPI data submissions with:
 * - Field-level validation with specific error messages
 * - Security checks (SQL injection, XSS prevention)
 * - Component ownership verification
 * - Deadline enforcement
 * - Data type and range validation
 *
 * Design principles:
 * - Fail fast with clear, actionable error messages
 * - No silent failures
 * - Security-first approach
 * - Performance-optimized queries
 */

import { supabase } from '../db';
import {
  CountFormInput,
  PercentageFormInput,
  ScoreFormInput,
  BooleanFormInput,
  MeasurementType
} from '../types/kpiData';
import { ValidationError, AuthorizationError, NotFoundError } from '../middleware/errorHandler';

/**
 * Sanitizes user input to prevent XSS and SQL injection
 * Strips HTML tags and escapes special characters
 *
 * @param input - Raw user input string
 * @returns Sanitized string safe for storage
 */
export function sanitizeInput(input: string): string {
  if (!input) return input;

  // Remove HTML tags
  let sanitized = input.replace(/<[^>]*>/g, '');

  // Escape special characters that could be used in SQL injection
  sanitized = sanitized.replace(/['"\\]/g, (char) => '\\' + char);

  // Trim whitespace
  sanitized = sanitized.trim();

  return sanitized;
}

/**
 * Validates URL format
 * Accepts http:// and https:// protocols
 * Does NOT check if URL is accessible (by design)
 *
 * @param url - URL string to validate
 * @returns True if valid URL format
 */
export function isValidURL(url: string): boolean {
  if (!url || typeof url !== 'string') {
    return false;
  }

  // Basic URL pattern: protocol + domain + optional path
  const urlPattern = /^https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)$/;

  return urlPattern.test(url.trim());
}

/**
 * Validates count form input (measurement_type = 0)
 *
 * Rules:
 * - value must be a number >= 0
 * - value must be an integer (no decimals)
 * - evidence_link must be valid URL
 * - evidence_link is required
 * - notes optional, max 500 characters
 * - notes sanitized for security
 *
 * @param input - Count form data
 * @throws ValidationError if validation fails
 */
export function validateCountForm(input: CountFormInput): void {
  // Validate value exists
  if (input.value === undefined || input.value === null) {
    throw new ValidationError('count_value is required');
  }

  // Validate value is a number
  if (typeof input.value !== 'number' || isNaN(input.value)) {
    throw new ValidationError('count_value must be a valid number');
  }

  // Validate value is non-negative
  if (input.value < 0) {
    throw new ValidationError('count_value must be greater than or equal to 0');
  }

  // Validate value is an integer (no decimals for count)
  if (!Number.isInteger(input.value)) {
    throw new ValidationError('count_value must be an integer (no decimal places)');
  }

  // Validate evidence_link exists
  if (!input.evidence_link) {
    throw new ValidationError('evidence_link is required');
  }

  // Validate evidence_link format
  if (!isValidURL(input.evidence_link)) {
    throw new ValidationError('evidence_link must be a valid URL (http:// or https://)');
  }

  // Validate notes if provided
  if (input.notes !== undefined && input.notes !== null) {
    if (typeof input.notes !== 'string') {
      throw new ValidationError('notes must be a string');
    }

    if (input.notes.length > 500) {
      throw new ValidationError('notes must not exceed 500 characters');
    }

    // Sanitize notes (mutates input object intentionally)
    input.notes = sanitizeInput(input.notes);
  }

  // Validate data_source if provided
  if (input.data_source !== undefined && input.data_source !== null) {
    if (![0, 1, 2].includes(input.data_source)) {
      throw new ValidationError('data_source must be 0 (manual), 1 (jotform), or 2 (auto)');
    }
  }
}

/**
 * Get next version number for a user's submission to a component
 * 
 * Queries the database for MAX(version_number) and increments by 1
 * Handles first submission (returns 1) and resubmissions (returns 2, 3, etc)
 * 
 * Race conditions handled by unique constraint at database level
 * 
 * @param user_id - User's UUID
 * @param component_id - Component's UUID
 * @returns Next version number (1 for first submission, 2+ for resubmissions)
 * @throws AppError if database query fails
 */
export async function getNextVersionNumber(
  user_id: string,
  component_id: string
): Promise<number> {
  const { data, error } = await supabase
    .from('user_kpi_data')
    .select('version_number')
    .eq('user_id', user_id)
    .eq('kpi_component_id', component_id)
    .order('version_number', { ascending: false })
    .limit(1)
    .single();

  // If no previous submissions exist, error will be PGRST116 (no rows)
  if (error && error.code === 'PGRST116') {
    return 1; // First submission
  }

  if (error) {
    console.error('Error fetching max version:', error);
    throw new Error('Failed to determine version number');
  }

  // Increment max version
  return (data?.version_number || 0) + 1;
}

/**
 * Component details with OKR information
 * Used for ownership and deadline validation
 */
interface ComponentDetails {
  id: string;
  component_name: string;
  okr_id: string;
  measurement_type: number;
  target_value: number;
  okr: {
    id: string;
    okr_title: string;
    role_id: number;
    year: number;
    quarter: number;
    deadline_at: string;
    deadline_missed: boolean;
    status: number;
  };
}

/**
 * Fetches component details with OKR information in a single query
 * Optimized to avoid N+1 queries
 *
 * @param component_id - KPI Component UUID
 * @returns Component with nested OKR details
 * @throws NotFoundError if component doesn't exist
 */
export async function getComponentWithOKR(component_id: string): Promise<ComponentDetails> {
  const { data, error } = await supabase
    .from('kpi_components')
    .select(`
      id,
      component_name,
      okr_id,
      measurement_type,
      target_value,
      okr:okr_id (
        id,
        okr_title,
        role_id,
        year,
        quarter,
        deadline_at,
        deadline_missed,
        status
      )
    `)
    .eq('id', component_id)
    .single();

  if (error || !data) {
    throw new NotFoundError(`KPI Component with ID ${component_id} not found`);
  }

  // Supabase returns nested okr as array or object, normalize it
  const okr = Array.isArray(data.okr) ? data.okr[0] : data.okr;

  if (!okr) {
    throw new NotFoundError(`OKR for component ${component_id} not found`);
  }

  return {
    ...data,
    okr: okr as ComponentDetails['okr']
  };
}

/**
 * Validates that the user has permission to submit data for a component
 *
 * Rules:
 * - Component must exist
 * - Component's OKR role must match user's role
 * - OKR must not be archived (status = 3)
 *
 * @param user_id - User UUID from auth
 * @param user_role - User's role name
 * @param component_id - KPI Component UUID
 * @returns Component details if authorized
 * @throws AuthorizationError if user doesn't have access
 * @throws NotFoundError if component doesn't exist
 */
export async function validateComponentOwnership(
  user_id: string,
  user_role: string,
  component_id: string
): Promise<ComponentDetails> {
  // Fetch component with OKR details
  const component = await getComponentWithOKR(component_id);

  // Check if OKR is archived
  if (component.okr.status === 3) {
    throw new AuthorizationError('Cannot submit data for archived OKR');
  }

  // Get user's role_id from roles table
  const { data: roleData, error: roleError } = await supabase
    .from('roles')
    .select('id')
    .eq('role_name', user_role)
    .single();

  if (roleError || !roleData) {
    throw new AuthorizationError('User role not found');
  }

  // Check if component's OKR role matches user's role
  if (component.okr.role_id !== roleData.id) {
    throw new AuthorizationError(
      `This KPI component belongs to a different role. Your role: ${user_role}, Required role ID: ${component.okr.role_id}`
    );
  }

  return component;
}

/**
 * Validates that the submission deadline has not passed
 *
 * Rules:
 * - If deadline_missed flag is true → reject
 * - If current time > deadline_at → reject
 * - Provides clear error message with OKR name and deadline
 *
 * @param component - Component with OKR details
 * @throws AuthorizationError if deadline has passed
 */
export function checkDeadline(component: ComponentDetails): void {
  const now = new Date();
  const deadline = new Date(component.okr.deadline_at);

  if (component.okr.deadline_missed || now > deadline) {
    const deadlineStr = deadline.toISOString().split('T')[0]; // Format: YYYY-MM-DD
    throw new AuthorizationError(
      `Submission deadline has passed for OKR "${component.okr.okr_title}". Deadline was ${deadlineStr}. ` +
      `Contact your manager if you need to submit late.`
    );
  }
}

/**
 * Validates that the measurement type matches the form type
 *
 * @param component - Component details
 * @param expectedType - Expected measurement type
 * @throws ValidationError if types don't match
 */
export function validateMeasurementType(
  component: ComponentDetails,
  expectedType: MeasurementType
): void {
  if (component.measurement_type !== expectedType) {
    throw new ValidationError(
      `This component expects measurement type ${component.measurement_type}, ` +
      `but received type ${expectedType}. Component "${component.component_name}" ` +
      `requires ${getMeasurementTypeDescription(component.measurement_type)} submissions.`
    );
  }
}

/**
 * Helper to get human-readable measurement type description
 */
function getMeasurementTypeDescription(type: number): string {
  switch (type) {
    case MeasurementType.COUNT:
      return 'count';
    case MeasurementType.PERCENTAGE:
      return 'percentage';
    case MeasurementType.SCORE:
      return 'score';
    case MeasurementType.BOOLEAN:
      return 'boolean';
    default:
      return 'unknown';
  }
}

/**
 * Checks if user already has a pending submission for this component
 * Business rule: Cannot have multiple pending submissions for same component
 *
 * @param user_id - User UUID
 * @param component_id - KPI Component UUID
 * @returns True if pending submission exists
 */
export async function hasPendingSubmission(
  user_id: string,
  component_id: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from('user_kpi_data')
    .select('id')
    .eq('user_id', user_id)
    .eq('kpi_component_id', component_id)
    .eq('status', 0) // 0 = pending
    .limit(1);

  if (error) {
    console.error('Error checking pending submission:', error);
    return false;
  }

  return data && data.length > 0;
}

/**
 * Gets the latest version number for a user's component submissions
 * Used for Sprint 4.4 versioning, but prepared here
 *
 * @param user_id - User UUID
 * @param component_id - KPI Component UUID
 * @returns Latest version number (0 if no submissions exist)
 */
export async function getLatestVersionNumber(
  user_id: string,
  component_id: string
): Promise<number> {
  const { data, error } = await supabase
    .from('user_kpi_data')
    .select('version_number')
    .eq('user_id', user_id)
    .eq('kpi_component_id', component_id)
    .order('version_number', { ascending: false })
    .limit(1);

  if (error) {
    console.error('Error fetching latest version:', error);
    return 0;
  }

  return data && data.length > 0 ? data[0].version_number : 0;
}

/**
 * Validates percentage form input (measurement_type = 1)
 *
 * Rules:
 * - numerator must be a number >= 0
 * - denominator must be a number > 0 (no division by zero)
 * - numerator should not be unreasonably high (sanity check)
 * - evidence_link must be valid URL
 * - evidence_link is required
 * - notes optional, max 500 characters
 * - notes sanitized for security
 * - Percentage calculated as (numerator/denominator) * 100
 * - Stored as DECIMAL(5,2) with standard rounding
 *
 * @param input - Percentage form data
 * @throws ValidationError if validation fails
 */
export function validatePercentageForm(input: PercentageFormInput): void {
  // Validate numerator exists
  if (input.numerator === undefined || input.numerator === null) {
    throw new ValidationError('numerator is required');
  }

  // Validate numerator is a number
  if (typeof input.numerator !== 'number' || isNaN(input.numerator)) {
    throw new ValidationError('numerator must be a valid number');
  }

  // Validate numerator is non-negative
  if (input.numerator < 0) {
    throw new ValidationError(`numerator must be greater than or equal to 0, received: ${input.numerator}`);
  }

  // Validate denominator exists
  if (input.denominator === undefined || input.denominator === null) {
    throw new ValidationError('denominator is required');
  }

  // Validate denominator is a number
  if (typeof input.denominator !== 'number' || isNaN(input.denominator)) {
    throw new ValidationError('denominator must be a valid number');
  }

  // Validate denominator is positive (no division by zero)
  if (input.denominator <= 0) {
    throw new ValidationError(
      `denominator must be greater than 0 (division by zero not allowed), received: ${input.denominator}`
    );
  }

  // Sanity check: numerator should not be unreasonably higher than denominator
  // Allow up to 10x for legitimate overachievement, but flag suspicious data
  if (input.numerator > input.denominator * 10) {
    throw new ValidationError(
      `numerator (${input.numerator}) is unreasonably high compared to denominator (${input.denominator}). ` +
      `If this is correct, please verify your data. Maximum ratio allowed: 10:1.`
    );
  }

  // Validate evidence_link exists
  if (!input.evidence_link) {
    throw new ValidationError('evidence_link is required');
  }

  // Validate evidence_link format
  if (!isValidURL(input.evidence_link)) {
    throw new ValidationError('evidence_link must be a valid URL (http:// or https://)');  
  }

  // Validate notes if provided
  if (input.notes !== undefined && input.notes !== null) {
    if (typeof input.notes !== 'string') {
      throw new ValidationError('notes must be a string');
    }

    if (input.notes.length > 500) {
      throw new ValidationError(`notes must not exceed 500 characters, received: ${input.notes.length} characters`);
    }

    // Sanitize notes (mutates input object intentionally)
    input.notes = sanitizeInput(input.notes);
  }

  // Validate data_source if provided
  if (input.data_source !== undefined && input.data_source !== null) {
    if (![0, 1, 2].includes(input.data_source)) {
      throw new ValidationError('data_source must be 0 (manual), 1 (jotform), or 2 (auto)');
    }
  }
}

/**
 * Calculates percentage from numerator and denominator
 * Rounds to 2 decimal places using standard rounding (ROUND_HALF_UP)
 * 
 * Examples:
 * - calculatePercentage(8, 10) = 80.00
 * - calculatePercentage(3, 7) = 42.86
 * - calculatePercentage(15, 10) = 150.00 (overachievement allowed)
 * - calculatePercentage(1, 3) = 33.33
 *
 * @param numerator - Completed items count
 * @param denominator - Total items count
 * @returns Percentage rounded to 2 decimal places
 */
export function calculatePercentage(numerator: number, denominator: number): number {
  if (denominator === 0) {
    throw new ValidationError('Cannot calculate percentage: denominator is zero');
  }

  const percentage = (numerator / denominator) * 100;
  
  // Round to 2 decimal places using standard rounding
  // Math.round() implements ROUND_HALF_UP behavior
  return Math.round(percentage * 100) / 100;
}

/**
 * Validates score form input (measurement_type = 2)
 *
 * Rules:
 * - score_value must be between 0.0 and 5.0 (inclusive)
 * - score_value must have exactly 1 decimal place (3.5 valid, 3.55 invalid)
 * - response_count must be integer > 0
 * - evidence_link must be valid URL
 * - evidence_link is required
 * - notes optional, max 500 characters
 * - data_source can be 0 (manual) or 1 (jotform)
 *
 * @param input - Score form data
 * @throws ValidationError if validation fails
 */
export function validateScoreForm(input: ScoreFormInput): void {
  // Validate score_value exists
  if (input.score_value === undefined || input.score_value === null) {
    throw new ValidationError('score_value is required');
  }

  // Validate score_value is a number
  if (typeof input.score_value !== 'number' || isNaN(input.score_value)) {
    throw new ValidationError('score_value must be a valid number');
  }

  // Validate score_value range (0.0 to 5.0)
  if (input.score_value < 0 || input.score_value > 5) {
    throw new ValidationError(
      `score_value must be between 0.0 and 5.0, received: ${input.score_value}`
    );
  }

  // Validate exactly 1 decimal place
  // Multiply by 10 and check if result is integer
  const multiplied = input.score_value * 10;
  if (!Number.isInteger(multiplied)) {
    throw new ValidationError(
      `score_value must have exactly 1 decimal place (e.g., 3.5, not 3.55), received: ${input.score_value}`
    );
  }

  // Validate response_count exists
  if (input.response_count === undefined || input.response_count === null) {
    throw new ValidationError('response_count is required');
  }

  // Validate response_count is a number
  if (typeof input.response_count !== 'number' || isNaN(input.response_count)) {
    throw new ValidationError('response_count must be a valid number');
  }

  // Validate response_count is positive integer
  if (input.response_count <= 0) {
    throw new ValidationError(
      `response_count must be greater than 0, received: ${input.response_count}`
    );
  }

  if (!Number.isInteger(input.response_count)) {
    throw new ValidationError(
      `response_count must be an integer, received: ${input.response_count}`
    );
  }

  // Validate evidence_link exists
  if (!input.evidence_link) {
    throw new ValidationError('evidence_link is required');
  }

  // Validate evidence_link format
  if (!isValidURL(input.evidence_link)) {
    throw new ValidationError('evidence_link must be a valid URL (http:// or https://)');  
  }

  // Validate notes if provided
  if (input.notes !== undefined && input.notes !== null) {
    if (typeof input.notes !== 'string') {
      throw new ValidationError('notes must be a string');
    }

    if (input.notes.length > 500) {
      throw new ValidationError(
        `notes must not exceed 500 characters, received: ${input.notes.length} characters`
      );
    }

    // Sanitize notes
    input.notes = sanitizeInput(input.notes);
  }

  // Validate data_source (score can be manual or jotform)
  if (input.data_source !== undefined && input.data_source !== null) {
    if (![0, 1].includes(input.data_source)) {
      throw new ValidationError('data_source must be 0 (manual) or 1 (jotform) for score submissions');
    }
  }
}

/**
 * Validates boolean form input (measurement_type = 3)
 *
 * Rules:
 * - completed must be exactly 0 or 1 (integer, not boolean)
 * - Rejects string "true"/"false" or boolean true/false
 * - evidence_link must be valid URL
 * - evidence_link is required
 * - notes optional, max 500 characters
 *
 * @param input - Boolean form data
 * @throws ValidationError if validation fails
 */
export function validateBooleanForm(input: BooleanFormInput): void {
  // Validate completed exists
  if (input.completed === undefined || input.completed === null) {
    throw new ValidationError('completed is required');
  }

  // Validate completed is a number (not boolean)
  if (typeof input.completed !== 'number') {
    throw new ValidationError(
      `completed must be a number (0 or 1), not a ${typeof input.completed}. ` +
      `Received: ${input.completed}`
    );
  }

  // Validate completed is exactly 0 or 1
  if (input.completed !== 0 && input.completed !== 1) {
    throw new ValidationError(
      `completed must be exactly 0 or 1, received: ${input.completed}`
    );
  }

  // Validate evidence_link exists
  if (!input.evidence_link) {
    throw new ValidationError('evidence_link is required');
  }

  // Validate evidence_link format
  if (!isValidURL(input.evidence_link)) {
    throw new ValidationError('evidence_link must be a valid URL (http:// or https://)');  
  }

  // Validate notes if provided
  if (input.notes !== undefined && input.notes !== null) {
    if (typeof input.notes !== 'string') {
      throw new ValidationError('notes must be a string');
    }

    if (input.notes.length > 500) {
      throw new ValidationError(
        `notes must not exceed 500 characters, received: ${input.notes.length} characters`
      );
    }

    // Sanitize notes
    input.notes = sanitizeInput(input.notes);
  }

  // Validate data_source if provided
  if (input.data_source !== undefined && input.data_source !== null) {
    if (![0, 1, 2].includes(input.data_source)) {
      throw new ValidationError('data_source must be 0 (manual), 1 (jotform), or 2 (auto)');
    }
  }
}
