"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const express_validator_1 = require("express-validator");
const supabase_1 = require("../database/supabase");
const auth_1 = require("../middleware/auth");
const common_1 = require("@devplan/common");
const uuid_1 = require("uuid");
const crypto_1 = __importDefault(require("crypto"));
const router = (0, express_1.Router)();
// Get all videos for current user
router.get('/', auth_1.authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const status = req.query.status;
        let query = supabase_1.supabase
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
            (0, common_1.logError)(error, 'Failed to fetch user videos');
            return res.status(500).json((0, common_1.createErrorResponse)('Failed to fetch videos'));
        }
        const totalPages = Math.ceil((count || 0) / limit);
        // Generate preview URLs for videos
        const videosWithPreviews = videos?.map(video => ({
            ...video,
            preview_url: video.video_url ? generatePreviewUrl(video.video_url) : null
        })) || [];
        res.json((0, common_1.createSuccessResponse)({
            videos: videosWithPreviews,
            pagination: {
                page,
                limit,
                total: count || 0,
                totalPages
            }
        }));
    }
    catch (error) {
        (0, common_1.logError)(error, 'Unexpected error in videos list endpoint');
        res.status(500).json((0, common_1.createErrorResponse)('Internal server error'));
    }
});
// Get video metadata and secure URL
router.get('/:id', auth_1.authenticateToken, async (req, res) => {
    const videoId = req.params.id;
    const userId = req.user.id;
    try {
        const { data: video, error } = await supabase_1.supabase
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
            return res.status(404).json((0, common_1.createErrorResponse)('Video not found'));
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
        res.json((0, common_1.createSuccessResponse)({
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
    }
    catch (err) {
        (0, common_1.logError)(err, 'Failed to fetch video metadata');
        res.status(500).json((0, common_1.createErrorResponse)('Failed to fetch video metadata'));
    }
});
// Generate shareable link for video
router.post('/:id/share', auth_1.authenticateToken, (0, auth_1.requireOwnership)('videos'), [
    (0, express_validator_1.body)('expires_at').optional().isISO8601(),
    (0, express_validator_1.body)('access_control').optional().isObject()
], async (req, res) => {
    try {
        const errors = (0, express_validator_1.validationResult)(req);
        if (!errors.isEmpty()) {
            return res.status(400).json((0, common_1.createErrorResponse)(errors.array()[0].msg));
        }
        const videoId = req.params.id;
        const userId = req.user.id;
        const { expires_at, access_control } = req.body;
        // Verify video exists and is completed
        const { data: video, error: videoError } = await supabase_1.supabase
            .from('videos')
            .select('status, video_url')
            .eq('id', videoId)
            .eq('user_id', userId)
            .single();
        if (videoError || !video) {
            return res.status(404).json((0, common_1.createErrorResponse)('Video not found'));
        }
        if (video.status !== 'completed') {
            return res.status(400).json((0, common_1.createErrorResponse)('Video must be completed before sharing'));
        }
        // Generate unique share token
        const shareToken = crypto_1.default.randomBytes(32).toString('hex');
        const shareId = (0, uuid_1.v4)();
        // Create share record
        const { data: share, error: shareError } = await supabase_1.supabase
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
            (0, common_1.logError)(shareError, 'Failed to create share record');
            return res.status(500).json((0, common_1.createErrorResponse)('Failed to create share link'));
        }
        // Track share event
        await trackAnalyticsEvent('video_share', {
            video_id: videoId,
            user_id: userId,
            share_type: 'link',
            share_id: shareId
        });
        const shareUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/share/${shareToken}`;
        res.json((0, common_1.createSuccessResponse)({
            share_id: shareId,
            share_url: shareUrl,
            expires_at: share.expires_at,
            created_at: share.created_at
        }));
    }
    catch (error) {
        (0, common_1.logError)(error, 'Failed to generate share link');
        res.status(500).json((0, common_1.createErrorResponse)('Failed to generate share link'));
    }
});
// Access shared video (public endpoint)
router.get('/share/:token', async (req, res) => {
    try {
        const { token } = req.params;
        // Find share record
        const { data: share, error: shareError } = await supabase_1.supabase
            .from('video_shares')
            .select(`
        *,
        video: videos(*, dialogue: dialogues(title), template: templates(name, description))
      `)
            .eq('share_token', token)
            .single();
        if (shareError || !share) {
            return res.status(404).json((0, common_1.createErrorResponse)('Share link not found or expired'));
        }
        // Check if share has expired
        if (share.expires_at && new Date(share.expires_at) < new Date()) {
            return res.status(410).json((0, common_1.createErrorResponse)('Share link has expired'));
        }
        // Check if video exists and is completed
        if (!share.video || share.video.status !== 'completed') {
            return res.status(404).json((0, common_1.createErrorResponse)('Video not available'));
        }
        // Generate signed URL for shared video
        const signedUrl = await generateSignedDownloadUrl(share.video.video_url);
        // Track share access event
        await trackAnalyticsEvent('share_access', {
            video_id: share.video_id,
            share_id: share.id,
            share_type: 'link'
        });
        res.json((0, common_1.createSuccessResponse)({
            video: {
                id: share.video.id,
                title: share.video.dialogue?.title,
                template_name: share.video.template?.name,
                video_url: signedUrl,
                preview_url: generatePreviewUrl(share.video.video_url),
                created_at: share.video.created_at,
                duration: share.video.duration
            },
            shared_by: share.user_id,
            expires_at: share.expires_at
        }));
    }
    catch (error) {
        (0, common_1.logError)(error, 'Failed to access shared video');
        res.status(500).json((0, common_1.createErrorResponse)('Failed to access shared video'));
    }
});
// Track social media share
router.post('/:id/share/social', auth_1.authenticateToken, (0, auth_1.requireOwnership)('videos'), [
    (0, express_validator_1.body)('platform').isIn(['facebook', 'twitter', 'linkedin', 'instagram']),
    (0, express_validator_1.body)('share_url').optional().isURL()
], async (req, res) => {
    try {
        const errors = (0, express_validator_1.validationResult)(req);
        if (!errors.isEmpty()) {
            return res.status(400).json((0, common_1.createErrorResponse)(errors.array()[0].msg));
        }
        const videoId = req.params.id;
        const userId = req.user.id;
        const { platform, share_url } = req.body;
        // Verify video exists
        const { data: video, error: videoError } = await supabase_1.supabase
            .from('videos')
            .select('id, status')
            .eq('id', videoId)
            .eq('user_id', userId)
            .single();
        if (videoError || !video) {
            return res.status(404).json((0, common_1.createErrorResponse)('Video not found'));
        }
        // Record social share event
        const { data: share, error: shareError } = await supabase_1.supabase
            .from('video_shares')
            .insert({
            video_id: videoId,
            user_id: userId,
            share_type: 'social_media',
            platform: platform,
            share_url: share_url,
            created_at: new Date().toISOString()
        })
            .select()
            .single();
        if (shareError) {
            (0, common_1.logError)(shareError, 'Failed to record social share');
            return res.status(500).json((0, common_1.createErrorResponse)('Failed to record share'));
        }
        // Track analytics event
        await trackAnalyticsEvent('video_share', {
            video_id: videoId,
            user_id: userId,
            share_type: 'social_media',
            platform: platform,
            share_id: share.id
        });
        res.json((0, common_1.createSuccessResponse)({
            message: 'Share recorded successfully',
            share_id: share.id
        }));
    }
    catch (error) {
        (0, common_1.logError)(error, 'Failed to record social share');
        res.status(500).json((0, common_1.createErrorResponse)('Failed to record share'));
    }
});
// Delete video and cleanup
router.delete('/:id', auth_1.authenticateToken, (0, auth_1.requireOwnership)('videos'), async (req, res) => {
    try {
        const videoId = req.params.id;
        const userId = req.user.id;
        // Get video details for cleanup
        const { data: video, error: videoError } = await supabase_1.supabase
            .from('videos')
            .select('video_url, dialogue_id')
            .eq('id', videoId)
            .eq('user_id', userId)
            .single();
        if (videoError || !video) {
            return res.status(404).json((0, common_1.createErrorResponse)('Video not found'));
        }
        // Delete associated share records
        await supabase_1.supabase
            .from('video_shares')
            .delete()
            .eq('video_id', videoId);
        // Delete video file from storage if exists
        if (video.video_url) {
            try {
                const { storageService } = await Promise.resolve().then(() => __importStar(require('../services/storage')));
                await storageService.deleteFile(video.video_url);
            }
            catch (storageError) {
                (0, common_1.logError)(storageError, 'Failed to delete video file from storage');
            }
        }
        // Delete video record
        const { error: deleteError } = await supabase_1.supabase
            .from('videos')
            .delete()
            .eq('id', videoId);
        if (deleteError) {
            (0, common_1.logError)(deleteError, 'Failed to delete video record');
            return res.status(500).json((0, common_1.createErrorResponse)('Failed to delete video'));
        }
        // Track deletion event
        await trackAnalyticsEvent('video_delete', {
            video_id: videoId,
            user_id: userId,
            dialogue_id: video.dialogue_id
        });
        res.json((0, common_1.createSuccessResponse)(null, 'Video deleted successfully'));
    }
    catch (error) {
        (0, common_1.logError)(error, 'Failed to delete video');
        res.status(500).json((0, common_1.createErrorResponse)('Failed to delete video'));
    }
});
// Admin analytics endpoint
router.get('/admin/analytics', auth_1.authenticateToken, auth_1.requireAdmin, async (req, res) => {
    try {
        const startDate = req.query.start_date;
        const endDate = req.query.end_date;
        // Build date filter
        let dateFilter = '';
        if (startDate && endDate) {
            dateFilter = `WHERE created_at >= '${startDate}' AND created_at <= '${endDate}'`;
        }
        // Get aggregated analytics
        const { data: analytics, error } = await supabase_1.supabase.rpc('get_video_analytics', {
            date_filter: dateFilter
        });
        if (error) {
            (0, common_1.logError)(error, 'Failed to fetch analytics');
            return res.status(500).json((0, common_1.createErrorResponse)('Failed to fetch analytics'));
        }
        res.json((0, common_1.createSuccessResponse)(analytics));
    }
    catch (error) {
        (0, common_1.logError)(error, 'Failed to fetch admin analytics');
        res.status(500).json((0, common_1.createErrorResponse)('Failed to fetch analytics'));
    }
});
// Helper functions
async function generateSignedDownloadUrl(videoUrl) {
    try {
        const supabaseUrl = process.env.SUPABASE_URL || '';
        const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
        const { createClient } = await Promise.resolve().then(() => __importStar(require('@supabase/supabase-js')));
        const supabaseClient = createClient(supabaseUrl, supabaseKey);
        const bucket = 'videos';
        const filePath = videoUrl.replace(`${supabaseUrl}/storage/v1/object/public/${bucket}/`, '');
        const { data: signedData, error: signedError } = await supabaseClient
            .storage
            .from(bucket)
            .createSignedUrl(filePath, 60 * 60); // 1 hour
        if (signedError || !signedData?.signedUrl) {
            throw new Error('Failed to create signed URL');
        }
        return signedData.signedUrl;
    }
    catch (error) {
        (0, common_1.logError)(error, 'Failed to generate signed download URL');
        return '';
    }
}
function generatePreviewUrl(videoUrl) {
    // Generate a preview/thumbnail URL for the video
    // This could be a frame from the video or a placeholder
    return videoUrl ? `${videoUrl}?preview=true` : '';
}
async function trackAnalyticsEvent(eventType, eventData) {
    try {
        // Insert analytics event
        const { error } = await supabase_1.supabase
            .from('analytics_events')
            .insert({
            event_type: eventType,
            event_data: eventData,
            user_id: eventData.user_id,
            created_at: new Date().toISOString()
        });
        if (error) {
            (0, common_1.logError)(error, 'Failed to track analytics event');
            // TODO: Implement retry mechanism for failed analytics events
        }
    }
    catch (error) {
        (0, common_1.logError)(error, 'Analytics tracking failed');
    }
}
exports.default = router;
//# sourceMappingURL=videos.js.map