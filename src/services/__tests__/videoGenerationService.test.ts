import { generateAvatarVideo, VideoProvider, VideoStatus } from '../videoGenerationService';
import axios from 'axios';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

// Mock storage service
jest.mock('../storage', () => ({
  storageService: {
    uploadBuffer: jest.fn().mockResolvedValue('https://storage.example.com/video.mp4')
  }
}));

// Mock supabase
jest.mock('../../database/supabase', () => ({
  supabase: {
    from: jest.fn().mockReturnValue({
      update: jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({ data: null, error: null })
      })
    })
  }
}));

describe('VideoGenerationService', () => {
  const mockPayload = {
    transcript: 'Hello, this is a test transcript.',
    moodAnalysis: {
      overall_mood: 'positive',
      sentiment_score: 0.8,
      emotions: [{ name: 'joy', intensity: 0.9 }]
    },
    templateMetadata: {
      avatar_style: 'professional',
      voice_id: 'voice123'
    }
  };

  const mockUserId = 'user123';
  const mockDialogueId = 'dialogue123';
  const mockTemplateId = 'template123';
  const mockVideoId = 'video123';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('generateAvatarVideo', () => {
    it('should successfully generate video using D-ID API', async () => {
      // Mock successful D-ID API response
      mockedAxios.post.mockResolvedValueOnce({
        data: {
          video_url: 'https://d-id.com/video123.mp4',
          status: 'completed'
        }
      });

      // Mock successful video download
      mockedAxios.get.mockResolvedValueOnce({
        data: Buffer.from('fake video data'),
        responseType: 'arraybuffer'
      });

      const result = await generateAvatarVideo(
        mockPayload,
        mockUserId,
        mockDialogueId,
        mockTemplateId,
        mockVideoId
      );

      expect(result.provider).toBe('D-ID');
      expect(result.status).toBe('completed');
      expect(result.videoUrl).toBe('https://storage.example.com/video.mp4');
      expect(result.errorMessage).toBeUndefined();
    });

    it('should fallback to JOGG when D-ID fails', async () => {
      // Mock D-ID API failure
      mockedAxios.post.mockRejectedValueOnce(new Error('D-ID API unavailable'));

      // Mock successful JOGG API response
      mockedAxios.post.mockResolvedValueOnce({
        data: {
          video_url: 'https://jogg.ai/video456.mp4',
          status: 'completed'
        }
      });

      // Mock successful video download
      mockedAxios.get.mockResolvedValueOnce({
        data: Buffer.from('fake video data'),
        responseType: 'arraybuffer'
      });

      const result = await generateAvatarVideo(
        mockPayload,
        mockUserId,
        mockDialogueId,
        mockTemplateId,
        mockVideoId
      );

      expect(result.provider).toBe('JOGG');
      expect(result.status).toBe('completed');
      expect(result.videoUrl).toBe('https://storage.example.com/video.mp4');
      expect(result.errorMessage).toBeUndefined();
    });

    it('should handle both providers failing', async () => {
      // Mock both APIs failing
      mockedAxios.post.mockRejectedValue(new Error('API unavailable'));

      const result = await generateAvatarVideo(
        mockPayload,
        mockUserId,
        mockDialogueId,
        mockTemplateId,
        mockVideoId
      );

      expect(result.status).toBe('failed');
      expect(result.videoUrl).toBe('');
      expect(result.errorMessage).toContain('Both video providers failed');
    });

    it('should handle storage upload failure', async () => {
      // Mock successful D-ID API response
      mockedAxios.post.mockResolvedValueOnce({
        data: {
          video_url: 'https://d-id.com/video123.mp4',
          status: 'completed'
        }
      });

      // Mock video download failure
      mockedAxios.get.mockRejectedValue(new Error('Download failed'));

      const result = await generateAvatarVideo(
        mockPayload,
        mockUserId,
        mockDialogueId,
        mockTemplateId,
        mockVideoId
      );

      expect(result.status).toBe('failed');
      expect(result.errorMessage).toContain('Download failed');
    });

    it('should handle missing video URL from provider', async () => {
      // Mock D-ID API response without video URL
      mockedAxios.post.mockResolvedValueOnce({
        data: {
          status: 'completed'
          // Missing video_url
        }
      });

      const result = await generateAvatarVideo(
        mockPayload,
        mockUserId,
        mockDialogueId,
        mockTemplateId,
        mockVideoId
      );

      expect(result.status).toBe('failed');
      expect(result.errorMessage).toContain('did not return a video URL');
    });

    it('should use JOGG avatar settings when falling back', async () => {
      // Mock D-ID failure
      mockedAxios.post.mockRejectedValueOnce(new Error('D-ID failed'));

      // Mock JOGG success
      mockedAxios.post.mockResolvedValueOnce({
        data: {
          video_url: 'https://jogg.ai/video.mp4'
        }
      });

      mockedAxios.get.mockResolvedValueOnce({
        data: Buffer.from('fake video data'),
        responseType: 'arraybuffer'
      });

      await generateAvatarVideo(
        mockPayload,
        mockUserId,
        mockDialogueId,
        mockTemplateId,
        mockVideoId
      );

      // Verify JOGG API was called with avatar settings
      expect(mockedAxios.post).toHaveBeenCalledWith(
        expect.stringContaining('/generate-video'),
        expect.objectContaining({
          avatar_settings: {
            style: 'professional',
            expression: 'positive',
            voice_tone: 0.8
          }
        }),
        expect.any(Object)
      );
    });

    it('should handle timeout scenarios', async () => {
      // Mock timeout error
      mockedAxios.post.mockRejectedValue(new Error('timeout of 120000ms exceeded'));

      const result = await generateAvatarVideo(
        mockPayload,
        mockUserId,
        mockDialogueId,
        mockTemplateId,
        mockVideoId
      );

      expect(result.status).toBe('failed');
      expect(result.errorMessage).toContain('timeout');
    });
  });
}); 