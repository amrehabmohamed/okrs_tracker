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

import { Request, Response, NextFunction } from 'express';
import { CountFormInput } from '../types/kpiData';
import { submitCountForm, getUserKPIData } from '../services/kpiDataService';
import { AppError } from '../middleware/errorHandler';
import { ErrorCode } from '../types/errors';

/**
 * Submit KPI data - auto-routes by measurement type
 *
 * POST /api/kpi-data
 */
export async function submitKPIData(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      throw new AppError(ErrorCode.AUTH_TOKEN_MISSING, 'Authentication required');
    }

    const user_id = req.user.id;
    const user_role = req.user.role;

    if (!req.body || Object.keys(req.body).length === 0) {
      throw new AppError(ErrorCode.VALIDATION_REQUIRED_FIELD, 'Request body is required');
    }

    const kpi_component_id = req.body.kpi_component_id;
    if (!kpi_component_id) {
      throw new AppError(ErrorCode.VALIDATION_REQUIRED_FIELD, 'kpi_component_id is required');
    }

    // Fetch component to determine measurement type
    const { getComponentWithOKR } = await import('../services/kpiDataValidationService');
    const component = await getComponentWithOKR(kpi_component_id);

    // Route to appropriate service based on measurement_type
    let submission;

    switch (component.measurement_type) {
      case 0: // Count
        const { submitCountForm } = await import('../services/kpiDataService');
        submission = await submitCountForm(user_id, user_role, req.body);
        break;

      case 1: // Percentage
        const { submitPercentageForm } = await import('../services/kpiDataService');
        submission = await submitPercentageForm(user_id, user_role, req.body);
        break;

      case 2: // Score
        const { submitScoreForm } = await import('../services/kpiDataService');
        submission = await submitScoreForm(user_id, user_role, req.body);
        break;

      case 3: // Boolean
        const { submitBooleanForm } = await import('../services/kpiDataService');
        submission = await submitBooleanForm(user_id, user_role, req.body);
        break;

      default:
        throw new AppError(
          ErrorCode.VALIDATION_INVALID_TYPE,
          `Unsupported measurement type: ${component.measurement_type}. ` +
          `Expected 0 (count), 1 (percentage), 2 (score), or 3 (boolean).`
        );
    }

    res.status(201).json({
      success: true,
      message: 'Submission created successfully and pending approval',
      data: submission
    });
  } catch (error) {
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
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // Extract user from auth middleware
    if (!req.user) {
      throw new AppError(ErrorCode.AUTH_TOKEN_MISSING, 'Authentication required');
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
      throw new AppError(
        ErrorCode.VALIDATION_OUT_OF_RANGE,
        'status must be 0 (pending), 1 (approved), or 2 (rejected)'
      );
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
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // Extract user from auth middleware
    if (!req.user) {
      throw new AppError(ErrorCode.AUTH_TOKEN_MISSING, 'Authentication required');
    }

    const user_id = req.user.id;
    const component_id = req.params.component_id;

    if (!component_id) {
      throw new AppError(ErrorCode.VALIDATION_REQUIRED_FIELD, 'component_id is required');
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
