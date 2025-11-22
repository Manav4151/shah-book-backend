// import { Router } from 'express';
// import multer from 'multer';
// import { getEmails, getEmailById, sendEmail, downloadAttachment } from '../controllers/email.controller.js';

// const router = Router();

// // Configure multer for handling file uploads (attachments)
// const upload = multer({ 
//     storage: multer.memoryStorage(),
//     limits: {
//         fileSize: 10 * 1024 * 1024, // 10MB limit
//     },
//     fileFilter: (req, file, cb) => {
//         // Allow common file types
//         const allowedTypes = [
//             'image/jpeg',
//             'image/png',
//             'image/gif',
//             'application/pdf',
//             'application/msword',
//             'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
//             'application/vnd.ms-excel',
//             'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
//             'text/plain',
//             'application/zip',
//             'application/x-zip-compressed'
//         ];
        
//         if (allowedTypes.includes(file.mimetype)) {
//             cb(null, true);
//         } else {
//             cb(new Error('File type not allowed'), false);
//         }
//     }
// });

// // Email routes
// router.get('/', getEmails); // GET /api/emails - Get list of emails
// router.get('/:uid', getEmailById); // GET /api/emails/:uid - Get single email
// router.post('/send', upload.single('attachment'), sendEmail); // POST /api/emails/send - Send email
// router.get('/:uid/attachments/:filename', downloadAttachment); // GET /api/emails/:uid/attachments/:filename - Download attachment

// export default router;
