import config from '../config';
import { logError, logInfo } from '../../common/src';
import { MoodAnalysis, Emotion } from '../../common/src';

// API Response Types
interface ElevenLabsTranscriptionResponse {
  text: string;
  confidence: number;
  language?: string;
}

interface ElevenLabsSentimentResponse {
  sentiment: 'positive' | 'negative' | 'neutral';
  confidence: number;
  emotions: Array<{
    name: string;
    intensity: number;
  }>;
}

interface GoogleAITranscriptionResponse {
  results: Array<{
    alternatives: Array<{
      transcript: string;
      confidence: number;
    }>;
  }>;
  languageCode?: string;
}

interface GoogleAISentimentResponse {
  documentSentiment: {
    score: number;
    magnitude: number;
  };
  sentences: Array<{
    text: {
      content: string;
    };
    sentiment: {
      score: number;
      magnitude: number;
    };
  }>;
}

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

export class SpeechToTextMoodAnalysisService {
  private readonly maxRetries = 2;
  private readonly retryDelayMs = 1000;

  /**
   * Main method to process audio and perform speech-to-text and mood analysis
   */
  async analyzeAudio(audioBuffer: Buffer, originalLanguage?: string): Promise<AnalysisResult> {
    const startTime = Date.now();
    let retryCount = 0;
    let fallbackUsed = false;
    let neutralFallbackApplied = false;
    let languageOverride = false;

    try {
      // Try ElevenLabs first
      let result = await this.tryElevenLabsAnalysis(audioBuffer, retryCount);
      
      if (!result) {
        // Fallback to Google AI Studio
        fallbackUsed = true;
        result = await this.tryGoogleAIAnalysis(audioBuffer, retryCount);
      }

      if (!result) {
        throw new Error('All API providers failed');
      }

      // Detect language and check for override
      const detectedLanguage = this.detectLanguage(result.transcript);
      if (originalLanguage && originalLanguage !== 'unknown' && detectedLanguage !== originalLanguage) {
        languageOverride = true;
        logInfo(`Language override detected: ${originalLanguage} -> ${detectedLanguage}`);
      }

      // Apply neutral fallback if confidence is low
      if (result.confidence < 0.6) {
        neutralFallbackApplied = true;
        result.moodAnalysis = this.applyNeutralFallback(result.moodAnalysis);
        logInfo('Low confidence detected, applying neutral fallback');
      }

      const processingTime = Date.now() - startTime;

      return {
        transcript: result.transcript,
        language: detectedLanguage,
        moodAnalysis: result.moodAnalysis,
        confidence: result.confidence,
        apiUsed: fallbackUsed ? 'google' : 'elevenlabs',
        processingTime,
        metadata: {
          retryCount,
          fallbackUsed,
          neutralFallbackApplied,
          languageOverride
        }
      };

    } catch (error) {
      logError(error as Error, 'Audio analysis failed completely');
      
      // Return neutral fallback result
      return {
        transcript: '',
        language: 'unknown',
        moodAnalysis: this.createNeutralMoodAnalysis(),
        confidence: 0,
        apiUsed: 'fallback',
        processingTime: Date.now() - startTime,
        metadata: {
          retryCount,
          fallbackUsed: true,
          neutralFallbackApplied: true,
          languageOverride: false
        }
      };
    }
  }

  /**
   * Try ElevenLabs API for transcription and sentiment analysis
   */
  private async tryElevenLabsAnalysis(audioBuffer: Buffer, retryCount: number): Promise<{
    transcript: string;
    moodAnalysis: MoodAnalysis;
    confidence: number;
  } | null> {
    if (!config.ELEVENLABS_API_KEY) {
      logError(new Error('ElevenLabs API key not configured'), 'ElevenLabs analysis skipped');
      return null;
    }

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        logInfo(`Attempting ElevenLabs analysis (attempt ${attempt + 1})`);

        // Step 1: Speech-to-Text
        const transcription = await this.callElevenLabsTranscription(audioBuffer);
        
        if (!transcription || !transcription.text) {
          throw new Error('No transcript received from ElevenLabs');
        }

        // Step 2: Sentiment Analysis
        const sentiment = await this.callElevenLabsSentiment(transcription.text);
        
        if (!sentiment) {
          throw new Error('No sentiment analysis received from ElevenLabs');
        }

        const moodAnalysis: MoodAnalysis = {
          overall_mood: sentiment.sentiment,
          confidence_score: sentiment.confidence,
          emotions: sentiment.emotions.map(emotion => ({
            name: emotion.name,
            intensity: emotion.intensity,
            confidence: sentiment.confidence
          })),
          sentiment_score: this.mapSentimentToScore(sentiment.sentiment),
          key_themes: this.extractKeyThemes(transcription.text),
          risk_indicators: this.detectRiskIndicators(transcription.text),
          recommendations: this.generateRecommendations(sentiment.sentiment, sentiment.emotions.map(emotion => ({
            name: emotion.name,
            intensity: emotion.intensity,
            confidence: sentiment.confidence
          })))
        };

        return {
          transcript: transcription.text,
          moodAnalysis,
          confidence: transcription.confidence
        };

      } catch (error) {
        logError(error as Error, `ElevenLabs analysis attempt ${attempt + 1} failed`);
        
        if (attempt < this.maxRetries) {
          await this.delay(this.retryDelayMs * Math.pow(2, attempt));
        }
      }
    }

    return null;
  }

  /**
   * Try Google AI Studio API as fallback
   */
  private async tryGoogleAIAnalysis(audioBuffer: Buffer, retryCount: number): Promise<{
    transcript: string;
    moodAnalysis: MoodAnalysis;
    confidence: number;
  } | null> {
    if (!config.GOOGLE_AI_STUDIO_API_KEY) {
      logError(new Error('Google AI Studio API key not configured'), 'Google AI analysis skipped');
      return null;
    }

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        logInfo(`Attempting Google AI analysis (attempt ${attempt + 1})`);

        // Step 1: Speech-to-Text
        const transcription = await this.callGoogleAITranscription(audioBuffer);
        
        if (!transcription || !transcription.results || transcription.results.length === 0) {
          throw new Error('No transcript received from Google AI');
        }

        const transcript = transcription.results
          .map(result => result.alternatives[0]?.transcript)
          .filter(Boolean)
          .join(' ');

        if (!transcript) {
          throw new Error('Empty transcript from Google AI');
        }

        // Step 2: Sentiment Analysis
        const sentiment = await this.callGoogleAISentiment(transcript);
        
        if (!sentiment) {
          throw new Error('No sentiment analysis received from Google AI');
        }

        const moodAnalysis: MoodAnalysis = {
          overall_mood: this.mapGoogleSentimentToMood(sentiment.documentSentiment.score),
          confidence_score: Math.abs(sentiment.documentSentiment.score),
          emotions: this.mapGoogleSentimentToEmotions(sentiment.documentSentiment),
          sentiment_score: sentiment.documentSentiment.score,
          key_themes: this.extractKeyThemes(transcript),
          risk_indicators: this.detectRiskIndicators(transcript),
          recommendations: this.generateRecommendations(
            this.mapGoogleSentimentToMood(sentiment.documentSentiment.score),
            this.mapGoogleSentimentToEmotions(sentiment.documentSentiment)
          )
        };

        const confidence = transcription.results[0]?.alternatives[0]?.confidence || 0.5;

        return {
          transcript,
          moodAnalysis,
          confidence
        };

      } catch (error) {
        logError(error as Error, `Google AI analysis attempt ${attempt + 1} failed`);
        
        if (attempt < this.maxRetries) {
          await this.delay(this.retryDelayMs * Math.pow(2, attempt));
        }
      }
    }

    return null;
  }

  /**
   * Call ElevenLabs Speech-to-Text API
   */
  private async callElevenLabsTranscription(audioBuffer: Buffer): Promise<ElevenLabsTranscriptionResponse | null> {
    try {
      // TODO: Replace with actual ElevenLabs API call
      // This is a placeholder implementation
      const response = await fetch('https://api.elevenlabs.io/v1/speech-to-text', {
        method: 'POST',
        headers: {
          'xi-api-key': config.ELEVENLABS_API_KEY,
          'Content-Type': 'audio/wav'
        },
        body: audioBuffer
      });

      if (!response.ok) {
        throw new Error(`ElevenLabs transcription failed: ${response.status}`);
      }

      const data = await response.json();
      return data as ElevenLabsTranscriptionResponse;

    } catch (error) {
      logError(error as Error, 'ElevenLabs transcription API call failed');
      return null;
    }
  }

  /**
   * Call ElevenLabs Sentiment Analysis API
   */
  private async callElevenLabsSentiment(text: string): Promise<ElevenLabsSentimentResponse | null> {
    try {
      // TODO: Replace with actual ElevenLabs sentiment API call
      // This is a placeholder implementation
      const response = await fetch('https://api.elevenlabs.io/v1/sentiment-analysis', {
        method: 'POST',
        headers: {
          'xi-api-key': config.ELEVENLABS_API_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ text })
      });

      if (!response.ok) {
        throw new Error(`ElevenLabs sentiment analysis failed: ${response.status}`);
      }

      const data = await response.json();
      return data as ElevenLabsSentimentResponse;

    } catch (error) {
      logError(error as Error, 'ElevenLabs sentiment analysis API call failed');
      return null;
    }
  }

  /**
   * Call Google AI Speech-to-Text API
   */
  private async callGoogleAITranscription(audioBuffer: Buffer): Promise<GoogleAITranscriptionResponse | null> {
    try {
      // TODO: Replace with actual Google AI API call
      // This is a placeholder implementation
      const response = await fetch('https://speech.googleapis.com/v1/speech:recognize', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.GOOGLE_AI_STUDIO_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          audio: {
            content: audioBuffer.toString('base64')
          },
          config: {
            encoding: 'LINEAR16',
            sampleRateHertz: 16000,
            languageCode: 'en-US'
          }
        })
      });

      if (!response.ok) {
        throw new Error(`Google AI transcription failed: ${response.status}`);
      }

      const data = await response.json();
      return data as GoogleAITranscriptionResponse;

    } catch (error) {
      logError(error as Error, 'Google AI transcription API call failed');
      return null;
    }
  }

  /**
   * Call Google AI Sentiment Analysis API
   */
  private async callGoogleAISentiment(text: string): Promise<GoogleAISentimentResponse | null> {
    try {
      // TODO: Replace with actual Google AI sentiment API call
      // This is a placeholder implementation
      const response = await fetch('https://language.googleapis.com/v1/documents:analyzeSentiment', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.GOOGLE_AI_STUDIO_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          document: {
            type: 'PLAIN_TEXT',
            content: text
          }
        })
      });

      if (!response.ok) {
        throw new Error(`Google AI sentiment analysis failed: ${response.status}`);
      }

      const data = await response.json();
      return data as GoogleAISentimentResponse;

    } catch (error) {
      logError(error as Error, 'Google AI sentiment analysis API call failed');
      return null;
    }
  }

  /**
   * Detect language from transcript text
   */
  private detectLanguage(text: string): 'english' | 'hebrew' | 'unknown' {
    const hebrewPattern = /[\u0590-\u05FF]/;
    const englishPattern = /[a-zA-Z]/;
    
    if (hebrewPattern.test(text)) {
      return 'hebrew';
    } else if (englishPattern.test(text)) {
      return 'english';
    }
    
    return 'unknown';
  }

  /**
   * Map sentiment to numerical score
   */
  private mapSentimentToScore(sentiment: string): number {
    switch (sentiment) {
      case 'positive': return 0.8;
      case 'negative': return -0.8;
      case 'neutral': return 0.0;
      default: return 0.0;
    }
  }

  /**
   * Map Google sentiment score to mood
   */
  private mapGoogleSentimentToMood(score: number): 'positive' | 'negative' | 'neutral' {
    if (score > 0.1) return 'positive';
    if (score < -0.1) return 'negative';
    return 'neutral';
  }

  /**
   * Map Google sentiment to emotions
   */
  private mapGoogleSentimentToEmotions(documentSentiment: any): Emotion[] {
    const emotions: Emotion[] = [];
    
    if (documentSentiment.score > 0.3) {
      emotions.push({ name: 'joy', intensity: documentSentiment.score, confidence: 0.8 });
    } else if (documentSentiment.score < -0.3) {
      emotions.push({ name: 'sadness', intensity: Math.abs(documentSentiment.score), confidence: 0.8 });
    } else {
      emotions.push({ name: 'neutral', intensity: 0.5, confidence: 0.6 });
    }

    return emotions;
  }

  /**
   * Extract key themes from transcript
   */
  private extractKeyThemes(text: string): string[] {
    // TODO: Implement more sophisticated theme extraction
    // This is a simple placeholder implementation
    const words = text.toLowerCase().split(/\s+/);
    const commonThemes = ['work', 'family', 'health', 'stress', 'happiness', 'anxiety', 'success', 'failure'];
    
    return commonThemes.filter(theme => 
      words.some(word => word.includes(theme))
    ).slice(0, 3);
  }

  /**
   * Detect risk indicators in transcript
   */
  private detectRiskIndicators(text: string): string[] {
    // TODO: Implement risk detection logic
    // This is a placeholder implementation
    const riskKeywords = ['suicide', 'harm', 'danger', 'hopeless', 'worthless'];
    const lowerText = text.toLowerCase();
    
    return riskKeywords.filter(keyword => 
      lowerText.includes(keyword)
    );
  }

  /**
   * Generate recommendations based on mood and emotions
   */
  private generateRecommendations(mood: string, emotions: Emotion[]): string[] {
    const recommendations: string[] = [];
    
    switch (mood) {
      case 'positive':
        recommendations.push('Continue with current positive practices');
        recommendations.push('Share your positive experiences with others');
        break;
      case 'negative':
        recommendations.push('Consider speaking with a mental health professional');
        recommendations.push('Practice self-care and stress management techniques');
        break;
      case 'neutral':
        recommendations.push('Explore activities that bring you joy');
        recommendations.push('Consider setting new goals or challenges');
        break;
    }

    return recommendations.slice(0, 3);
  }

  /**
   * Apply neutral fallback to mood analysis
   */
  private applyNeutralFallback(moodAnalysis: MoodAnalysis): MoodAnalysis {
    return {
      ...moodAnalysis,
      overall_mood: 'neutral',
      confidence_score: 0.5,
      emotions: [{ name: 'neutral', intensity: 0.5, confidence: 0.5 }],
      sentiment_score: 0.0,
      recommendations: ['Consider re-recording with clearer audio', 'Try speaking more slowly and clearly']
    };
  }

  /**
   * Create neutral mood analysis for fallback
   */
  private createNeutralMoodAnalysis(): MoodAnalysis {
    return {
      overall_mood: 'neutral',
      confidence_score: 0.0,
      emotions: [{ name: 'neutral', intensity: 0.5, confidence: 0.0 }],
      sentiment_score: 0.0,
      key_themes: [],
      risk_indicators: [],
      recommendations: ['Unable to analyze audio. Please try re-recording with clearer audio.']
    };
  }

  /**
   * Utility method for delays
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export const speechToTextMoodAnalysisService = new SpeechToTextMoodAnalysisService();
