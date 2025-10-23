import 'express';

declare global {
  namespace Express {
    interface Request {
      // Request ID for distributed tracing (UUID v4)
      id?: string;
      
      // Authenticated user (populated by authenticate middleware)
      user?: {
        id: string;
        email: string;
        role: string;
        team_id: number;
        is_manager: number;
        status: string;
        first_name: string;
        last_name: string;
      };
    }
  }
}
