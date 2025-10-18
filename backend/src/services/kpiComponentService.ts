import { supabase } from '../db';
import { KPIComponent, CreateComponentInput, UpdateComponentInput } from '../types/okr';
import { 
  validateComponentWeights, 
  validateComponentInput
} from './validationService';
import { logAudit } from './auditService';
import { 
  NotFoundError, 
  ValidationError 
} from '../middleware/errorHandler';

/**
 * KPI Component Service - Core business logic for component management
 * 
 * This service handles all CRUD operations for KPI Components with:
 * - Weight validation (sum must equal 100% within parent OKR)
 * - Parent OKR validation
 * - Automatic sort order assignment
 * - Deadline inheritance from parent OKR
 * - Soft delete pattern (archive, never hard delete)
 * - Immutable audit trail
 * 
 * Known Limitations (acceptable for MVP):
 * - Weight validation has race condition with concurrent updates
 * - Audit logging happens after DB commit (not in same transaction)
 */

/**
 * Create a new KPI Component
 * 
 * Flow:
 * 1. Validate input data (required fields, constraints)
 * 2. Verify parent OKR exists and is active
 * 3. Calculate current weight sum for this OKR's components
 * 4. Validate weight sum wouldn't exceed 100%
 * 5. Auto-assign sort_order (max + 1)
 * 6. Inherit deadline_at from parent OKR
 * 7. Insert component with status=active
 * 8. Log audit trail
 * 
 * @param input - Component creation data
 * @param created_by - User ID creating the component
 * @returns Created component object
 * @throws ValidationError if data invalid or weight sum exceeds 100%
 * @throws NotFoundError if parent OKR doesn't exist
 */
export async function createComponent(
  input: CreateComponentInput,
  created_by: string
): Promise<KPIComponent> {
  // Step 1: Validate input data
  validateComponentInput(input);

  // Step 2: Verify parent OKR exists and is active
  const { data: parentOKR, error: okrError } = await supabase
    .from('OKRs')
    .select('id, okr_title, deadline_at, status')
    .eq('id', input.okr_id)
    .single();

  if (okrError || !parentOKR) {
    throw new NotFoundError(`Parent OKR not found with id: ${input.okr_id}`);
  }

  if (parentOKR.status === 3) {
    throw new ValidationError('Cannot add component to archived OKR');
  }

  // Step 3 & 4: Validate weight sum (will throw if invalid)
  await validateComponentWeights(
    input.okr_id,
    input.component_weight
  );

  // Step 5: Auto-assign sort_order
  const { data: maxSortData } = await supabase
    .from('kpi_components')
    .select('sort_order')
    .eq('okr_id', input.okr_id)
    .eq('status', 0) // Only count active components
    .order('sort_order', { ascending: false })
    .limit(1)
    .single();

  const sort_order = input.sort_order ?? (maxSortData ? maxSortData.sort_order + 1 : 1);

  // Step 6: Inherit deadline from parent OKR
  const deadline_at = parentOKR.deadline_at;

  // Step 7: Insert component
  const { data: component, error } = await supabase
    .from('kpi_components')
    .insert({
      okr_id: input.okr_id,
      component_name: input.component_name,
      component_weight: input.component_weight,
      measurement_type: input.measurement_type,
      target_value: input.target_value,
      unit: input.unit,
      description: input.description || null,
      sort_order: sort_order,
      deadline_at: deadline_at,
      deadline_missed: false,
      counting_method: input.counting_method ?? 0,
      status: 0 // active
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating component:', error);
    throw error;
  }

  // Step 8: Log audit trail
  await logAudit({
    entity_type: 'KPI_Component',
    entity_id: component.id,
    action: 'created',
    new_value: component,
    changed_by: created_by
  });

  return component as KPIComponent;
}

/**
 * Update an existing KPI Component
 * 
 * Flow:
 * 1. Get existing component (404 if not found)
 * 2. Verify component is active (cannot update archived)
 * 3. If weight changed, validate new sum
 * 4. Update only provided fields (partial update)
 * 5. Log audit trail with old/new values
 * 
 * @param component_id - Component ID to update
 * @param input - Fields to update
 * @param updated_by - User ID performing update
 * @returns Updated component object
 * @throws NotFoundError if component doesn't exist
 * @throws ValidationError if archived or weight sum invalid
 */
export async function updateComponent(
  component_id: string,
  input: UpdateComponentInput,
  updated_by: string
): Promise<KPIComponent> {
  // Step 1: Get existing component
  const { data: existing, error: fetchError } = await supabase
    .from('kpi_components')
    .select('*')
    .eq('id', component_id)
    .single();

  if (fetchError || !existing) {
    throw new NotFoundError(`Component not found with id: ${component_id}`);
  }

  // Step 2: Verify component is active
  if (existing.status === 1) {
    throw new ValidationError('Cannot update archived component. Restore it first.');
  }

  // Step 3: If weight changed, validate new sum
  if (input.component_weight !== undefined && input.component_weight !== existing.component_weight) {
    await validateComponentWeights(
      existing.okr_id,
      input.component_weight,
      component_id // Exclude current component from sum
    );
  }

  // Step 4: Update only provided fields
  const updateData: any = {};
  if (input.component_name !== undefined) updateData.component_name = input.component_name;
  if (input.component_weight !== undefined) updateData.component_weight = input.component_weight;
  if (input.measurement_type !== undefined) updateData.measurement_type = input.measurement_type;
  if (input.target_value !== undefined) updateData.target_value = input.target_value;
  if (input.unit !== undefined) updateData.unit = input.unit;
  if (input.description !== undefined) updateData.description = input.description;
  if (input.sort_order !== undefined) updateData.sort_order = input.sort_order;
  if (input.counting_method !== undefined) updateData.counting_method = input.counting_method;

  const { data: updated, error: updateError } = await supabase
    .from('kpi_components')
    .update(updateData)
    .eq('id', component_id)
    .select()
    .single();

  if (updateError) {
    console.error('Error updating component:', updateError);
    throw updateError;
  }

  // Step 5: Log audit trail
  await logAudit({
    entity_type: 'KPI_Component',
    entity_id: component_id,
    action: 'updated',
    old_value: existing,
    new_value: updated,
    changed_by: updated_by
  });

  return updated as KPIComponent;
}

/**
 * Archive a KPI Component (soft delete)
 * 
 * Flow:
 * 1. Get component (404 if not found)
 * 2. Check if already archived (idempotent)
 * 3. Set status=1 (archived)
 * 4. Log audit trail
 * 
 * Note: Unlike hard delete, we allow archiving even with User_KPI_Data.
 * Historical data remains visible, just excluded from active calculations.
 * 
 * @param component_id - Component ID to archive
 * @param deleted_by - User ID performing archive
 * @param reason - Optional reason for archiving
 * @returns Archived component object
 * @throws NotFoundError if component doesn't exist
 */
export async function deleteComponent(
  component_id: string,
  deleted_by: string,
  reason?: string
): Promise<KPIComponent> {
  // Step 1: Get component
  const { data: existing, error: fetchError } = await supabase
    .from('kpi_components')
    .select('*')
    .eq('id', component_id)
    .single();

  if (fetchError || !existing) {
    throw new NotFoundError(`Component not found with id: ${component_id}`);
  }

  // Step 2: Check if already archived (idempotent)
  if (existing.status === 1) {
    return existing as KPIComponent;
  }

  // Step 3: Set status=1 (archived)
  const { data: archived, error: archiveError } = await supabase
    .from('kpi_components')
    .update({ status: 1 })
    .eq('id', component_id)
    .select()
    .single();

  if (archiveError) {
    console.error('Error archiving component:', archiveError);
    throw archiveError;
  }

  // Step 4: Log audit trail
  await logAudit({
    entity_type: 'KPI_Component',
    entity_id: component_id,
    action: 'archived',
    old_value: existing,
    new_value: archived,
    changed_by: deleted_by,
    reason: reason
  });

  return archived as KPIComponent;
}

/**
 * List all active components for an OKR
 * 
 * @param okr_id - Parent OKR ID
 * @param include_archived - Include archived components (default: false)
 * @returns Array of components sorted by sort_order
 */
export async function listComponents(
  okr_id: string,
  include_archived: boolean = false
): Promise<KPIComponent[]> {
  let query = supabase
    .from('kpi_components')
    .select('*')
    .eq('okr_id', okr_id)
    .order('sort_order', { ascending: true });

  // Exclude archived by default
  if (!include_archived) {
    query = query.eq('status', 0);
  }

  const { data: components, error } = await query;

  if (error) {
    console.error('Error listing components:', error);
    throw error;
  }

  return components as KPIComponent[];
}

/**
 * Get a single component by ID
 * 
 * @param component_id - Component ID
 * @returns Component object
 * @throws NotFoundError if component doesn't exist
 */
export async function getComponent(component_id: string): Promise<KPIComponent> {
  const { data: component, error } = await supabase
    .from('kpi_components')
    .select('*')
    .eq('id', component_id)
    .single();

  if (error || !component) {
    throw new NotFoundError(`Component not found with id: ${component_id}`);
  }

  return component as KPIComponent;
}
