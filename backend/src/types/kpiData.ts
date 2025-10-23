/**
 * KPI Data Types - Phase 4: Data Submission & Versioning
 *
 * Type definitions for KPI data submissions with support for:
 * - Count forms (measurement_type = 0)
 * - Percentage forms (measurement_type = 1)
 * - Score forms (measurement_type = 2)
 * - Boolean forms (measurement_type = 3)
 */

/**
 * Complete KPI Data record from database
 * Matches User_KPI_Data table schema
 */
export interface KPIData {
  id: string;
  user_id: string;
  okr_id: string;
  kpi_component_id: string;
  value: number;
  numerator?: number | null;
  denominator?: number | null;
  version_number: number;
  data_source: number; // 0=manual, 1=jotform, 2=auto
  evidence_link: string | null;
  submitted_date: string;
  status: number; // 0=pending, 1=approved, 2=rejected
  notes?: string | null;
  response_count?: number | null;
  created_at: string;
  updated_at: string;
}

/**
 * Base input for KPI data submission
 * All form types extend this base interface
 */
export interface BaseKPIDataInput {
  kpi_component_id: string;
  evidence_link: string; // Required - URL to supporting documentation
  notes?: string; // Optional - max 500 characters
  data_source?: number; // Defaults to 0 (manual)
}

/**
 * Count Form Input (measurement_type = 0)
 * Used for counting discrete items (interviews, documents, etc.)
 *
 * Validation rules:
 * - value must be integer >= 0
 * - No decimals allowed for count
 * - evidence_link required (valid URL)
 * - notes optional, max 500 chars
 */
export interface CountFormInput extends BaseKPIDataInput {
  value: number; // Must be integer >= 0
}

/**
 * Percentage Form Input (measurement_type = 1)
 * Used for calculating percentages from numerator/denominator
 *
 * Validation rules:
 * - numerator must be >= 0
 * - denominator must be > 0 (no division by zero)
 * - percentage calculated as (numerator/denominator) * 100
 * - Stored as DECIMAL(5,2) with ROUND_HALF_UP
 * - Overachievement allowed (150%, 200%, etc.)
 */
export interface PercentageFormInput extends BaseKPIDataInput {
  numerator: number; // Must be >= 0
  denominator: number; // Must be > 0
}

/**
 * Score Form Input (measurement_type = 2)
 * Used for average scores from surveys/feedback
 *
 * Validation rules:
 * - score_value must be between 0.0 and 5.0
 * - Must have exactly 1 decimal place (3.5 valid, 3.55 invalid)
 * - response_count must be > 0
 * - evidence_link required (link to survey results)
 */
export interface ScoreFormInput extends BaseKPIDataInput {
  score_value: number; // 0.0 to 5.0, exactly 1 decimal
  response_count: number; // Must be > 0
}

/**
 * Boolean Form Input (measurement_type = 3)
 * Used for yes/no or complete/incomplete tracking
 *
 * Validation rules:
 * - completed must be exactly 0 or 1 (not boolean true/false)
 * - evidence_link required (proof of completion)
 */
export interface BooleanFormInput extends BaseKPIDataInput {
  completed: number; // Must be 0 or 1
}

/**
 * Union type for all form inputs
 * Used for generic handlers that accept any form type
 */
export type KPIDataInput = CountFormInput | PercentageFormInput | ScoreFormInput | BooleanFormInput;

/**
 * Enriched submission response with component and OKR details
 * Returned by API for better UX
 */
export interface KPIDataResponse {
  id: string;
  user_id: string;
  kpi_component: {
    id: string;
    name: string;
    target_value: number;
    unit: string;
    measurement_type: number;
  };
  okr: {
    id: string;
    title: string;
    year: number;
    quarter: number;
    deadline_at: string;
  };
  value: number;
  numerator?: number | null;
  denominator?: number | null;
  version_number: number;
  status: number;
  status_label: string; // 'Pending', 'Approved', 'Rejected'
  evidence_link: string | null;
  submitted_date: string;
  notes?: string | null;
  response_count?: number | null;
  data_source: number;
  data_source_label: string; // 'Manual', 'JotForm', 'Auto'
}

/**
 * Query filters for retrieving KPI data
 */
export interface KPIDataFilters {
  okr_id?: string;
  kpi_component_id?: string;
  status?: number; // 0=pending, 1=approved, 2=rejected
  include_history?: boolean; // Include all versions or just latest
  year?: number;
  quarter?: number;
}

/**
 * Submission history response
 * Groups all versions of a submission together
 */
export interface KPIDataHistory {
  kpi_component: {
    id: string;
    name: string;
    target_value: number;
    unit: string;
  };
  okr: {
    id: string;
    title: string;
    year: number;
    quarter: number;
  };
  latest_version: KPIDataResponse;
  versions: KPIDataResponse[];
  total_versions: number;
}

/**
 * Status enum for type safety
 */
export enum SubmissionStatus {
  PENDING = 0,
  APPROVED = 1,
  REJECTED = 2
}

/**
 * Data source enum for type safety
 */
export enum DataSource {
  MANUAL = 0,
  JOTFORM = 1,
  AUTO = 2
}

/**
 * Measurement type enum for type safety
 */
export enum MeasurementType {
  COUNT = 0,
  PERCENTAGE = 1,
  SCORE = 2,
  BOOLEAN = 3
}

/**
 * Helper function to get status label
 */
export function getStatusLabel(status: number): string {
  switch (status) {
    case SubmissionStatus.PENDING:
      return 'Pending';
    case SubmissionStatus.APPROVED:
      return 'Approved';
    case SubmissionStatus.REJECTED:
      return 'Rejected';
    default:
      return 'Unknown';
  }
}

/**
 * Helper function to get data source label
 */
export function getDataSourceLabel(source: number): string {
  switch (source) {
    case DataSource.MANUAL:
      return 'Manual';
    case DataSource.JOTFORM:
      return 'JotForm';
    case DataSource.AUTO:
      return 'Auto';
    default:
      return 'Unknown';
  }
}

/**
 * Helper function to get measurement type label
 */
export function getMeasurementTypeLabel(type: number): string {
  switch (type) {
    case MeasurementType.COUNT:
      return 'Count';
    case MeasurementType.PERCENTAGE:
      return 'Percentage';
    case MeasurementType.SCORE:
      return 'Score';
    case MeasurementType.BOOLEAN:
      return 'Boolean';
    default:
      return 'Unknown';
  }
}
