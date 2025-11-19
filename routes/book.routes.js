import { Router } from 'express';
const router = Router();
// import { createBook, getAllBooks, getBookById, updateBook, deleteBook, bulkImportBooks } from '../controllers/book.controller.js';
import uploadMiddleware from '../middleware/upload.middleware.js';
import { createOrUpdateBook, deleteBook, deleteBookPricing, deleteMultipleBooks, getBookPricing, getBooks, updateBook, validateExcelFile, bulkImportExcelFile, getBookSuggestions, markAsOutofPrint, getBookDetails } from '../controllers/book.controller.js';
import { checkBookStatus } from '../controllers/duplicate.controller.js';
import { authenticate, authorizeRoles } from '../middleware/auth.middleware.js';

router.use(authenticate);
// Route for creating/updating a book or its pricing
router.post('/', createOrUpdateBook);

// Bulk import route
// router.route('/import')
//   .post(uploadMiddleware, bulkImportBooks);

// // Chained routes for operations on a single book by its ID
// router.route('/:id')
//   .get(getBookById)
//   .put(updateBook)
//   .delete(deleteBook);

router.get('/', getBooks); // GET /api/books
router.get('/:bookId/details', getBookDetails);
router.get('/:bookId/pricing', getBookPricing);
router.put('/:bookId/outOfPrint', authorizeRoles("ADMIN", "INVENTORY_MANAGER"), markAsOutofPrint);
// Update route
router.put('/:bookId', updateBook); // PUT /api/books/some_id (updates book and optionally pricing)

// Delete routes
// router.delete('/:bookId', deleteBook); // DELETE /api/books/some_id (deletes book and all its pricing)
router.delete('/pricing/:pricingId', authorizeRoles("ADMIN", "INVENTORY_MANAGER"), deleteBookPricing); // DELETE /api/books/pricing/some_pricing_id (deletes specific pricing)
router.delete('/bulk', authorizeRoles("ADMIN", "INVENTORY_MANAGER"), deleteMultipleBooks); // DELETE /api/books/bulk (deletes multiple books and their pricing)

// Bulk import routes
router.post('/validate-excel', uploadMiddleware, validateExcelFile); // POST /api/books/validate-excel (validate Excel column mapping)
router.post('/bulk-import', uploadMiddleware, bulkImportExcelFile); // POST /api/books/bulk-import (bulk import Excel data)
router.post('/check-duplicate', checkBookStatus); // POST /api/books/check-duplicate (check duplicate book)
router.get('/suggestions', getBookSuggestions);

export default router;