import { supabase } from '../database/supabase';
import { storageService } from './storage';
import { logInfo, logError } from '../common';
import axios from 'axios';

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

const D_ID_API_URL = process.env.DID_API_URL || '';
const D_ID_API_KEY = process.env.DID_API_KEY || '';
const JOGG_API_URL = process.env.JOGG_API_URL || 'https://app.jogg.ai/api';
const JOGG_API_KEY = process.env.JOGG_API_KEY || '';
const VIDEO_GEN_TIMEOUT_MS = 120000; // 2 minutes
const STORAGE_RETRY_LIMIT = 3;
const PROVIDER_RETRY_LIMIT = 2;

async function callDIDApi(payload: VideoGenerationPayload): Promise<{ videoUrl: string; providerResponse: any }> {
  // TODO: Map payload to D-ID API format
  const requestBody = {
    script: payload.transcript,
    mood: payload.moodAnalysis,
    template: payload.templateMetadata,
  };
  const headers = {
    'Authorization': `Bearer ${D_ID_API_KEY}`,
    'Content-Type': 'application/json',
  };
  const response = await axios.post(D_ID_API_URL, requestBody, { headers, timeout: VIDEO_GEN_TIMEOUT_MS });
  // TODO: Map response to { videoUrl, providerResponse }
  return {
    videoUrl: response.data?.video_url,
    providerResponse: response.data,
  };
}

async function callJOGGApi(payload: VideoGenerationPayload): Promise<{ videoUrl: string; providerResponse: any }> {
  // TODO: Map payload to JOGG API format based on https://app.jogg.ai/home
  const requestBody = {
    text: payload.transcript,
    mood: payload.moodAnalysis,
    template: payload.templateMetadata,
    // JOGG specific parameters for avatar and video generation
    avatar_settings: {
      style: payload.templateMetadata?.avatar_style || 'professional',
      expression: payload.moodAnalysis?.overall_mood || 'neutral',
      voice_tone: payload.moodAnalysis?.sentiment_score || 0
    }
  };
  const headers = {
    'Authorization': `Bearer ${JOGG_API_KEY}`,
    'Content-Type': 'application/json',
  };
  const response = await axios.post(`${JOGG_API_URL}/generate-video`, requestBody, { headers, timeout: VIDEO_GEN_TIMEOUT_MS });
  // TODO: Map JOGG response to { videoUrl, providerResponse }
  return {
    videoUrl: response.data?.video_url || response.data?.download_url,
    providerResponse: response.data,
  };
}

async function uploadVideoToStorage(videoUrl: string, userId: string, dialogueId: string, retry = 0): Promise<string> {
  try {
    // Download video file from provider
    const videoResponse = await axios.get(videoUrl, { responseType: 'arraybuffer' });
    const videoBuffer = Buffer.from(videoResponse.data);
    const fileName = `videos/${userId}/${dialogueId}/${Date.now()}_avatar.mp4`;
    // Upload to Supabase Storage (encrypted at rest)
    const uploadedUrl = await storageService.uploadBuffer(videoBuffer, fileName, 'video/mp4', true);
    return uploadedUrl;
  } catch (error) {
    logError(error as Error, `Video storage upload failed (attempt ${retry + 1})`);
    if (retry < STORAGE_RETRY_LIMIT) {
      return uploadVideoToStorage(videoUrl, userId, dialogueId, retry + 1);
    }
    throw error;
  }
}

export async function generateAvatarVideo(
  payload: VideoGenerationPayload,
  userId: string,
  dialogueId: string,
  templateId: string,
  videoId: string
): Promise<VideoGenerationResult> {
  let provider: VideoProvider = 'D-ID';
  let providerResponse: any = null;
  let videoUrl: string = '';
  let errorMessage: string | undefined = undefined;
  let status: VideoStatus = 'failed';
  let duration: number | undefined = undefined;

  // Try D-ID first, then fallback to JOGG
  for (let attempt = 0; attempt < PROVIDER_RETRY_LIMIT; attempt++) {
    try {
      logInfo('Calling D-ID API for video generation', { attempt, dialogueId, templateId });
      const didResult = await callDIDApi(payload);
      provider = 'D-ID';
      providerResponse = didResult.providerResponse;
      videoUrl = didResult.videoUrl;
      if (!videoUrl) throw new Error('D-ID API did not return a video URL');
      status = 'processing';
      break;
    } catch (error) {
      logError(error as Error, 'D-ID API failed, will try JOGG');
      provider = 'JOGG';
      // Try JOGG as fallback
      try {
        logInfo('Calling JOGG API for video generation', { attempt, dialogueId, templateId });
        const joggResult = await callJOGGApi(payload);
        providerResponse = joggResult.providerResponse;
        videoUrl = joggResult.videoUrl;
        if (!videoUrl) throw new Error('JOGG API did not return a video URL');
        status = 'processing';
        break;
      } catch (joggError) {
        logError(joggError as Error, 'JOGG API failed');
        errorMessage = (joggError as Error).message;
        status = 'failed';
      }
    }
  }

  if (!videoUrl) {
    errorMessage = errorMessage || 'Both video providers failed to generate video.';
    return { videoUrl: '', provider, status: 'failed', errorMessage };
  }

  // Upload to Supabase Storage
  let storageUrl = '';
  try {
    storageUrl = await uploadVideoToStorage(videoUrl, userId, dialogueId);
    status = 'completed';
  } catch (storageError) {
    logError(storageError as Error, 'Failed to upload video to storage');
    errorMessage = (storageError as Error).message;
    status = 'failed';
    return { videoUrl: '', provider, status, errorMessage };
  }

  // Optionally, extract video duration from providerResponse or metadata
  // TODO: Parse duration if available

  return {
    videoUrl: storageUrl,
    provider,
    status,
    errorMessage,
    duration,
    providerResponse,
  };
} 
