import ImportTemplate from '../models/import.template.js';
import { ApiResponse } from '../lib/api-response.js';

// Get all templates (no filtering needed)
export const getTemplates = async (req, res) => {
  try {
    console.log('Getting templates for user:', req.user?.id || 'anonymous');
    
    const templates = await ImportTemplate.find()
      .select('name description mapping expectedHeaders userId usageCount lastUsedAt createdAt')
      .sort({ lastUsedAt: -1, createdAt: -1 });
    
    console.log('Found templates:', templates.length);
    console.log('Templates:', templates);
    
    res.json(ApiResponse.success(templates, 'Templates retrieved successfully'));
  } catch (error) {
    console.error('Error getting templates:', error);
    res.status(500).json(ApiResponse.error('Failed to retrieve templates'));
  }
};

// Create new template (no isPublic field)
export const createTemplate = async (req, res) => {
  try {
    const { name, description, mapping, expectedHeaders } = req.body;
    const userId = req.user?.id || `temp_user_${Date.now()}`; // Handle missing user with unique ID
    
    console.log('Creating template with data:', {
      name,
      description,
      userId,
      mapping,
      expectedHeaders
    });
    
    const template = new ImportTemplate({
      name,
      description,
      userId,
      mapping,
      expectedHeaders
    });
    
    await template.save();
    console.log('Template saved successfully:', template);
    res.json(ApiResponse.success(template, 'Template created successfully'));
  } catch (error) {
    console.error('Error creating template:', error);
    res.status(500).json(ApiResponse.error('Failed to create template'));
  }
};

// Get specific template (no ownership check needed)
export const getTemplate = async (req, res) => {
  try {
    const { id } = req.params;
    
    const template = await ImportTemplate.findById(id)
      .populate('userId', 'name email');
    
    if (!template) {
      return res.status(404).json(ApiResponse.error('Template not found'));
    }
    
    res.json(ApiResponse.success(template, 'Template retrieved successfully'));
  } catch (error) {
    res.status(500).json(ApiResponse.error('Failed to retrieve template'));
  }
};

// Update template (only creator can update)
export const updateTemplate = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id || 'anonymous';
    const updateData = req.body;
    
    const template = await ImportTemplate.findOneAndUpdate(
      { _id: id, userId }, // Only creator can update
      updateData,
      { new: true }
    );
    
    if (!template) {
      return res.status(404).json(ApiResponse.error('Template not found or you cannot update this template'));
    }
    
    res.json(ApiResponse.success(template, 'Template updated successfully'));
  } catch (error) {
    console.error('Error updating template:', error);
    res.status(500).json(ApiResponse.error('Failed to update template'));
  }
};

// Delete template (only creator can delete)
export const deleteTemplate = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id || 'anonymous';
    
    const template = await ImportTemplate.findOneAndDelete({ 
      _id: id, 
      userId // Only creator can delete
    });
    
    if (!template) {
      return res.status(404).json(ApiResponse.error('Template not found or you cannot delete this template'));
    }
    
    res.json(ApiResponse.success('Template deleted successfully'));
  } catch (error) {
    console.error('Error deleting template:', error);
    res.status(500).json(ApiResponse.error('Failed to delete template'));
  }
};

