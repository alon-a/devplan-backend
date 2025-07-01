import { Router, Request, Response } from 'express';
import { supabase } from '../database/supabase';
import { authenticateToken } from '../middleware/auth';
import { Template, templateSelectorService } from '../services/templateSelectorService';
import { logInfo, logError } from '@devplan/common';
import { asyncHandler } from '../middleware/errorHandler';
import { createSuccessResponse, createErrorResponse } from '@devplan/common';

const router: Router = Router();

/**
 * GET /api/templates
 * Get all available psychological templates
 */
router.get('/', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
  const { category, is_active } = req.query;

  let query = supabase
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
  const formattedTemplates: Template[] = templates.map(template => ({
    id: template.id,
    name: template.name,
    description: template.description,
    category: template.category,
    avatar_url: template.avatar_url,
    voice_id: template.voice_id,
    is_active: template.is_active,
    metadata: template.metadata || {}
  }));

  logInfo('Templates fetched successfully', {
    count: formattedTemplates.length,
    categories: [...new Set(formattedTemplates.map(t => t.category))]
  });

  res.json(createSuccessResponse({ templates: formattedTemplates, count: formattedTemplates.length }));
}));

/**
 * GET /api/templates/:id
 * Get a specific template by ID
 */
router.get('/:id', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
  const templateId = req.params.id;

  const { data: template, error } = await supabase
    .from('templates')
    .select('*')
    .eq('id', templateId)
    .single();

  if (error || !template) {
    return res.status(404).json(createErrorResponse('Template not found'));
  }

  const formattedTemplate: Template = {
    id: template.id,
    name: template.name,
    description: template.description,
    category: template.category,
    avatar_url: template.avatar_url,
    voice_id: template.voice_id,
    is_active: template.is_active,
    metadata: template.metadata || {}
  };

  logInfo('Template fetched successfully', { templateId });

  res.json(createSuccessResponse({ template: formattedTemplate }));
}));

/**
 * GET /api/templates/suggest/:dialogueId
 * Get template suggestion for a specific dialogue based on mood analysis
 */
router.get('/suggest/:dialogueId', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
  const { dialogueId } = req.params;
  const userId = req.user?.id;

  logInfo('Getting template suggestion for dialogue', { 
    dialogueId, 
    userId 
  });

  // Get the dialogue with analysis
  const { data: dialogue, error: dialogueError } = await supabase
    .from('dialogues')
    .select('*')
    .eq('id', dialogueId)
    .eq('user_id', userId)
    .single();

  if (dialogueError) {
    if (dialogueError.code === 'PGRST116') {
      return res.status(404).json(createErrorResponse('Dialogue not found'));
    }
    
    logError(dialogueError, 'Failed to fetch dialogue for template suggestion');
    return res.status(500).json(createErrorResponse('Failed to fetch dialogue'));
  }

  // Check if analysis exists
  if (!dialogue.analysis || dialogue.analysis_status !== 'completed') {
    return res.status(400).json(createErrorResponse('Analysis not available'));
  }

  // Get available templates
  const { data: templates, error: templatesError } = await supabase
    .from('templates')
    .select('*')
    .eq('is_active', true);

  if (templatesError) {
    logError(templatesError, 'Failed to fetch templates for suggestion');
    return res.status(500).json(createErrorResponse('Failed to fetch templates'));
  }

  if (!templates || templates.length === 0) {
    return res.status(404).json(createErrorResponse('No templates available'));
  }

  // Generate template suggestion
  const suggestion = templateSelectorService.suggestTemplate(dialogue.analysis);
  
  // Validate that the suggested template exists
  const suggestedTemplate = templates.find(t => t.id === suggestion.templateId);
  if (!suggestedTemplate) {
    logError(new Error(`Suggested template ${suggestion.templateId} not found`), 'Template suggestion validation failed');
    suggestion.templateId = templateSelectorService.getFallbackTemplateId(templates);
    suggestion.fallbackUsed = true;
    suggestion.reasoning = 'Original suggestion not available, using fallback template';
  }

  logInfo('Template suggestion generated', {
    dialogueId,
    suggestedTemplateId: suggestion.templateId,
    confidence: suggestion.confidence,
    fallbackUsed: suggestion.fallbackUsed
  });

  res.json(createSuccessResponse({
    suggestion,
    availableTemplates: templates.length,
    dialogueAnalysisStatus: dialogue.analysis_status
  }));
}));

// Get template categories
router.get('/categories/list', asyncHandler(async (req: Request, res: Response) => {
  const { data: templates, error } = await supabase
    .from('templates')
    .select('category')
    .eq('is_active', true);

  if (error) {
    throw error;
  }

  // Extract unique categories
  const categories = [...new Set(templates.map(t => t.category))].sort();

  res.json(createSuccessResponse({ categories }));
}));

// Get templates by category
router.get('/category/:category', asyncHandler(async (req: Request, res: Response) => {
  const category = req.params.category;

  const { data: templates, error } = await supabase
    .from('templates')
    .select('*')
    .eq('category', category)
    .eq('is_active', true)
    .order('name');

  if (error) {
    throw error;
  }

  res.json(createSuccessResponse({ templates }));
}));

export default router; 