"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.storageService = exports.StorageService = void 0;
const supabase_1 = require("../database/supabase");
const common_1 = require("@devplan/common");
const supabase_js_1 = require("@supabase/supabase-js");
const uuid_1 = require("uuid");
class StorageService {
    constructor() {
        this.bucketName = 'devplan-video-therapy';
    }
    // Initialize storage buckets
    async initializeBuckets() {
        try {
            // Create main bucket if it doesn't exist
            const { data: buckets, error: listError } = await supabase_1.supabase.storage.listBuckets();
            if (listError) {
                throw listError;
            }
            const bucketExists = buckets.some(bucket => bucket.name === this.bucketName);
            if (!bucketExists) {
                const { error: createError } = await supabase_1.supabase.storage.createBucket(this.bucketName, {
                    public: false,
                    allowedMimeTypes: ['audio/*', 'video/*', 'image/*', 'text/*'],
                    fileSizeLimit: 100 * 1024 * 1024 // 100MB
                });
                if (createError) {
                    throw createError;
                }
                (0, common_1.logInfo)(`Created storage bucket: ${this.bucketName}`);
            }
            // Create subdirectories
            await this.createDirectory('audio');
            await this.createDirectory('video');
            await this.createDirectory('avatars');
            await this.createDirectory('transcripts');
            (0, common_1.logInfo)('Storage buckets initialized successfully');
        }
        catch (error) {
            (0, common_1.logError)(error, 'Failed to initialize storage buckets');
            throw error;
        }
    }
    async createDirectory(path) {
        try {
            const { error } = await supabase_1.supabase.storage
                .from(this.bucketName)
                .upload(`${path}/.keep`, new Uint8Array(0), {
                contentType: 'application/octet-stream'
            });
            if (error && !error.message.includes('already exists')) {
                throw error;
            }
        }
        catch (error) {
            // Directory might already exist, which is fine
            (0, common_1.logInfo)(`Directory ${path} already exists or could not be created`);
        }
    }
    // Upload file to storage
    async uploadFile(file, userId, directory = 'audio') {
        try {
            // Validate file type based on directory
            const allowedTypes = this.getAllowedTypesForDirectory(directory);
            if (!(0, common_1.isValidFileType)(file.originalname, allowedTypes)) {
                throw new Error(`Invalid file type for ${directory}. Allowed types: ${allowedTypes.join(', ')}`);
            }
            // Validate file size (100MB max for all files)
            const maxSizeMB = 100;
            if (!(0, common_1.isValidFileSize)(file.size, maxSizeMB)) {
                throw new Error(`File too large. Maximum size: ${maxSizeMB}MB`);
            }
            // Generate unique filename
            const fileName = (0, common_1.generateFileName)(file.originalname, userId);
            const filePath = `${directory}/${fileName}`;
            // Upload to Supabase Storage
            const { data, error } = await supabase_1.supabase.storage
                .from(this.bucketName)
                .upload(filePath, file.buffer, {
                contentType: file.mimetype,
                upsert: false
            });
            if (error) {
                throw error;
            }
            // Get public URL
            const { data: urlData } = supabase_1.supabase.storage
                .from(this.bucketName)
                .getPublicUrl(filePath);
            (0, common_1.logInfo)(`File uploaded successfully: ${filePath}`);
            return urlData.publicUrl;
        }
        catch (error) {
            (0, common_1.logError)(error, 'File upload failed');
            throw error;
        }
    }
    // Get allowed file types for each directory
    getAllowedTypesForDirectory(directory) {
        switch (directory) {
            case 'audio':
                return ['mp3', 'wav', 'm4a', 'ogg', 'aac'];
            case 'video':
                return ['mp4', 'avi', 'mov', 'webm', 'mkv'];
            case 'avatars':
                return ['jpg', 'jpeg', 'png', 'gif', 'webp'];
            case 'transcripts':
                return ['txt', 'md'];
            default:
                return ['mp3', 'wav', 'm4a', 'ogg', 'mp4', 'avi', 'mov', 'webm'];
        }
    }
    // Download file from storage
    async downloadFile(filePath) {
        try {
            const { data, error } = await supabase_1.supabase.storage
                .from(this.bucketName)
                .download(filePath);
            if (error) {
                throw error;
            }
            return Buffer.from(await data.arrayBuffer());
        }
        catch (error) {
            (0, common_1.logError)(error, 'File download failed');
            throw error;
        }
    }
    // Delete file from storage
    async deleteFile(filePath) {
        try {
            const { error } = await supabase_1.supabase.storage
                .from(this.bucketName)
                .remove([filePath]);
            if (error) {
                throw error;
            }
            (0, common_1.logInfo)(`File deleted successfully: ${filePath}`);
            return true;
        }
        catch (error) {
            (0, common_1.logError)(error, 'File deletion failed');
            throw error;
        }
    }
    // Get signed URL for secure access
    async getSignedUrl(filePath, expiresIn = 3600) {
        try {
            const { data, error } = await supabase_1.supabase.storage
                .from(this.bucketName)
                .createSignedUrl(filePath, expiresIn);
            if (error) {
                throw error;
            }
            return data.signedUrl;
        }
        catch (error) {
            (0, common_1.logError)(error, 'Failed to generate signed URL');
            throw error;
        }
    }
    // List files in directory
    async listFiles(directory) {
        try {
            const { data, error } = await supabase_1.supabase.storage
                .from(this.bucketName)
                .list(directory);
            if (error) {
                throw error;
            }
            return data.map(file => `${directory}/${file.name}`);
        }
        catch (error) {
            (0, common_1.logError)(error, 'Failed to list files');
            throw error;
        }
    }
    // Check if storage is available
    async isStorageAvailable() {
        try {
            const { data, error } = await supabase_1.supabase.storage.listBuckets();
            if (error) {
                return false;
            }
            return data.some(bucket => bucket.name === this.bucketName);
        }
        catch (error) {
            return false;
        }
    }
    // Extract file path from URL
    extractFilePathFromUrl(url) {
        try {
            const urlObj = new URL(url);
            const pathParts = urlObj.pathname.split('/');
            const bucketIndex = pathParts.findIndex(part => part === this.bucketName);
            if (bucketIndex === -1) {
                return null;
            }
            return pathParts.slice(bucketIndex + 1).join('/');
        }
        catch (error) {
            return null;
        }
    }
    // Get file info
    async getFileInfo(filePath) {
        try {
            const { data, error } = await supabase_1.supabase.storage
                .from(this.bucketName)
                .list(filePath.split('/').slice(0, -1).join('/'));
            if (error) {
                throw error;
            }
            const fileName = filePath.split('/').pop();
            const fileInfo = data.find(file => file.name === fileName);
            return fileInfo;
        }
        catch (error) {
            (0, common_1.logError)(error, 'Failed to get file info');
            throw error;
        }
    }
    async uploadBuffer(buffer, filePath, contentType, encrypt = true) {
        // TODO: Use Supabase Storage API to upload buffer
        // This is a placeholder; actual implementation may vary
        const supabaseUrl = process.env.SUPABASE_URL || '';
        const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
        const supabase = (0, supabase_js_1.createClient)(supabaseUrl, supabaseKey);
        const bucket = 'videos';
        const fileName = filePath || `videos/${(0, uuid_1.v4)()}.mp4`;
        const options = {
            contentType,
            upsert: true,
            // Encryption at rest is handled by Supabase Storage config
        };
        const { data, error } = await supabase.storage.from(bucket).upload(fileName, buffer, options);
        if (error)
            throw error;
        // Return public or signed URL as needed
        const { publicURL } = supabase.storage.from(bucket).getPublicUrl(fileName);
        return publicURL;
    }
}
exports.StorageService = StorageService;
exports.storageService = new StorageService();
//# sourceMappingURL=storage.js.map