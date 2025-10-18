import { supabase } from '../db';

/**
 * Parameters for logging an audit trail entry
 */
interface AuditLogParams {
  entity_type: 'OKR' | 'KPI_Component' | 'User_KPI_Data' | 'Task' | 'Task_Collaborator';
  entity_id: string;
  action: 'created' | 'updated' | 'deleted' | 'approved' | 'rejected' | 'archived' | 'reassigned';
  old_value?: any;
  new_value?: any;
  changed_by: string;
  reason?: string;
}

/**
 * Log an action to the Audit_Log table
 * 
 * This function creates an immutable audit trail record for any mutation operation.
 * IMPORTANT: This must be called in the SAME transaction as the main operation
 * to ensure atomicity. If audit logging fails, the main operation should be rolled back.
 * 
 * @param params - Audit log parameters
 * @throws Error if audit logging fails
 */
export async function logAudit(params: AuditLogParams): Promise<void> {
  const {
    entity_type,
    entity_id,
    action,
    old_value,
    new_value,
    changed_by,
    reason
  } = params;

  try {
    const { error } = await supabase
      .from('Audit_Log')
      .insert({
        entity_type,
        entity_id,
        action,
        old_value: old_value ? JSON.stringify(old_value) : null,
        new_value: new_value ? JSON.stringify(new_value) : null,
        changed_by,
        changed_at: new Date().toISOString(),
        reason: reason || null
      });

    if (error) {
      console.error('Failed to log audit:', {
        error,
        entity_type,
        entity_id,
        action
      });
      throw new Error('Audit logging failed - operation rolled back');
    }
  } catch (err) {
    console.error('Exception in audit logging:', err);
    throw new Error('Audit logging failed - operation rolled back');
  }
}

/**
 * Get audit history for a specific entity
 * 
 * @param entity_type - Type of entity
 * @param entity_id - ID of the entity
 * @param limit - Maximum number of records to return (default: 50)
 * @returns Array of audit log entries, ordered by most recent first
 */
export async function getAuditHistory(
  entity_type: string,
  entity_id: string,
  limit: number = 50
): Promise<any[]> {
  const { data, error } = await supabase
    .from('Audit_Log')
    .select('*')
    .eq('entity_type', entity_type)
    .eq('entity_id', entity_id)
    .order('changed_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching audit history:', error);
    throw error;
  }

  return data || [];
}

/**
 * Get recent audit logs by user
 * 
 * Useful for showing a user's recent activity or for admin monitoring.
 * 
 * @param user_id - The user who made the changes
 * @param limit - Maximum number of records to return (default: 20)
 * @returns Array of audit log entries, ordered by most recent first
 */
export async function getUserAuditLogs(
  user_id: number,
  limit: number = 20
): Promise<any[]> {
  const { data, error } = await supabase
    .from('Audit_Log')
    .select('*')
    .eq('changed_by', user_id)
    .order('changed_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching user audit logs:', error);
    throw error;
  }

  return data || [];
}

/**
 * Get all audit logs for a specific entity type
 * 
 * Useful for admin reports on all OKRs, Components, etc.
 * 
 * @param entity_type - Type of entity
 * @param filters - Optional filters
 * @param limit - Maximum number of records to return (default: 100)
 * @returns Array of audit log entries
 */
export async function getAuditLogsByType(
  entity_type: string,
  filters?: {
    action?: string;
    changed_by?: number;
    date_from?: string;
    date_to?: string;
  },
  limit: number = 100
): Promise<any[]> {
  let query = supabase
    .from('Audit_Log')
    .select('*')
    .eq('entity_type', entity_type)
    .order('changed_at', { ascending: false })
    .limit(limit);

  if (filters?.action) {
    query = query.eq('action', filters.action);
  }

  if (filters?.changed_by) {
    query = query.eq('changed_by', filters.changed_by);
  }

  if (filters?.date_from) {
    query = query.gte('changed_at', filters.date_from);
  }

  if (filters?.date_to) {
    query = query.lte('changed_at', filters.date_to);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching audit logs by type:', error);
    throw error;
  }

  return data || [];
}

/**
 * Get detailed diff between old and new values
 * 
 * Compares JSON strings and returns human-readable changes.
 * 
 * @param old_value_json - JSON string of old value
 * @param new_value_json - JSON string of new value
 * @returns Object with changed fields and their before/after values
 */
export function getAuditDiff(
  old_value_json: string | null,
  new_value_json: string | null
): any {
  if (!old_value_json || !new_value_json) {
    return null;
  }

  try {
    const oldValue = JSON.parse(old_value_json);
    const newValue = JSON.parse(new_value_json);

    const changes: any = {};

    // Compare all keys in new value
    for (const key in newValue) {
      if (oldValue[key] !== newValue[key]) {
        changes[key] = {
          before: oldValue[key],
          after: newValue[key]
        };
      }
    }

    return changes;
  } catch (err) {
    console.error('Error parsing audit diff:', err);
    return null;
  }
}

/**
 * Create a comprehensive audit summary for an entity
 * 
 * Returns a timeline of all changes with human-readable descriptions.
 * 
 * @param entity_type - Type of entity
 * @param entity_id - ID of the entity
 * @returns Array of audit entries with formatted descriptions
 */
export async function getAuditSummary(
  entity_type: string,
  entity_id: string
): Promise<any[]> {
  const logs = await getAuditHistory(entity_type, entity_id);

  return logs.map(log => {
    const diff = getAuditDiff(log.old_value, log.new_value);

    return {
      id: log.id,
      action: log.action,
      changed_at: log.changed_at,
      changed_by: log.changed_by,
      reason: log.reason,
      changes: diff,
      description: generateAuditDescription(log, diff)
    };
  });
}

/**
 * Generate human-readable description of audit log entry
 * 
 * @param log - Audit log entry
 * @param diff - Diff object from getAuditDiff
 * @returns Human-readable description
 */
function generateAuditDescription(log: any, diff: any): string {
  switch (log.action) {
    case 'created':
      return `Created ${log.entity_type}`;
    case 'updated':
      if (diff) {
        const changedFields = Object.keys(diff).join(', ');
        return `Updated ${log.entity_type}: ${changedFields}`;
      }
      return `Updated ${log.entity_type}`;
    case 'deleted':
      return `Deleted ${log.entity_type}`;
    case 'archived':
      return `Archived ${log.entity_type}${log.reason ? `: ${log.reason}` : ''}`;
    case 'approved':
      return `Approved ${log.entity_type}`;
    case 'rejected':
      return `Rejected ${log.entity_type}${log.reason ? `: ${log.reason}` : ''}`;
    default:
      return `${log.action} ${log.entity_type}`;
  }
}

/**
 * Check if entity has been modified since a certain date
 * 
 * @param entity_type - Type of entity
 * @param entity_id - ID of the entity
 * @param since - ISO date string
 * @returns true if entity has been modified since date
 */
export async function hasBeenModifiedSince(
  entity_type: string,
  entity_id: string,
  since: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from('Audit_Log')
    .select('id')
    .eq('entity_type', entity_type)
    .eq('entity_id', entity_id)
    .gte('changed_at', since)
    .limit(1);

  if (error) {
    console.error('Error checking modification status:', error);
    throw error;
  }

  return data && data.length > 0;
}
