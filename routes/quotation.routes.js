import { Router } from "express";
import { createQuotation, downloadQuotationPDF, getQuotationById, getQuotations, previewQuotation, previewQuotationPDF, sendQuotationEmail, updateQuotation } from "../controllers/quotation.controller.js";
import multer from "multer";
import { authenticate, authorizeRoles } from "../middleware/auth.middleware.js";
import { ROLES } from "../lib/auth.js";
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
// 🔍 View all quotations — all roles allowed
router.get(
    "/",
    authorizeRoles(),   // this means ALLOW ALL ROLES
    getQuotations
);

// 🔍 Preview quotation (all roles)
router.post(
    "/preview",
    authorizeRoles(),
    previewQuotation
);

// 📝 Create quotation — ONLY ADMIN + SALES_EXECUTIVE
router.post(
    "/create",
    authorizeRoles(ROLES.ADMIN, ROLES.SALES_EXECUTIVE),

    createQuotation
);

// 📤 Share quotation (also only creation roles)
router.post(
    "/sendQuotation",
    authorizeRoles(ROLES.ADMIN, ROLES.SALES_EXECUTIVE),
    upload.single("attachment"),
    sendQuotationEmail
);

// 📥 Download PDF (all roles)
router.get(
    "/:id/download",
    authorizeRoles(),
    downloadQuotationPDF
);

// 🔎 Preview PDF (all roles)
router.get(
    "/:id/preview",
    authorizeRoles(),
    previewQuotationPDF
);

// ✏️ Update quotation — ONLY ADMIN + SALES_EXECUTIVE
router.put(
    "/:id",
    authorizeRoles(ROLES.ADMIN, ROLES.SALES_EXECUTIVE),
    updateQuotation
);

// 🔎 Get single quotation (all roles)
router.get(
    "/:id",
    authorizeRoles(),
    getQuotationById
);

export default router;