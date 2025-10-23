import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { v4 as uuidv4 } from 'uuid';

interface ValidateOptions {
  body?: ZodSchema;
  query?: ZodSchema;
  params?: ZodSchema;
}

export const validate = (schemas: ValidateOptions) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Validate body
      if (schemas.body) {
        req.body = await schemas.body.parseAsync(req.body);
      }

      // Validate query params
      if (schemas.query) {
        req.query = await schemas.query.parseAsync(req.query);
      }

      // Validate route params
      if (schemas.params) {
        req.params = await schemas.params.parseAsync(req.params);
      }

      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const requestId = req.id || uuidv4();
        
        // Format field-level errors
        const fieldErrors = error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message
        }));

        return res.status(400).json({
          type: 'https://api.kpi-platform.com/errors/validation-error',
          title: 'Validation Error',
          status: 400,
          detail: 'One or more fields failed validation',
          instance: req.path,
          requestId,
          errors: fieldErrors
        });
      }

      next(error);
    }
  };
};

// Convenience validators for common patterns
export const validateBody = (schema: ZodSchema) => validate({ body: schema });
export const validateQuery = (schema: ZodSchema) => validate({ query: schema });
export const validateParams = (schema: ZodSchema) => validate({ params: schema });
export const validateAll = (body: ZodSchema, query?: ZodSchema, params?: ZodSchema) => 
  validate({ body, query, params });
