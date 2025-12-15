import multer from 'multer';
import path from 'path';
import fs from 'fs';

// Ensure uploads directory exists
const uploadsDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadsDir);
    },
    filename: function (req, file, cb) {
        // Generate unique filename with timestamp
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        const name = path.basename(file.originalname, ext);
        cb(null, `${name}-${uniqueSuffix}${ext}`);
    }
});

// File filter to only allow Excel files
const fileFilter = (req, file, cb) => {
    const allowedTypes = [
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
        'application/vnd.ms-excel' // .xls
    ];

    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Only Excel files (.xlsx, .xls) are allowed!'), false);
    }
};

// Configure multer
const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB limit
    }
});

// Middleware for single file upload
const uploadSingle = upload.single('excelFile');

// Wrapper middleware to handle multer errors
const handleUpload = (req, res, next) => {
    uploadSingle(req, res, (err) => {
        console.log("file reach hear1");
        if (err instanceof multer.MulterError) {
        console.log("file reach hear3");

            if (err.code === 'LIMIT_FILE_SIZE') {
        console.log("file reach hear2");

                return res.status(400).json({
                    message: 'File too large',
                    error: 'File size must be less than 10MB'
                });
            }
            return res.status(400).json({
                message: 'Upload error',
                error: err.message
            });
        } else if (err) {
            return res.status(400).json({
                message: 'Upload error',
                error: err.message
            });
        }
        next();
    });
};

export default handleUpload;
