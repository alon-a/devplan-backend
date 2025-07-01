"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const supabase_1 = require("../database/supabase");
const auth_1 = require("../middleware/auth");
const templateSelectorService_1 = require("../services/templateSelectorService");
const common_1 = require("@devplan/common");
const errorHandler_1 = require("../middleware/errorHandler");
const common_2 = require("@devplan/common");
const router = (0, express_1.Router)();
/**
 * GET /api/templates
 * Get all available psychological templates
 */
router.get('/', auth_1.authenticateToken, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { category, is_active } = req.query;
    let query = supabase_1.supabase
        .from('templates')
        .select('*')
        .order('name');
    // Apply filters
    if (category) {
        query = query.eq('category', category);
    }
    if (is_active !== undefined) {
        query = query.eq('is_active', is_active === 'true');
    }
    const { data: templates, error } = await query;
    if (error) {
        throw error;
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
    res.json((0, common_2.createSuccessResponse)({ templates: formattedTemplates, count: formattedTemplates.length }));
}));
/**
 * GET /api/templates/:id
 * Get a specific template by ID
 */
router.get('/:id', auth_1.authenticateToken, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const templateId = req.params.id;
    const { data: template, error } = await supabase_1.supabase
        .from('templates')
        .select('*')
        .eq('id', templateId)
        .single();
    if (error || !template) {
        return res.status(404).json((0, common_2.createErrorResponse)('Template not found'));
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
    (0, common_1.logInfo)('Template fetched successfully', { templateId });
    res.json((0, common_2.createSuccessResponse)({ template: formattedTemplate }));
}));
/**
 * GET /api/templates/suggest/:dialogueId
 * Get template suggestion for a specific dialogue based on mood analysis
 */
router.get('/suggest/:dialogueId', auth_1.authenticateToken, (0, errorHandler_1.asyncHandler)(async (req, res) => {
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
            return res.status(404).json((0, common_2.createErrorResponse)('Dialogue not found'));
        }
        (0, common_1.logError)(dialogueError, 'Failed to fetch dialogue for template suggestion');
        return res.status(500).json((0, common_2.createErrorResponse)('Failed to fetch dialogue'));
    }
    // Check if analysis exists
    if (!dialogue.analysis || dialogue.analysis_status !== 'completed') {
        return res.status(400).json((0, common_2.createErrorResponse)('Analysis not available'));
    }
    // Get available templates
    const { data: templates, error: templatesError } = await supabase_1.supabase
        .from('templates')
        .select('*')
        .eq('is_active', true);
    if (templatesError) {
        (0, common_1.logError)(templatesError, 'Failed to fetch templates for suggestion');
        return res.status(500).json((0, common_2.createErrorResponse)('Failed to fetch templates'));
    }
    if (!templates || templates.length === 0) {
        return res.status(404).json((0, common_2.createErrorResponse)('No templates available'));
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
    res.json((0, common_2.createSuccessResponse)({
        suggestion,
        availableTemplates: templates.length,
        dialogueAnalysisStatus: dialogue.analysis_status
    }));
}));
// Get template categories
router.get('/categories/list', (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { data: templates, error } = await supabase_1.supabase
        .from('templates')
        .select('category')
        .eq('is_active', true);
    if (error) {
        throw error;
    }
    // Extract unique categories
    const categories = [...new Set(templates.map(t => t.category))].sort();
    res.json((0, common_2.createSuccessResponse)({ categories }));
}));
// Get templates by category
router.get('/category/:category', (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const category = req.params.category;
    const { data: templates, error } = await supabase_1.supabase
        .from('templates')
        .select('*')
        .eq('category', category)
        .eq('is_active', true)
        .order('name');
    if (error) {
        throw error;
    }
    res.json((0, common_2.createSuccessResponse)({ templates }));
}));
exports.default = router;
//# sourceMappingURL=templates.js.map