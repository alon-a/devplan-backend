export type VideoProvider = 'D-ID' | 'JOGG';
export type VideoStatus = 'pending' | 'processing' | 'completed' | 'failed';
export interface VideoGenerationPayload {
    transcript: string;
    moodAnalysis: any;
    templateMetadata: any;
}
export interface VideoGenerationResult {
    videoUrl: string;
    provider: VideoProvider;
    status: VideoStatus;
    errorMessage?: string;
    duration?: number;
    providerResponse?: any;
}
export declare function generateAvatarVideo(payload: VideoGenerationPayload, userId: string, dialogueId: string, templateId: string, videoId: string): Promise<VideoGenerationResult>;
//# sourceMappingURL=videoGenerationService.d.ts.map