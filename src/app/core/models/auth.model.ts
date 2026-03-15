import { User } from './user.model';

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload {
  fullName: string;
  email: string;
  password: string;
  phone?: string;
}

export interface ForgotPasswordPayload {
  email: string;
}

export interface AuthSession {
  accessToken: string;
  refreshToken?: string;
  expiresAt: string;
  user: User;
}
