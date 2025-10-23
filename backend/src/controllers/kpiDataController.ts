/**
 * KPI Data Controller - Phase 4 Sprint 1
 *
 * HTTP request handlers for KPI data submission endpoints
 *
 * Responsibilities:
 * - Parse and validate HTTP requests
 * - Extract user context from auth middleware
 * - Delegate business logic to service layer
 * - Format HTTP responses with proper status codes
 * - Handle errors and return user-friendly messages
 *
 * Status codes used:
 * - 200: Success (GET)
 * - 201: Created (POST)
 * - 400: Bad Request (validation errors)
 * - 401: Unauthorized (no/invalid token)
 * - 403: Forbidden (deadline passed, wrong role)
 * - 404: Not Found (component doesn't exist)
 * - 409: Conflict (duplicate submission)
 * - 500: Internal Server Error (unexpected errors)
 */

import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';
import { CountFormInput } from '../types/kpiData';
import { submitCountForm, getUserKPIData } from '../services/kpiDataService';
import { AppError } from '../middleware/errorHandler';

/**
 * Submit KPI data (count form for Sprint 4.1)
 *
 * POST /api/kpi-data
 *
 * Request body:
 * {
 *   "kpi_component_id": "uuid",
 *   "value": 2,
 *   "evidence_link": "https://...",
 *   "notes": "Optional notes",
 *   "data_source": 0
 * }
 *
 * Success response (201):
 * {
 *   "success": true,
 *   "message": "Submission created successfully and pending approval",
 *   "data": { ...enriched submission... }
 * }
 *
 * Error responses:
 * - 400: Validation error with field-level details
 * - 403: Deadline passed or access denied
 * - 404: Component not found
 * - 409: Pending submission already exists
 *
 * @param req - Express request with authenticated user
 * @param res - Express response
 * @param next - Express next function
 */
export async function submitKPIData(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // Extract user from auth middleware
    if (!req.user) {
      throw new AppError('Authentication required', 401);
    }

    const user_id = req.user.id;
    const user_role = req.user.role;

    // Validate request body exists
    if (!req.body || Object.keys(req.body).length === 0) {
      throw new AppError('Request body is required', 400);
    }

    // Extract and validate required fields
    const input: CountFormInput = {
      kpi_component_id: req.body.kpi_component_id,
      value: req.body.value,
      evidence_link: req.body.evidence_link,
      notes: req.body.notes,
      data_source: req.body.data_source
    };

    // Basic type validation before passing to service
    if (!input.kpi_component_id) {
      throw new AppError('kpi_component_id is required', 400);
    }

    if (input.value === undefined || input.value === null) {
      throw new AppError('value is required', 400);
    }

    // Delegate to service layer
    const submission = await submitCountForm(user_id, user_role, input);

    // Return success response with 201 Created
    res.status(201).json({
      success: true,
      message: 'Submission created successfully and pending approval',
      data: submission
    });
  } catch (error) {
    // Pass errors to error handler middleware
    next(error);
  }
}

/**
 * Get user's KPI data submissions
 *
 * GET /api/kpi-data
 *
 * Query parameters:
 * - okr_id: Filter by OKR (optional)
 * - kpi_component_id: Filter by component (optional)
 * - status: Filter by status 0=pending, 1=approved, 2=rejected (optional)
 * - include_history: Include all versions (default: false)
 *
 * Success response (200):
 * {
 *   "success": true,
 *   "data": [ ...array of submissions... ],
 *   "count": 5
 * }
 *
 * @param req - Express request with authenticated user
 * @param res - Express response
 * @param next - Express next function
 */
export async function getKPIData(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // Extract user from auth middleware
    if (!req.user) {
      throw new AppError('Authentication required', 401);
    }

    const user_id = req.user.id;

    // Extract query parameters
    const filters = {
      okr_id: req.query.okr_id as string | undefined,
      kpi_component_id: req.query.kpi_component_id as string | undefined,
      status: req.query.status ? parseInt(req.query.status as string, 10) : undefined,
      include_history: req.query.include_history === 'true'
    };

    // Validate status if provided
    if (filters.status !== undefined && ![0, 1, 2].includes(filters.status)) {
      throw new AppError('status must be 0 (pending), 1 (approved), or 2 (rejected)', 400);
    }

    // Delegate to service layer
    const submissions = await getUserKPIData(user_id, filters);

    // Return success response
    res.status(200).json({
      success: true,
      data: submissions,
      count: submissions.length
    });
  } catch (error) {
    // Pass errors to error handler middleware
    next(error);
  }
}

/**
 * Get submission history for a specific component
 *
 * GET /api/kpi-data/history/:component_id
 *
 * Returns all versions of submissions for a component
 * Useful for viewing rejection/resubmission history
 *
 * Success response (200):
 * {
 *   "success": true,
 *   "data": {
 *     "component": { ...component details... },
 *     "submissions": [ ...all versions... ],
 *     "latest": { ...latest version... }
 *   }
 * }
 *
 * @param req - Express request with authenticated user
 * @param res - Express response
 * @param next - Express next function
 */
export async function getSubmissionHistory(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // Extract user from auth middleware
    if (!req.user) {
      throw new AppError('Authentication required', 401);
    }

    const user_id = req.user.id;
    const component_id = req.params.component_id;

    if (!component_id) {
      throw new AppError('component_id is required', 400);
    }

    // Get all submissions for this component
    const submissions = await getUserKPIData(user_id, {
      kpi_component_id: component_id,
      include_history: true
    });

    if (submissions.length === 0) {
      res.status(200).json({
        success: true,
        message: 'No submissions found for this component',
        data: {
          component_id,
          submissions: [],
          latest: null
        }
      });
      return;
    }

    // Sort by version number descending
    submissions.sort((a, b) => b.version_number - a.version_number);

    const latest = submissions[0];

    res.status(200).json({
      success: true,
      data: {
        component: latest.kpi_component,
        okr: latest.okr,
        submissions: submissions,
        latest: latest,
        total_versions: submissions.length
      }
    });
  } catch (error) {
    // Pass errors to error handler middleware
    next(error);
  }
}
