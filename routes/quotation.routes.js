import { Router } from "express";
import { createQuotation, downloadQuotationPDF, getQuotationById, getQuotations, previewQuotation, previewQuotationPDF, sendQuotationEmail, updateQuotation } from "../controllers/quotation.controller.js";
import multer from "multer";
import { authenticate } from "../middleware/auth.middleware.js";
// Apply authentication middleware to all template routes
const router = Router();
router.use(authenticate);
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB limit
    },
    fileFilter: (req, file, cb) => {
        // Allow common file types
        const allowedTypes = [
            'image/jpeg',
            'image/png',
            'image/gif',
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'text/plain',
            'application/zip',
            'application/x-zip-compressed'
        ];

        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('File type not allowed'), false);
        }
    }
});
router.get('/', getQuotations);

// Place specific routes before dynamic :id routes to avoid route conflicts
router.route('/preview').post(previewQuotation);
router.route('/create').post(createQuotation);
// share quotation 
router.post('/sendQuotation', upload.single('attachment'), sendQuotationEmail);
// 4. Add the new routes for handling specific actions by ID
router.route('/:id/download')
    .get(downloadQuotationPDF);

router.route('/:id/preview')
    .get(previewQuotationPDF);

// Update quotation (must be before get by id to avoid conflicts)
router.put('/:id', updateQuotation);

// Get single quotation by ID (must be last to avoid conflicts with /preview and /create)
router.get('/:id', getQuotationById);

export default router;