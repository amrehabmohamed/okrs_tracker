import { Request, Response } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import * as componentService from '../services/kpiComponentService';
import { CreateComponentInput, UpdateComponentInput } from '../types/okr';

/**
 * KPI Component Controller - Thin request/response layer
 * Note: Request.user type is defined globally in types/express.d.ts
 */

export const createComponent = asyncHandler(async (req: Request, res: Response) => {
  const input: CreateComponentInput = req.body;
  const created_by = req.user!.id;

  const component = await componentService.createComponent(input, created_by);

  res.status(201).json({
    component,
    message: 'Component created successfully'
  });
});

export const listComponents = asyncHandler(async (req: Request, res: Response) => {
  const okr_id = req.query.okr_id as string;
  const include_archived = req.query.include_archived === 'true';

  if (!okr_id) {
    res.status(400).json({ error: 'okr_id query parameter is required' });
    return;
  }

  const components = await componentService.listComponents(okr_id, include_archived);

  res.status(200).json({
    components,
    count: components.length
  });
});

export const getComponent = asyncHandler(async (req: Request, res: Response) => {
  const component_id = req.params.id;

  const component = await componentService.getComponent(component_id);

  res.status(200).json({ component });
});

export const updateComponent = asyncHandler(async (req: Request, res: Response) => {
  const component_id = req.params.id;
  const input: UpdateComponentInput = req.body;
  const updated_by = req.user!.id;

  const component = await componentService.updateComponent(component_id, input, updated_by);

  res.status(200).json({
    component,
    message: 'Component updated successfully'
  });
});

export const deleteComponent = asyncHandler(async (req: Request, res: Response) => {
  const component_id = req.params.id;
  const deleted_by = req.user!.id;
  const reason = req.body.reason;

  const component = await componentService.deleteComponent(component_id, deleted_by, reason);

  res.status(200).json({
    component,
    message: 'Component archived successfully'
  });
});
