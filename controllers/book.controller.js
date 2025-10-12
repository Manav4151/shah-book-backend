import Book from '../models/book.schema.js';
import BookPricing from '../models/BookPricing.js';
import mongoose from 'mongoose';
import importExcel from '../utils/excelImport.js';
import { validateExcelMapping, bulkImportExcel } from '../utils/bulkImport.js';
import path from 'path';
import { log } from 'console';
import { logger } from '../lib/logger.js';
import { create } from 'domain';
import Publisher from '../models/publisher.schema.js';


/**
 * A helper function to find an existing publisher by name or create a new one.
 * This is a critical step for ensuring data integrity.
 * @param {string} publisherName - The name of the publisher.
 * @returns {Promise<string>} - The ObjectId of the publisher.
 */
const getOrCreatePublisher = async (publisherName) => {
  if (!publisherName || typeof publisherName !== 'string' || publisherName.trim() === '') {
    // Handle cases where publisher name is missing or invalid
    // Depending on requirements, you could throw an error or return null
    throw new Error('Publisher name is required and must be a non-empty string.');
  }

  const trimmedName = publisherName.trim();

  // Find a publisher with a case-insensitive match
  const existingPublisher = await Publisher.findOne({
    name: new RegExp(`^${trimmedName}$`, 'i')
  });

  if (existingPublisher) {
    return existingPublisher._id;
  }

  // If no publisher is found, create a new one
  const newPublisher = await Publisher.create({ name: trimmedName });
  return newPublisher._id;
};
export const checkBookStatus = async (req, res) => {
  try {
    const { bookData, pricingData, publisherData } = req.body;

    if (!bookData || !pricingData) {
      return res.status(400).json({ message: "bookData and pricingData are required" });
    }

    const { isbn, other_code, title, author } = bookData;
    const { source } = pricingData;
    const { publisher_name } = publisherData

    let existingBook = null;
    let response = {};
    const publisherId = await getOrCreatePublisher(publisher_name);
    // 🔹 1) If ISBN present → check by ISBN
    if (isbn) {
      existingBook = await Book.findOne({ isbn });

      if (existingBook) {
        const sameTitle = existingBook.title.toLowerCase() === title.toLowerCase();
        const sameAuthor = existingBook.author.toLowerCase() === author.toLowerCase();

        if (sameTitle && sameAuthor) {
          const sameYear = existingBook.year === bookData.year;
          const samePublisher = existingBook.publisher === publisherId;

          if (sameYear && samePublisher) {
            response = {
              status: "DUPLICATE",
              message: "This book already exists in the system.",
              existingBook,
            };
          } else {
            response = {
              status: "DUPLICATE",
              message:
                "This book already exists in the system. but some details (e.g., year or publisher) differ",
              existingBook,
              conflictFields: {
                year: { old: existingBook.year, new: bookData.year },
                publisher_name: {
                  old: existingBook.publisher_name,
                  new: bookData.publisher_name,
                },
              },
            };
          }
        } else if (sameTitle && !sameAuthor) {
          response = {
            status: "AUTHOR_CONFLICT",
            message: "Conflict detected: A book with this ISBN and title already exists but has different details. Please verify.",
            existingBook,
            newData: bookData,
            conflictFields: {
              author: { old: existingBook.author, new: author },
            },
          };

        } else {
          response = {
            status: "CONFLICT",
            message: "Conflict detected: A book with this ISBN already exists but has different details. Please verify.",
            existingBook,
            newData: bookData,
            conflictFields: {
              title: !sameTitle ? { old: existingBook.title, new: title } : null,
              author: !sameAuthor ? { old: existingBook.author, new: author } : null,
            },
          };
          return res.json(response);
        }

        // ✅ Book found → check pricing
        return await handlePricingCheck(res, existingBook, pricingData, response);
      }
    }

    // 🔹 2) If ISBN not found OR not present → check by other_code first, then Title + Author
    if (!existingBook) {
      // Check by other_code if present
      if (other_code) {
        existingBook = await Book.findOne({ other_code });

        if (existingBook) {
          const sameTitle = existingBook.title.toLowerCase() === title.toLowerCase();
          const sameAuthor = existingBook.author.toLowerCase() === author.toLowerCase();

          if (sameTitle && sameAuthor) {
            const sameYear = existingBook.year === bookData.year;
            const samePublisher = existingBook.publisher === publisherId;

            if (sameYear && samePublisher) {
              response = {
                status: "DUPLICATE",
                message: "This book already exists in the system.",
                existingBook,
              };
            } else {
              response = {
                status: "DUPLICATE",
                message:
                  "This book already exists in the system. but some details (e.g., year or publisher) differ",
                existingBook,
                conflictFields: {
                  year: { old: existingBook.year, new: bookData.year },
                  publisher_name: {
                    old: existingBook.publisher_name,
                    new: bookData.publisher_name,
                  },
                },
              };
            }
            return await handlePricingCheck(res, existingBook, pricingData, response);
          } else {
            response = {
              status: "CONFLICT",
              message: "Conflict detected: A book with this ISBN already exists but has different details. Please verify.",
              existingBook,
              newData: bookData,
              conflictFields: {
                title: !sameTitle ? { old: existingBook.title, new: title } : null,
                author: !sameAuthor ? { old: existingBook.author, new: author } : null,
              },
            };
            return res.json(response);
          }
        }
      }

      // If no match by other_code, check by Title + Author
      if (!existingBook) {
        existingBook = await Book.findOne({
          title: new RegExp(`^${title}$`, "i"),
        });
      }

      if (existingBook) {
        const sameAuthor = existingBook.author.toLowerCase() === author.toLowerCase();

        if (sameAuthor) {
          const sameYear = existingBook.year === bookData.year;
          const samePublisher = existingBook.publisher === publisherId;

          if (sameYear && samePublisher) {
            response = {
              status: "DUPLICATE",
              message: "This book already exists in the system.",
              existingBook,
              isbn: { old: existingBook.isbn, new: bookData.isbn },
              other_code: { old: existingBook.other_code, new: bookData.other_code },
            };
          } else {
            response = {
              status: "DUPLICATE",
              message:
                "This book already exists in the system.but some details (e.g., year or publisher) differ",
              existingBook,
              conflictFields: {
                isbn: { old: existingBook.isbn, new: bookData.isbn },
                other_code: { old: existingBook.other_code, new: bookData.other_code },
                year: { old: existingBook.year, new: bookData.year },
                publisher_name: {
                  old: existingBook.publisher_name,
                  new: bookData.publisher_name,
                },
              },
            };
          }
        } else {
          response = {
            status: "AUTHOR_CONFLICT",
            message: "Conflict detected: A book with this ISBN already exists but has different details. Please verify.",
            existingBook,
            newData: bookData,
            conflictFields: {
              isbn: { old: existingBook.isbn, new: bookData.isbn },
              author: { old: existingBook.author, new: author },
            },
          };
        }

        // ✅ Book found → check pricing
        return await handlePricingCheck(res, existingBook, pricingData, response);
      }
    }

    // 🔹 3) If no match found → New book + price
    // const newBook = new Book(bookData);


    // const newPricing = new BookPricing({ ...pricingData, book: newBook._id });

    response = {
      status: "NEW",
      message: "No matching book found. Inserted as new book.",
      newData: bookData,
      pricingAction: "PRICE_ADDED",
    };

    return res.json(response);
  } catch (error) {
    console.error("Error checking duplicate:", error);
    res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
  }
};

// 🔹 Helper for Pricing Logic
const handlePricingCheck = async (res, existingBook, pricingData, baseResponse) => {
  const { source, rate, discount } = pricingData;

  const existingPricing = await BookPricing.findOne({
    book: existingBook._id,
    source,
  });

  if (!existingPricing) {
    return res.json({
      ...baseResponse,
      pricingAction: "ADD_PRICE",
      message: `${baseResponse.message} | Pricing source is new, add pricing.`,
      bookId: existingBook._id,
    });
  }

  const differences = [];
  if (existingPricing.rate !== rate) {
    differences.push({ field: "rate", existing: existingPricing.rate, new: rate });
  }
  if (existingPricing.discount !== discount) {
    differences.push({
      field: "discount",
      existing: existingPricing.discount,
      new: discount,
    });
  }

  if (differences.length > 0) {
    return res.json({
      ...baseResponse,
      pricingAction: "UPDATE_POSSIBLE",
      message: baseResponse.message,
      differences,
      bookId: existingBook._id,
      pricingId: existingPricing._id,
      // pricingAction: "UPDATE_PRICE",
    });
  }

  return res.json({

    ...baseResponse,
    status: "DUPLICATE",
    pricingAction: "NO_CHANGE",
    message: baseResponse.message,
    bookId: existingBook._id,
    pricingId: existingPricing._id,
  });
};

export const createOrUpdateBook = async (req, res) => {
  const { bookData, pricingData, bookId, pricingId, status, pricingAction, publisherData } = req.body;

  if (!status || !bookData || !pricingData) {
    return res.status(400).json({ message: 'Request must include action, bookData, and pricingData.' });
  }

  // --- ACTION: CREATE_NEW ---
  if (status === 'NEW') {
    try {
      
      const newBook = new Book(bookData);
      const savedBook = await newBook.save();

      try {
        const newBookPricing = new BookPricing({ ...pricingData, book: savedBook._id });
        const savedPricing = await newBookPricing.save();

        return res.status(201).json({
          message: 'Book and pricing created successfully.',
          book: savedBook,
          pricing: savedPricing
        });
      } catch (pricingError) {
        // Cleanup orphaned book if pricing creation fails
        await Book.findByIdAndDelete(savedBook._id);
        console.error('Pricing create failed, book rolled back:', pricingError);
        return res.status(500).json({ message: 'Pricing creation failed. Book was removed.', error: pricingError.message });
      }

    } catch (bookError) {
      console.error('Book create failed:', bookError);
      return res.status(500).json({ message: 'Failed to create book.', error: bookError.message });
    }
  }

  // --- ACTION: ADD_PRICE ---
  if (pricingAction === 'ADD_PRICE') {
    if (!bookId) return res.status(400).json({ message: 'bookId is required to add new pricing.' });
    try {
      const newPricing = new BookPricing({ ...pricingData, book: bookId });
      const savedPricing = await newPricing.save();
      return res.status(201).json({ message: 'New pricing added successfully.', data: savedPricing });
    } catch (error) {
      console.error('Add pricing error:', error);
      return res.status(500).json({ message: 'Failed to add new pricing.', error: error.message });
    }
  }

  // --- ACTION: UPDATE_EXISTING ---
  if (pricingAction === 'UPDATE_POSSIBLE' || pricingAction === 'UPDATE_PRICE') {
    if (!bookId || !pricingId) {
      return res.status(400).json({ message: 'bookId and pricingId are required for an update.' });
    }
    try {
      const updatedBook = await Book.findByIdAndUpdate(bookId, bookData, { new: true });
      const updatedPricing = await BookPricing.findByIdAndUpdate(pricingId, pricingData, { new: true });

      return res.status(200).json({
        message: 'Data updated successfully.',
        book: updatedBook,
        pricing: updatedPricing
      });
    } catch (error) {
      console.error('Update error:', error);
      return res.status(500).json({ message: 'Failed to update data.', error: error.message });
    }
  }

  return res.status(400).json({ message: 'Invalid action specified.' });
};

// --- GET ALL BOOKS (with Pagination) ---
// --- GET ALL BOOKS (with Pagination, Filtering, and Pricing) ---
export const getBooks = async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;

  // Extract filter parameters
  const { title, author, isbn, year, classification, publisher_name, } = req.query;

  try {
    // Build filter object
    let filter = {};

    if (title) {
      filter.title = { $regex: title, $options: 'i' };
    }
    if (author) {
      filter.author = { $regex: author, $options: 'i' };
    }
    if (isbn) {
      filter.isbn = { $regex: isbn, $options: 'i' };
    }
    if (year) {
      filter.year = parseInt(year);
    }
    if (classification) {
      filter.classification = classification;
    }
    if (publisher_name) {
      filter.publisher_name = { $regex: publisher_name, $options: 'i' };
    }

    // Get books with filters
    const books = await Book.find(filter)
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 });

    // Get pricing data for all books
    const bookIds = books.map(book => book._id);
    const pricingData = await BookPricing.find({ book: { $in: bookIds } })
      .select('book rate discount source currency last_updated');

    // Create a map of book ID to pricing data
    const pricingMap = {};
    pricingData.forEach(pricing => {
      if (!pricingMap[pricing.book]) {
        pricingMap[pricing.book] = [];
      }
      pricingMap[pricing.book].push(pricing);
    });

    // Add pricing data to books
    const booksWithPricing = books.map(book => {
      const bookObj = book.toObject();
      bookObj.pricing = pricingMap[book._id] || [];
      // Add a primary price (first pricing entry) for display
      bookObj.price = bookObj.pricing.length > 0 ? bookObj.pricing[0].rate : null;
      return bookObj;
    });

    // Get total count with same filters
    const totalBooks = await Book.countDocuments(filter);
    const totalPages = Math.ceil(totalBooks / limit);

    // Calculate statistics
    const stats = {
      totalBooks,
      currentPage: page,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
      showing: {
        from: skip + 1,
        to: Math.min(skip + limit, totalBooks),
        total: totalBooks
      }
    };

    res.status(200).json({
      success: true,
      books: booksWithPricing,
      pagination: stats,
      filters: {
        title: title || null,
        author: author || null,
        isbn: isbn || null,
        year: year || null,
        classification: classification || null,
        publisher_name: publisher_name || null
      }
    });
  } catch (error) {
    console.error('Error fetching books:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching books.',
      error: error.message
    });
  }
};

// --- GET PRICING FOR A SPECIFIC BOOK ---
export const getBookPricing = async (req, res) => {
  const { bookId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(bookId)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid book ID format.'
    });
  }

  try {
    // Get book details first
    const book = await Book.findById(bookId);
    if (!book) {
      return res.status(404).json({
        success: false,
        message: 'Book not found.'
      });
    }

    // Get all pricing information for this book
    const pricing = await BookPricing.find({ book: bookId })
      .sort({ createdAt: -1 });

    // Calculate pricing statistics
    const pricingStats = {
      totalSources: pricing.length,
      averageRate: pricing.length > 0
        ? pricing.reduce((sum, p) => sum + p.rate, 0) / pricing.length
        : 0,
      minRate: pricing.length > 0
        ? Math.min(...pricing.map(p => p.rate))
        : 0,
      maxRate: pricing.length > 0
        ? Math.max(...pricing.map(p => p.rate))
        : 0,
      averageDiscount: pricing.length > 0
        ? pricing.reduce((sum, p) => sum + (p.discount || 0), 0) / pricing.length
        : 0
    };

    res.status(200).json({
      success: true,
      book: {
        _id: book._id,
        title: book.title,
        author: book.author,
        isbn: book.isbn,
        year: book.year,
        publisher_name: book.publisher_name,
        classification: book.classification,
        binding_type: book.binding_type,
        createdAt: book.createdAt,
        updatedAt: book.updatedAt,
        edition: book.edition,
        remarks: book.remarks
      },
      pricing: pricing,
      statistics: pricingStats,
      message: pricing.length === 0
        ? 'No pricing information found for this book.'
        : `Found ${pricing.length} pricing source(s).`
    });
  } catch (error) {
    console.error('Error fetching book pricing:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching book pricing.',
      error: error.message
    });
  }
};

// --- DELETE BOOK AND ALL ITS PRICING DATA ---
export const deleteBook = async (req, res) => {
  const { bookId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(bookId)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid book ID format.'
    });
  }

  try {
    // Check if book exists
    const book = await Book.findById(bookId);
    if (!book) {
      return res.status(404).json({
        success: false,
        message: 'Book not found.'
      });
    }

    // Delete all pricing data associated with this book
    const deletedPricing = await BookPricing.deleteMany({ book: bookId });

    // Delete the book
    const deletedBook = await Book.findByIdAndDelete(bookId);

    res.status(200).json({
      success: true,
      message: 'Book and all associated pricing data deleted successfully.',
      deletedBook: {
        _id: deletedBook._id,
        title: deletedBook.title,
        author: deletedBook.author,
        isbn: deletedBook.isbn
      },
      deletedPricingCount: deletedPricing.deletedCount,
      details: {
        bookDeleted: true,
        pricingRecordsDeleted: deletedPricing.deletedCount
      }
    });
  } catch (error) {
    console.error('Error deleting book:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while deleting book.',
      error: error.message
    });
  }
};

// --- DELETE SPECIFIC BOOK PRICING DATA ---
export const deleteBookPricing = async (req, res) => {
  const { pricingId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(pricingId)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid pricing ID format.'
    });
  }

  try {
    // Check if pricing record exists and get book details
    const pricing = await BookPricing.findById(pricingId).populate('book', 'title author isbn');
    if (!pricing) {
      return res.status(404).json({
        success: false,
        message: 'Pricing record not found.'
      });
    }

    // Delete the specific pricing record
    const deletedPricing = await BookPricing.findByIdAndDelete(pricingId);

    // Check if there are any remaining pricing records for this book
    const remainingPricingCount = await BookPricing.countDocuments({ book: pricing.book._id });

    res.status(200).json({
      success: true,
      message: 'Pricing record deleted successfully.',
      deletedPricing: {
        _id: deletedPricing._id,
        source: deletedPricing.source,
        rate: deletedPricing.rate,
        discount: deletedPricing.discount,
        currency: deletedPricing.currency
      },
      book: {
        _id: pricing.book._id,
        title: pricing.book.title,
        author: pricing.book.author,
        isbn: pricing.book.isbn
      },
      remainingPricingCount: remainingPricingCount,
      details: {
        pricingDeleted: true,
        bookStillExists: true,
        hasOtherPricingSources: remainingPricingCount > 0
      }
    });
  } catch (error) {
    console.error('Error deleting book pricing:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while deleting pricing record.',
      error: error.message
    });
  }
};

// --- UPDATE BOOK DIRECTLY ---
export const updateBook = async (req, res) => {
  const { bookId } = req.params;
  const { bookData, pricingData } = req.body;

  if (!mongoose.Types.ObjectId.isValid(bookId)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid book ID format.'
    });
  }

  if (!bookData) {
    return res.status(400).json({
      success: false,
      message: 'Book data is required for update.'
    });
  }

  try {
    // Check if book exists
    const existingBook = await Book.findById(bookId);
    if (!existingBook) {
      return res.status(404).json({
        success: false,
        message: 'Book not found.'
      });
    }

    // Update the book
    const updatedBook = await Book.findByIdAndUpdate(
      bookId,
      bookData,
      { new: true, runValidators: true }
    );

    let updatedPricing = null;

    // If pricing data is provided, update or create pricing
    if (pricingData) {
      const existingPricing = await BookPricing.findOne({
        book: bookId,
        source: pricingData.source
      });

      if (existingPricing) {
        // Update existing pricing
        updatedPricing = await BookPricing.findByIdAndUpdate(
          existingPricing._id,
          pricingData,
          { new: true }
        );
      } else {
        // Create new pricing
        updatedPricing = new BookPricing({ ...pricingData, book: bookId });
        await updatedPricing.save();
      }
    }

    res.status(200).json({
      success: true,
      message: 'Book updated successfully.',
      book: updatedBook,
      pricing: updatedPricing
    });
  } catch (error) {
    console.error('Error updating book:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating book.',
      error: error.message
    });
  }
};

export const deleteMultipleBooks = async (req, res) => {
  logger.info('Deleting multiple books', req.body);
  const { bookIds } = req.body;
  if (!Array.isArray(bookIds) || bookIds.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'Request body must include a non-empty array of bookIds.'
    });
  }

  const results = [];
  let deletedBooksCount = 0;
  let deletedPricingCount = 0;
  let errors = [];

  for (const bookId of bookIds) {

    if (!mongoose.Types.ObjectId.isValid(bookId)) {
      errors.push({ bookId, error: 'Invalid book ID format.' });
      continue;
    }
    try {
      const book = await Book.findById(bookId);
      if (!book) {
        errors.push({ bookId, error: 'Book not found.' });
        continue;
      }
      // Delete all pricing data for this book
      const pricingDeleteResult = await BookPricing.deleteMany({ book: bookId });
      // Delete the book
      const deletedBook = await Book.findByIdAndDelete(bookId);
      deletedBooksCount++;
      deletedPricingCount += pricingDeleteResult.deletedCount;
      results.push({
        bookId,
        deletedBook: {
          _id: deletedBook._id,
          title: deletedBook.title,
          author: deletedBook.author,
          isbn: deletedBook.isbn
        },
        deletedPricingCount: pricingDeleteResult.deletedCount
      });
    } catch (error) {
      errors.push({ bookId, error: error.message });
    }
  }

  res.status(200).json({
    success: true,
    message: `Bulk delete completed. Deleted ${deletedBooksCount} books and ${deletedPricingCount} pricing records.`,
    results,
    errors
  });
};

// --- VALIDATE EXCEL MAPPING ---
export const validateExcelFile = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No Excel file uploaded'
      });
    }

    const filePath = req.file.path;
    const originalName = path.basename(req.file.originalname, path.extname(req.file.originalname));

    logger.info('Validating Excel file mapping', {
      fileName: req.file.originalname,
      filePath
    });

    const validationResult = await validateExcelMapping(filePath);

    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        message: validationResult.message,
        error: validationResult.error
      });
    }

    // Clean up uploaded file after validation
    try {
      const fs = await import('fs');
      fs.unlinkSync(filePath);
    } catch (cleanupError) {
      logger.warn('Could not clean up validation file:', cleanupError);
    }

    res.status(200).json({
      success: true,
      message: 'Excel file validation completed',
      data: {
        fileName: req.file.originalname,
        headers: validationResult.headers,
        mapping: validationResult.mapping,
        unmappedHeaders: validationResult.unmappedHeaders,
        suggestedMapping: validationResult.suggestedMapping,
        validation: validationResult.validation
      }
    });

  } catch (error) {
    logger.error('Error validating Excel file:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during Excel validation',
      error: error.message
    });
  }
};

// --- BULK IMPORT EXCEL ---
export const bulkImportExcelFile = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No Excel file uploaded'
      });
    }

    const { mapping, options } = req.body;

    // Parse mapping if it's a string
    let parsedMapping = mapping;
    if (typeof mapping === 'string') {
      try {
        parsedMapping = JSON.parse(mapping);
      } catch (parseError) {
        logger.warn('Could not parse mapping JSON:', parseError);
        return res.status(400).json({
          success: false,
          message: 'Invalid mapping format'
        });
      }
    }

    if (!parsedMapping || typeof parsedMapping !== 'object') {
      return res.status(400).json({
        success: false,
        message: 'Column mapping is required'
      });
    }

    const filePath = req.file.path;
    const originalName = path.basename(req.file.originalname, path.extname(req.file.originalname));

    logger.info('Starting bulk Excel import', {
      fileName: req.file.originalname,
      filePath,
      mapping: parsedMapping,
      options
    });

    // Parse options if provided as string
    let importOptions = {};
    if (options) {
      try {
        importOptions = typeof options === 'string' ? JSON.parse(options) : options;
      } catch (parseError) {
        logger.warn('Could not parse import options, using defaults:', parseError);
      }
    }

    const importResult = await bulkImportExcel(filePath, parsedMapping, originalName, importOptions);

    if (!importResult.success) {
      return res.status(500).json({
        success: false,
        message: importResult.message,
        error: importResult.error
      });
    }

    // Clean up uploaded file after import
    try {
      const fs = await import('fs');
      fs.unlinkSync(filePath);
    } catch (cleanupError) {
      logger.warn('Could not clean up import file:', cleanupError);
    }

    res.status(200).json({
      success: true,
      message: 'Bulk import completed successfully',
      data: {
        fileName: req.file.originalname,
        stats: importResult.stats,
        summary: importResult.summary,
        logFile: importResult.logFile,
        logFileUrl: importResult.logFileUrl
      }
    });

  } catch (error) {
    logger.error('Error during bulk Excel import:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during bulk import',
      error: error.message
    });
  }
};

// UPDATED: Book suggestions controller
export const getBookSuggestions = async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.trim() === '') {
      return res.json({ success: true, books: [] });
    }
    const books = await Book.find(
      { $text: { $search: q } },
      { score: { $meta: "textScore" } }
    )
      .sort({ score: { $meta: "textScore" } })
      .populate('publisher', 'name') // <-- Use populate to get publisher name
      .limit(10)
      .select("title author year publisher"); // <-- Select the 'publisher' object

    res.json({ success: true, books });
  } catch (error) {
    logger.error('Error fetching book suggestions:', error);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};