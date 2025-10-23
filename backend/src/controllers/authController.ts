import { Request, Response, NextFunction } from 'express';
import { supabase } from '../db';
import { AppError, asyncHandler, createSuccessResponse } from '../middleware/errorHandler';
import { ErrorCode } from '../types/errors';

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

export const signup = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const { email, password, first_name, last_name, role, team_id }: SignupBody = req.body;

  if (!email || !password || !first_name || !last_name) {
    throw new AppError(
      ErrorCode.VALIDATION_REQUIRED_FIELD,
      'Email, password, first name, and last name are required',
      { fields: ['email', 'password', 'first_name', 'last_name'] }
    );
  }

  if (password.length < 8) {
    throw new AppError(
      ErrorCode.VALIDATION_PASSWORD_WEAK,
      'Password must be at least 8 characters'
    );
  }

  const { data: existingUser } = await supabase
    .from('Users')
    .select('email')
    .eq('email', email.toLowerCase())
    .single();

  if (existingUser) {
    throw new AppError(
      ErrorCode.RESOURCE_ALREADY_EXISTS,
      'User with this email already exists',
      { field: 'email', value: email }
    );
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
    throw new AppError(
      ErrorCode.VALIDATION_FAILED,
      authError.message
    );
  }

  if (!authData.user) {
    throw new AppError(
      ErrorCode.SERVER_INTERNAL_ERROR,
      'Failed to create user'
    );
  }

  // Get user profile data
  const { data: userProfile } = await supabase
    .from('Users')
    .select('id, email, first_name, last_name, role, team_id, is_manager, status')
    .eq('id', authData.user.id)
    .single();

  // Update role/team if provided
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

  // Cache user metadata in JWT for performance optimization
  // This eliminates the need for a DB query on every authenticated request
  if (userProfile) {
    await supabase.auth.admin.updateUserById(authData.user.id, {
      user_metadata: {
        role: userProfile.role,
        team_id: userProfile.team_id,
        is_manager: userProfile.is_manager,
        status: userProfile.status,
        first_name: userProfile.first_name,
        last_name: userProfile.last_name
      }
    });
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

export const login = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const { email, password }: LoginBody = req.body;

  if (!email || !password) {
    throw new AppError(
      ErrorCode.VALIDATION_REQUIRED_FIELD,
      'Email and password are required',
      { fields: ['email', 'password'] }
    );
  }

  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: email.toLowerCase(),
    password
  });

  if (authError) {
    throw new AppError(
      ErrorCode.AUTH_CREDENTIALS_INVALID,
      'Invalid email or password'
    );
  }

  if (!authData.user || !authData.session) {
    throw new AppError(
      ErrorCode.AUTH_CREDENTIALS_INVALID,
      'Login failed'
    );
  }

  if (!authData.user.email_confirmed_at) {
    throw new AppError(
      ErrorCode.AUTH_EMAIL_NOT_VERIFIED,
      'Please verify your email before logging in'
    );
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
    throw new AppError(
      ErrorCode.RESOURCE_NOT_FOUND,
      'User profile not found'
    );
  }

  if (userProfile.status !== 'approved') {
    const errorCode = userProfile.status === 'rejected' 
      ? ErrorCode.AUTH_ACCOUNT_REJECTED
      : userProfile.status === 'suspended'
      ? ErrorCode.AUTH_ACCOUNT_SUSPENDED
      : ErrorCode.AUTH_ACCOUNT_NOT_APPROVED;
    
    throw new AppError(
      errorCode,
      `Account is ${userProfile.status}. Please contact admin.`,
      { status: userProfile.status }
    );
  }

  // Cache user metadata in JWT for performance optimization
  // This reduces DB queries from 2 to 1 per authenticated request (50% reduction)
  await supabase.auth.admin.updateUserById(authData.user.id, {
    user_metadata: {
      role: userProfile.role,
      team_id: userProfile.team_id,
      is_manager: userProfile.is_manager,
      status: userProfile.status,
      first_name: userProfile.first_name,
      last_name: userProfile.last_name
    }
  });

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

export const logout = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
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

export const me = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) {
    throw new AppError(
      ErrorCode.AUTH_TOKEN_INVALID,
      'Not authenticated'
    );
  }

  const { data: userProfile, error } = await supabase
    .from('Users')
    .select('id, email, first_name, last_name, role, team_id, is_manager, status, created_at')
    .eq('id', req.user.id)
    .single();

  if (error || !userProfile) {
    throw new AppError(
      ErrorCode.RESOURCE_NOT_FOUND,
      'User not found'
    );
  }

  res.status(200).json({
    success: true,
    data: userProfile
  });
});

export const changePassword = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) {
    throw new AppError(
      ErrorCode.AUTH_TOKEN_INVALID,
      'Not authenticated'
    );
  }

  const { new_password }: PasswordChangeBody = req.body;

  if (!new_password) {
    throw new AppError(
      ErrorCode.VALIDATION_REQUIRED_FIELD,
      'New password is required',
      { field: 'new_password' }
    );
  }

  if (new_password.length < 8) {
    throw new AppError(
      ErrorCode.VALIDATION_PASSWORD_WEAK,
      'Password must be at least 8 characters'
    );
  }

  const { error } = await supabase.auth.admin.updateUserById(
    req.user.id,
    { password: new_password }
  );

  if (error) {
    throw new AppError(
      ErrorCode.VALIDATION_FAILED,
      error.message
    );
  }

  res.status(200).json({
    success: true,
    message: 'Password changed successfully'
  });
});

export const requestPasswordReset = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const { email }: PasswordResetBody = req.body;

  if (!email) {
    throw new AppError(
      ErrorCode.VALIDATION_REQUIRED_FIELD,
      'Email is required',
      { field: 'email' }
    );
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

export const resendVerificationEmail = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const { email }: { email: string } = req.body;

  if (!email) {
    throw new AppError(
      ErrorCode.VALIDATION_REQUIRED_FIELD,
      'Email is required',
      { field: 'email' }
    );
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

export const listPendingUsers = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const { data: users, error } = await supabase
    .from('Users')
    .select('id, email, first_name, last_name, role, team_id, status, created_at')
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  if (error) {
    throw new AppError(
      ErrorCode.DATABASE_ERROR,
      'Failed to fetch pending users'
    );
  }

  res.status(200).json({
    success: true,
    data: users || [],
    count: users?.length || 0
  });
});

export const approveUser = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const { userId } = req.params;

  const { data, error } = await supabase
    .from('Users')
    .update({ status: 'approved' })
    .eq('id', userId)
    .select()
    .single();

  if (error) {
    throw new AppError(
      ErrorCode.DATABASE_ERROR,
      'Failed to approve user'
    );
  }

  if (!data) {
    throw new AppError(
      ErrorCode.RESOURCE_NOT_FOUND,
      'User not found'
    );
  }

  res.status(200).json({
    success: true,
    message: 'User approved successfully',
    data
  });
});

export const rejectUser = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const { userId } = req.params;
  const { reason } = req.body;

  const { data, error } = await supabase
    .from('Users')
    .update({ status: 'rejected' })
    .eq('id', userId)
    .select()
    .single();

  if (error) {
    throw new AppError(
      ErrorCode.DATABASE_ERROR,
      'Failed to reject user'
    );
  }

  if (!data) {
    throw new AppError(
      ErrorCode.RESOURCE_NOT_FOUND,
      'User not found'
    );
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
