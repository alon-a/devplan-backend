import { MoodAnalysis } from '../common';
import { logInfo, logError } from '../common';

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

export class TemplateSelectorService {
  private readonly defaultTemplateId = 'default-therapist';

  /**
   * Suggest the best template based on mood analysis
   */
  suggestTemplate(moodAnalysis: MoodAnalysis): TemplateSuggestion {
    try {
      logInfo('Starting template suggestion process', {
        overallMood: moodAnalysis.overall_mood,
        confidenceScore: moodAnalysis.confidence_score,
        emotionCount: moodAnalysis.emotions?.length || 0
      });

      // Extract factors for template selection
      const factors = this.extractSelectionFactors(moodAnalysis);

      // Apply selection logic
      const suggestion = this.applySelectionLogic(factors);

      logInfo('Template suggestion completed', {
        suggestedTemplateId: suggestion.templateId,
        confidence: suggestion.confidence,
        reasoning: suggestion.reasoning
      });

      return suggestion;

    } catch (error) {
      logError(error as Error, 'Template suggestion failed, using default');
      
      return {
        templateId: this.defaultTemplateId,
        confidence: 0.0,
        reasoning: 'Default template used due to analysis error',
        fallbackUsed: true
      };
    }
  }

  /**
   * Extract key factors from mood analysis for template selection
   */
  private extractSelectionFactors(moodAnalysis: MoodAnalysis) {
    const factors = {
      overallMood: moodAnalysis.overall_mood,
      confidenceScore: moodAnalysis.confidence_score,
      sentimentScore: moodAnalysis.sentiment_score,
      primaryEmotion: this.getPrimaryEmotion(moodAnalysis.emotions),
      intensityLevel: this.calculateIntensityLevel(moodAnalysis),
      riskIndicators: moodAnalysis.risk_indicators?.length || 0,
      keyThemes: moodAnalysis.key_themes || []
    };

    logInfo('Extracted selection factors', factors);
    return factors;
  }

  /**
   * Get the primary emotion from the emotions array
   */
  private getPrimaryEmotion(emotions: any[]): string {
    if (!emotions || emotions.length === 0) {
      return 'neutral';
    }

    // Find emotion with highest intensity
    const primaryEmotion = emotions.reduce((prev, current) => 
      (current.intensity > prev.intensity) ? current : prev
    );

    return primaryEmotion.name;
  }

  /**
   * Calculate intensity level based on confidence and sentiment scores
   */
  private calculateIntensityLevel(moodAnalysis: MoodAnalysis): 'low' | 'medium' | 'high' {
    const avgIntensity = (moodAnalysis.confidence_score + Math.abs(moodAnalysis.sentiment_score)) / 2;
    
    if (avgIntensity < 0.3) return 'low';
    if (avgIntensity < 0.7) return 'medium';
    return 'high';
  }

  /**
   * Apply template selection logic based on extracted factors
   */
  private applySelectionLogic(factors: any): TemplateSuggestion {
    let templateId: string;
    let confidence: number;
    let reasoning: string;

    // High-risk indicators require specialized support template
    if (factors.riskIndicators > 0) {
      templateId = 'crisis-support-therapist';
      confidence = 0.95;
      reasoning = 'Risk indicators detected - using crisis support template';
    }
    // High positive sentiment with joy/excitement
    else if (factors.overallMood === 'positive' && factors.sentimentScore > 0.6 && 
             ['joy', 'excitement', 'happiness'].includes(factors.primaryEmotion)) {
      templateId = 'motivational-coach';
      confidence = 0.85;
      reasoning = 'High positive sentiment with joy - using motivational coach template';
    }
    // High negative sentiment with sadness/anxiety
    else if (factors.overallMood === 'negative' && factors.sentimentScore < -0.6 && 
             ['sadness', 'anxiety', 'stress'].includes(factors.primaryEmotion)) {
      templateId = 'empathetic-therapist';
      confidence = 0.90;
      reasoning = 'High negative sentiment with distress - using empathetic therapist template';
    }
    // Medium negative sentiment
    else if (factors.overallMood === 'negative' && factors.sentimentScore < -0.2) {
      templateId = 'supportive-counselor';
      confidence = 0.80;
      reasoning = 'Moderate negative sentiment - using supportive counselor template';
    }
    // Neutral mood with low intensity
    else if (factors.overallMood === 'neutral' && factors.intensityLevel === 'low') {
      templateId = 'life-coach';
      confidence = 0.75;
      reasoning = 'Neutral mood with low intensity - using life coach template';
    }
    // Work-related themes
    else if (factors.keyThemes.some((theme: string) => ['work', 'career', 'professional'].includes(theme))) {
      templateId = 'career-counselor';
      confidence = 0.85;
      reasoning = 'Work-related themes detected - using career counselor template';
    }
    // Family-related themes
    else if (factors.keyThemes.some((theme: string) => ['family', 'relationship', 'marriage'].includes(theme))) {
      templateId = 'family-therapist';
      confidence = 0.85;
      reasoning = 'Family-related themes detected - using family therapist template';
    }
    // Health-related themes
    else if (factors.keyThemes.some((theme: string) => ['health', 'wellness', 'fitness'].includes(theme))) {
      templateId = 'wellness-coach';
      confidence = 0.80;
      reasoning = 'Health-related themes detected - using wellness coach template';
    }
    // Default case - general therapist
    else {
      templateId = 'general-therapist';
      confidence = 0.70;
      reasoning = 'General mood profile - using general therapist template';
    }

    return {
      templateId,
      confidence,
      reasoning,
      fallbackUsed: false
    };
  }

  /**
   * Validate if a template ID is valid
   */
  async validateTemplateId(templateId: string, availableTemplates: Template[]): Promise<boolean> {
    if (!templateId || !availableTemplates) {
      return false;
    }

    const isValid = availableTemplates.some(template => 
      template.id === templateId && template.is_active
    );

    logInfo('Template validation result', {
      templateId,
      isValid,
      availableTemplatesCount: availableTemplates.length
    });

    return isValid;
  }

  /**
   * Get fallback template ID if the selected one is invalid
   */
  getFallbackTemplateId(availableTemplates: Template[]): string {
    // Try to find a general therapist template first
    const generalTemplate = availableTemplates.find(template => 
      template.is_active && template.category === 'general'
    );

    if (generalTemplate) {
      return generalTemplate.id;
    }

    // Fallback to first active template
    const firstActiveTemplate = availableTemplates.find(template => template.is_active);
    
    if (firstActiveTemplate) {
      return firstActiveTemplate.id;
    }

    // Ultimate fallback
    return this.defaultTemplateId;
  }

  /**
   * Get template selection reasoning for user feedback
   */
  getSelectionReasoning(moodAnalysis: MoodAnalysis, selectedTemplateId: string, suggestedTemplateId: string): string {
    if (selectedTemplateId === suggestedTemplateId) {
      return 'Template selected based on your mood analysis';
    }

    const factors = this.extractSelectionFactors(moodAnalysis);
    
    if (factors.riskIndicators > 0) {
      return 'Note: Risk indicators were detected in your dialogue. Consider speaking with a mental health professional.';
    }

    return 'You selected a different template than suggested. The system will adapt to your preference.';
  }
}

export const templateSelectorService = new TemplateSelectorService(); 
