import { MoodAnalysis } from '@devplan/common';
interface AnalysisResult {
    transcript: string;
    language: 'english' | 'hebrew' | 'unknown';
    moodAnalysis: MoodAnalysis;
    confidence: number;
    apiUsed: 'elevenlabs' | 'google' | 'fallback';
    processingTime: number;
    metadata: {
        retryCount: number;
        fallbackUsed: boolean;
        neutralFallbackApplied: boolean;
        languageOverride: boolean;
    };
}
export declare class SpeechToTextMoodAnalysisService {
    private readonly maxRetries;
    private readonly retryDelayMs;
    /**
     * Main method to process audio and perform speech-to-text and mood analysis
     */
    analyzeAudio(audioBuffer: Buffer, originalLanguage?: string): Promise<AnalysisResult>;
    /**
     * Try ElevenLabs API for transcription and sentiment analysis
     */
    private tryElevenLabsAnalysis;
    /**
     * Try Google AI Studio API as fallback
     */
    private tryGoogleAIAnalysis;
    /**
     * Call ElevenLabs Speech-to-Text API
     */
    private callElevenLabsTranscription;
    /**
     * Call ElevenLabs Sentiment Analysis API
     */
    private callElevenLabsSentiment;
    /**
     * Call Google AI Speech-to-Text API
     */
    private callGoogleAITranscription;
    /**
     * Call Google AI Sentiment Analysis API
     */
    private callGoogleAISentiment;
    /**
     * Detect language from transcript text
     */
    private detectLanguage;
    /**
     * Map sentiment to numerical score
     */
    private mapSentimentToScore;
    /**
     * Map Google sentiment score to mood
     */
    private mapGoogleSentimentToMood;
    /**
     * Map Google sentiment to emotions
     */
    private mapGoogleSentimentToEmotions;
    /**
     * Extract key themes from transcript
     */
    private extractKeyThemes;
    /**
     * Detect risk indicators in transcript
     */
    private detectRiskIndicators;
    /**
     * Generate recommendations based on mood and emotions
     */
    private generateRecommendations;
    /**
     * Apply neutral fallback to mood analysis
     */
    private applyNeutralFallback;
    /**
     * Create neutral mood analysis for fallback
     */
    private createNeutralMoodAnalysis;
    /**
     * Utility method for delays
     */
    private delay;
}
export declare const speechToTextMoodAnalysisService: SpeechToTextMoodAnalysisService;
export {};
//# sourceMappingURL=speechToTextMoodAnalysisService.d.ts.map