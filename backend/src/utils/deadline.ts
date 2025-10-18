import { supabase } from '../db';

/**
 * Calculate deadline for a given year/quarter based on Deadline_Config
 * 
 * Looks up configuration for specific role/year/quarter, falls back to global config.
 * Formula: deadline_at = quarter_end_date + days_after_quarter_end
 * 
 * @param year - The year (e.g., 2025)
 * @param quarter - The quarter (1-4)
 * @param role_id - Optional role_id for role-specific deadlines
 * @returns Date object set to end of deadline day (23:59:59.999)
 */
export async function calculateDeadline(
  year: number,
  quarter: number,
  role_id?: number
): Promise<Date> {
  // Validate inputs
  if (quarter < 1 || quarter > 4) {
    throw new Error('Quarter must be between 1 and 4');
  }

  // Try to find specific config, fallback to global (nulls sort last)
  let query = supabase
    .from('Deadline_Config')
    .select('days_after_quarter_end, deadline_exceeded_action')
    .or(`role_id.is.null,role_id.eq.${role_id || 'null'}`)
    .or(`year.is.null,year.eq.${year}`)
    .or(`quarter.is.null,quarter.eq.${quarter}`)
    .order('role_id', { ascending: false })
    .order('year', { ascending: false })
    .order('quarter', { ascending: false })
    .limit(1)
    .single();

  const { data: config, error } = await query;

  // Use config value or default to 14 days
  const daysAfter = config?.days_after_quarter_end || 14;

  // Get the last day of the quarter
  const quarterEnd = getQuarterEnd(year, quarter);
  
  // Add days_after_quarter_end
  const deadline = new Date(quarterEnd);
  deadline.setDate(deadline.getDate() + daysAfter);
  
  // Set to end of day (23:59:59.999)
  deadline.setHours(23, 59, 59, 999);
  
  return deadline;
}

/**
 * Get the last day of a quarter
 * 
 * @param year - The year
 * @param quarter - The quarter (1-4)
 * @returns Date object for last day of quarter
 */
export function getQuarterEnd(year: number, quarter: number): Date {
  // Quarter end months: Q1=March(3), Q2=June(6), Q3=September(9), Q4=December(12)
  const quarterEndMonths = [2, 5, 8, 11]; // 0-indexed for Date constructor
  const month = quarterEndMonths[quarter - 1];
  
  // Get last day of month: month+1, day 0 = last day of previous month
  return new Date(year, month + 1, 0);
}

/**
 * Get the first day of a quarter
 * 
 * @param year - The year
 * @param quarter - The quarter (1-4)
 * @returns Date object for first day of quarter
 */
export function getQuarterStart(year: number, quarter: number): Date {
  const quarterStartMonths = [0, 3, 6, 9]; // Jan, Apr, Jul, Oct (0-indexed)
  const month = quarterStartMonths[quarter - 1];
  
  return new Date(year, month, 1);
}

/**
 * Check if current date has passed deadline
 * 
 * @param deadline - The deadline date
 * @returns true if deadline has passed
 */
export function isDeadlineMissed(deadline: Date): boolean {
  return new Date() > deadline;
}

/**
 * Get current quarter from date
 * 
 * @param date - Optional date (defaults to now)
 * @returns Quarter number (1-4)
 */
export function getCurrentQuarter(date: Date = new Date()): number {
  const month = date.getMonth(); // 0-indexed
  return Math.floor(month / 3) + 1;
}

/**
 * Get current year
 * 
 * @param date - Optional date (defaults to now)
 * @returns Year number
 */
export function getCurrentYear(date: Date = new Date()): number {
  return date.getFullYear();
}

/**
 * Format deadline for display
 * 
 * @param deadline - Date object
 * @returns Formatted string (e.g., "Nov 13, 2025")
 */
export function formatDeadline(deadline: Date): string {
  return deadline.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}

/**
 * Calculate days remaining until deadline
 * 
 * @param deadline - The deadline date
 * @returns Number of days (negative if past deadline)
 */
export function getDaysRemaining(deadline: Date): number {
  const now = new Date();
  const diff = deadline.getTime() - now.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}
