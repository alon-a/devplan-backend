import request from 'supertest';
import { app } from '../../app';
import { supabase } from '../../database/supabase';
import { speechToTextMoodAnalysisService } from '../../services/speechToTextMoodAnalysisService';

// Mock the analysis service
jest.mock('../../services/speechToTextMoodAnalysisService');
const mockAnalysisService = speechToTextMoodAnalysisService as jest.Mocked<typeof speechToTextMoodAnalysisService>;

// Mock Supabase
jest.mock('../../database/supabase');
const mockSupabase = supabase as jest.Mocked<typeof supabase>;

describe('Dialogues API - Analysis Integration', () => {
  let authToken: string;
  let testUserId: string;

  beforeEach(async () => {
    // Setup test user and authentication
    testUserId = 'test-user-id';
    authToken = 'test-auth-token';

    // Mock authentication middleware
    jest.spyOn(require('../../middleware/auth'), 'authenticateToken').mockImplementation((req, res, next) => {
      req.user = { id: testUserId };
      next();
    });

    jest.spyOn(require('../../middleware/auth'), 'requireOwnership').mockImplementation(() => (req, res, next) => {
      next();
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/dialogues/upload', () => {
    it('should trigger analysis for audio file upload', async () => {
      const mockDialogue = {
        id: 'test-dialogue-id',
        user_id: testUserId,
        title: 'Test Audio',
        content: '',
        audio_url: 'https://example.com/audio.wav',
        status: 'draft',
        analysis_status: 'pending',
        language: 'unknown',
        created_at: new Date(),
        updated_at: new Date()
      };

      const mockAnalysisResult = {
        transcript: 'Hello, this is a test transcript',
        language: 'english' as const,
        moodAnalysis: {
          overall_mood: 'positive' as const,
          confidence_score: 0.9,
          emotions: [{ name: 'joy', intensity: 0.8, confidence: 0.9 }],
          sentiment_score: 0.8,
          key_themes: ['test'],
          risk_indicators: [],
          recommendations: ['Continue positive practices']
        },
        confidence: 0.9,
        apiUsed: 'elevenlabs' as const,
        processingTime: 1500,
        metadata: {
          retryCount: 0,
          fallbackUsed: false,
          neutralFallbackApplied: false,
          languageOverride: false
        }
      };

      // Mock Supabase responses
      mockSupabase.from.mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: mockDialogue, error: null })
          })
        }),
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ error: null })
        })
      } as any);

      // Mock analysis service
      mockAnalysisService.analyzeAudio.mockResolvedValue(mockAnalysisResult);

      const response = await request(app)
        .post('/api/dialogues/upload')
        .set('Authorization', `Bearer ${authToken}`)
        .field('title', 'Test Audio')
        .field('content', 'Test content')
        .field('input_type', 'file')
        .attach('file', Buffer.from('mock audio data'), 'test.wav');

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.dialogue).toBeDefined();

      // Verify analysis was triggered
      expect(mockAnalysisService.analyzeAudio).toHaveBeenCalledWith(
        expect.any(Buffer),
        'unknown'
      );
    });

    it('should handle analysis failure gracefully', async () => {
      const mockDialogue = {
        id: 'test-dialogue-id',
        user_id: testUserId,
        title: 'Test Audio',
        content: '',
        audio_url: 'https://example.com/audio.wav',
        status: 'draft',
        analysis_status: 'pending',
        language: 'unknown',
        created_at: new Date(),
        updated_at: new Date()
      };

      // Mock Supabase responses
      mockSupabase.from.mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: mockDialogue, error: null })
          })
        }),
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ error: null })
        })
      } as any);

      // Mock analysis service to fail
      mockAnalysisService.analyzeAudio.mockRejectedValue(new Error('Analysis failed'));

      const response = await request(app)
        .post('/api/dialogues/upload')
        .set('Authorization', `Bearer ${authToken}`)
        .field('title', 'Test Audio')
        .field('content', 'Test content')
        .field('input_type', 'file')
        .attach('file', Buffer.from('mock audio data'), 'test.wav');

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);

      // Verify analysis was attempted
      expect(mockAnalysisService.analyzeAudio).toHaveBeenCalled();
    });
  });

  describe('POST /api/dialogues/record', () => {
    it('should trigger analysis for audio recording', async () => {
      const mockDialogue = {
        id: 'test-dialogue-id',
        user_id: testUserId,
        title: 'Test Recording',
        content: '',
        audio_url: 'https://example.com/recording.wav',
        status: 'draft',
        analysis_status: 'pending',
        language: 'unknown',
        created_at: new Date(),
        updated_at: new Date()
      };

      const mockAnalysisResult = {
        transcript: 'This is a recorded message',
        language: 'english' as const,
        moodAnalysis: {
          overall_mood: 'neutral' as const,
          confidence_score: 0.7,
          emotions: [{ name: 'neutral', intensity: 0.5, confidence: 0.7 }],
          sentiment_score: 0.0,
          key_themes: ['message'],
          risk_indicators: [],
          recommendations: ['Explore activities that bring you joy']
        },
        confidence: 0.7,
        apiUsed: 'google' as const,
        processingTime: 2000,
        metadata: {
          retryCount: 0,
          fallbackUsed: true,
          neutralFallbackApplied: false,
          languageOverride: false
        }
      };

      // Mock Supabase responses
      mockSupabase.from.mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: mockDialogue, error: null })
          })
        }),
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ error: null })
        })
      } as any);

      // Mock analysis service
      mockAnalysisService.analyzeAudio.mockResolvedValue(mockAnalysisResult);

      const response = await request(app)
        .post('/api/dialogues/record')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Test Recording',
          audio_data: Buffer.from('mock audio data').toString('base64')
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.dialogue).toBeDefined();

      // Verify analysis was triggered
      expect(mockAnalysisService.analyzeAudio).toHaveBeenCalledWith(
        expect.any(Buffer),
        'unknown'
      );
    });
  });

  describe('GET /api/dialogues/:id/analysis', () => {
    it('should return analysis results when available', async () => {
      const mockDialogue = {
        id: 'test-dialogue-id',
        user_id: testUserId,
        title: 'Test Dialogue',
        transcript: 'Hello, this is a test transcript',
        mood_analysis: {
          overall_mood: 'positive',
          confidence_score: 0.9,
          emotions: [{ name: 'joy', intensity: 0.8, confidence: 0.9 }],
          sentiment_score: 0.8,
          key_themes: ['test'],
          risk_indicators: [],
          recommendations: ['Continue positive practices']
        },
        analysis_status: 'completed',
        language: 'english',
        analysis_metadata: {
          api_used: 'elevenlabs',
          processing_time: 1500,
          confidence: 0.9,
          analyzed_at: new Date().toISOString()
        },
        created_at: new Date(),
        updated_at: new Date()
      };

      // Mock Supabase response
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: mockDialogue, error: null })
          })
        })
      } as any);

      const response = await request(app)
        .get('/api/dialogues/test-dialogue-id/analysis')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.dialogue.transcript).toBe('Hello, this is a test transcript');
      expect(response.body.data.dialogue.mood_analysis.overall_mood).toBe('positive');
      expect(response.body.data.dialogue.analysis_status).toBe('completed');
      expect(response.body.data.dialogue.language).toBe('english');
    });

    it('should return 404 when analysis is not available', async () => {
      const mockDialogue = {
        id: 'test-dialogue-id',
        user_id: testUserId,
        title: 'Test Dialogue',
        mood_analysis: null,
        analysis_status: 'pending',
        created_at: new Date(),
        updated_at: new Date()
      };

      // Mock Supabase response
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: mockDialogue, error: null })
          })
        })
      } as any);

      const response = await request(app)
        .get('/api/dialogues/test-dialogue-id/analysis')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Analysis not available or still processing');
    });

    it('should return 404 when dialogue not found', async () => {
      // Mock Supabase response for not found
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: null, error: { message: 'Not found' } })
          })
        })
      } as any);

      const response = await request(app)
        .get('/api/dialogues/non-existent-id/analysis')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Dialogue not found');
    });
  });

  describe('Analysis Status Updates', () => {
    it('should update analysis status to processing when analysis starts', async () => {
      const mockDialogue = {
        id: 'test-dialogue-id',
        user_id: testUserId,
        title: 'Test Audio',
        content: '',
        audio_url: 'https://example.com/audio.wav',
        status: 'draft',
        analysis_status: 'pending',
        language: 'unknown',
        created_at: new Date(),
        updated_at: new Date()
      };

      // Mock Supabase responses
      mockSupabase.from.mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: mockDialogue, error: null })
          })
        }),
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ error: null })
        })
      } as any);

      // Mock analysis service to delay
      mockAnalysisService.analyzeAudio.mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
        return {
          transcript: 'Test transcript',
          language: 'english' as const,
          moodAnalysis: {
            overall_mood: 'positive' as const,
            confidence_score: 0.9,
            emotions: [{ name: 'joy', intensity: 0.8, confidence: 0.9 }],
            sentiment_score: 0.8,
            key_themes: ['test'],
            risk_indicators: [],
            recommendations: ['Continue positive practices']
          },
          confidence: 0.9,
          apiUsed: 'elevenlabs' as const,
          processingTime: 1500,
          metadata: {
            retryCount: 0,
            fallbackUsed: false,
            neutralFallbackApplied: false,
            languageOverride: false
          }
        };
      });

      const response = await request(app)
        .post('/api/dialogues/upload')
        .set('Authorization', `Bearer ${authToken}`)
        .field('title', 'Test Audio')
        .field('content', 'Test content')
        .field('input_type', 'file')
        .attach('file', Buffer.from('mock audio data'), 'test.wav');

      expect(response.status).toBe(201);

      // Verify status updates were called
      expect(mockSupabase.from).toHaveBeenCalledWith('dialogues');
      expect(mockSupabase.from().update).toHaveBeenCalled();
    });

    it('should update analysis status to failed when analysis fails', async () => {
      const mockDialogue = {
        id: 'test-dialogue-id',
        user_id: testUserId,
        title: 'Test Audio',
        content: '',
        audio_url: 'https://example.com/audio.wav',
        status: 'draft',
        analysis_status: 'pending',
        language: 'unknown',
        created_at: new Date(),
        updated_at: new Date()
      };

      // Mock Supabase responses
      mockSupabase.from.mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: mockDialogue, error: null })
          })
        }),
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ error: null })
        })
      } as any);

      // Mock analysis service to fail
      mockAnalysisService.analyzeAudio.mockRejectedValue(new Error('Analysis failed'));

      const response = await request(app)
        .post('/api/dialogues/upload')
        .set('Authorization', `Bearer ${authToken}`)
        .field('title', 'Test Audio')
        .field('content', 'Test content')
        .field('input_type', 'file')
        .attach('file', Buffer.from('mock audio data'), 'test.wav');

      expect(response.status).toBe(201);

      // Wait for async analysis to complete
      await new Promise(resolve => setTimeout(resolve, 200));

      // Verify failure status update was called
      expect(mockSupabase.from().update).toHaveBeenCalledWith(
        expect.objectContaining({
          analysis_status: 'failed',
          analysis_metadata: expect.objectContaining({
            error: 'Analysis failed'
          })
        })
      );
    });
  });
}); 