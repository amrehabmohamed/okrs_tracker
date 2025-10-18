import { Request, Response } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import * as okrService from '../services/okrService';
import { CreateOKRInput, UpdateOKRInput, OKRFilters } from '../types/okr';

// Extend Request type inline
interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    is_manager: number;
    role: string;
    team_id: number;
  };
}

/**
 * OKR Controller - Thin request/response layer
 */

export const createOKR = asyncHandler(async (req: Request, res: Response) => {
  const input: CreateOKRInput = req.body;
  const created_by = (req as AuthRequest).user!.id;

  const okr = await okrService.createOKR(input, created_by);

  res.status(201).json({
    okr,
    message: 'OKR created successfully'
  });
});

export const listOKRs = asyncHandler(async (req: Request, res: Response) => {
  const filters: OKRFilters = {
    role_id: req.query.role_id ? Number(req.query.role_id) : undefined,
    year: req.query.year ? Number(req.query.year) : undefined,
    quarter: req.query.quarter ? Number(req.query.quarter) : undefined,
    status: req.query.status !== undefined ? Number(req.query.status) as any : undefined,
    tags: req.query.tags as string | undefined,
    limit: req.query.limit ? Number(req.query.limit) : undefined,
    offset: req.query.offset ? Number(req.query.offset) : undefined
  };

  const result = await okrService.listOKRs(filters);

  res.status(200).json(result);
});

export const getOKR = asyncHandler(async (req: Request, res: Response) => {
  const okr_id = req.params.id;
  const include_archived = req.query.include_archived === 'true';

  const okr = await okrService.getOKRWithComponents(okr_id, include_archived);

  res.status(200).json({ okr });
});

export const updateOKR = asyncHandler(async (req: Request, res: Response) => {
  const okr_id = req.params.id;
  const input: UpdateOKRInput = req.body;
  const updated_by = (req as AuthRequest).user!.id;

  const okr = await okrService.updateOKR(okr_id, input, updated_by);

  res.status(200).json({
    okr,
    message: 'OKR updated successfully'
  });
});

export const deleteOKR = asyncHandler(async (req: Request, res: Response) => {
  const okr_id = req.params.id;
  const deleted_by = (req as AuthRequest).user!.id;
  const reason = req.body.reason;

  const okr = await okrService.deleteOKR(okr_id, deleted_by, reason);

  res.status(200).json({
    okr,
    message: 'OKR archived successfully'
  });
});

export const getWeightSum = asyncHandler(async (req: Request, res: Response) => {
  const role_id = Number(req.params.role_id);
  const year = Number(req.params.year);
  const quarter = Number(req.params.quarter);

  const current_sum = await okrService.getCurrentWeightSum(role_id, year, quarter);

  res.status(200).json({
    role_id,
    year,
    quarter,
    current_sum,
    remaining: 100 - current_sum
  });
});
