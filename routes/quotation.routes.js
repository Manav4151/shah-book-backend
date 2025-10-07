import { Router } from "express";
import { downloadQuotationPDF, getQuotations, previewQuotationPDF } from "../controllers/quotation.controller.js";

const router = Router();

router.get('/',getQuotations);

// 4. Add the new routes for handling specific actions by ID
router.route('/:id/download')
    .get(downloadQuotationPDF);

router.route('/:id/preview')
    .get(previewQuotationPDF);

export default router;