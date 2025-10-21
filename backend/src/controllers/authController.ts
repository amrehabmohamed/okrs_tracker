import { Response, NextFunction } from 'express';
import { supabase } from '../db';
import { AppError, asyncHandler } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';

interface SignupBody {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  role?: string;
  team_id?: number;
}

interface LoginBody {
  email: string;
  password: string;
}

interface PasswordChangeBody {
  new_password: string;
}

interface PasswordResetBody {
  email: string;
}

export const signup = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
  const { email, password, first_name, last_name, role, team_id }: SignupBody = req.body;

  if (!email || !password || !first_name || !last_name) {
    throw new AppError('Email, password, first name, and last name are required', 400);
  }

  if (password.length < 8) {
    throw new AppError('Password must be at least 8 characters', 400);
  }

  const { data: existingUser } = await supabase
    .from('Users')
    .select('email')
    .eq('email', email.toLowerCase())
    .single();

  if (existingUser) {
    throw new AppError('User with this email already exists', 409);
  }

  const { data: authData, error: authError } = await supabase.auth.signUp({
    email: email.toLowerCase(),
    password,
    options: {
      data: {
        first_name,
        last_name,
      },
      emailRedirectTo: `${process.env.FRONTEND_URL}/auth/verify-email`
    }
  });

  if (authError) {
    throw new AppError(authError.message, 400);
  }

  if (!authData.user) {
    throw new AppError('Failed to create user', 500);
  }

  if (role || team_id) {
    const { error: updateError } = await supabase
      .from('Users')
      .update({
        ...(role && { role }),
        ...(team_id && { team_id })
      })
      .eq('id', authData.user.id);

    if (updateError) {
      console.error('Failed to update user profile:', updateError);
    }
  }

  res.status(201).json({
    success: true,
    message: 'Registration successful. Please check your email to verify your account.',
    data: {
      user_id: authData.user.id,
      email: authData.user.email,
      email_confirmed: authData.user.email_confirmed_at ? true : false,
      status: 'pending'
    }
  });
});

export const login = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
  const { email, password }: LoginBody = req.body;

  if (!email || !password) {
    throw new AppError('Email and password are required', 400);
  }

  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: email.toLowerCase(),
    password
  });

  if (authError) {
    throw new AppError('Invalid credentials', 401);
  }

  if (!authData.user || !authData.session) {
    throw new AppError('Login failed', 401);
  }

  if (!authData.user.email_confirmed_at) {
    throw new AppError('Please verify your email before logging in', 403);
  }

  const { data: userProfile, error: profileError } = await supabase
    .from('Users')
    .select('id, email, first_name, last_name, role, team_id, is_manager, status')
    .eq('id', authData.user.id)
    .single();

  console.log('Login debug - User ID:', authData.user.id);
  console.log('Login debug - Profile data:', userProfile);
  console.log('Login debug - Profile error:', profileError);

  if (profileError || !userProfile) {
    throw new AppError('User profile not found', 404);
  }

  if (userProfile.status !== 'approved') {
    throw new AppError(
      `Account is ${userProfile.status}. Please wait for admin approval.`,
      403
    );
  }

  res.status(200).json({
    success: true,
    message: 'Login successful',
    data: {
      access_token: authData.session.access_token,
      refresh_token: authData.session.refresh_token,
      expires_at: authData.session.expires_at,
      user: userProfile
    }
  });
});

export const logout = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    const { error } = await supabase.auth.admin.signOut(token);
    
    if (error) {
      console.error('Logout error:', error);
    }
  }

  res.status(200).json({
    success: true,
    message: 'Logout successful'
  });
});

export const me = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.user) {
    throw new AppError('Not authenticated', 401);
  }

  const { data: userProfile, error } = await supabase
    .from('Users')
    .select('id, email, first_name, last_name, role, team_id, is_manager, status, created_at')
    .eq('id', req.user.id)
    .single();

  if (error || !userProfile) {
    throw new AppError('User not found', 404);
  }

  res.status(200).json({
    success: true,
    data: userProfile
  });
});

export const changePassword = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.user) {
    throw new AppError('Not authenticated', 401);
  }

  const { new_password }: PasswordChangeBody = req.body;

  if (!new_password) {
    throw new AppError('New password is required', 400);
  }

  if (new_password.length < 8) {
    throw new AppError('Password must be at least 8 characters', 400);
  }

  const { error } = await supabase.auth.admin.updateUserById(
    req.user.id,
    { password: new_password }
  );

  if (error) {
    throw new AppError(error.message, 400);
  }

  res.status(200).json({
    success: true,
    message: 'Password changed successfully'
  });
});

export const requestPasswordReset = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
  const { email }: PasswordResetBody = req.body;

  if (!email) {
    throw new AppError('Email is required', 400);
  }

  const { error } = await supabase.auth.resetPasswordForEmail(email.toLowerCase(), {
    redirectTo: `${process.env.FRONTEND_URL}/auth/reset-password`
  });

  if (error) {
    console.error('Password reset error:', error);
  }

  res.status(200).json({
    success: true,
    message: 'If an account exists with this email, a password reset link has been sent.'
  });
});

export const resendVerificationEmail = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
  const { email }: { email: string } = req.body;

  if (!email) {
    throw new AppError('Email is required', 400);
  }

  const { error } = await supabase.auth.resend({
    type: 'signup',
    email: email.toLowerCase(),
    options: {
      emailRedirectTo: `${process.env.FRONTEND_URL}/auth/verify-email`
    }
  });

  if (error) {
    console.error('Resend verification error:', error);
  }

  res.status(200).json({
    success: true,
    message: 'Verification email sent if account exists and is not verified.'
  });
});

export const listPendingUsers = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
  const { data: users, error } = await supabase
    .from('Users')
    .select('id, email, first_name, last_name, role, team_id, status, created_at')
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  if (error) {
    throw new AppError('Failed to fetch pending users', 500);
  }

  res.status(200).json({
    success: true,
    data: users || [],
    count: users?.length || 0
  });
});

export const approveUser = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
  const { userId } = req.params;

  const { data, error } = await supabase
    .from('Users')
    .update({ status: 'approved' })
    .eq('id', userId)
    .select()
    .single();

  if (error) {
    throw new AppError('Failed to approve user', 500);
  }

  if (!data) {
    throw new AppError('User not found', 404);
  }

  res.status(200).json({
    success: true,
    message: 'User approved successfully',
    data
  });
});

export const rejectUser = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
  const { userId } = req.params;
  const { reason } = req.body;

  const { data, error } = await supabase
    .from('Users')
    .update({ status: 'rejected' })
    .eq('id', userId)
    .select()
    .single();

  if (error) {
    throw new AppError('Failed to reject user', 500);
  }

  if (!data) {
    throw new AppError('User not found', 404);
  }

  if (reason) {
    await supabase
      .from('User_Status_Audit')
      .update({ reason })
      .eq('user_id', userId)
      .order('changed_at', { ascending: false })
      .limit(1);
  }

  res.status(200).json({
    success: true,
    message: 'User rejected',
    data
  });
});
