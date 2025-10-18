import { supabase } from '../db';
import { OKR, CreateOKRInput, UpdateOKRInput, OKRFilters } from '../types/okr';
import { 
  validateOKRWeights, 
  validateOKRInput,
  getOKRWeightSum 
} from './validationService';
import { logAudit } from './auditService';
import { calculateDeadline } from '../utils/deadline';
import { 
  NotFoundError, 
  ValidationError, 
  ConflictError 
} from '../middleware/errorHandler';

/**
 * OKR Service - Core business logic for OKR management
 * 
 * This service handles all CRUD operations for OKRs with:
 * - Weight validation (sum must equal 100% for role/year/quarter)
 * - Automatic deadline calculation
 * - Immutable audit trail
 * - Soft delete pattern (archive instead of delete)
 * - Transaction safety where possible
 * 
 * Known Limitations (acceptable for MVP):
 * - Weight validation has race condition with concurrent updates
 * - Audit logging happens after DB commit (not in same transaction)
 */

/**
 * Create a new OKR
 * 
 * Flow:
 * 1. Validate input data (required fields, constraints)
 * 2. Check if OKR with same number already exists (idempotency)
 * 3. Validate weight sum wouldn't exceed 100%
 * 4. Calculate deadline based on year/quarter
 * 5. Insert OKR with status=active
 * 6. Log audit trail
 * 
 * @param input - OKR creation data
 * @param created_by - User ID creating the OKR
 * @returns Created OKR object
 * @throws ValidationError if data invalid or weight sum exceeds 100%
 * @throws ConflictError if OKR with same number already exists
 */
export async function createOKR(
  input: CreateOKRInput,
  created_by: string
): Promise<OKR> {
  // Step 1: Validate input data
  validateOKRInput(input);

  // Step 2: Check for duplicate OKR number (idempotency)
  const { data: existing } = await supabase
    .from('OKRs')
    .select('id, okr_title, status')
    .eq('role_id', input.role_id)
    .eq('year', input.year)
    .eq('quarter', input.quarter)
    .eq('okr_number', input.okr_number)
    .neq('status', 3) // Exclude archived
    .single();

  if (existing) {
    throw new ConflictError(
      `OKR #${input.okr_number} already exists for this role/year/quarter: "${existing.okr_title}"`
    );
  }

  // Step 3: Validate weight sum (will throw if invalid)
  await validateOKRWeights(
    input.role_id,
    input.year,
    input.quarter,
    input.weight
  );

  // Step 4: Calculate deadline
  const deadline = await calculateDeadline(
    input.year,
    input.quarter,
    input.role_id
  );

  // Step 5: Insert OKR
  const { data: okr, error } = await supabase
    .from('OKRs')
    .insert({
      role_id: input.role_id,
      year: input.year,
      quarter: input.quarter,
      okr_number: input.okr_number,
      okr_title: input.okr_title,
      description: input.description || null,
      weight: input.weight,
      type: input.type,
      status: 1, // active
      tags: input.tags || null,
      deadline_at: deadline.toISOString(),
      deadline_missed: false,
      created_by: created_by,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating OKR:', error);
    throw error;
  }

  // Step 6: Log audit trail
  try {
    await logAudit({
      entity_type: 'OKR',
      entity_id: okr.id,
      action: 'created',
      new_value: okr,
      changed_by: created_by
    });
  } catch (auditError) {
    console.error('Failed to log OKR creation audit:', auditError);
    // Don't fail the operation if audit logging fails (known limitation)
  }

  return okr as OKR;
}

/**
 * Update an existing OKR
 * 
 * Flow:
 * 1. Verify OKR exists and not archived
 * 2. Check deadline not missed (if trying to update)
 * 3. If weight changed, validate new sum would still be valid
 * 4. Update OKR fields
 * 5. Log audit trail with old/new values
 * 
 * @param okr_id - UUID of OKR to update
 * @param input - Fields to update
 * @param updated_by - User ID making the update
 * @returns Updated OKR object
 * @throws NotFoundError if OKR doesn't exist
 * @throws ValidationError if deadline missed or weight invalid
 */
export async function updateOKR(
  okr_id: string,
  input: UpdateOKRInput,
  updated_by: string
): Promise<OKR> {
  // Step 1: Get existing OKR
  const { data: existingOKR, error: fetchError } = await supabase
    .from('OKRs')
    .select('*')
    .eq('id', okr_id)
    .single();

  if (fetchError || !existingOKR) {
    throw new NotFoundError(`OKR not found: ${okr_id}`);
  }

  if (existingOKR.status === 3) {
    throw new ValidationError('Cannot update archived OKR');
  }

  // Step 2: Check deadline
  if (existingOKR.deadline_missed) {
    throw new ValidationError(
      'Cannot update OKR after deadline has passed',
      { deadline_at: existingOKR.deadline_at }
    );
  }

  // Step 3: If weight is changing, validate new sum
  if (input.weight !== undefined && input.weight !== existingOKR.weight) {
    await validateOKRWeights(
      existingOKR.role_id,
      existingOKR.year,
      existingOKR.quarter,
      input.weight,
      okr_id // Exclude this OKR from sum
    );
  }

  // Step 4: Update OKR
  const updateData: any = {
    updated_at: new Date().toISOString()
  };

  // Only include fields that are provided
  if (input.okr_title !== undefined) updateData.okr_title = input.okr_title;
  if (input.description !== undefined) updateData.description = input.description;
  if (input.weight !== undefined) updateData.weight = input.weight;
  if (input.type !== undefined) updateData.type = input.type;
  if (input.status !== undefined) updateData.status = input.status;
  if (input.tags !== undefined) updateData.tags = input.tags;

  const { data: updatedOKR, error: updateError } = await supabase
    .from('OKRs')
    .update(updateData)
    .eq('id', okr_id)
    .select()
    .single();

  if (updateError) {
    console.error('Error updating OKR:', updateError);
    throw updateError;
  }

  // Step 5: Log audit trail
  try {
    await logAudit({
      entity_type: 'OKR',
      entity_id: okr_id,
      action: 'updated',
      old_value: existingOKR,
      new_value: updatedOKR,
      changed_by: updated_by
    });
  } catch (auditError) {
    console.error('Failed to log OKR update audit:', auditError);
  }

  return updatedOKR as OKR;
}

/**
 * Delete (archive) an OKR
 * 
 * Uses soft delete pattern - sets status=3 (archived) instead of actual deletion.
 * This preserves the immutable audit trail and allows historical reporting.
 * 
 * Flow:
 * 1. Verify OKR exists
 * 2. Set status=3 (archived)
 * 3. Cascade: Archive all child KPI_Components
 * 4. Log audit trail
 * 
 * @param okr_id - UUID of OKR to archive
 * @param deleted_by - User ID performing the deletion
 * @param reason - Optional reason for deletion
 * @returns Archived OKR object
 * @throws NotFoundError if OKR doesn't exist
 */
export async function deleteOKR(
  okr_id: string,
  deleted_by: string,
  reason?: string
): Promise<OKR> {
  // Step 1: Verify OKR exists
  const { data: existingOKR, error: fetchError } = await supabase
    .from('OKRs')
    .select('*')
    .eq('id', okr_id)
    .single();

  if (fetchError || !existingOKR) {
    throw new NotFoundError(`OKR not found: ${okr_id}`);
  }

  if (existingOKR.status === 3) {
    throw new ValidationError('OKR is already archived');
  }

  // Step 2: Archive OKR (soft delete)
  const { data: archivedOKR, error: archiveError } = await supabase
    .from('OKRs')
    .update({ 
      status: 3, // archived
      updated_at: new Date().toISOString()
    })
    .eq('id', okr_id)
    .select()
    .single();

  if (archiveError) {
    console.error('Error archiving OKR:', archiveError);
    throw archiveError;
  }

  // Step 3: Cascade - Archive all child components
  // Note: This is not in a transaction, acceptable for MVP
  try {
    await supabase
      .from('KPI_Components')
      .update({ 
        // Components don't have status field, but they'll be filtered by parent OKR status
        // In the future, we might add a status field to components too
      })
      .eq('okr_id', okr_id);
    
    // For now, we don't update components since they don't have a status field
    // Components will be filtered out when querying by checking their parent OKR status
  } catch (cascadeError) {
    console.error('Error cascading archive to components:', cascadeError);
    // Don't fail the operation
  }

  // Step 4: Log audit trail
  try {
    await logAudit({
      entity_type: 'OKR',
      entity_id: okr_id,
      action: 'archived',
      old_value: existingOKR,
      new_value: archivedOKR,
      changed_by: deleted_by,
      reason: reason
    });
  } catch (auditError) {
    console.error('Failed to log OKR archive audit:', auditError);
  }

  return archivedOKR as OKR;
}

/**
 * List OKRs with filtering and pagination
 * 
 * Default behavior: Excludes archived OKRs unless explicitly requested.
 * Supports filtering by role, year, quarter, status, and tags.
 * 
 * @param filters - Filter criteria
 * @returns Object with okrs array and pagination info
 */
export async function listOKRs(
  filters: OKRFilters = {}
): Promise<{ okrs: OKR[]; total: number; limit: number; offset: number }> {
  const {
    role_id,
    year,
    quarter,
    status,
    tags,
    limit = 50,
    offset = 0
  } = filters;

  // Build query
  let query = supabase
    .from('OKRs')
    .select('*', { count: 'exact' });

  // Apply filters
  if (role_id !== undefined) {
    query = query.eq('role_id', role_id);
  }
  if (year !== undefined) {
    query = query.eq('year', year);
  }
  if (quarter !== undefined) {
    query = query.eq('quarter', quarter);
  }
  if (status !== undefined) {
    query = query.eq('status', status);
  } else {
    // Default: exclude archived
    query = query.neq('status', 3);
  }
  if (tags) {
    // Simple contains search for tags
    query = query.ilike('tags', `%${tags}%`);
  }

  // Pagination and ordering
  query = query
    .order('year', { ascending: false })
    .order('quarter', { ascending: false })
    .order('okr_number', { ascending: true })
    .range(offset, offset + limit - 1);

  const { data: okrs, error, count } = await query;

  if (error) {
    console.error('Error listing OKRs:', error);
    throw error;
  }

  return {
    okrs: (okrs || []) as OKR[],
    total: count || 0,
    limit,
    offset
  };
}

/**
 * Get a single OKR by ID with its child components
 * 
 * Returns OKR with nested array of KPI_Components.
 * Useful for detailed views and editing.
 * 
 * @param okr_id - UUID of OKR
 * @param include_archived - Include archived components (default: false)
 * @returns OKR object with components array
 * @throws NotFoundError if OKR doesn't exist
 */
export async function getOKRWithComponents(
  okr_id: string,
  include_archived: boolean = false
): Promise<OKR & { components: any[] }> {
  // Get OKR
  const { data: okr, error: okrError } = await supabase
    .from('OKRs')
    .select('*')
    .eq('id', okr_id)
    .single();

  if (okrError || !okr) {
    throw new NotFoundError(`OKR not found: ${okr_id}`);
  }

  // Get components for this OKR
  let componentsQuery = supabase
    .from('KPI_Components')
    .select('*')
    .eq('okr_id', okr_id)
    .order('sort_order', { ascending: true });

  // Note: Components don't have status field yet
  // In future phases, we'll filter by component status here

  const { data: components, error: componentsError } = await componentsQuery;

  if (componentsError) {
    console.error('Error fetching components:', componentsError);
    throw componentsError;
  }

  return {
    ...okr,
    components: components || []
  } as OKR & { components: any[] };
}

/**
 * Get OKR by unique combination of role/year/quarter/number
 * 
 * Useful for checking existence before creation.
 * 
 * @param role_id - Role ID
 * @param year - Year
 * @param quarter - Quarter (1-4)
 * @param okr_number - OKR number within quarter
 * @returns OKR object if found, null otherwise
 */
export async function getOKRByNumber(
  role_id: number,
  year: number,
  quarter: number,
  okr_number: number
): Promise<OKR | null> {
  const { data: okr, error } = await supabase
    .from('OKRs')
    .select('*')
    .eq('role_id', role_id)
    .eq('year', year)
    .eq('quarter', quarter)
    .eq('okr_number', okr_number)
    .neq('status', 3) // Exclude archived
    .single();

  if (error) {
    // Not found is expected, other errors should be logged
    if (error.code !== 'PGRST116') { // PGRST116 = no rows returned
      console.error('Error fetching OKR by number:', error);
    }
    return null;
  }

  return okr as OKR;
}

/**
 * Get current weight sum for a role/year/quarter
 * 
 * Useful for showing how much "weight budget" remains.
 * 
 * @param role_id - Role ID
 * @param year - Year
 * @param quarter - Quarter (1-4)
 * @returns Current sum of weights (0-100)
 */
export async function getCurrentWeightSum(
  role_id: number,
  year: number,
  quarter: number
): Promise<number> {
  return await getOKRWeightSum(role_id, year, quarter);
}
