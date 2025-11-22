import { z } from 'zod';

// ==========================================
// AUTHENTICATION SCHEMAS
// ==========================================

export const signupSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string()
    .min(12, 'Password must be at least 12 characters')
    .regex(/[A-Z]/, 'Password must contain uppercase letter')
    .regex(/[a-z]/, 'Password must contain lowercase letter')
    .regex(/[0-9]/, 'Password must contain number'),
  firstName: z.string().min(1, 'First name required').max(100),
  lastName: z.string().min(1, 'Last name required').max(100),
  team_id: z.number().int().positive().optional()
});

export const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password required')
});

export const verifyEmailSchema = z.object({
  token: z.string().min(1, 'Token required')
});

export const passwordResetSchema = z.object({
  email: z.string().email('Invalid email format')
});

export const passwordChangeSchema = z.object({
  oldPassword: z.string().min(1, 'Old password required'),
  newPassword: z.string()
    .min(12, 'Password must be at least 12 characters')
    .regex(/[A-Z]/, 'Password must contain uppercase letter')
    .regex(/[a-z]/, 'Password must contain lowercase letter')
    .regex(/[0-9]/, 'Password must contain number')
});

export const passwordUpdateSchema = z.object({
  token: z.string().min(1, 'Token required'),
  newPassword: z.string()
    .min(12, 'Password must be at least 12 characters')
    .regex(/[A-Z]/, 'Password must contain uppercase letter')
    .regex(/[a-z]/, 'Password must contain lowercase letter')
    .regex(/[0-9]/, 'Password must contain number')
});

export const checkEmailSchema = z.object({
  email: z.string().email('Invalid email format')
});

// ==========================================
// OKR SCHEMAS
// ==========================================

export const createOKRSchema = z.object({
  role_id: z.number().int().positive('Role ID must be positive'),
  year: z.number().int().min(2025, 'Year must be 2025 or later'),
  quarter: z.number().int().min(1).max(4, 'Quarter must be 1-4'),
  okr_number: z.number().int().min(1).max(8, 'OKR number must be 1-8'),
  okr_title: z.string().min(1, 'Title required').max(500),
  description: z.string().max(2000).optional(),
  weight: z.number().int().min(0).max(100, 'Weight must be 0-100'),
  type: z.number().int().min(0).max(1, 'Type must be 0 (qualitative) or 1 (quantitative)'),
  tags: z.string().max(500).optional()
});

export const updateOKRSchema = z.object({
  okr_title: z.string().min(1).max(500).optional(),
  description: z.string().max(2000).optional(),
  weight: z.number().int().min(0).max(100).optional(),
  status: z.number().int().min(0).max(3).optional(),
  tags: z.string().max(500).optional()
}).refine(data => Object.keys(data).length > 0, {
  message: 'At least one field must be provided'
});

export const listOKRsQuerySchema = z.object({
  role_id: z.coerce.number().int().positive().optional(),
  year: z.coerce.number().int().min(2025).optional(),
  quarter: z.coerce.number().int().min(1).max(4).optional(),
  status: z.coerce.number().int().min(0).max(3).optional(),
  expand: z.enum(['true', 'false']).transform(v => v === 'true').optional()
});

export const okrIdParamSchema = z.object({
  id: z.string().uuid('Invalid OKR ID format')
});

// ==========================================
// KPI COMPONENT SCHEMAS
// ==========================================

export const createKPIComponentSchema = z.object({
  okr_id: z.string().uuid('Invalid OKR ID'),
  component_name: z.string().min(1, 'Component name required').max(500),
  component_weight: z.number().int().min(0).max(100, 'Weight must be 0-100'),
  measurement_type: z.number().int().min(0).max(3, 'Measurement type must be 0-3'),
  target_value: z.number().positive('Target value must be positive'),
  unit: z.string().min(1).max(100),
  description: z.string().max(2000).optional(),
  sort_order: z.number().int().positive().optional(),
  counting_method: z.number().int().min(0).max(2).default(0)
});

export const updateKPIComponentSchema = z.object({
  component_name: z.string().min(1).max(500).optional(),
  component_weight: z.number().int().min(0).max(100).optional(),
  target_value: z.number().positive().optional(),
  counting_method: z.number().int().min(0).max(2).optional(),
  description: z.string().max(2000).optional()
}).refine(data => Object.keys(data).length > 0, {
  message: 'At least one field must be provided'
});

export const listKPIComponentsQuerySchema = z.object({
  okr_id: z.string().uuid().optional()
});

export const componentIdParamSchema = z.object({
  id: z.string().uuid('Invalid component ID format')
});

// ==========================================
// KPI DATA SUBMISSION SCHEMAS (Phase 4)
// ==========================================

export const countFormSchema = z.object({
  kpi_component_id: z.string().uuid('Invalid component ID'),
  value: z.number().int().nonnegative('Count must be 0 or positive'),
  evidence_link: z.string().url('Invalid URL format'),
  notes: z.string().max(500).optional(),
  data_source: z.literal(0).default(0)
});

export const percentageFormSchema = z.object({
  kpi_component_id: z.string().uuid('Invalid component ID'),
  numerator: z.number().nonnegative('Numerator must be 0 or positive'),
  denominator: z.number().positive('Denominator must be positive'),
  evidence_link: z.string().url('Invalid URL format'),
  notes: z.string().max(500).optional(),
  data_source: z.literal(0).default(0)
}).refine(
  data => data.numerator <= data.denominator * 10,
  { message: 'Numerator unreasonably high compared to denominator' }
);

export const scoreFormSchema = z.object({
  kpi_component_id: z.string().uuid('Invalid component ID'),
  score_value: z.number()
    .min(0, 'Score must be 0.0-5.0')
    .max(5, 'Score must be 0.0-5.0')
    .refine(val => Number((val * 10).toFixed(1)) === val * 10, {
      message: 'Score must have exactly 1 decimal place'
    }),
  response_count: z.number().int().positive('Response count must be positive'),
  evidence_link: z.string().url('Invalid URL format'),
  notes: z.string().max(500).optional(),
  data_source: z.union([z.literal(0), z.literal(1)])
});

export const booleanFormSchema = z.object({
  kpi_component_id: z.string().uuid('Invalid component ID'),
  completed: z.union([z.literal(0), z.literal(1)]),
  evidence_link: z.string().url('Invalid URL format'),
  notes: z.string().max(500).optional(),
  data_source: z.literal(0).default(0)
});

export const submissionQuerySchema = z.object({
  okr_id: z.string().uuid().optional(),
  include_history: z.enum(['true', 'false']).transform(v => v === 'true').optional()
});
