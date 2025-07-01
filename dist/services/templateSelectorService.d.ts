import { MoodAnalysis } from '@devplan/common';
export interface TemplateSuggestion {
    templateId: string;
    confidence: number;
    reasoning: string;
    fallbackUsed: boolean;
}
export interface Template {
    id: string;
    name: string;
    description: string;
    category: string;
    avatar_url: string;
    voice_id: string;
    is_active: boolean;
    metadata?: {
        mood_profile?: string[];
        intensity_level?: 'low' | 'medium' | 'high';
        therapeutic_focus?: string[];
        preview_url?: string;
    };
}
export declare class TemplateSelectorService {
    private readonly defaultTemplateId;
    /**
     * Suggest a psychological template based on mood and sentiment analysis
     */
    suggestTemplate(moodAnalysis: MoodAnalysis): TemplateSuggestion;
    /**
     * Extract key factors from mood analysis for template selection
     */
    private extractSelectionFactors;
    /**
     * Get the primary emotion from the emotions array
     */
    private getPrimaryEmotion;
    /**
     * Calculate intensity level based on confidence and sentiment scores
     */
    private calculateIntensityLevel;
    /**
     * Apply template selection logic based on extracted factors
     */
    private applySelectionLogic;
    /**
     * Validate if a template ID is valid
     */
    validateTemplateId(templateId: string, availableTemplates: Template[]): Promise<boolean>;
    /**
     * Get fallback template ID if the selected one is invalid
     */
    getFallbackTemplateId(availableTemplates: Template[]): string;
    /**
     * Get template selection reasoning for user feedback
     */
    getSelectionReasoning(moodAnalysis: MoodAnalysis, selectedTemplateId: string, suggestedTemplateId: string): string;
}
export declare const templateSelectorService: TemplateSelectorService;
//# sourceMappingURL=templateSelectorService.d.ts.map