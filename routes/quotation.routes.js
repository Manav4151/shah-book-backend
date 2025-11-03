import { Router } from "express";
import { createQuotation, downloadQuotationPDF, getQuotationById, getQuotations, previewQuotation, previewQuotationPDF } from "../controllers/quotation.controller.js";

const router = Router();

router.get('/',getQuotations);

// Place specific routes before dynamic :id routes to avoid route conflicts
router.route('/preview').post(previewQuotation);
router.route('/create').post(createQuotation);

// 4. Add the new routes for handling specific actions by ID
router.route('/:id/download')
    .get(downloadQuotationPDF);

router.route('/:id/preview')
    .get(previewQuotationPDF);

// Get single quotation by ID (must be last to avoid conflicts with /preview and /create)
router.get('/:id', getQuotationById);

export default router;