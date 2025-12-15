import ImportTemplate from '../models/import.template.js';
import { ApiResponse } from '../lib/api-response.js';

// Get all templates (no filtering needed)
export const getTemplates = async (req, res) => {
  try {
    const agentId = req.user?.agentId;

    if (!agentId) {
      return res
        .status(401)
        .json(ApiResponse.error("Unauthorized - Missing agent identity"));
    }

    const templates = await ImportTemplate.find({ agentId })
      .select(
        "name description mapping expectedHeaders userId usageCount lastUsedAt createdAt"
      )
      .sort({ lastUsedAt: -1, createdAt: -1 });

    if (!templates || templates.length === 0) {
      return res
        .status(404)
        .json(ApiResponse.error("No templates found for this agent"));
    }

    res.json(ApiResponse.success(templates, "Templates retrieved successfully"));
  } catch (error) {
    console.error("Error getting templates:", error);
    res.status(500).json(ApiResponse.error("Failed to retrieve templates"));
  }
};


// Create new template (no isPublic field)
export const createTemplate = async (req, res) => {
  try {
    const { name, description, mapping, expectedHeaders } = req.body;

    const userId = req.user?.id || `temp_user_${Date.now()}`;
    const agentId = req.user?.agentId;

    if (!agentId) {
      return res.status(400).json(ApiResponse.error("Agent not found in request"));
    }

    console.log('Creating template with data:', {
      name,
      description,
      userId,
      agentId,
      mapping,
      expectedHeaders
    });

    const template = new ImportTemplate({
      name,
      description,
      userId,
      agentId, // 🔐 Assigned Tenant
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
    const agentId = req.user?.agentId;

    if (!agentId) {
      return res.status(401).json(ApiResponse.error("Unauthorized - Agent missing"));
    }

    const template = await ImportTemplate.findOne({
      _id: id,
      agentId: agentId   // 🔐 Tenant isolation check
    }).populate('userId', 'name email');

    if (!template) {
      return res.status(404).json(ApiResponse.error('Template not found or unauthorized'));
    }

    res.json(ApiResponse.success(template, 'Template retrieved successfully'));
  } catch (error) {
    console.error("Error fetching template: ", error);
    res.status(500).json(ApiResponse.error('Failed to retrieve template'));
  }
};

// Update template (only creator can update)
export const updateTemplate = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;
    const agentId = req.user?.agentId;
    const updateData = req.body;

    if (!agentId) {
      return res
        .status(401)
        .json(ApiResponse.error("Unauthorized - Agent information missing"));
    }

    const template = await ImportTemplate.findOneAndUpdate(
      { 
        _id: id, 
        userId,     // Only the creator can update
        agentId     // Must belong to same tenant
      },
      updateData,
      { new: true }
    );

    if (!template) {
      return res
        .status(404)
        .json(ApiResponse.error("Template not found or you don't have permission to update"));
    }

    res.json(
      ApiResponse.success(template, "Template updated successfully")
    );
  } catch (error) {
    console.error("Error updating template:", error);
    res
      .status(500)
      .json(ApiResponse.error("Failed to update template"));
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

export const getMappingFields = async (req, res) => {
  try {
    const { id } = req.params;
    const agentId = req.user?.agentId;

    if (!agentId) {
      return res.status(401).json(ApiResponse.error("Unauthorized - Agent information missing"));
    }
    const mappingFields = [
      {
        value: 'title',
        label: 'Title',
        category: 'book',
        required: true
      },
      {
        value: 'author',
        label: 'Author',
        category: 'book'
      },
      {
        value: 'year',
        label: 'Year',
        category: 'book'
      },
      {
        value: 'publisher_name',
        label: 'Publisher',
        category: 'book'
      },
      {
        value: 'isbn',
        label: 'ISBN',
        category: 'book',
        required: true
      },
      {
        value: 'binding_type',
        label: 'Binding Type',
        category: 'pricing'
      },
      {
        value: 'classification',
        label: 'Classification',
        category: 'book'
      },
      {
        value: 'rate',
        label: 'Rate',
        category: 'pricing'
      },
      {
        value: 'currency',
        label: 'Currency',
        category: 'pricing'
      },
      {
        value: 'discount',
        label: 'Discount',
        category: 'pricing'
      },
      {
        value: 'other_code',
        label: 'Other Code',
        category: 'book'
      },
      {
        value: 'edition',
        label: 'Edition',
        category: 'book'
      },
      {
        value: 'remarks',
        label: 'Remarks',
        category: 'book'
      }

    ];
    res.json(ApiResponse.success(mappingFields, 'Mapping fields retrieved successfully'));
  } catch (error) {
    console.error('Error fetching mapping fields:', error);
    res.status(500).json(ApiResponse.error('Failed to retrieve mapping fields'));
  }
};

/*
const defaultHeaderMap = {
    "ISBN": "isbn",
    "Non ISBN": "nonisbn",
    "Other Code": "other_code",
    "Title": "title",
    "Author": "author",
    "EDITION": "edition",
    "Edition": "edition",
    "Year": "year",
    "Publisher": "publisher_name",
    "Binding Type": "binding_type",
    "Classification": "classification",
    "Remarks": "remarks",
    "Price": "rate",
    "Rate": "rate",
    "Currency": "currency",
    "Discount": "discount",
};
*/