import { SpeechToTextMoodAnalysisService } from '../speechToTextMoodAnalysisService';
import { MoodAnalysis } from '../../common/src';

// Mock fetch
global.fetch = jest.fn();

describe('SpeechToTextMoodAnalysisService', () => {
  let service: SpeechToTextMoodAnalysisService;
  let mockAudioBuffer: Buffer;

  beforeEach(() => {
    service = new SpeechToTextMoodAnalysisService();
    mockAudioBuffer = Buffer.from('mock audio data');
    (fetch as jest.Mock).mockClear();
  });

  describe('analyzeAudio', () => {
    it('should successfully analyze audio with ElevenLabs', async () => {
      const mockElevenLabsTranscriptionResponse = {
        text: 'Hello, this is a test transcript',
        confidence: 0.95,
        language: 'en'
      };

      const mockElevenLabsSentimentResponse = {
        sentiment: 'positive',
        confidence: 0.88,
        emotions: [
          { name: 'joy', intensity: 0.8 },
          { name: 'excitement', intensity: 0.6 }
        ]
      };

      (fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockElevenLabsTranscriptionResponse
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockElevenLabsSentimentResponse
        });

      const result = await service.analyzeAudio(mockAudioBuffer, 'english');

      expect(result.transcript).toBe('Hello, this is a test transcript');
      expect(result.language).toBe('english');
      expect(result.apiUsed).toBe('elevenlabs');
      expect(result.confidence).toBe(0.95);
      expect(result.moodAnalysis.overall_mood).toBe('positive');
      expect(result.moodAnalysis.confidence_score).toBe(0.88);
      expect(result.moodAnalysis.emotions).toHaveLength(2);
      expect(result.metadata.fallbackUsed).toBe(false);
      expect(result.metadata.neutralFallbackApplied).toBe(false);
    });

    it('should fallback to Google AI when ElevenLabs fails', async () => {
      const mockGoogleTranscriptionResponse = {
        results: [{
          alternatives: [{
            transcript: 'Google transcript test',
            confidence: 0.92
          }]
        }]
      };

      const mockGoogleSentimentResponse = {
        documentSentiment: {
          score: 0.7,
          magnitude: 1.2
        },
        sentences: []
      };

      // ElevenLabs fails
      (fetch as jest.Mock)
        .mockRejectedValueOnce(new Error('ElevenLabs API error'))
        // Google AI succeeds
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockGoogleTranscriptionResponse
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockGoogleSentimentResponse
        });

      const result = await service.analyzeAudio(mockAudioBuffer, 'english');

      expect(result.transcript).toBe('Google transcript test');
      expect(result.apiUsed).toBe('google');
      expect(result.metadata.fallbackUsed).toBe(true);
      expect(result.moodAnalysis.overall_mood).toBe('positive');
    });

    it('should apply neutral fallback when confidence is low', async () => {
      const mockLowConfidenceResponse = {
        text: 'Low confidence transcript',
        confidence: 0.3,
        language: 'en'
      };

      const mockSentimentResponse = {
        sentiment: 'neutral',
        confidence: 0.4,
        emotions: [{ name: 'neutral', intensity: 0.5 }]
      };

      (fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockLowConfidenceResponse
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockSentimentResponse
        });

      const result = await service.analyzeAudio(mockAudioBuffer, 'english');

      expect(result.confidence).toBe(0.3);
      expect(result.metadata.neutralFallbackApplied).toBe(true);
      expect(result.moodAnalysis.overall_mood).toBe('neutral');
      expect(result.moodAnalysis.confidence_score).toBe(0.5);
    });

    it('should detect language override correctly', async () => {
      const mockResponse = {
        text: 'שלום, זה טקסט בעברית',
        confidence: 0.95,
        language: 'he'
      };

      const mockSentimentResponse = {
        sentiment: 'positive',
        confidence: 0.8,
        emotions: [{ name: 'joy', intensity: 0.7 }]
      };

      (fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockResponse
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockSentimentResponse
        });

      const result = await service.analyzeAudio(mockAudioBuffer, 'english');

      expect(result.language).toBe('hebrew');
      expect(result.metadata.languageOverride).toBe(true);
    });

    it('should return fallback result when all APIs fail', async () => {
      // Both APIs fail
      (fetch as jest.Mock)
        .mockRejectedValue(new Error('API error'));

      const result = await service.analyzeAudio(mockAudioBuffer, 'english');

      expect(result.apiUsed).toBe('fallback');
      expect(result.transcript).toBe('');
      expect(result.language).toBe('unknown');
      expect(result.confidence).toBe(0);
      expect(result.moodAnalysis.overall_mood).toBe('neutral');
      expect(result.metadata.fallbackUsed).toBe(true);
      expect(result.metadata.neutralFallbackApplied).toBe(true);
    });

    it('should retry failed API calls', async () => {
      const mockResponse = {
        text: 'Retry test transcript',
        confidence: 0.9,
        language: 'en'
      };

      const mockSentimentResponse = {
        sentiment: 'positive',
        confidence: 0.85,
        emotions: [{ name: 'joy', intensity: 0.8 }]
      };

      // First attempt fails, second succeeds
      (fetch as jest.Mock)
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockResponse
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockSentimentResponse
        });

      const result = await service.analyzeAudio(mockAudioBuffer, 'english');

      expect(result.transcript).toBe('Retry test transcript');
      expect(result.apiUsed).toBe('elevenlabs');
      expect(fetch).toHaveBeenCalledTimes(3); // 2 retries + 1 success
    });
  });

  describe('language detection', () => {
    it('should detect Hebrew text correctly', async () => {
      const mockResponse = {
        text: 'שלום עולם, איך אתה?',
        confidence: 0.95
      };

      const mockSentimentResponse = {
        sentiment: 'positive',
        confidence: 0.8,
        emotions: [{ name: 'joy', intensity: 0.7 }]
      };

      (fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockResponse
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockSentimentResponse
        });

      const result = await service.analyzeAudio(mockAudioBuffer, 'unknown');

      expect(result.language).toBe('hebrew');
    });

    it('should detect English text correctly', async () => {
      const mockResponse = {
        text: 'Hello world, how are you?',
        confidence: 0.95
      };

      const mockSentimentResponse = {
        sentiment: 'positive',
        confidence: 0.8,
        emotions: [{ name: 'joy', intensity: 0.7 }]
      };

      (fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockResponse
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockSentimentResponse
        });

      const result = await service.analyzeAudio(mockAudioBuffer, 'unknown');

      expect(result.language).toBe('english');
    });

    it('should return unknown for unrecognized text', async () => {
      const mockResponse = {
        text: '1234567890 !@#$%^&*()',
        confidence: 0.95
      };

      const mockSentimentResponse = {
        sentiment: 'neutral',
        confidence: 0.5,
        emotions: [{ name: 'neutral', intensity: 0.5 }]
      };

      (fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockResponse
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockSentimentResponse
        });

      const result = await service.analyzeAudio(mockAudioBuffer, 'unknown');

      expect(result.language).toBe('unknown');
    });
  });

  describe('error handling', () => {
    it('should handle API timeout errors', async () => {
      (fetch as jest.Mock).mockRejectedValue(new Error('Request timeout'));

      const result = await service.analyzeAudio(mockAudioBuffer, 'english');

      expect(result.apiUsed).toBe('fallback');
      expect(result.moodAnalysis.recommendations).toContain('Unable to analyze audio');
    });

    it('should handle invalid API responses', async () => {
      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ invalid: 'response' })
      });

      const result = await service.analyzeAudio(mockAudioBuffer, 'english');

      expect(result.apiUsed).toBe('fallback');
    });

    it('should handle HTTP error responses', async () => {
      (fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests'
      });

      const result = await service.analyzeAudio(mockAudioBuffer, 'english');

      expect(result.apiUsed).toBe('fallback');
    });
  });

  describe('mood analysis processing', () => {
    it('should extract key themes from transcript', async () => {
      const mockResponse = {
        text: 'I am stressed about work and family issues',
        confidence: 0.95
      };

      const mockSentimentResponse = {
        sentiment: 'negative',
        confidence: 0.8,
        emotions: [{ name: 'stress', intensity: 0.8 }]
      };

      (fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockResponse
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockSentimentResponse
        });

      const result = await service.analyzeAudio(mockAudioBuffer, 'english');

      expect(result.moodAnalysis.key_themes).toContain('work');
      expect(result.moodAnalysis.key_themes).toContain('family');
      expect(result.moodAnalysis.overall_mood).toBe('negative');
    });

    it('should detect risk indicators', async () => {
      const mockResponse = {
        text: 'I feel hopeless and worthless',
        confidence: 0.95
      };

      const mockSentimentResponse = {
        sentiment: 'negative',
        confidence: 0.9,
        emotions: [{ name: 'sadness', intensity: 0.9 }]
      };

      (fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockResponse
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockSentimentResponse
        });

      const result = await service.analyzeAudio(mockAudioBuffer, 'english');

      expect(result.moodAnalysis.risk_indicators).toContain('hopeless');
      expect(result.moodAnalysis.risk_indicators).toContain('worthless');
      expect(result.moodAnalysis.recommendations).toContain('Consider speaking with a mental health professional');
    });
  });
}); 
