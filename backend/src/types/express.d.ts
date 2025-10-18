import { Request } from 'express';

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string; // UUID from Supabase
        email: string;
        is_manager: number;
        role: string;
        team_id: number;
      };
    }
  }
}

export {};
