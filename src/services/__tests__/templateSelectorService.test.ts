import { templateSelectorService, TemplateSuggestion, Template } from '../templateSelectorService';
import { MoodAnalysis } from '../../common/src';

describe('TemplateSelectorService', () => {
  const mockTemplates: Template[] = [
    {
      id: 'general-therapist',
      name: 'General Therapist',
      description: 'A general therapeutic approach',
      category: 'general',
      avatar_url: 'https://example.com/avatar1.jpg',
      voice_id: 'voice1',
      is_active: true,
      metadata: {
        mood_profile: ['neutral', 'mixed'],
        intensity_level: 'medium',
        therapeutic_focus: ['general', 'support']
      }
    },
    {
      id: 'empathetic-therapist',
      name: 'Empathetic Therapist',
      description: 'Specialized in emotional support',
      category: 'emotional',
      avatar_url: 'https://example.com/avatar2.jpg',
      voice_id: 'voice2',
      is_active: true,
      metadata: {
        mood_profile: ['negative', 'sadness', 'anxiety'],
        intensity_level: 'high',
        therapeutic_focus: ['emotional-support', 'empathy']
      }
    },
    {
      id: 'motivational-coach',
      name: 'Motivational Coach',
      description: 'Focused on positive reinforcement',
      category: 'motivational',
      avatar_url: 'https://example.com/avatar3.jpg',
      voice_id: 'voice3',
      is_active: true,
      metadata: {
        mood_profile: ['positive', 'joy', 'excitement'],
        intensity_level: 'high',
        therapeutic_focus: ['motivation', 'goal-setting']
      }
    },
    {
      id: 'crisis-support-therapist',
      name: 'Crisis Support Therapist',
      description: 'Specialized in crisis intervention',
      category: 'crisis',
      avatar_url: 'https://example.com/avatar4.jpg',
      voice_id: 'voice4',
      is_active: true,
      metadata: {
        mood_profile: ['crisis', 'risk'],
        intensity_level: 'high',
        therapeutic_focus: ['crisis-intervention', 'safety']
      }
    },
    {
      id: 'inactive-template',
      name: 'Inactive Template',
      description: 'This template is inactive',
      category: 'test',
      avatar_url: 'https://example.com/avatar5.jpg',
      voice_id: 'voice5',
      is_active: false
    }
  ];

  describe('suggestTemplate', () => {
    it('should suggest crisis support template for high-risk indicators', () => {
      const moodAnalysis: MoodAnalysis = {
        overall_mood: 'negative',
        confidence_score: 0.8,
        sentiment_score: -0.7,
        emotions: [
          { name: 'sadness', intensity: 0.9 },
          { name: 'anxiety', intensity: 0.8 }
        ],
        risk_indicators: ['self-harm', 'suicidal-thoughts'],
        key_themes: ['hopelessness', 'despair'],
        language: 'english',
        therapeutic_recommendations: ['immediate-professional-help']
      };

      const suggestion = templateSelectorService.suggestTemplate(moodAnalysis);

      expect(suggestion.templateId).toBe('crisis-support-therapist');
      expect(suggestion.confidence).toBe(0.95);
      expect(suggestion.reasoning).toContain('Risk indicators detected');
      expect(suggestion.fallbackUsed).toBe(false);
    });

    it('should suggest motivational coach for high positive sentiment', () => {
      const moodAnalysis: MoodAnalysis = {
        overall_mood: 'positive',
        confidence_score: 0.9,
        sentiment_score: 0.8,
        emotions: [
          { name: 'joy', intensity: 0.9 },
          { name: 'excitement', intensity: 0.8 }
        ],
        risk_indicators: [],
        key_themes: ['success', 'achievement'],
        language: 'english',
        therapeutic_recommendations: ['continue-positive-mindset']
      };

      const suggestion = templateSelectorService.suggestTemplate(moodAnalysis);

      expect(suggestion.templateId).toBe('motivational-coach');
      expect(suggestion.confidence).toBe(0.85);
      expect(suggestion.reasoning).toContain('High positive sentiment with joy');
      expect(suggestion.fallbackUsed).toBe(false);
    });

    it('should suggest empathetic therapist for high negative sentiment', () => {
      const moodAnalysis: MoodAnalysis = {
        overall_mood: 'negative',
        confidence_score: 0.8,
        sentiment_score: -0.8,
        emotions: [
          { name: 'sadness', intensity: 0.9 },
          { name: 'anxiety', intensity: 0.7 }
        ],
        risk_indicators: [],
        key_themes: ['loneliness', 'stress'],
        language: 'english',
        therapeutic_recommendations: ['emotional-support']
      };

      const suggestion = templateSelectorService.suggestTemplate(moodAnalysis);

      expect(suggestion.templateId).toBe('empathetic-therapist');
      expect(suggestion.confidence).toBe(0.90);
      expect(suggestion.reasoning).toContain('High negative sentiment with distress');
      expect(suggestion.fallbackUsed).toBe(false);
    });

    it('should suggest general therapist for neutral mood', () => {
      const moodAnalysis: MoodAnalysis = {
        overall_mood: 'neutral',
        confidence_score: 0.6,
        sentiment_score: 0.1,
        emotions: [
          { name: 'neutral', intensity: 0.5 }
        ],
        risk_indicators: [],
        key_themes: ['daily-life', 'routine'],
        language: 'english',
        therapeutic_recommendations: ['general-support']
      };

      const suggestion = templateSelectorService.suggestTemplate(moodAnalysis);

      expect(suggestion.templateId).toBe('general-therapist');
      expect(suggestion.confidence).toBe(0.70);
      expect(suggestion.reasoning).toContain('General mood profile');
      expect(suggestion.fallbackUsed).toBe(false);
    });

    it('should handle missing emotions gracefully', () => {
      const moodAnalysis: MoodAnalysis = {
        overall_mood: 'neutral',
        confidence_score: 0.5,
        sentiment_score: 0.0,
        emotions: [],
        risk_indicators: [],
        key_themes: [],
        language: 'english',
        therapeutic_recommendations: []
      };

      const suggestion = templateSelectorService.suggestTemplate(moodAnalysis);

      expect(suggestion.templateId).toBe('general-therapist');
      expect(suggestion.fallbackUsed).toBe(false);
    });

    it('should use fallback template on error', () => {
      // Mock a scenario that would cause an error
      const invalidMoodAnalysis = null as any;

      const suggestion = templateSelectorService.suggestTemplate(invalidMoodAnalysis);

      expect(suggestion.templateId).toBe('default-therapist');
      expect(suggestion.confidence).toBe(0.0);
      expect(suggestion.reasoning).toContain('Default template used due to analysis error');
      expect(suggestion.fallbackUsed).toBe(true);
    });
  });

  describe('validateTemplateId', () => {
    it('should return true for valid active template', async () => {
      const isValid = await templateSelectorService.validateTemplateId('general-therapist', mockTemplates);
      expect(isValid).toBe(true);
    });

    it('should return false for inactive template', async () => {
      const isValid = await templateSelectorService.validateTemplateId('inactive-template', mockTemplates);
      expect(isValid).toBe(false);
    });

    it('should return false for non-existent template', async () => {
      const isValid = await templateSelectorService.validateTemplateId('non-existent-template', mockTemplates);
      expect(isValid).toBe(false);
    });

    it('should return false for empty template ID', async () => {
      const isValid = await templateSelectorService.validateTemplateId('', mockTemplates);
      expect(isValid).toBe(false);
    });

    it('should return false for null template ID', async () => {
      const isValid = await templateSelectorService.validateTemplateId(null as any, mockTemplates);
      expect(isValid).toBe(false);
    });

    it('should return false for empty templates array', async () => {
      const isValid = await templateSelectorService.validateTemplateId('general-therapist', []);
      expect(isValid).toBe(false);
    });
  });

  describe('getFallbackTemplateId', () => {
    it('should return general template if available', () => {
      const fallbackId = templateSelectorService.getFallbackTemplateId(mockTemplates);
      expect(fallbackId).toBe('general-therapist');
    });

    it('should return first active template if no general template', () => {
      const templatesWithoutGeneral = mockTemplates.filter(t => t.category !== 'general');
      const fallbackId = templateSelectorService.getFallbackTemplateId(templatesWithoutGeneral);
      expect(fallbackId).toBe('empathetic-therapist');
    });

    it('should return default template if no active templates', () => {
      const inactiveTemplates = mockTemplates.map(t => ({ ...t, is_active: false }));
      const fallbackId = templateSelectorService.getFallbackTemplateId(inactiveTemplates);
      expect(fallbackId).toBe('default-therapist');
    });

    it('should return default template for empty array', () => {
      const fallbackId = templateSelectorService.getFallbackTemplateId([]);
      expect(fallbackId).toBe('default-therapist');
    });
  });

  describe('getSelectionReasoning', () => {
    const mockMoodAnalysis: MoodAnalysis = {
      overall_mood: 'negative',
      confidence_score: 0.8,
      sentiment_score: -0.6,
      emotions: [{ name: 'sadness', intensity: 0.8 }],
      risk_indicators: [],
      key_themes: ['stress'],
      language: 'english',
      therapeutic_recommendations: ['support']
    };

    it('should return confirmation message when selected matches suggested', () => {
      const reasoning = templateSelectorService.getSelectionReasoning(
        mockMoodAnalysis,
        'empathetic-therapist',
        'empathetic-therapist'
      );
      expect(reasoning).toBe('Template selected based on your mood analysis');
    });

    it('should return override message when selected differs from suggested', () => {
      const reasoning = templateSelectorService.getSelectionReasoning(
        mockMoodAnalysis,
        'motivational-coach',
        'empathetic-therapist'
      );
      expect(reasoning).toBe('You selected a different template than suggested. The system will adapt to your preference.');
    });

    it('should include risk warning when risk indicators are present', () => {
      const moodAnalysisWithRisk: MoodAnalysis = {
        ...mockMoodAnalysis,
        risk_indicators: ['self-harm']
      };

      const reasoning = templateSelectorService.getSelectionReasoning(
        moodAnalysisWithRisk,
        'general-therapist',
        'crisis-support-therapist'
      );
      expect(reasoning).toContain('Risk indicators were detected');
      expect(reasoning).toContain('mental health professional');
    });
  });

  describe('template selection edge cases', () => {
    it('should handle work-related themes', () => {
      const moodAnalysis: MoodAnalysis = {
        overall_mood: 'neutral',
        confidence_score: 0.7,
        sentiment_score: 0.2,
        emotions: [{ name: 'neutral', intensity: 0.6 }],
        risk_indicators: [],
        key_themes: ['work', 'career', 'professional'],
        language: 'english',
        therapeutic_recommendations: ['career-guidance']
      };

      const suggestion = templateSelectorService.suggestTemplate(moodAnalysis);
      expect(suggestion.templateId).toBe('career-counselor');
      expect(suggestion.reasoning).toContain('Work-related themes detected');
    });

    it('should handle family-related themes', () => {
      const moodAnalysis: MoodAnalysis = {
        overall_mood: 'negative',
        confidence_score: 0.8,
        sentiment_score: -0.4,
        emotions: [{ name: 'stress', intensity: 0.7 }],
        risk_indicators: [],
        key_themes: ['family', 'relationship', 'marriage'],
        language: 'english',
        therapeutic_recommendations: ['family-therapy']
      };

      const suggestion = templateSelectorService.suggestTemplate(moodAnalysis);
      expect(suggestion.templateId).toBe('family-therapist');
      expect(suggestion.reasoning).toContain('Family-related themes detected');
    });

    it('should handle health-related themes', () => {
      const moodAnalysis: MoodAnalysis = {
        overall_mood: 'positive',
        confidence_score: 0.6,
        sentiment_score: 0.3,
        emotions: [{ name: 'optimism', intensity: 0.6 }],
        risk_indicators: [],
        key_themes: ['health', 'wellness', 'fitness'],
        language: 'english',
        therapeutic_recommendations: ['wellness-coaching']
      };

      const suggestion = templateSelectorService.suggestTemplate(moodAnalysis);
      expect(suggestion.templateId).toBe('wellness-coach');
      expect(suggestion.reasoning).toContain('Health-related themes detected');
    });
  });
}); 
