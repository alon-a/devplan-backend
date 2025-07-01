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
    // Trigger analysis if we have audio/video content
    if (req.file && req.file.buffer) {
        triggerAnalysis(dialogue.id, req.file.buffer, detectedLanguage);
    }
    res.status(201).json((0, common_1.createSuccessResponse)({ dialogue }, 'Dialogue uploaded successfully'));
}));
// Record dialogue with audio data
router.post('/record', auth_1.authenticateToken, [
    (0, express_validator_1.body)('title').trim().isLength({ min: 1, max: 255 }),
    (0, express_validator_1.body)('audio_data').notEmpty(),
    (0, express_validator_1.body)('template_id').optional().isUUID()
], (0, errorHandler_1.asyncHandler)(async (req, res) => {
    // Check validation errors
    const errors = (0, express_validator_1.validationResult)(req);
    if (!errors.isEmpty()) {
        return res.status(400).json((0, common_1.createErrorResponse)(errors.array()[0].msg));
    }
    const userId = req.user.id;
    const { title, audio_data, template_id } = req.body;
    // Validate audio data (base64)
    if (!audio_data.startsWith('data:audio/')) {
        return res.status(400).json((0, common_1.createErrorResponse)('Invalid audio data format'));
    }
    try {
        // Convert base64 to buffer
        const base64Data = audio_data.split(',')[1];
        const audioBuffer = Buffer.from(base64Data, 'base64');
        // Create mock file for storage
        const mockFile = {
            fieldname: 'audio',
            originalname: `recording_${Date.now()}.webm`,
            encoding: '7bit',
            mimetype: 'audio/webm',
            buffer: audioBuffer,
            size: audioBuffer.length
        };
        // Upload audio file
        const audioUrl = await storage_1.storageService.uploadFile(mockFile, userId, 'audio');
        // Create dialogue in database
        const { data: dialogue, error } = await supabase_1.supabase
            .from('dialogues')
            .insert({
            user_id: userId,
            title: title.trim(),
            content: '',
            audio_url: audioUrl,
            status: 'draft',
            analysis_status: 'pending',
            language: 'unknown',
            template_id,
            metadata: {
                input_type: 'recording',
                file_size: audioBuffer.length,
                file_type: 'audio/webm',
                recorded_at: new Date().toISOString()
            }
        })
            .select()
            .single();
        if (error) {
            throw error;
        }
        // Trigger analysis
        triggerAnalysis(dialogue.id, audioBuffer, 'unknown');
        res.status(201).json((0, common_1.createSuccessResponse)({ dialogue }, 'Dialogue recorded successfully'));
    }
    catch (error) {
        return res.status(400).json((0, common_1.createErrorResponse)('Audio processing failed'));
    }
}));
// Get all dialogues for user
router.get('/', auth_1.authenticateToken, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const userId = req.user.id;
    const { page = 1, limit = 10, status, analysis_status } = req.query;
    let query = supabase_1.supabase
        .from('dialogues')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
    // Apply filters
    if (status) {
        query = query.eq('status', status);
    }
    if (analysis_status) {
        query = query.eq('analysis_status', analysis_status);
    }
    // Apply pagination
    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 10;
    const from = (pageNum - 1) * limitNum;
    const to = from + limitNum - 1;
    query = query.range(from, to);
    const { data: dialogues, error, count } = await query;
    if (error) {
        throw error;
    }
    res.json((0, common_1.createSuccessResponse)({
        dialogues,
        pagination: {
            page: pageNum,
            limit: limitNum,
            total: count || 0,
            totalPages: Math.ceil((count || 0) / limitNum)
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
// Get dialogue analysis results
router.get('/:id/analysis', auth_1.authenticateToken, (0, auth_1.requireOwnership)('dialogues'), (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const dialogueId = req.params.id;
    const { data: dialogue, error } = await supabase_1.supabase
        .from('dialogues')
        .select('analysis_status, mood_analysis, transcript, language, analysis_metadata')
        .eq('id', dialogueId)
        .single();
    if (error || !dialogue) {
        return res.status(404).json((0, common_1.createErrorResponse)('Dialogue not found'));
    }
    res.json((0, common_1.createSuccessResponse)({ analysis: dialogue }));
}));
// Update dialogue
router.put('/:id', auth_1.authenticateToken, (0, auth_1.requireOwnership)('dialogues'), [
    (0, express_validator_1.body)('title').optional().trim().isLength({ min: 1, max: 255 }),
    (0, express_validator_1.body)('content').optional().trim()
], (0, errorHandler_1.asyncHandler)(async (req, res) => {
    // Check validation errors
    const errors = (0, express_validator_1.validationResult)(req);
    if (!errors.isEmpty()) {
        return res.status(400).json((0, common_1.createErrorResponse)(errors.array()[0].msg));
    }
    const dialogueId = req.params.id;
    const { title, content } = req.body;
    const updateData = {};
    if (title !== undefined)
        updateData.title = title.trim();
    if (content !== undefined)
        updateData.content = content.trim();
    const { data: dialogue, error } = await supabase_1.supabase
        .from('dialogues')
        .update(updateData)
        .eq('id', dialogueId)
        .select()
        .single();
    if (error || !dialogue) {
        return res.status(404).json((0, common_1.createErrorResponse)('Dialogue not found'));
    }
    res.json((0, common_1.createSuccessResponse)({ dialogue }, 'Dialogue updated successfully'));
}));
// Delete dialogue
router.delete('/:id', auth_1.authenticateToken, (0, auth_1.requireOwnership)('dialogues'), (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const dialogueId = req.params.id;
    // Get dialogue to check if it has associated files
    const { data: dialogue, error: fetchError } = await supabase_1.supabase
        .from('dialogues')
        .select('audio_url, video_url')
        .eq('id', dialogueId)
        .single();
    if (fetchError || !dialogue) {
        return res.status(404).json((0, common_1.createErrorResponse)('Dialogue not found'));
    }
    // Delete associated files from storage
    try {
        if (dialogue.audio_url) {
            await storage_1.storageService.deleteFile(dialogue.audio_url);
        }
        if (dialogue.video_url) {
            await storage_1.storageService.deleteFile(dialogue.video_url);
        }
    }
    catch (error) {
        // Log error but continue with deletion
        (0, common_1.logError)(error, `Failed to delete files for dialogue ${dialogueId}`);
    }
    // Delete dialogue from database
    const { error: deleteError } = await supabase_1.supabase
        .from('dialogues')
        .delete()
        .eq('id', dialogueId);
    if (deleteError) {
        throw deleteError;
    }
    res.json((0, common_1.createSuccessResponse)(null, 'Dialogue deleted successfully'));
}));
// Generate video from dialogue
router.post('/:id/generate', auth_1.authenticateToken, (0, auth_1.requireOwnership)('dialogues'), [
    (0, express_validator_1.body)('template_id').isUUID(),
    (0, express_validator_1.body)('custom_settings').optional().isObject()
], (0, errorHandler_1.asyncHandler)(async (req, res) => {
    // Check validation errors
    const errors = (0, express_validator_1.validationResult)(req);
    if (!errors.isEmpty()) {
        return res.status(400).json((0, common_1.createErrorResponse)(errors.array()[0].msg));
    }
    const dialogueId = req.params.id;
    const { template_id, custom_settings } = req.body;
    // Get dialogue
    const { data: dialogue, error: dialogueError } = await supabase_1.supabase
        .from('dialogues')
        .select('*')
        .eq('id', dialogueId)
        .single();
    if (dialogueError || !dialogue) {
        return res.status(404).json((0, common_1.createErrorResponse)('Dialogue not found'));
    }
    // Check if dialogue is analyzed
    if (dialogue.analysis_status !== 'completed') {
        return res.status(400).json((0, common_1.createErrorResponse)('Dialogue must be analyzed before generating video'));
    }
    // Get template
    const { data: template, error: templateError } = await supabase_1.supabase
        .from('templates')
        .select('*')
        .eq('id', template_id)
        .single();
    if (templateError || !template) {
        return res.status(404).json((0, common_1.createErrorResponse)('Template not found'));
    }
    try {
        // Generate video
        const videoResult = await (0, videoGenerationService_1.generateAvatarVideo)({
            transcript: dialogue.transcript || dialogue.content,
            moodAnalysis: dialogue.mood_analysis,
            templateMetadata: template.metadata || {}
        }, req.user.id, dialogueId, template_id, dialogue.id);
        // Create video record
        const { data: video, error: videoError } = await supabase_1.supabase
            .from('videos')
            .insert({
            dialogue_id: dialogueId,
            user_id: req.user.id,
            template_id,
            avatar_url: template.avatar_url,
            audio_url: dialogue.audio_url || '',
            video_url: videoResult.videoUrl,
            duration: videoResult.duration || 0,
            status: videoResult.status,
            metadata: {
                provider: videoResult.provider,
                error_message: videoResult.errorMessage,
                generated_at: new Date().toISOString()
            }
        })
            .select()
            .single();
        if (videoError) {
            throw videoError;
        }
        // Update dialogue status
        await supabase_1.supabase
            .from('dialogues')
            .update({ status: 'generated' })
            .eq('id', dialogueId);
        res.json((0, common_1.createSuccessResponse)({ video }, 'Video generated successfully'));
    }
    catch (error) {
        (0, common_1.logError)(error, `Video generation failed for dialogue ${dialogueId}`);
        return res.status(500).json((0, common_1.createErrorResponse)('Video generation failed'));
    }
}));
exports.default = router;
//# sourceMappingURL=dialogues.js.map