import { Router } from 'express';
import { createTemplate, deleteTemplate, getTemplate, getTemplates, updateTemplate } from '../controllers/template.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';

const router = Router();

// Apply authentication middleware to all template routes
// router.use(authenticate);

router.get('/', getTemplates);
router.post('/', createTemplate);
router.get('/:id', getTemplate);
router.put('/:id', updateTemplate);
router.delete('/:id', deleteTemplate);

export default router;