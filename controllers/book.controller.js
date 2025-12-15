import Book from '../models/book.schema.js';
import BookPricing from '../models/BookPricing.js';
import mongoose from 'mongoose';
import { validateExcelMapping, bulkImportExcel } from '../utils/excelImport.js';
import path from 'path';
import { log } from 'console';
import { logger } from '../lib/logger.js';
import { create } from 'domain';
import Publisher from '../models/publisher.schema.js';
import { ROLES } from '../lib/auth.js';
import BookVendorPricing from '../models/bookvendorpricing.schema.js';
import Vendor from '../models/vendor.schema.js';

// --- ISBN Helpers ---
const cleanIsbnInput = (raw) => {
  if (!raw || typeof raw !== 'string') return '';
  const upper = raw.toUpperCase();
  const alnum = upper.replace(/[^0-9X]/g, '');
  if (alnum.length > 10) {
    // ISBN-13: digits only
    return alnum.replace(/[^0-9]/g, '');
  }
  // ISBN-10: allow X only at last position
  if (alnum.includes('X') && alnum.indexOf('X') !== alnum.length - 1) {
    return alnum.replace(/X/g, '');
  }
  return alnum;
};

const validateIsbn10 = (cleanIsbn) => {
  if (!cleanIsbn || cleanIsbn.length !== 10) return false;
  if (!/^\d{9}[\dX]$/.test(cleanIsbn)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(cleanIsbn[i], 10) * (10 - i);
  }
  const checkDigit = cleanIsbn[9] === 'X' ? 10 : parseInt(cleanIsbn[9], 10);
  sum += checkDigit;
  return sum % 11 === 0;
};

const validateIsbn13 = (cleanIsbn) => {
  if (!cleanIsbn || cleanIsbn.length !== 13 || !/^\d{13}$/.test(cleanIsbn)) return false;
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const digit = parseInt(cleanIsbn[i], 10);
    sum += digit * (i % 2 === 0 ? 1 : 3);
  }
  const checkDigit = (10 - (sum % 10)) % 10;
  return checkDigit === parseInt(cleanIsbn[12], 10);
};

const isValidIsbn = (raw) => {
  if (!raw || typeof raw !== 'string' || raw.trim() === '') return false;
  const clean = cleanIsbnInput(raw);
  if (clean.length === 10) return validateIsbn10(clean);
  if (clean.length === 13) return validateIsbn13(clean);
  return false;
};

export const getOrCreatePublisher = async (publisherName, agentId) => {
  console.log("Agent id", agentId);
  if (!agentId) {
    throw new Error("Agent ID is required to create or fetch publisher");
  }

  if (!publisherName || typeof publisherName !== "string" || !publisherName.trim()) {
    throw new Error("Publisher name is required and must be a non-empty string.");
  }

  const trimmedName = publisherName.trim().toUpperCase();

  // 🔍 Find publisher only within SAME AGENT
  const existingPublisher = await Publisher.findOne({
    name: trimmedName,
    agentId: agentId
  });

  if (existingPublisher) {
    return existingPublisher._id;
  }

  // ➕ Create publisher with correct tenant
  const newPublisher = await Publisher.create({
    name: trimmedName,
    agentId: agentId
  });

  return newPublisher._id;
};

export const createOrUpdateBook = async (req, res) => {
  const agentId = req.user?.agentId; // 🟢 Secure Tenant Check
  if (!agentId) {
    return res.status(403).json({ success: false, message: "Agent not assigned" });
  }
  const { bookData, pricingData, bookId, pricingId, status, pricingAction, publisherData } = req.body;

  if (!status || !bookData || !pricingData) {
    return res.status(400).json({ success: false, message: 'Request must include action, bookData, and pricingData.' });
  }
  logger.info('Publisher data:', publisherData);

  // Normalize and validate ISBN once for all flows
  if (bookData && typeof bookData.isbn === 'string') {
    bookData.isbn = cleanIsbnInput(bookData.isbn);
    if (bookData.isbn && !isValidIsbn(bookData.isbn)) {
      return res.status(400).json({ success: false, message: 'Invalid ISBN provided.' });
    }
  }

  // --- ACTION: CREATE_NEW ---
  if (status === 'NEW') {
    try {

      const publisherID = await getOrCreatePublisher(publisherData.publisher_name, agentId);
      bookData.publisher = publisherID;
      bookData.agentId = agentId;
      const newBook = new Book(bookData);
      const savedBook = await newBook.save();

      try {
        const newBookPricing = new BookPricing({ ...pricingData, book: savedBook._id, agentId });
        const savedPricing = await newBookPricing.save();

        return res.status(201).json({
          success: true,
          message: 'Book and pricing created successfully.',
          book: savedBook,
          pricing: savedPricing
        });
      } catch (pricingError) {
        // Cleanup orphaned book if pricing creation fails
        await Book.findByIdAndDelete(savedBook._id);
        console.error('Pricing create failed, book rolled back:', pricingError);
        return res.status(500).json({ success: false, message: 'Pricing creation failed. Book was removed.', error: pricingError.message });
      }

    } catch (bookError) {
      console.error('Book create failed:', bookError);
      return res.status(500).json({ success: false, message: 'Failed to create book.', error: bookError.message });
    }
  }

  // --- ACTION: ADD_PRICE ---
  if (pricingAction === 'ADD_PRICE') {
    if (!bookId) return res.status(400).json({ success: false, message: 'bookId is required to add new pricing.' });
    const book = await Book.findOne({ _id: bookId, agentId });
    if (!book) return res.status(403).json({ success: false, message: "Unauthorized: Book does not belong to your agent" });

    try {
      const newPricing = new BookPricing({ ...pricingData, book: bookId, agentId });
      const savedPricing = await newPricing.save();
      return res.status(201).json({ success: true, message: 'New pricing added successfully.', data: savedPricing });
    } catch (error) {
      console.error('Add pricing error:', error);
      return res.status(500).json({ success: false, message: 'Failed to add new pricing.', error: error.message });
    }
  }

  // --- ACTION: UPDATE_EXISTING ---
  if (pricingAction === 'UPDATE_POSSIBLE' || pricingAction === 'UPDATE_PRICE') {
    if (!bookId || !pricingId) {
      return res.status(400).json({ success: false, message: 'bookId and pricingId are required for an update.' });
    }
    const book = await Book.findOne({ _id: bookId, agentId });
    if (!book) return res.status(403).json({ success: false, message: "Unauthorized: Book does not belong to this agent" });
    try {
      const updatedBook = await Book.findByIdAndUpdate(bookId, bookData, { new: true });
      const updatedPricing = await BookPricing.findByIdAndUpdate({ _id: pricingId, agentId }, // 🟢 must match agent
        pricingData,
        { new: true });

      return res.status(200).json({
        success: true,
        message: 'Data updated successfully.',
        book: updatedBook,
        pricing: updatedPricing
      });
    } catch (error) {
      console.error('Update error:', error);
      return res.status(500).json({ success: false, message: 'Failed to update data.', error: error.message });
    }
  }

  return res.status(400).json({ success: false, message: 'Invalid action specified.' });
};

// --- GET ALL BOOKS (with Pagination) ---
// export const getBooks = async (req, res) => {
//   try {
//     const userAgentId = req.user?.agentId;
//     const userRole = req.user?.role;

//     if (!userAgentId && userRole !== ROLES.SYSTEM_ADMIN) {
//       return res.status(403).json({
//         success: false,
//         message: "Agent ID is required for tenant-based access."
//       });
//     }

//     logger.info('📚 Books API called');

//     const page = parseInt(req.query.page) || 1;
//     const limit = parseInt(req.query.limit) || 10;
//     const skip = (page - 1) * limit;

//     const { title, author, isbn, year, classification, publisher_name } = req.query;

//     const filter = {};

//     // 🔹 Enforce Tenant Isolation — Every book belongs to an agent
//     if (userRole !== ROLES.SYSTEM_ADMIN) {
//       filter.agentId = userAgentId; // Restrict to that agent's books
//     }

//     if (title) filter.title = { $regex: title, $options: "i" };
//     if (author) filter.author = { $regex: author, $options: "i" };
//     if (isbn) filter.isbn = { $regex: isbn, $options: "i" };
//     if (year) filter.year = parseInt(year);
//     if (classification) filter.classification = {
//       $regex: classification,
//       $options: "i"
//     };

//     // 🔍 Publisher Filter
//     if (publisher_name) {
//       const cleanName = publisher_name.trim().toUpperCase();
//       const matchingPublishers = await Publisher.find({ name: cleanName }).select("_id");
//       const publisherIds = matchingPublishers.map(p => p._id);
//       filter.publisher = { $in: publisherIds };
//     }

//     const totalBooks = await Book.countDocuments(filter);

//     const books = await Book.find(filter)
//       .populate("publisher", "name")
//       .skip(skip)
//       .limit(limit)
//       .sort({ createdAt: -1 });

//     const bookIds = books.map(book => book._id);
//     const pricingData = await BookPricing.find({ book: { $in: bookIds } });

//     const pricingMap = new Map();
//     pricingData.forEach(pricing => {
//       const id = pricing.book.toString();
//       if (!pricingMap.has(id)) pricingMap.set(id, []);
//       pricingMap.get(id).push(pricing);
//     });

//     const booksWithPricing = books.map(book => {
//       const obj = book.toObject();
//       const pricing = pricingMap.get(book._id.toString()) || [];
//       obj.pricing = pricing;
//       obj.price = pricing.length > 0 ? pricing[0].rate : null;
//       return obj;
//     });

//     const totalPages = Math.ceil(totalBooks / limit);

//     res.status(200).json({
//       success: true,
//       books: booksWithPricing,
//       pagination: {
//         totalBooks,
//         currentPage: page,
//         totalPages,
//         hasNextPage: page < totalPages,
//         hasPrevPage: page > 1,
//         showing: {
//           from: skip + 1,
//           to: Math.min(skip + limit, totalBooks),
//           total: totalBooks,
//         }
//       }
//     });

//   } catch (error) {
//     logger.error("❌ Error fetching books:", error.message);
//     res.status(500).json({
//       success: false,
//       message: "Server error while fetching books.",
//       error: error.message,
//     });
//   }
// };
export const getBooks = async (req, res) => {
  try {
    const userAgentId = req.user?.agentId;
    const userRole = req.user?.role;

    if (!userAgentId && userRole !== ROLES.SYSTEM_ADMIN) {
      return res.status(403).json({
        success: false,
        message: "Agent ID is required for tenant-based access."
      });
    }

    logger.info("📚 Books API called");

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const {
      search,
      title,
      author,
      isbn,
      year,
      classification,
      publisher_name,
    } = req.query;

    const filter = {};

    // Tenant Restriction
    if (userRole !== ROLES.SYSTEM_ADMIN) {
      filter.agentId = userAgentId;
    }

    // 🌟 PRIORITY WEIGHTED TEXT SEARCH + FUZZY SUPPORT
    if (search) {
      const cleanSearch = search.trim();

      // 1. Find all Publisher IDs that match the search name
      const matchingPublishers = await Publisher.find({
        name: { $regex: cleanSearch, $options: "i" }
      }).select("_id");
      
      const publisherIds = matchingPublishers.map(p => p._id);

      // 2. Add publisher IDs to the $or array
      filter.$or = [
        { isbn: { $regex: cleanSearch, $options: "i" } },
        { title: { $regex: cleanSearch, $options: "i" } },
        { author: { $regex: cleanSearch, $options: "i" } },
        { publisher: { $in: publisherIds } } // <--- NEW: Matches books by these publishers
      ];
    }

    // Other Filters
    if (title) filter.title = { $regex: title, $options: "i" };
    if (author) filter.author = { $regex: author, $options: "i" };
    if (isbn) filter.isbn = { $regex: isbn, $options: "i" };
    if (year) filter.year = parseInt(year);
    if (classification)
      filter.classification = { $regex: classification, $options: "i" };

    // 🔍 Publisher Filter
    if (publisher_name) {
      const cleanName = publisher_name.trim().toUpperCase();
      const matchingPublishers = await Publisher.find({ name: cleanName }).select("_id");
      const publisherIds = matchingPublishers.map((p) => p._id);
      filter.publisher = { $in: publisherIds };
    }

    const totalBooks = await Book.countDocuments(filter);

    const projection = {};
    const sort = { createdAt: -1 }; // default sort

    // if (search) {
    //   projection.score = { $meta: "textScore" };
    //   sort.score = { $meta: "textScore" }; // apply relevance only when searching
    // }

    const books = await Book.find(filter, projection)
      .populate("publisher", "name")
      .skip(skip)
      .limit(limit)
      .sort(sort);

    // Pricing integration
    const bookIds = books.map((book) => book._id);
    const pricingData = await BookVendorPricing.find({ book: { $in: bookIds } });

    const pricingMap = new Map();
    pricingData.forEach((pricing) => {
      const id = pricing.book.toString();
      if (!pricingMap.has(id)) pricingMap.set(id, []);
      pricingMap.get(id).push(pricing);
    });

    const booksWithPricing = books.map((book) => {
      const obj = book.toObject();
      const pricing = pricingMap.get(book._id.toString()) || [];
      obj.pricing = pricing;
      obj.price = pricing.length > 0 ? pricing[0].rate : null;
      return obj;
    });

    const totalPages = Math.ceil(totalBooks / limit);

    res.status(200).json({
      success: true,
      books: booksWithPricing,
      pagination: {
        totalBooks,
        currentPage: page,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
        showing: {
          from: skip + 1,
          to: Math.min(skip + limit, totalBooks),
          total: totalBooks,
        },
      },
    });
  } catch (error) {
    logger.error("❌ Error fetching books:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching books.",
      error: error.message,
    });
  }
};

// --- GET PRICING FOR A SPECIFIC BOOK ---
export const getBookPricing = async (req, res) => {
  const { bookId } = req.params;
  const agentId = req.user?.agentId;

  if (!mongoose.Types.ObjectId.isValid(bookId)) {
    return res.status(400).json({
      success: false,
      message: "Invalid book ID format."
    });
  }

  try {
    // 🔍 First verify book belongs to this agent
    const bookExists = await Book.findOne({
      _id: bookId,
      agentId
    });

    if (!bookExists) {
      return res.status(404).json({
        success: false,
        message: "Book not found or access denied."
      });
    }

    // 🔐 Fetch only agent-specific pricing
    const pricing = await BookPricing.find({
      book: bookId,
      agentId
    }).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      pricing,
      message: pricing.length
        ? "Book pricing fetched successfully."
        : "No pricing found for this book."
    });

  } catch (error) {
    console.error("Error fetching book pricing:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching book pricing.",
      error: error.message
    });
  }
};
// --- GET BOOK DETAILS ---
export const getBookDetails = async (req, res) => {
  const { bookId } = req.params;
  const agentId = req.user?.agentId;

  if (!mongoose.Types.ObjectId.isValid(bookId)) {
    return res.status(400).json({
      success: false,
      message: "Invalid book ID format."
    });
  }

  try {
    // 🔐 Find book only inside current tenant (agent)
    const book = await Book.findOne({
      _id: bookId,
      agentId
    });

    if (!book) {
      return res.status(404).json({
        success: false,
        message: "Book not found or access denied."
      });
    }

    // 🔐 Fetch publisher inside tenant
    const publisher = await Publisher.findOne({
      _id: book.publisher,
      agentId
    }).select("name");

    // 🔐 Fetch pricing inside tenant
    const pricing = await BookVendorPricing.find({
      book: bookId,
      agentId
    }).populate("vendor", "name").sort({ createdAt: -1 });

    // Calculate pricing statistics
    const pricingStats = {
      totalSources: pricing.length,
      averageRate:
        pricing.length > 0
          ? pricing.reduce((sum, p) => sum + p.rate, 0) / pricing.length
          : 0,
      minRate: pricing.length > 0
        ? Math.min(...pricing.map(p => p.rate))
        : 0,
      maxRate: pricing.length > 0
        ? Math.max(...pricing.map(p => p.rate))
        : 0,
      averageDiscount:
        pricing.length > 0
          ? pricing.reduce((sum, p) => sum + (p.discount || 0), 0) /
          pricing.length
          : 0
    };

    res.status(200).json({
      success: true,
      book: {
        ...book.toObject(),
        publisher_name: publisher?.name || "Not Found"
      },
      pricing,
      statistics: pricingStats
    });
  } catch (error) {
    console.error("Error fetching book pricing:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching book pricing.",
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
  const agentId = req.user?.agentId; // 🔐 Identify tenant

  if (!mongoose.Types.ObjectId.isValid(pricingId)) {
    return res.status(400).json({
      success: false,
      message: "Invalid pricing ID format."
    });
  }

  try {
    // 🔍 Ensure pricing belongs to same tenant
    const pricing = await BookPricing.findOne({
      _id: pricingId,
      agentId
    }).populate("book", "title author isbn agentId");

    if (!pricing) {
      return res.status(404).json({
        success: false,
        message: "Pricing record not found or unauthorized."
      });
    }

    // Also ensure book belongs to same tenant
    if (pricing.book?.agentId?.toString() !== agentId.toString()) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized — This book does not belong to your agent."
      });
    }

    // Delete pricing record safely
    const deletedPricing = await BookPricing.findOneAndDelete({
      _id: pricingId,
      agentId
    });

    const remainingPricingCount = await BookPricing.countDocuments({
      book: pricing.book._id,
      agentId
    });

    res.status(200).json({
      success: true,
      message: "Pricing record deleted successfully.",
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
      remainingPricingCount,
      details: {
        pricingDeleted: true,
        bookStillExists: true,
        hasOtherPricingSources: remainingPricingCount > 0
      }
    });

  } catch (error) {
    console.error("Error deleting book pricing:", error);
    res.status(500).json({
      success: false,
      message: "Server error while deleting pricing record.",
      error: error.message
    });
  }
};

// --- UPDATE BOOK DIRECTLY ---
export const updateBook = async (req, res) => {
  const { bookId } = req.params;
  const { bookData, pricingData } = req.body;
  const agentId = req.user?.agentId; // 🔐 Multi-tenant scope

  if (!mongoose.Types.ObjectId.isValid(bookId)) {
    return res.status(400).json({
      success: false,
      message: "Invalid book ID format.",
    });
  }

  if (!bookData) {
    return res.status(400).json({
      success: false,
      message: "Book data is required for update.",
    });
  }

  try {
    // 🔐 Check if book exists & belongs to this agent
    const existingBook = await Book.findOne({ _id: bookId, agentId });
    if (!existingBook) {
      return res.status(404).json({
        success: false,
        message: "Book not found or unauthorized access.",
      });
    }

    // 🔐 Always enforce agentId on update
    const updatedBook = await Book.findOneAndUpdate(
      { _id: bookId, agentId },
      { ...bookData, agentId },
      { new: true, runValidators: true }
    );

    let updatedPricing = null;

    // Pricing Update (if exists)
    if (pricingData) {
      const existingPricing = await BookPricing.findOne({
        book: bookId,
        agentId // 🔐 Pricing must also belong to SAME tenant
      });

      if (existingPricing) {
        updatedPricing = await BookPricing.findOneAndUpdate(
          { _id: existingPricing._id, agentId },
          pricingData,
          { new: true }
        );
      } else {
        // New pricing for this tenant
        updatedPricing = new BookPricing({
          ...pricingData,
          book: bookId,
          agentId
        });
        await updatedPricing.save();
      }
    }

    res.status(200).json({
      success: true,
      message: "Book updated successfully.",
      book: updatedBook,
      pricing: updatedPricing,
    });
  } catch (error) {
    console.error("Error updating book:", error);
    res.status(500).json({
      success: false,
      message: "Server error while updating book.",
      error: error.message,
    });
  }
};


export const deleteMultipleBooks = async (req, res) => {
  logger.info("Deleting multiple books", req.body);

  const { bookIds } = req.body;
  const agentId = req.user?.agentId;

  if (!Array.isArray(bookIds) || bookIds.length === 0) {
    return res.status(400).json({
      success: false,
      message: "Request body must include a non-empty array of bookIds.",
    });
  }

  const results = [];
  let deletedBooksCount = 0;
  let deletedPricingCount = 0;
  let errors = [];

  for (const bookId of bookIds) {
    if (!mongoose.Types.ObjectId.isValid(bookId)) {
      errors.push({ bookId, error: "Invalid book ID format." });
      continue;
    }

    try {
      // 🔐 Check book belongs to this agent before deleting
      const book = await Book.findOne({ _id: bookId, agentId });

      if (!book) {
        errors.push({ bookId, error: "Book not found or access denied." });
        continue;
      }

      // Delete pricing only for this agent's book
      const pricingDeleteResult = await BookPricing.deleteMany({
        book: bookId,
        agentId,
      });

      const deletedBook = await Book.findByIdAndDelete(bookId);

      deletedBooksCount++;
      deletedPricingCount += pricingDeleteResult.deletedCount;

      results.push({
        bookId,
        deletedBook: {
          _id: deletedBook._id,
          title: deletedBook.title,
          author: deletedBook.author,
          isbn: deletedBook.isbn,
        },
        deletedPricingCount: pricingDeleteResult.deletedCount,
      });
    } catch (error) {
      errors.push({ bookId, error: error.message });
    }
  }

  return res.status(200).json({
    success: true,
    message: `Bulk delete completed. Deleted ${deletedBooksCount} access-allowed book(s) and ${deletedPricingCount} pricing record(s).`,
    results,
    errors,
  });
};


// --- VALIDATE EXCEL MAPPING ---
export const validateExcelFile = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No Excel file uploaded"
      });
    }

    const agentId = req.user?.agentId; // 🔐 Add Agent Scope Check
    const filePath = req.file.path;
    const originalName = path.basename(
      req.file.originalname,
      path.extname(req.file.originalname)
    );
    const { templateId } = req.body;

    logger.info("Validating Excel file mapping", {
      fileName: req.file.originalname,
      filePath,
      templateId,
      agentId
    });

    const validationResult = await validateExcelMapping(filePath);

    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        message: validationResult.message,
        error: validationResult.error
      });
    }

    let template = null;
    let autoMapping = {};
    let isTemplateMatch = false;
    let templateMatchDetails = null;

    // 🔐 Protect Template Access by Agent
    if (templateId) {
      try {
        const ImportTemplate =
          (await import("../models/import.template.js")).default;

        template = await ImportTemplate.findOne({
          _id: templateId,
          agentId: agentId // Ensure template belongs to the same tenant
        });

        if (!template) {
          return res.status(403).json({
            success: false,
            message: "Access denied. Template not found for your account."
          });
        }

        // Binary template matching
        const normalizedTemplate = template.expectedHeaders.map((h) =>
          h.toLowerCase().trim()
        );
        const normalizedFile = validationResult.headers.map((h) =>
          h.toLowerCase().trim()
        );

        const allHeadersMatch = normalizedTemplate.every((templateHeader) =>
          normalizedFile.includes(templateHeader)
        );

        const missingHeaders = normalizedTemplate.filter(
          (header) => !normalizedFile.includes(header)
        );

        const extraHeaders = normalizedFile.filter(
          (header) => !normalizedTemplate.includes(header)
        );

        templateMatchDetails = {
          isPerfectMatch: allHeadersMatch,
          missingHeaders,
          extraHeaders
        };

        if (allHeadersMatch) {
          autoMapping = template.mapping;
          isTemplateMatch = true;

          // Update usage safely with tenant scope
          await ImportTemplate.findOneAndUpdate(
            { _id: templateId, agentId },
            {
              $inc: { usageCount: 1 },
              lastUsedAt: new Date()
            }
          );
        }
      } catch (templateError) {
        logger.warn("Error processing template:", templateError);
      }
    }

    // Clean uploaded file
    try {
      const fs = await import("fs");
      fs.unlinkSync(filePath);
    } catch (cleanupError) {
      logger.warn("Could not clean up validation file:", cleanupError);
    }

    return res.status(200).json({
      success: true,
      message: "Excel file validation completed",
      data: {
        fileName: req.file.originalname,
        headers: validationResult.headers,
        mapping: isTemplateMatch ? autoMapping : validationResult.mapping,
        unmappedHeaders: validationResult.unmappedHeaders,
        suggestedMapping: validationResult.suggestedMapping,
        templateMatch: isTemplateMatch,
        templateMatchDetails,
        validation: validationResult.validation
      }
    });
  } catch (error) {
    logger.error("Error validating Excel file:", error);
    res.status(500).json({
      success: false,
      message: "Server error during Excel validation",
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
        message: "No Excel file uploaded",
      });
    }

    const agentId = req.user?.agentId; // 🔐 Multi-tenant Scope

    const { mapping, options } = req.body;

    // Parse mapping if it's a string
    let parsedMapping = mapping;
    if (typeof mapping === "string") {
      try {
        parsedMapping = JSON.parse(mapping);
      } catch (parseError) {
        logger.warn("Could not parse mapping JSON:", parseError);
        return res.status(400).json({
          success: false,
          message: "Invalid mapping format",
        });
      }
    }

    if (!parsedMapping || typeof parsedMapping !== "object") {
      return res.status(400).json({
        success: false,
        message: "Column mapping is required",
      });
    }

    const filePath = req.file.path;
    const originalName = path.basename(
      req.file.originalname,
      path.extname(req.file.originalname)
    );

    logger.info("Starting bulk Excel import", {
      fileName: req.file.originalname,
      filePath,
      mapping: parsedMapping,
      options,
      agentId, // 🟦 Log for tenant debug
    });

    // Parse options if string
    let importOptions = {};
    if (options) {
      try {
        importOptions =
          typeof options === "string" ? JSON.parse(options) : options;
      } catch (parseError) {
        logger.warn("Could not parse import options, using defaults:", parseError);
      }
    }

    // 🔐 Pass agentId to ensure documents created are tagged correctly
    const importResult = await bulkImportExcel(
      filePath,
      parsedMapping,
      originalName,
      agentId,
      { ...importOptions } // ⬅️ Tenant-safe import
    );

    if (!importResult.success) {
      return res.status(500).json({
        success: false,
        message: importResult.message,
        error: importResult.error,
      });
    }

    // Clean uploaded file
    try {
      const fs = await import("fs");
      fs.unlinkSync(filePath);
    } catch (cleanupError) {
      logger.warn("Could not clean up import file:", cleanupError);
    }

    res.status(200).json({
      success: true,
      message: "Bulk import completed successfully",
      data: {
        fileName: req.file.originalname,
        stats: importResult.stats,
        summary: importResult.summary,
        logFile: importResult.logFile,
        logFileUrl: importResult.logFileUrl,
      },
    });
  } catch (error) {
    logger.error("Error during bulk Excel import:", error);
    res.status(500).json({
      success: false,
      message: "Server error during bulk import",
      error: error.message,
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

export const markAsOutofPrint = async (req, res) => {
  try {
    const { bookId } = req.params;
    const updatedBook = await Book.findByIdAndUpdate(
      bookId,
      { outOfPrint: true, },
      { new: true }  // returns updated document
    );

    if (!updatedBook) {
      return res.status(404).json({ success: false, message: 'Book not found.' });
    }

    res.json({ success: true, message: 'Book marked as out of print.', book: updatedBook });
  } catch (error) {
    logger.error('Error marking book as out of print:', error);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};