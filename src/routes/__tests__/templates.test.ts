import request from 'supertest';
import { app } from '../../app';
import { supabase } from '../../database/supabase';
import { createTestUser, generateAuthToken } from '../testUtils';

describe('Templates Routes', () => {
  let authToken: string;
  let testUser: any;

  const mockTemplates = [
    {
      id: 'general-therapist',
      name: 'General Therapist',
      description: 'A general therapeutic approach for various concerns',
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
      description: 'Specialized in emotional support and empathy',
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
      description: 'Focused on positive reinforcement and goal achievement',
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
      id: 'inactive-template',
      name: 'Inactive Template',
      description: 'This template is inactive',
      category: 'test',
      avatar_url: 'https://example.com/avatar4.jpg',
      voice_id: 'voice4',
      is_active: false
    }
  ];

  beforeAll(async () => {
    testUser = await createTestUser();
    authToken = generateAuthToken(testUser.id);

    // Insert mock templates
    for (const template of mockTemplates) {
      await supabase
        .from('templates')
        .upsert(template, { onConflict: 'id' });
    }
  });

  afterAll(async () => {
    // Clean up test data
    await supabase
      .from('templates')
      .delete()
      .in('id', mockTemplates.map(t => t.id));
    
    await supabase
      .from('users')
      .delete()
      .eq('id', testUser.id);
  });

  describe('GET /api/templates', () => {
    it('should return all active templates', async () => {
      const response = await request(app)
        .get('/api/templates')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.templates).toBeDefined();
      expect(Array.isArray(response.body.templates)).toBe(true);
      expect(response.body.count).toBe(3); // Only active templates
      
      const activeTemplates = response.body.templates.filter((t: any) => t.is_active);
      expect(activeTemplates).toHaveLength(3);
      
      // Check template structure
      const template = activeTemplates[0];
      expect(template).toHaveProperty('id');
      expect(template).toHaveProperty('name');
      expect(template).toHaveProperty('description');
      expect(template).toHaveProperty('category');
      expect(template).toHaveProperty('avatar_url');
      expect(template).toHaveProperty('voice_id');
      expect(template).toHaveProperty('is_active');
      expect(template).toHaveProperty('metadata');
    });

    it('should return 401 without authentication', async () => {
      await request(app)
        .get('/api/templates')
        .expect(401);
    });

    it('should handle database errors gracefully', async () => {
      // Mock database error by temporarily changing the table name
      const originalQuery = supabase.from;
      supabase.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockRejectedValue(new Error('Database connection failed'))
          })
        })
      });

      const response = await request(app)
        .get('/api/templates')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(500);

      expect(response.body.error).toBe('Failed to fetch templates');
      
      // Restore original function
      supabase.from = originalQuery;
    });
  });

  describe('GET /api/templates/:id', () => {
    it('should return specific template by ID', async () => {
      const response = await request(app)
        .get('/api/templates/general-therapist')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.template).toBeDefined();
      expect(response.body.template.id).toBe('general-therapist');
      expect(response.body.template.name).toBe('General Therapist');
      expect(response.body.template.is_active).toBe(true);
    });

    it('should return 404 for non-existent template', async () => {
      const response = await request(app)
        .get('/api/templates/non-existent-template')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body.error).toBe('Template not found');
    });

    it('should return 404 for inactive template', async () => {
      const response = await request(app)
        .get('/api/templates/inactive-template')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body.error).toBe('Template not found');
    });

    it('should return 401 without authentication', async () => {
      await request(app)
        .get('/api/templates/general-therapist')
        .expect(401);
    });
  });

  describe('GET /api/templates/suggest/:dialogueId', () => {
    let testDialogue: any;

    beforeAll(async () => {
      // Create a test dialogue with analysis
      const { data: dialogue } = await supabase
        .from('dialogues')
        .insert({
          user_id: testUser.id,
          title: 'Test Dialogue for Template Suggestion',
          content: 'This is a test dialogue content',
          status: 'analyzed',
          analysis_status: 'completed',
          language: 'english',
          analysis: {
            overall_mood: 'negative',
            confidence_score: 0.8,
            sentiment_score: -0.6,
            emotions: [
              { name: 'sadness', intensity: 0.8 },
              { name: 'anxiety', intensity: 0.6 }
            ],
            risk_indicators: [],
            key_themes: ['stress', 'work'],
            language: 'english',
            therapeutic_recommendations: ['emotional-support']
          }
        })
        .select()
        .single();

      testDialogue = dialogue;
    });

    afterAll(async () => {
      if (testDialogue) {
        await supabase
          .from('dialogues')
          .delete()
          .eq('id', testDialogue.id);
      }
    });

    it('should return template suggestion based on mood analysis', async () => {
      const response = await request(app)
        .get(`/api/templates/suggest/${testDialogue.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.suggestion).toBeDefined();
      expect(response.body.suggestion.templateId).toBeDefined();
      expect(response.body.suggestion.confidence).toBeGreaterThan(0);
      expect(response.body.suggestion.reasoning).toBeDefined();
      expect(response.body.suggestion.fallbackUsed).toBeDefined();
      expect(response.body.availableTemplates).toBe(3);
      expect(response.body.dialogueAnalysisStatus).toBe('completed');
    });

    it('should return 404 for non-existent dialogue', async () => {
      const response = await request(app)
        .get('/api/templates/suggest/non-existent-dialogue-id')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body.error).toBe('Dialogue not found');
    });

    it('should return 400 for dialogue without analysis', async () => {
      // Create dialogue without analysis
      const { data: dialogueWithoutAnalysis } = await supabase
        .from('dialogues')
        .insert({
          user_id: testUser.id,
          title: 'Dialogue Without Analysis',
          content: 'This dialogue has no analysis',
          status: 'draft',
          analysis_status: 'pending',
          language: 'english'
        })
        .select()
        .single();

      const response = await request(app)
        .get(`/api/templates/suggest/${dialogueWithoutAnalysis.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body.error).toBe('Analysis not available');
      expect(response.body.message).toContain('Mood analysis must be completed');

      // Clean up
      await supabase
        .from('dialogues')
        .delete()
        .eq('id', dialogueWithoutAnalysis.id);
    });

    it('should return 500 when no templates are available', async () => {
      // Temporarily deactivate all templates
      await supabase
        .from('templates')
        .update({ is_active: false })
        .in('id', mockTemplates.map(t => t.id));

      const response = await request(app)
        .get(`/api/templates/suggest/${testDialogue.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(500);

      expect(response.body.error).toBe('No templates available');

      // Reactivate templates
      await supabase
        .from('templates')
        .update({ is_active: true })
        .in('id', mockTemplates.map(t => t.id));
    });

    it('should return 401 without authentication', async () => {
      await request(app)
        .get(`/api/templates/suggest/${testDialogue.id}`)
        .expect(401);
    });
  });

  describe('Template suggestion edge cases', () => {
    it('should handle crisis indicators appropriately', async () => {
      // Create dialogue with crisis indicators
      const { data: crisisDialogue } = await supabase
        .from('dialogues')
        .insert({
          user_id: testUser.id,
          title: 'Crisis Dialogue',
          content: 'This dialogue contains crisis indicators',
          status: 'analyzed',
          analysis_status: 'completed',
          language: 'english',
          analysis: {
            overall_mood: 'negative',
            confidence_score: 0.9,
            sentiment_score: -0.8,
            emotions: [
              { name: 'despair', intensity: 0.9 },
              { name: 'hopelessness', intensity: 0.8 }
            ],
            risk_indicators: ['self-harm', 'suicidal-thoughts'],
            key_themes: ['hopelessness', 'despair'],
            language: 'english',
            therapeutic_recommendations: ['immediate-professional-help']
          }
        })
        .select()
        .single();

      const response = await request(app)
        .get(`/api/templates/suggest/${crisisDialogue.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Should suggest crisis support template
      expect(response.body.suggestion.templateId).toBe('crisis-support-therapist');
      expect(response.body.suggestion.confidence).toBe(0.95);

      // Clean up
      await supabase
        .from('dialogues')
        .delete()
        .eq('id', crisisDialogue.id);
    });

    it('should handle positive sentiment appropriately', async () => {
      // Create dialogue with positive sentiment
      const { data: positiveDialogue } = await supabase
        .from('dialogues')
        .insert({
          user_id: testUser.id,
          title: 'Positive Dialogue',
          content: 'This dialogue has positive sentiment',
          status: 'analyzed',
          analysis_status: 'completed',
          language: 'english',
          analysis: {
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
          }
        })
        .select()
        .single();

      const response = await request(app)
        .get(`/api/templates/suggest/${positiveDialogue.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Should suggest motivational coach
      expect(response.body.suggestion.templateId).toBe('motivational-coach');
      expect(response.body.suggestion.confidence).toBe(0.85);

      // Clean up
      await supabase
        .from('dialogues')
        .delete()
        .eq('id', positiveDialogue.id);
    });
  });
}); 