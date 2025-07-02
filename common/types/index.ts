import { z } from 'zod';

// Database Schema Types
export interface User {
  id: string;
  email: string;
  password_hash: string;
  created_at: Date;
  updated_at: Date;
  first_name?: string;
  last_name?: string;
  avatar_url?: string;
  preferences?: Record<string, any>;
}

export interface Dialogue {
  id: string;
  user_id: string;
  title: string;
  content: string;
  transcript?: string;
  audio_url?: string;
  video_url?: string;
  mood_analysis?: MoodAnalysis;
  analysis_status: 'pending' | 'processing' | 'completed' | 'failed';
  language: string;
  analysis_metadata?: Record<string, any>;
  created_at: Date;
  updated_at: Date;
  status: 'draft' | 'analyzed' | 'generated' | 'completed';
  template_id?: string;
}

export interface Video {
  id: string;
  dialogue_id: string;
  user_id: string;
  template_id: string;
  avatar_url: string;
  audio_url: string;
  video_url: string;
  duration: number;
  created_at: Date;
  status: 'processing' | 'completed' | 'failed';
  metadata?: Record<string, any>;
}

export interface Template {
  id: string;
  name: string;
  description: string;
  avatar_url: string;
  voice_id: string;
  category: string;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface MoodAnalysis {
  overall_mood: 'positive' | 'negative' | 'neutral';
  confidence_score: number;
  emotions: Emotion[];
  sentiment_score: number;
  key_themes: string[];
  risk_indicators?: string[];
  recommendations?: string[];
}

export interface Emotion {
  name: string;
  intensity: number;
  confidence: number;
}

// API Request/Response Types
export const UploadDialogueSchema = z.object({
  title: z.string().min(1).max(255),
  content: z.string().min(1),
  audio_file: z.any().optional(), // File upload
  template_id: z.string().optional(),
});

export const RecordDialogueSchema = z.object({
  title: z.string().min(1).max(255),
  audio_data: z.string(), // Base64 encoded audio
  template_id: z.string().optional(),
});

export const GenerateVideoSchema = z.object({
  template_id: z.string(),
  custom_settings: z.record(z.any()).optional(),
});

// API Response Types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Authentication Types
export interface AuthUser {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  avatarUrl?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
}

export interface AuthResponse {
  user: AuthUser;
  token: string;
  refreshToken?: string;
}

// Error Types
export class AppError extends Error {
  constructor(
    public statusCode: number,
    public message: string,
    public isOperational = true
  ) {
    super(message);
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(400, message);
  }
}

export class AuthenticationError extends AppError {
  constructor(message = 'Authentication required') {
    super(401, message);
  }
}

export class AuthorizationError extends AppError {
  constructor(message = 'Insufficient permissions') {
    super(403, message);
  }
}

export class NotFoundError extends AppError {
  constructor(resource = 'Resource') {
    super(404, `${resource} not found`);
  }
}

// Environment Configuration
export interface EnvironmentConfig {
  NODE_ENV: 'development' | 'production' | 'test';
  PORT: number;
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  SUPABASE_SERVICE_KEY: string;
  ELEVENLABS_API_KEY: string;
  GOOGLE_AI_STUDIO_API_KEY: string;
  DID_API_KEY: string;
  DEEPBRAIN_AI_API_KEY: string;
  JWT_SECRET: string;
  CORS_ORIGIN: string;
} 