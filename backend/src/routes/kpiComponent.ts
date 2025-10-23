import express from 'express';
import * as componentController from '../controllers/kpiComponentController';
import { authenticate, requireAdmin } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { 
  createKPIComponentSchema, 
  updateKPIComponentSchema, 
  listKPIComponentsQuerySchema,
  componentIdParamSchema
} from '../validation/schemas';

const router = express.Router();

/**
 * KPI Component Routes - All routes require authentication and admin access
 * Only users with is_manager >= 3 (VP, CTO) can manage components
 */

/**
 * GET /api/kpi-components - List components for an OKR
 * Query params: okr_id (required), include_archived (boolean)
 */
router.get('/', authenticate, requireAdmin, validate({ query: listKPIComponentsQuerySchema }), componentController.listComponents);

/**
 * POST /api/kpi-components - Create new component
 * Body: CreateComponentInput
 */
router.post('/', authenticate, requireAdmin, validate({ body: createKPIComponentSchema }), componentController.createComponent);

/**
 * GET /api/kpi-components/:id - Get single component
 * Params: id (UUID)
 */
router.get('/:id', authenticate, requireAdmin, validate({ params: componentIdParamSchema }), componentController.getComponent);

/**
 * PUT /api/kpi-components/:id - Update component
 * Params: id (UUID)
 * Body: UpdateComponentInput
 */
router.put('/:id', authenticate, requireAdmin, validate({ params: componentIdParamSchema, body: updateKPIComponentSchema }), componentController.updateComponent);

/**
 * DELETE /api/kpi-components/:id - Archive (soft delete) component
 * Params: id (UUID)
 * Body: { reason?: string }
 */
router.delete('/:id', authenticate, requireAdmin, validate({ params: componentIdParamSchema }), componentController.deleteComponent);

export default router;
