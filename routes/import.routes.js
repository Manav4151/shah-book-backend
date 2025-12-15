import express from 'express';
// import uploadMiddleware from '../middleware/upload.middleware.js';
import { upload } from '../middleware/new.middleware.js';
 // The file we just created
import { 
    previewFile, 
    processImport,
    getDbFields // <--- New Helper Function (see below)
} from '../controllers/import.controller.js';
 // Assuming you have auth
import { authenticate } from '../middleware/auth.middleware.js'
import { getTemplatesNew, saveTemplateNew } from '../controllers/import.template.controller.js';
const router = express.Router();
router.use(authenticate);
// 1. Preview: Upload file to see headers
router.post('/preview', upload.single('file'), previewFile);

// 2. Templates: Get and Save
router.get('/templates', getTemplatesNew);
router.post('/templates', saveTemplateNew);

// 3. Process: The actual import (Requires file + mapping data)
router.post('/process', upload.single('file'), processImport);

// 4. Configuration: Send available DB fields to Frontend
router.get('/config/fields', getDbFields);

export default router;