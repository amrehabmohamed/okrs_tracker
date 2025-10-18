import { supabase } from '../db';
import { ValidationError } from '../middleware/errorHandler';

/**
 * Validate that OKR weights sum to 100% for a given role/year/quarter
 * 
 * This function checks if adding a new OKR weight (or updating an existing one)
 * would result in a total weight sum of exactly 100% for all OKRs in the same
 * (role_id, year, quarter) group.
 * 
 * @param role_id - The role ID
 * @param year - The year
 * @param quarter - The quarter (1-4)
 * @param new_weight - The weight being added/updated
 * @param exclude_id - Optional: Exclude this OKR from sum (for updates)
 * @throws ValidationError if sum would not equal 100%
 */
export async function validateOKRWeights(
  role_id: number,
  year: number,
  quarter: number,
  new_weight: number,
  exclude_id?: string
): Promise<void> {
  // Build query to get all OKRs in this role/year/quarter
  let query = supabase
    .from('OKRs')
    .select('id, weight, okr_title')
    .eq('role_id', role_id)
    .eq('year', year)
    .eq('quarter', quarter)
    .neq('status', 3); // Exclude archived OKRs

  // If updating an existing OKR, exclude it from the sum
  if (exclude_id) {
    query = query.neq('id', exclude_id);
  }

  const { data: okrs, error } = await query;

  if (error) {
    console.error('Error fetching OKRs for validation:', error);
    throw error;
  }

  // Calculate current sum (excluding the one being updated)
  const currentSum = okrs.reduce((sum, okr) => sum + okr.weight, 0);
  const newSum = currentSum + new_weight;

  // Must equal exactly 100%
  if (newSum !== 100) {
    throw new ValidationError(
      `OKR weight validation failed: Total would be ${newSum}%, must equal 100%`,
      {
        role_id,
        year,
        quarter,
        current_sum: currentSum,
        new_weight: new_weight,
        total: newSum,
        required: 100,
        deficit: 100 - newSum,
        existing_okrs: okrs.map(okr => ({
          id: okr.id,
          title: okr.okr_title,
          weight: okr.weight
        }))
      }
    );
  }
}

/**
 * Validate that Component weights sum to 100% for an OKR
 * 
 * This function checks if adding a new component weight (or updating an existing one)
 * would result in a total weight sum of exactly 100% for all components within an OKR.
 * 
 * @param okr_id - The parent OKR ID
 * @param new_weight - The weight being added/updated
 * @param exclude_id - Optional: Exclude this component from sum (for updates)
 * @throws ValidationError if sum would not equal 100%
 */
export async function validateComponentWeights(
  okr_id: string,
  new_weight: number,
  exclude_id?: string
): Promise<void> {
  // Build query to get all components for this OKR
  let query = supabase
    .from('KPI_Components')
    .select('id, component_weight, component_name')
    .eq('okr_id', okr_id);

  // If updating an existing component, exclude it from the sum
  if (exclude_id) {
    query = query.neq('id', exclude_id);
  }

  const { data: components, error } = await query;

  if (error) {
    console.error('Error fetching components for validation:', error);
    throw error;
  }

  // Calculate current sum (excluding the one being updated)
  const currentSum = components.reduce((sum, c) => sum + c.component_weight, 0);
  const newSum = currentSum + new_weight;

  // Must equal exactly 100%
  if (newSum !== 100) {
    throw new ValidationError(
      `Component weight validation failed: Total would be ${newSum}%, must equal 100%`,
      {
        okr_id,
        current_sum: currentSum,
        new_weight: new_weight,
        total: newSum,
        required: 100,
        deficit: 100 - newSum,
        existing_components: components.map(c => ({
          id: c.id,
          name: c.component_name,
          weight: c.component_weight
        }))
      }
    );
  }
}

/**
 * Get the current weight sum for an OKR group
 * 
 * @param role_id - The role ID
 * @param year - The year
 * @param quarter - The quarter
 * @param exclude_id - Optional: Exclude this OKR from sum
 * @returns Current sum of weights
 */
export async function getOKRWeightSum(
  role_id: number,
  year: number,
  quarter: number,
  exclude_id?: string
): Promise<number> {
  let query = supabase
    .from('OKRs')
    .select('weight')
    .eq('role_id', role_id)
    .eq('year', year)
    .eq('quarter', quarter)
    .neq('status', 3);

  if (exclude_id) {
    query = query.neq('id', exclude_id);
  }

  const { data: okrs, error } = await query;

  if (error) {
    console.error('Error fetching OKRs for weight sum:', error);
    throw error;
  }

  return okrs.reduce((sum, okr) => sum + okr.weight, 0);
}

/**
 * Get the current weight sum for a component group
 * 
 * @param okr_id - The parent OKR ID
 * @param exclude_id - Optional: Exclude this component from sum
 * @returns Current sum of weights
 */
export async function getComponentWeightSum(
  okr_id: string,
  exclude_id?: string
): Promise<number> {
  let query = supabase
    .from('KPI_Components')
    .select('component_weight')
    .eq('okr_id', okr_id);

  if (exclude_id) {
    query = query.neq('id', exclude_id);
  }

  const { data: components, error } = await query;

  if (error) {
    console.error('Error fetching components for weight sum:', error);
    throw error;
  }

  return components.reduce((sum, c) => sum + c.component_weight, 0);
}

/**
 * Validate OKR input data
 * 
 * @param data - OKR data to validate
 * @throws ValidationError if data is invalid
 */
export function validateOKRInput(data: any): void {
  const errors: string[] = [];

  // Required fields
  if (!data.role_id) errors.push('role_id is required');
  if (!data.year) errors.push('year is required');
  if (!data.quarter) errors.push('quarter is required');
  if (!data.okr_number) errors.push('okr_number is required');
  if (!data.okr_title || data.okr_title.trim().length === 0) {
    errors.push('okr_title is required');
  }
  if (data.weight === undefined || data.weight === null) {
    errors.push('weight is required');
  }
  if (data.type === undefined || data.type === null) {
    errors.push('type is required');
  }

  // Value constraints
  if (data.quarter && (data.quarter < 1 || data.quarter > 4)) {
    errors.push('quarter must be between 1 and 4');
  }
  if (data.weight !== undefined && (data.weight < 0 || data.weight > 100)) {
    errors.push('weight must be between 0 and 100');
  }
  if (data.type !== undefined && ![0, 1].includes(data.type)) {
    errors.push('type must be 0 (Qualitative) or 1 (Quantitative)');
  }
  if (data.year && data.year < 2020) {
    errors.push('year must be 2020 or later');
  }

  if (errors.length > 0) {
    throw new ValidationError('Invalid OKR data', { errors });
  }
}

/**
 * Validate KPI Component input data
 * 
 * @param data - Component data to validate
 * @throws ValidationError if data is invalid
 */
export function validateComponentInput(data: any): void {
  const errors: string[] = [];

  // Required fields
  if (!data.okr_id) errors.push('okr_id is required');
  if (!data.component_name || data.component_name.trim().length === 0) {
    errors.push('component_name is required');
  }
  if (data.component_weight === undefined || data.component_weight === null) {
    errors.push('component_weight is required');
  }
  if (data.measurement_type === undefined || data.measurement_type === null) {
    errors.push('measurement_type is required');
  }
  if (data.target_value === undefined || data.target_value === null) {
    errors.push('target_value is required');
  }
  if (!data.unit || data.unit.trim().length === 0) {
    errors.push('unit is required');
  }
  if (data.sort_order === undefined || data.sort_order === null) {
    errors.push('sort_order is required');
  }

  // Value constraints
  if (data.component_weight !== undefined && (data.component_weight < 0 || data.component_weight > 100)) {
    errors.push('component_weight must be between 0 and 100');
  }
  if (data.measurement_type !== undefined && ![0, 1, 2, 3].includes(data.measurement_type)) {
    errors.push('measurement_type must be 0 (count), 1 (percentage), 2 (score), or 3 (boolean)');
  }
  if (data.target_value !== undefined && data.target_value < 0) {
    errors.push('target_value must be non-negative');
  }
  if (data.counting_method !== undefined && ![0, 1, 2].includes(data.counting_method)) {
    errors.push('counting_method must be 0 (cumulative), 1 (individual), or 2 (per_period)');
  }

  if (errors.length > 0) {
    throw new ValidationError('Invalid component data', { errors });
  }
}
