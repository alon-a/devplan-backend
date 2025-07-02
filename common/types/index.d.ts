import { z } from 'zod';
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
export declare const UploadDialogueSchema: z.ZodObject<{
    title: z.ZodString;
    content: z.ZodString;
    audio_file: z.ZodOptional<z.ZodAny>;
    template_id: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    title: string;
    content: string;
    audio_file?: any;
    template_id?: string | undefined;
}, {
    title: string;
    content: string;
    audio_file?: any;
    template_id?: string | undefined;
}>;
export declare const RecordDialogueSchema: z.ZodObject<{
    title: z.ZodString;
    audio_data: z.ZodString;
    template_id: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    title: string;
    audio_data: string;
    template_id?: string | undefined;
}, {
    title: string;
    audio_data: string;
    template_id?: string | undefined;
}>;
export declare const GenerateVideoSchema: z.ZodObject<{
    template_id: z.ZodString;
    custom_settings: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
}, "strip", z.ZodTypeAny, {
    template_id: string;
    custom_settings?: Record<string, any> | undefined;
}, {
    template_id: string;
    custom_settings?: Record<string, any> | undefined;
}>;
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
export declare class AppError extends Error {
    statusCode: number;
    message: string;
    isOperational: boolean;
    constructor(statusCode: number, message: string, isOperational?: boolean);
}
export declare class ValidationError extends AppError {
    constructor(message: string);
}
export declare class AuthenticationError extends AppError {
    constructor(message?: string);
}
export declare class AuthorizationError extends AppError {
    constructor(message?: string);
}
export declare class NotFoundError extends AppError {
    constructor(resource?: string);
}
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
export type { UploadDialogueSchema, RecordDialogueSchema, GenerateVideoSchema, };
//# sourceMappingURL=index.d.ts.map