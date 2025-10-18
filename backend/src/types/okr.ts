/**
 * TypeScript interfaces for OKR and KPI Component entities
 */

export interface OKR {
  id: string;
  role_id: number;
  year: number;
  quarter: number;
  okr_number: number;
  okr_title: string;
  description?: string;
  weight: number;
  type: 0 | 1; // 0=Qualitative, 1=Quantitative
  status: 0 | 1 | 2 | 3; // 0=draft, 1=active, 2=completed, 3=archived
  tags?: string;
  deadline_at: Date;
  deadline_missed: boolean;
  completed_date?: Date;
  created_by: number;
  created_at: Date;
  updated_at: Date;
}

export interface KPIComponent {
  id: string;
  okr_id: string;
  component_name: string;
  component_weight: number;
  measurement_type: 0 | 1 | 2 | 3; // 0=count, 1=percentage, 2=score, 3=boolean
  target_value: number;
  unit: string;
  description?: string;
  sort_order: number;
  deadline_at: Date;
  deadline_missed: boolean;
  completed_date?: Date;
  counting_method: 0 | 1 | 2; // 0=cumulative, 1=individual, 2=per_period
  created_at: Date;
}

export interface CreateOKRInput {
  role_id: number;
  year: number;
  quarter: number;
  okr_number: number;
  okr_title: string;
  description?: string;
  weight: number;
  type: 0 | 1;
  tags?: string;
}

export interface UpdateOKRInput {
  okr_title?: string;
  description?: string;
  weight?: number;
  type?: 0 | 1;
  status?: 0 | 1 | 2 | 3;
  tags?: string;
}

export interface CreateComponentInput {
  okr_id: string;
  component_name: string;
  component_weight: number;
  measurement_type: 0 | 1 | 2 | 3;
  target_value: number;
  unit: string;
  description?: string;
  sort_order: number;
  counting_method?: 0 | 1 | 2;
}

export interface UpdateComponentInput {
  component_name?: string;
  component_weight?: number;
  measurement_type?: 0 | 1 | 2 | 3;
  target_value?: number;
  unit?: string;
  description?: string;
  sort_order?: number;
  counting_method?: 0 | 1 | 2;
}

export interface OKRFilters {
  role_id?: number;
  year?: number;
  quarter?: number;
  status?: 0 | 1 | 2 | 3;
  tags?: string;
  limit?: number;
  offset?: number;
}
