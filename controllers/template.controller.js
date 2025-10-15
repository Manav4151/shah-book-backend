import Template from '../models/template.schema.js';
import crypto from 'crypto';

// Create a stable fingerprint for a header array
function fingerprintHeaders(headers) {
  const normalized = Array.isArray(headers)
    ? headers.map(h => (h || '').toString().trim()).filter(Boolean)
    : [];
  const joined = normalized.join('|').toLowerCase();
  return crypto.createHash('sha1').update(joined).digest('hex');
}

// POST /api/templates
export async function createTemplate(req, res) {
  try {
    const { name, description, headers, mapping, sheetName } = req.body;
    if (!name || !Array.isArray(headers) || !mapping || typeof mapping !== 'object') {
      return res.status(400).json({ success: false, message: 'name, headers[], and mapping are required' });
    }

    const createdBy = req.user?.id || req.user?.email || null;
    const headersFingerprint = fingerprintHeaders(headers);

    const template = await Template.create({
      name,
      description: description || null,
      headers,
      mapping,
      sheetName: sheetName || null,
      createdBy,
      headersFingerprint,
    });

    return res.status(201).json({ success: true, data: template });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Error creating template', error: error.message });
  }
}

// GET /api/templates
export async function listTemplates(req, res) {
  try {
    const createdBy = req.user?.id || req.user?.email || null;
    const query = createdBy ? { $or: [{ createdBy }, { createdBy: null }] } : {};
    const templates = await Template.find(query).sort({ updatedAt: -1 });
    return res.status(200).json({ success: true, data: templates });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Error fetching templates', error: error.message });
  }
}

// GET /api/templates/match?headers=a&headers=b
export async function matchTemplate(req, res) {
  try {
    const headers = Array.isArray(req.query.headers)
      ? req.query.headers
      : typeof req.query.headers === 'string'
        ? [req.query.headers]
        : [];

    if (!headers.length) {
      return res.status(400).json({ success: false, message: 'headers query params are required' });
    }

    const createdBy = req.user?.id || req.user?.email || null;
    const headersFingerprint = fingerprintHeaders(headers);

    const query = createdBy
      ? { headersFingerprint, $or: [{ createdBy }, { createdBy: null }] }
      : { headersFingerprint };

    const template = await Template.findOne(query).sort({ updatedAt: -1 });
    return res.status(200).json({ success: true, data: template });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Error matching template', error: error.message });
  }
}

// GET /api/templates/:id
export async function getTemplate(req, res) {
  try {
    const { id } = req.params;
    const template = await Template.findById(id);
    if (!template) {
      return res.status(404).json({ success: false, message: 'Template not found' });
    }
    return res.status(200).json({ success: true, data: template });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Error fetching template', error: error.message });
  }
}


