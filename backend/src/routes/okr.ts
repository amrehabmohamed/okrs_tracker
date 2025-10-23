import express from 'express';
import * as okrController from '../controllers/okrController';
import { authenticate, requireAdmin } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { 
  createOKRSchema, 
  updateOKRSchema, 
  listOKRsQuerySchema,
  okrIdParamSchema
} from '../validation/schemas';

const router = express.Router();

/**
 * OKR Routes - All routes require authentication and admin access
 * Only users with is_manager >= 3 (VP, CTO) can manage OKRs
 */

/**
 * GET /api/okrs - List OKRs with filters
 * Query params: role_id, year, quarter, status, tags, limit, offset
 */
router.get('/', authenticate, requireAdmin, validate({ query: listOKRsQuerySchema }), okrController.listOKRs);

/**
 * POST /api/okrs - Create new OKR
 * Body: CreateOKRInput
 */
router.post('/', authenticate, requireAdmin, validate({ body: createOKRSchema }), okrController.createOKR);

/**
 * GET /api/okrs/weight-sum/:role_id/:year/:quarter - Get current weight sum
 */
router.get('/weight-sum/:role_id/:year/:quarter', authenticate, requireAdmin, okrController.getWeightSum);

/**
 * GET /api/okrs/:id - Get single OKR with components
 * Params: id (UUID)
 * Query: include_archived (boolean)
 */
router.get('/:id', authenticate, requireAdmin, validate({ params: okrIdParamSchema }), okrController.getOKR);

/**
 * PUT /api/okrs/:id - Update OKR
 * Params: id (UUID)
 * Body: UpdateOKRInput
 */
router.put('/:id', authenticate, requireAdmin, validate({ params: okrIdParamSchema, body: updateOKRSchema }), okrController.updateOKR);

/**
 * DELETE /api/okrs/:id - Archive (soft delete) OKR
 * Params: id (UUID)
 * Body: { reason?: string }
 */
router.delete('/:id', authenticate, requireAdmin, validate({ params: okrIdParamSchema }), okrController.deleteOKR);

export default router;
