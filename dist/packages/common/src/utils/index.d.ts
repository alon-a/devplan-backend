import { z } from 'zod';
export declare const validateSchema: <T>(schema: z.ZodSchema<T>, data: unknown) => T;
export declare const handleAsyncError: <T>(promise: Promise<T>) => Promise<T>;
export declare const validateEnvironment: (config: Record<string, any>) => void;
export declare const generateFileName: (originalName: string, userId: string) => string;
export declare const isValidFileType: (fileName: string, allowedTypes: string[]) => boolean;
export declare const isValidFileSize: (fileSize: number, maxSizeInMB: number) => boolean;
export declare const formatDate: (date: Date) => string;
export declare const parseDate: (dateString: string) => Date;
export declare const calculatePagination: (page: number, limit: number, total: number) => {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    offset: number;
    hasNext: boolean;
    hasPrev: boolean;
};
export declare const createSuccessResponse: <T>(data: T, message?: string) => {
    success: boolean;
    data: T;
    message: string | undefined;
};
export declare const createErrorResponse: (error: string, statusCode?: number) => {
    success: boolean;
    error: string;
    statusCode: number;
};
export declare const sanitizeUser: (user: any) => any;
export declare const logError: (error: Error, context?: string) => void;
export declare const logInfo: (message: string, data?: any) => void;
//# sourceMappingURL=index.d.ts.map