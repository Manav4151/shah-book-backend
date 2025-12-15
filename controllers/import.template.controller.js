import ImportTemplate from '../models/import.template.js'; //

// Get all templates for this agent
export const getTemplatesNew = async (req, res) => {
  try {
    const templates = await ImportTemplate.find({ agentId: req.user.agentId });
    res.json(templates);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Save a new template
export const saveTemplateNew = async (req, res) => {
  try {
    const { name, mapping, expectedHeaders } = req.body;
    
    const template = await ImportTemplate.create({
      agentId: req.user.agentId,
      name,
      mapping,
      expectedHeaders
    });
    
    res.status(201).json(template);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};