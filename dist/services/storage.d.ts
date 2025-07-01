export declare class StorageService {
    private bucketName;
    initializeBuckets(): Promise<void>;
    private createDirectory;
    uploadFile(file: Express.Multer.File, userId: string, directory?: 'audio' | 'video' | 'avatars' | 'transcripts'): Promise<string>;
    private getAllowedTypesForDirectory;
    downloadFile(filePath: string): Promise<Buffer>;
    deleteFile(filePath: string): Promise<boolean>;
    getSignedUrl(filePath: string, expiresIn?: number): Promise<string>;
    listFiles(directory: string): Promise<string[]>;
    isStorageAvailable(): Promise<boolean>;
    extractFilePathFromUrl(url: string): string | null;
    getFileInfo(filePath: string): Promise<import("@supabase/storage-js").FileObject | undefined>;
    uploadBuffer(buffer: Buffer, filePath: string, contentType: string, encrypt?: boolean): Promise<string>;
}
export declare const storageService: StorageService;
//# sourceMappingURL=storage.d.ts.map