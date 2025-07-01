"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const supabase_1 = require("../database/supabase");
const auth_1 = require("../middleware/auth");
const templateSelectorService_1 = require("../services/templateSelectorService");
const common_1 = require("@devplan/common");
const router = (0, express_1.Router)();
/**
 * GET /api/templates
 * Get all available psychological templates
 */
router.get('/', auth_1.authenticateToken, async (req, res) => {
    try {
        (0, common_1.logInfo)('Fetching available templates', { userId: req.user?.id });
        const { data: templates, error } = await supabase_1.supabase
            .from('templates')
            .select('*')
            .eq('is_active', true)
            .order('name');
        if (error) {
            (0, common_1.logError)(error, 'Failed to fetch templates from database');
            return res.status(500).json({
                error: 'Failed to fetch templates',
                details: error.message
            });
        }
        if (!templates || templates.length === 0) {
            (0, common_1.logInfo)('No active templates found');
            return res.status(404).json({
                error: 'No templates available',
                message: 'No active templates found in the system'
            });
        }
        // Transform database records to Template interface
        const formattedTemplates = templates.map(template => ({
            id: template.id,
            name: template.name,
            description: template.description,
            category: template.category,
            avatar_url: template.avatar_url,
            voice_id: template.voice_id,
            is_active: template.is_active,
            metadata: template.metadata || {}
        }));
        (0, common_1.logInfo)('Templates fetched successfully', {
            count: formattedTemplates.length,
            categories: [...new Set(formattedTemplates.map(t => t.category))]
        });
        res.json({
            templates: formattedTemplates,
            count: formattedTemplates.length
        });
    }
    catch (error) {
        (0, common_1.logError)(error, 'Unexpected error in templates endpoint');
        res.status(500).json({
            error: 'Internal server error',
            message: 'Failed to retrieve templates'
        });
    }
});
/**
 * GET /api/templates/:id
 * Get a specific template by ID
 */
router.get('/:id', auth_1.authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        (0, common_1.logInfo)('Fetching specific template', {
            templateId: id,
            userId: req.user?.id
        });
        const { data: template, error } = await supabase_1.supabase
            .from('templates')
            .select('*')
            .eq('id', id)
            .eq('is_active', true)
            .single();
        if (error) {
            if (error.code === 'PGRST116') {
                return res.status(404).json({
                    error: 'Template not found',
                    message: 'The requested template does not exist or is not active'
                });
            }
            (0, common_1.logError)(error, 'Failed to fetch template from database');
            return res.status(500).json({
                error: 'Failed to fetch template',
                details: error.message
            });
        }
        const formattedTemplate = {
            id: template.id,
            name: template.name,
            description: template.description,
            category: template.category,
            avatar_url: template.avatar_url,
            voice_id: template.voice_id,
            is_active: template.is_active,
            metadata: template.metadata || {}
        };
        (0, common_1.logInfo)('Template fetched successfully', { templateId: id });
        res.json({ template: formattedTemplate });
    }
    catch (error) {
        (0, common_1.logError)(error, 'Unexpected error in template detail endpoint');
        res.status(500).json({
            error: 'Internal server error',
            message: 'Failed to retrieve template details'
        });
    }
});
/**
 * GET /api/templates/suggest/:dialogueId
 * Get template suggestion for a specific dialogue based on mood analysis
 */
router.get('/suggest/:dialogueId', auth_1.authenticateToken, async (req, res) => {
    try {
        const { dialogueId } = req.params;
        const userId = req.user?.id;
        (0, common_1.logInfo)('Getting template suggestion for dialogue', {
            dialogueId,
            userId
        });
        // Get the dialogue with analysis
        const { data: dialogue, error: dialogueError } = await supabase_1.supabase
            .from('dialogues')
            .select('*')
            .eq('id', dialogueId)
            .eq('user_id', userId)
            .single();
        if (dialogueError) {
            if (dialogueError.code === 'PGRST116') {
                return res.status(404).json({
                    error: 'Dialogue not found',
                    message: 'The requested dialogue does not exist'
                });
            }
            (0, common_1.logError)(dialogueError, 'Failed to fetch dialogue for template suggestion');
            return res.status(500).json({
                error: 'Failed to fetch dialogue',
                details: dialogueError.message
            });
        }
        // Check if analysis exists
        if (!dialogue.analysis || dialogue.analysis_status !== 'completed') {
            return res.status(400).json({
                error: 'Analysis not available',
                message: 'Mood analysis must be completed before suggesting templates'
            });
        }
        // Get available templates
        const { data: templates, error: templatesError } = await supabase_1.supabase
            .from('templates')
            .select('*')
            .eq('is_active', true);
        if (templatesError) {
            (0, common_1.logError)(templatesError, 'Failed to fetch templates for suggestion');
            return res.status(500).json({
                error: 'Failed to fetch templates',
                details: templatesError.message
            });
        }
        if (!templates || templates.length === 0) {
            return res.status(404).json({
                error: 'No templates available',
                message: 'No active templates found for suggestion'
            });
        }
        // Generate template suggestion
        const suggestion = templateSelectorService_1.templateSelectorService.suggestTemplate(dialogue.analysis);
        // Validate that the suggested template exists
        const suggestedTemplate = templates.find(t => t.id === suggestion.templateId);
        if (!suggestedTemplate) {
            (0, common_1.logError)(new Error(`Suggested template ${suggestion.templateId} not found`), 'Template suggestion validation failed');
            suggestion.templateId = templateSelectorService_1.templateSelectorService.getFallbackTemplateId(templates);
            suggestion.fallbackUsed = true;
            suggestion.reasoning = 'Original suggestion not available, using fallback template';
        }
        (0, common_1.logInfo)('Template suggestion generated', {
            dialogueId,
            suggestedTemplateId: suggestion.templateId,
            confidence: suggestion.confidence,
            fallbackUsed: suggestion.fallbackUsed
        });
        res.json({
            suggestion,
            availableTemplates: templates.length,
            dialogueAnalysisStatus: dialogue.analysis_status
        });
    }
    catch (error) {
        (0, common_1.logError)(error, 'Unexpected error in template suggestion endpoint');
        res.status(500).json({
            error: 'Internal server error',
            message: 'Failed to generate template suggestion'
        });
    }
});
exports.default = router;
//# sourceMappingURL=templates.js.map