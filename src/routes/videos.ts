import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { supabase } from '../database/supabase';
import { authenticateToken, requireOwnership } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { createSuccessResponse, createErrorResponse, logInfo, logError } from '@devplan/common';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';

const router: Router = Router();

// Get all videos for current user
router.get('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const status = req.query.status as string;

    let query = supabase
      .from('videos')
      .select(`
        *,
        dialogue: dialogues(title, content, status),
        template: templates(name, description, category)
      `, { count: 'exact' })
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    // Apply status filter if provided
    if (status) {
      query = query.eq('status', status);
    }

    // Apply pagination
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    query = query.range(from, to);

    const { data: videos, error, count } = await query;

    if (error) {
      logError(error, 'Failed to fetch user videos');
      return res.status(500).json(createErrorResponse('Failed to fetch videos'));
    }

    const totalPages = Math.ceil((count || 0) / limit);

    // Generate preview URLs for videos
    const videosWithPreviews = videos?.map(video => ({
      ...video,
      preview_url: video.video_url ? generatePreviewUrl(video.video_url) : null
    })) || [];

    res.json(createSuccessResponse({
      videos: videosWithPreviews,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages
      }
    }));

  } catch (error) {
    logError(error as Error, 'Unexpected error in videos list endpoint');
    res.status(500).json(createErrorResponse('Internal server error'));
  }
});

// Get video metadata and secure URL
router.get('/:id', authenticateToken, async (req: Request, res: Response) => {
  const videoId = req.params.id;
  const userId = req.user!.id;

  try {
    const { data: video, error } = await supabase
      .from('videos')
      .select(`
        *,
        dialogue: dialogues(title, content, status),
        template: templates(name, description, category)
      `)
      .eq('id', videoId)
      .eq('user_id', userId)
      .single();

    if (error || !video) {
      return res.status(404).json(createErrorResponse('Video not found'));
    }

    // Generate signed URL for video if available
    let signedUrl = '';
    if (video.video_url && video.status === 'completed') {
      signedUrl = await generateSignedDownloadUrl(video.video_url);
    }

    // Track video view event
    await trackAnalyticsEvent('video_view', {
      video_id: videoId,
      user_id: userId,
      template_id: video.template_id
    });

    res.json(createSuccessResponse({
      id: video.id,
      dialogue_id: video.dialogue_id,
      template_id: video.template_id,
      video_url: signedUrl,
      preview_url: generatePreviewUrl(video.video_url),
      provider: video.provider,
      status: video.status,
      error_message: video.error_message,
      created_at: video.created_at,
      duration: video.duration,
      metadata: video.metadata,
      avatar_url: video.avatar_url,
      audio_url: video.audio_url,
      dialogue: video.dialogue,
      template: video.template
    }));
  } catch (err) {
    logError(err as Error, 'Failed to fetch video metadata');
    res.status(500).json(createErrorResponse('Failed to fetch video metadata'));
  }
});

// Generate shareable link for video
router.post('/:id/share', 
  authenticateToken,
  requireOwnership('videos'),
  [
    body('expires_at').optional().isISO8601(),
    body('access_control').optional().isObject()
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json(createErrorResponse(errors.array()[0].msg));
      }

      const videoId = req.params.id;
      const userId = req.user!.id;
      const { expires_at, access_control } = req.body;

      // Verify video exists and is completed
      const { data: video, error: videoError } = await supabase
        .from('videos')
        .select('status, video_url')
        .eq('id', videoId)
        .eq('user_id', userId)
        .single();

      if (videoError || !video) {
        return res.status(404).json(createErrorResponse('Video not found'));
      }

      if (video.status !== 'completed') {
        return res.status(400).json(createErrorResponse('Video must be completed before sharing'));
      }

      // Generate unique share token
      const shareToken = crypto.randomBytes(32).toString('hex');
      const shareId = uuidv4();

      // Create share record
      const { data: share, error: shareError } = await supabase
        .from('video_shares')
        .insert({
          id: shareId,
          video_id: videoId,
          user_id: userId,
          share_token: shareToken,
          expires_at: expires_at || null,
          access_control: access_control || {},
          share_type: 'link',
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (shareError) {
        logError(shareError, 'Failed to create share record');
        return res.status(500).json(createErrorResponse('Failed to create share link'));
      }

      // Track share event
      await trackAnalyticsEvent('video_share', {
        video_id: videoId,
        user_id: userId,
        share_type: 'link',
        share_id: shareId
      });

      const shareUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/share/${shareToken}`;

      res.json(createSuccessResponse({
        share_id: shareId,
        share_url: shareUrl,
        expires_at: share.expires_at,
        access_control: share.access_control
      }));
    } catch (error) {
      logError(error as Error, 'Failed to create share link');
      res.status(500).json(createErrorResponse('Failed to create share link'));
    }
  }
);

// Get video download URL
router.get('/:id/download', authenticateToken, requireOwnership('videos'), async (req: Request, res: Response) => {
  try {
    const videoId = req.params.id;
    const userId = req.user!.id;

    const { data: video, error } = await supabase
      .from('videos')
      .select('video_url, status')
      .eq('id', videoId)
      .eq('user_id', userId)
      .single();

    if (error || !video) {
      return res.status(404).json(createErrorResponse('Video not found'));
    }

    if (video.status !== 'completed') {
      return res.status(400).json(createErrorResponse('Video is not ready for download'));
    }

    if (!video.video_url) {
      return res.status(404).json(createErrorResponse('Video file not found'));
    }

    // Generate signed download URL
    const downloadUrl = await generateSignedDownloadUrl(video.video_url);

    // Track download event
    await trackAnalyticsEvent('video_download', {
      video_id: videoId,
      user_id: userId
    });

    res.json(createSuccessResponse({
      download_url: downloadUrl,
      expires_in: 3600 // 1 hour
    }));
  } catch (error) {
    logError(error as Error, 'Failed to generate download URL');
    res.status(500).json(createErrorResponse('Failed to generate download URL'));
  }
});

// Delete video
router.delete('/:id', authenticateToken, requireOwnership('videos'), async (req: Request, res: Response) => {
  try {
    const videoId = req.params.id;
    const userId = req.user!.id;

    // Get video details for cleanup
    const { data: video, error: fetchError } = await supabase
      .from('videos')
      .select('video_url, audio_url, avatar_url')
      .eq('id', videoId)
      .eq('user_id', userId)
      .single();

    if (fetchError || !video) {
      return res.status(404).json(createErrorResponse('Video not found'));
    }

    // Delete associated files from storage (if implemented)
    // This would require storage service integration
    // await storageService.deleteFile(video.video_url);
    // await storageService.deleteFile(video.audio_url);
    // await storageService.deleteFile(video.avatar_url);

    // Delete video record
    const { error: deleteError } = await supabase
      .from('videos')
      .delete()
      .eq('id', videoId)
      .eq('user_id', userId);

    if (deleteError) {
      logError(deleteError, 'Failed to delete video record');
      return res.status(500).json(createErrorResponse('Failed to delete video'));
    }

    // Track deletion event
    await trackAnalyticsEvent('video_delete', {
      video_id: videoId,
      user_id: userId
    });

    res.json(createSuccessResponse(null, 'Video deleted successfully'));
  } catch (error) {
    logError(error as Error, 'Failed to delete video');
    res.status(500).json(createErrorResponse('Failed to delete video'));
  }
});

// Get video statistics
router.get('/stats/summary', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;

    // Get video counts by status
    const { data: statusCounts, error: statusError } = await supabase
      .from('videos')
      .select('status')
      .eq('user_id', userId);

    if (statusError) {
      logError(statusError, 'Failed to fetch video status counts');
      return res.status(500).json(createErrorResponse('Failed to fetch video statistics'));
    }

    const stats = {
      total: statusCounts?.length || 0,
      completed: statusCounts?.filter(v => v.status === 'completed').length || 0,
      processing: statusCounts?.filter(v => v.status === 'processing').length || 0,
      failed: statusCounts?.filter(v => v.status === 'failed').length || 0
    };

    res.json(createSuccessResponse({ stats }));
  } catch (error) {
    logError(error as Error, 'Failed to fetch video statistics');
    res.status(500).json(createErrorResponse('Failed to fetch video statistics'));
  }
});

// Helper function to generate signed download URL
async function generateSignedDownloadUrl(videoUrl: string): Promise<string> {
  try {
    // This would integrate with your storage service (Supabase, AWS S3, etc.)
    // For now, return the original URL
    return videoUrl;
  } catch (error) {
    logError(error as Error, 'Failed to generate signed download URL');
    throw error;
  }
}

// Helper function to generate preview URL
function generatePreviewUrl(videoUrl: string): string {
  // This would generate a thumbnail or preview image URL
  // For now, return a placeholder
  return videoUrl.replace(/\.(mp4|mov|avi)$/, '_preview.jpg');
}

// Helper function to track analytics events
async function trackAnalyticsEvent(eventType: string, eventData: any): Promise<void> {
  try {
    // This would integrate with your analytics service
    // For now, just log the event
    logInfo(`Analytics event: ${eventType}`, eventData);
  } catch (error) {
    logError(error as Error, `Failed to track analytics event: ${eventType}`);
  }
}

export default router; 