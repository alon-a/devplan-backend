"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const express_validator_1 = require("express-validator");
const multer_1 = __importDefault(require("multer"));
const supabase_1 = require("../database/supabase");
const auth_1 = require("../middleware/auth");
const errorHandler_1 = require("../middleware/errorHandler");
const storage_1 = require("../services/storage");
const speechToTextMoodAnalysisService_1 = require("../services/speechToTextMoodAnalysisService");
const templateSelectorService_1 = require("../services/templateSelectorService");
const common_1 = require("@devplan/common");
const videoGenerationService_1 = require("../services/videoGenerationService");
const router = (0, express_1.Router)();
// Configure multer for file uploads with increased size limit
const upload = (0, multer_1.default)({
    storage: multer_1.default.memoryStorage(),
    limits: {
        fileSize: 100 * 1024 * 1024, // 100MB
    },
    fileFilter: (req, file, cb) => {
        const allowedAudioTypes = ['audio/mpeg', 'audio/wav', 'audio/m4a', 'audio/ogg', 'audio/mp3'];
        const allowedVideoTypes = ['video/mp4', 'video/mov', 'video/avi', 'video/webm'];
        const allowedTypes = [...allowedAudioTypes, ...allowedVideoTypes];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        }
        else {
            cb(new Error(`Invalid file type. Allowed types: ${allowedTypes.join(', ')}`));
        }
    }
});
// Language detection function (placeholder - would integrate with NLP API)
const detectLanguage = async (text) => {
    // Simple heuristic-based detection
    const hebrewPattern = /[\u0590-\u05FF]/;
    const englishPattern = /[a-zA-Z]/;
    if (hebrewPattern.test(text)) {
        return 'hebrew';
    }
    else if (englishPattern.test(text)) {
        return 'english';
    }
    return 'unsupported';
};
// Trigger asynchronous analysis
const triggerAnalysis = async (dialogueId, audioBuffer, originalLanguage) => {
    try {
        // Update status to processing
        await supabase_1.supabase
            .from('dialogues')
            .update({ analysis_status: 'processing' })
            .eq('id', dialogueId);
        // Perform analysis
        const analysisResult = await speechToTextMoodAnalysisService_1.speechToTextMoodAnalysisService.analyzeAudio(audioBuffer, originalLanguage);
        // Update dialogue with analysis results
        const updateData = {
            transcript: analysisResult.transcript,
            mood_analysis: analysisResult.moodAnalysis,
            analysis_status: 'completed',
            language: analysisResult.language,
            analysis_metadata: {
                ...analysisResult.metadata,
                api_used: analysisResult.apiUsed,
                processing_time: analysisResult.processingTime,
                confidence: analysisResult.confidence,
                analyzed_at: new Date().toISOString()
            }
        };
        // Update status to analyzed if analysis was successful
        if (analysisResult.confidence > 0) {
            updateData.status = 'analyzed';
        }
        await supabase_1.supabase
            .from('dialogues')
            .update(updateData)
            .eq('id', dialogueId);
        (0, common_1.logInfo)(`Analysis completed for dialogue ${dialogueId}`, {
            apiUsed: analysisResult.apiUsed,
            confidence: analysisResult.confidence,
            language: analysisResult.language
        });
    }
    catch (error) {
        (0, common_1.logError)(error, `Analysis failed for dialogue ${dialogueId}`);
        // Update status to failed
        await supabase_1.supabase
            .from('dialogues')
            .update({
            analysis_status: 'failed',
            analysis_metadata: {
                error: error instanceof Error ? error.message : 'Unknown error',
                failed_at: new Date().toISOString()
            }
        })
            .eq('id', dialogueId);
    }
};
// Upload dialogue with file or transcript
router.post('/upload', auth_1.authenticateToken, upload.single('audio_file'), (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const userId = req.user.id;
    const { title, content, input_type = 'file' } = req.body;
    // Validate required fields
    if (!title || title.trim().length === 0) {
        return res.status(400).json((0, common_1.createErrorResponse)('Title is required'));
    }
    let audioUrl;
    let videoUrl;
    let transcriptContent = content || '';
    let detectedLanguage = 'unsupported';
    // Handle different input types
    if (input_type === 'file' && req.file) {
        // File upload
        try {
            const isVideo = req.file.mimetype.startsWith('video/');
            const directory = isVideo ? 'video' : 'audio';
            if (isVideo) {
                videoUrl = await storage_1.storageService.uploadFile(req.file, userId, 'video');
            }
            else {
                audioUrl = await storage_1.storageService.uploadFile(req.file, userId, 'audio');
            }
        }
        catch (error) {
            return res.status(400).json((0, common_1.createErrorResponse)('File upload failed'));
        }
    }
    else if (input_type === 'transcript') {
        // Transcript input
        if (!transcriptContent || transcriptContent.trim().length === 0) {
            return res.status(400).json((0, common_1.createErrorResponse)('Transcript content is required'));
        }
        // Detect language
        detectedLanguage = await detectLanguage(transcriptContent);
        if (detectedLanguage === 'unsupported') {
            return res.status(400).json((0, common_1.createErrorResponse)('Unsupported language detected. Please provide text in English or Hebrew.'));
        }
        // Store transcript as a text file in storage
        try {
            const transcriptBuffer = Buffer.from(transcriptContent, 'utf-8');
            const mockFile = {
                fieldname: 'transcript',
                originalname: `transcript_${Date.now()}.txt`,
                encoding: 'utf-8',
                mimetype: 'text/plain',
                buffer: transcriptBuffer,
                size: transcriptBuffer.length
            };
            const transcriptUrl = await storage_1.storageService.uploadFile(mockFile, userId, 'audio');
            // For transcripts, we'll store the URL in audio_url field for consistency
            audioUrl = transcriptUrl;
        }
        catch (error) {
            return res.status(400).json((0, common_1.createErrorResponse)('Transcript storage failed'));
        }
    }
    else {
        return res.status(400).json((0, common_1.createErrorResponse)('Invalid input type or missing file'));
    }
    // Create dialogue in database
    const { data: dialogue, error } = await supabase_1.supabase
        .from('dialogues')
        .insert({
        user_id: userId,
        title: title.trim(),
        content: transcriptContent,
        audio_url: audioUrl,
        video_url: videoUrl,
        status: 'draft',
        analysis_status: 'pending',
        language: detectedLanguage,
        metadata: {
            input_type,
            language: detectedLanguage,
            file_size: req.file?.size,
            file_type: req.file?.mimetype,
            uploaded_at: new Date().toISOString()
        }
    })
        .select()
        .single();
    if (error) {
        throw error;
    }
    // Trigger asynchronous analysis for audio/video files
    if (input_type === 'file' && req.file && (audioUrl || videoUrl)) {
        this.triggerAnalysis(dialogue.id, req.file.buffer, detectedLanguage);
    }
    res.status(201).json((0, common_1.createSuccessResponse)({
        dialogue,
        language: detectedLanguage,
        message: 'Dialogue uploaded successfully'
    }));
}));
// Record new dialogue (with base64 audio data)
router.post('/record', auth_1.authenticateToken, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    // Validate request body
    const validationResult = (0, common_1.validateSchema)(RecordDialogueSchema, req.body);
    const userId = req.user.id;
    const { title, audio_data } = validationResult;
    let audioUrl;
    // Handle base64 audio data
    if (audio_data) {
        try {
            // Convert base64 to buffer
            const audioBuffer = Buffer.from(audio_data, 'base64');
            // Validate audio data size (max 100MB)
            if (audioBuffer.length > 100 * 1024 * 1024) {
                return res.status(400).json((0, common_1.createErrorResponse)('Audio file too large. Maximum size: 100MB'));
            }
            // Create a mock file object for storage service
            const mockFile = {
                fieldname: 'audio',
                originalname: `recording_${Date.now()}.wav`,
                encoding: '7bit',
                mimetype: 'audio/wav',
                buffer: audioBuffer,
                size: audioBuffer.length
            };
            audioUrl = await storage_1.storageService.uploadFile(mockFile, userId, 'audio');
        }
        catch (error) {
            return res.status(400).json((0, common_1.createErrorResponse)('Audio processing failed'));
        }
    }
    // Create dialogue in database
    const { data: dialogue, error } = await supabase_1.supabase
        .from('dialogues')
        .insert({
        user_id: userId,
        title: title.trim(),
        audio_url: audioUrl,
        content: '', // Will be populated after transcription
        status: 'draft',
        analysis_status: 'pending',
        language: 'unknown', // Will be detected after transcription
        metadata: {
            input_type: 'recording',
            language: 'unknown', // Will be detected after transcription
            file_size: audioUrl ? Buffer.from(audio_data, 'base64').length : 0,
            file_type: 'audio/wav',
            recorded_at: new Date().toISOString()
        }
    })
        .select()
        .single();
    if (error) {
        throw error;
    }
    // Trigger asynchronous analysis for audio recordings
    if (audio_data) {
        const audioBuffer = Buffer.from(audio_data, 'base64');
        this.triggerAnalysis(dialogue.id, audioBuffer, 'unknown');
    }
    res.status(201).json((0, common_1.createSuccessResponse)({
        dialogue,
        message: 'Dialogue recorded successfully'
    }));
}));
// Get dialogue analysis
router.get('/:id/analysis', auth_1.authenticateToken, (0, auth_1.requireOwnership)('dialogues'), (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const dialogueId = req.params.id;
    // Get dialogue with analysis
    const { data: dialogue, error } = await supabase_1.supabase
        .from('dialogues')
        .select('*')
        .eq('id', dialogueId)
        .single();
    if (error || !dialogue) {
        return res.status(404).json((0, common_1.createErrorResponse)('Dialogue not found'));
    }
    // Check if analysis exists
    if (!dialogue.mood_analysis || dialogue.analysis_status !== 'completed') {
        return res.status(404).json((0, common_1.createErrorResponse)('Analysis not available or still processing'));
    }
    res.json((0, common_1.createSuccessResponse)({
        dialogue: {
            id: dialogue.id,
            title: dialogue.title,
            transcript: dialogue.transcript,
            mood_analysis: dialogue.mood_analysis,
            analysis_status: dialogue.analysis_status,
            language: dialogue.language,
            analysis_metadata: dialogue.analysis_metadata,
            created_at: dialogue.created_at,
            updated_at: dialogue.updated_at
        }
    }));
}));
// Generate video from dialogue
router.post('/:id/generate', auth_1.authenticateToken, (0, auth_1.requireOwnership)('dialogues'), [
    (0, express_validator_1.body)('template_id').optional().isUUID(),
    (0, express_validator_1.body)('custom_settings').optional().isObject()
], (0, errorHandler_1.asyncHandler)(async (req, res) => {
    // Check validation errors
    const errors = (0, express_validator_1.validationResult)(req);
    if (!errors.isEmpty()) {
        return res.status(400).json((0, common_1.createErrorResponse)(errors.array()[0].msg));
    }
    const dialogueId = req.params.id;
    const userId = req.user.id;
    const { template_id, custom_settings } = req.body;
    (0, common_1.logInfo)('Starting video generation', {
        dialogueId,
        userId,
        providedTemplateId: template_id
    });
    // Verify dialogue exists and belongs to user
    const { data: dialogue, error: dialogueError } = await supabase_1.supabase
        .from('dialogues')
        .select('*')
        .eq('id', dialogueId)
        .eq('user_id', userId)
        .single();
    if (dialogueError || !dialogue) {
        return res.status(404).json((0, common_1.createErrorResponse)('Dialogue not found'));
    }
    // Check if analysis is completed
    if (!dialogue.analysis || dialogue.analysis_status !== 'completed') {
        return res.status(400).json((0, common_1.createErrorResponse)('Mood analysis must be completed before generating video. Please wait for analysis to complete.'));
    }
    // Get all available templates
    const { data: availableTemplates, error: templatesError } = await supabase_1.supabase
        .from('templates')
        .select('*')
        .eq('is_active', true);
    if (templatesError || !availableTemplates || availableTemplates.length === 0) {
        (0, common_1.logError)(templatesError || new Error('No templates available'), 'Failed to fetch templates for video generation');
        return res.status(500).json((0, common_1.createErrorResponse)('Template data is currently unavailable. Please try again later.'));
    }
    let finalTemplateId = template_id;
    let templateFallbackUsed = false;
    let templateFallbackReason = '';
    // If no template_id provided, generate suggestion
    if (!finalTemplateId) {
        (0, common_1.logInfo)('No template provided, generating suggestion based on mood analysis');
        const suggestion = templateSelectorService_1.templateSelectorService.suggestTemplate(dialogue.analysis);
        finalTemplateId = suggestion.templateId;
        templateFallbackUsed = suggestion.fallbackUsed;
        templateFallbackReason = suggestion.reasoning;
        (0, common_1.logInfo)('Template suggestion generated', {
            suggestedTemplateId: finalTemplateId,
            confidence: suggestion.confidence,
            fallbackUsed: templateFallbackUsed
        });
    }
    // Validate the template ID (whether provided or suggested)
    const isValidTemplate = await templateSelectorService_1.templateSelectorService.validateTemplateId(finalTemplateId, availableTemplates);
    if (!isValidTemplate) {
        (0, common_1.logError)(new Error(`Invalid template ID: ${finalTemplateId}`), 'Template validation failed');
        // Get fallback template
        const fallbackTemplateId = templateSelectorService_1.templateSelectorService.getFallbackTemplateId(availableTemplates);
        finalTemplateId = fallbackTemplateId;
        templateFallbackUsed = true;
        templateFallbackReason = `Invalid template ID provided. Using fallback template: ${fallbackTemplateId}`;
        (0, common_1.logInfo)('Using fallback template', {
            originalTemplateId: template_id,
            fallbackTemplateId: finalTemplateId
        });
    }
    // Get the final template details
    const finalTemplate = availableTemplates.find(t => t.id === finalTemplateId);
    if (!finalTemplate) {
        (0, common_1.logError)(new Error(`Final template not found: ${finalTemplateId}`), 'Template retrieval failed');
        return res.status(500).json((0, common_1.createErrorResponse)('Template configuration error. Please contact support.'));
    }
    // Create video record (status: processing)
    const { data: video, error: videoError } = await supabase_1.supabase
        .from('videos')
        .insert({
        dialogue_id: dialogueId,
        user_id: userId,
        template_id: finalTemplateId,
        avatar_url: finalTemplate.avatar_url,
        audio_url: dialogue.audio_url || '',
        video_url: '', // Will be populated after generation
        duration: 0, // Will be calculated after generation
        status: 'processing',
        metadata: {
            ...custom_settings,
            template_selection: {
                provided_template_id: template_id,
                final_template_id: finalTemplateId,
                fallback_used: templateFallbackUsed,
                fallback_reason: templateFallbackReason,
                available_templates_count: availableTemplates.length,
                selected_at: new Date().toISOString()
            }
        }
    })
        .select()
        .single();
    if (videoError) {
        (0, common_1.logError)(videoError, 'Failed to create video record');
        throw videoError;
    }
    // Update dialogue status
    await supabase_1.supabase
        .from('dialogues')
        .update({ status: 'generated' })
        .eq('id', dialogueId);
    (0, common_1.logInfo)('Video generation initiated', {
        dialogueId,
        videoId: video.id,
        templateId: finalTemplateId,
        fallbackUsed: templateFallbackUsed
    });
    // Trigger video generation asynchronously (do not await)
    (async () => {
        try {
            const payload = {
                transcript: dialogue.transcript || dialogue.content,
                moodAnalysis: dialogue.analysis,
                templateMetadata: finalTemplate.metadata || {}
            };
            const result = await (0, videoGenerationService_1.generateAvatarVideo)(payload, userId, dialogueId, finalTemplateId, video.id);
            // Update video record with result
            await supabase_1.supabase
                .from('videos')
                .update({
                video_url: result.videoUrl,
                status: result.status,
                provider: result.provider,
                duration: result.duration || 0,
                error_message: result.errorMessage,
                metadata: {
                    ...video.metadata,
                    provider_response: result.providerResponse
                }
            })
                .eq('id', video.id);
            // Optionally: notify user via websocket/event
        }
        catch (err) {
            (0, common_1.logError)(err, 'Video generation job failed');
            await supabase_1.supabase
                .from('videos')
                .update({
                status: 'failed',
                error_message: err.message
            })
                .eq('id', video.id);
            // Optionally: notify user of failure
        }
    })();
    // Return immediate acknowledgement
    const responseData = {
        video,
        template: {
            id: finalTemplate.id,
            name: finalTemplate.name,
            category: finalTemplate.category
        },
        message: 'Video generation started',
        poll_url: `/api/videos/${video.id}`
    };
    if (templateFallbackUsed) {
        responseData.fallback_info = {
            used: true,
            reason: templateFallbackReason,
            original_template_id: template_id
        };
    }
    res.status(202).json((0, common_1.createSuccessResponse)(responseData));
}));
// Get all dialogues for current user
router.get('/', auth_1.authenticateToken, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const userId = req.user.id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const status = req.query.status;
    const inputType = req.query.input_type;
    let query = supabase_1.supabase
        .from('dialogues')
        .select('*', { count: 'exact' })
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
    // Apply status filter if provided
    if (status) {
        query = query.eq('status', status);
    }
    // Apply input type filter if provided
    if (inputType) {
        query = query.eq('metadata->input_type', inputType);
    }
    // Apply pagination
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    query = query.range(from, to);
    const { data: dialogues, error, count } = await query;
    if (error) {
        throw error;
    }
    const totalPages = Math.ceil((count || 0) / limit);
    res.json((0, common_1.createSuccessResponse)({
        dialogues,
        pagination: {
            page,
            limit,
            total: count || 0,
            totalPages
        }
    }));
}));
// Get specific dialogue
router.get('/:id', auth_1.authenticateToken, (0, auth_1.requireOwnership)('dialogues'), (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const dialogueId = req.params.id;
    const { data: dialogue, error } = await supabase_1.supabase
        .from('dialogues')
        .select('*')
        .eq('id', dialogueId)
        .single();
    if (error || !dialogue) {
        return res.status(404).json((0, common_1.createErrorResponse)('Dialogue not found'));
    }
    res.json((0, common_1.createSuccessResponse)({ dialogue }));
}));
// Update dialogue
router.put('/:id', auth_1.authenticateToken, (0, auth_1.requireOwnership)('dialogues'), [
    (0, express_validator_1.body)('title').optional().trim().isLength({ min: 1, max: 255 }),
    (0, express_validator_1.body)('content').optional().trim().isLength({ min: 1 })
], (0, errorHandler_1.asyncHandler)(async (req, res) => {
    // Check validation errors
    const errors = (0, express_validator_1.validationResult)(req);
    if (!errors.isEmpty()) {
        return res.status(400).json((0, common_1.createErrorResponse)(errors.array()[0].msg));
    }
    const dialogueId = req.params.id;
    const { title, content } = req.body;
    const { data: dialogue, error } = await supabase_1.supabase
        .from('dialogues')
        .update({ title, content })
        .eq('id', dialogueId)
        .select()
        .single();
    if (error) {
        throw error;
    }
    res.json((0, common_1.createSuccessResponse)({ dialogue }, 'Dialogue updated successfully'));
}));
// Delete dialogue
router.delete('/:id', auth_1.authenticateToken, (0, auth_1.requireOwnership)('dialogues'), (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const dialogueId = req.params.id;
    // Get dialogue to check for associated files
    const { data: dialogue, error: fetchError } = await supabase_1.supabase
        .from('dialogues')
        .select('audio_url, video_url')
        .eq('id', dialogueId)
        .single();
    if (fetchError) {
        throw fetchError;
    }
    // Delete associated files from storage
    if (dialogue.audio_url) {
        const audioPath = storage_1.storageService.extractFilePathFromUrl(dialogue.audio_url);
        if (audioPath) {
            await storage_1.storageService.deleteFile(audioPath).catch(() => {
                // Ignore errors when deleting files
            });
        }
    }
    if (dialogue.video_url) {
        const videoPath = storage_1.storageService.extractFilePathFromUrl(dialogue.video_url);
        if (videoPath) {
            await storage_1.storageService.deleteFile(videoPath).catch(() => {
                // Ignore errors when deleting files
            });
        }
    }
    // Delete dialogue from database
    const { error } = await supabase_1.supabase
        .from('dialogues')
        .delete()
        .eq('id', dialogueId);
    if (error) {
        throw error;
    }
    res.json((0, common_1.createSuccessResponse)(null, 'Dialogue deleted successfully'));
}));
exports.default = router;
//# sourceMappingURL=dialogues.js.map