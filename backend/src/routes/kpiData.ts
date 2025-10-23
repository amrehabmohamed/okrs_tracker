/**
 * KPI Data Routes - Phase 4 Sprint 1
 *
 * Route definitions for KPI data submission endpoints
 *
 * All routes require authentication via JWT token
 * Rate limiting applied at application level
 */

import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import {
  submitKPIData,
  getKPIData,
  getSubmissionHistory
} from '../controllers/kpiDataController';

const router = Router();

/**
 * POST /api/kpi-data
 * Submit KPI data (count form for Sprint 4.1)
 *
 * Authentication: Required
 * Body: CountFormInput
 * Response: 201 Created with submission details
 */
router.post('/', authenticate, submitKPIData);

/**
 * GET /api/kpi-data
 * Get user's KPI data submissions
 *
 * Authentication: Required
 * Query params: okr_id, kpi_component_id, status, include_history
 * Response: 200 OK with array of submissions
 */
router.get('/', authenticate, getKPIData);

/**
 * GET /api/kpi-data/history/:component_id
 * Get submission history for a specific component
 *
 * Authentication: Required
 * Params: component_id (UUID)
 * Response: 200 OK with all versions
 */
router.get('/history/:component_id', authenticate, getSubmissionHistory);

export default router;
