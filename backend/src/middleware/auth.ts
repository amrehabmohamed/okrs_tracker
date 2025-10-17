import { Request, Response, NextFunction } from 'express';
import { supabase } from '../db';
import { AppError } from './errorHandler';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
    team_id: number;
    is_manager: number;
  };
}

export const authenticate = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AppError('No token provided', 401);
    }

    const token = authHeader.substring(7);

    // Verify token with Supabase
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      throw new AppError('Invalid or expired token', 401);
    }

    // Get user details from Users table
    const { data: userData, error: userError } = await supabase
      .from('Users')
      .select('id, email, role, team_id, is_manager')
      .eq('id', user.id)
      .single();

    if (userError || !userData) {
      throw new AppError('User not found', 404);
    }

    req.user = userData;
    next();
  } catch (error) {
    next(error);
  }
};

// Middleware to check if user is a manager
export const requireManager = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  if (!req.user || req.user.is_manager === 0) {
    return next(new AppError('Manager access required', 403));
  }
  next();
};

// Middleware to check if user is admin (VP or CTO)
export const requireAdmin = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  if (!req.user || req.user.is_manager < 3) {
    return next(new AppError('Admin access required', 403));
  }
  next();
};
