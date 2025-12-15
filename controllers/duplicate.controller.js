import Book from '../models/book.schema.js';
import BookPricing from '../models/BookPricing.js';
import Publisher from '../models/publisher.schema.js';


function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * A helper function to find an existing publisher by name or return null if not found.
 * @param {string} publisherName - The name of the publisher.
 * @returns {Promise<string|null>} - The ObjectId of the publisher or null.
 */
const findPublisherId = async (publisherName, agentId) => {
  if (!publisherName || !agentId) return null;

  const cleanName = publisherName.trim().toUpperCase();

  const existingPublisher = await Publisher.findOne({
    name: cleanName,
    agentId // 🔐 Only return publisher belonging to the logged-in tenant
  }).select("_id");

  return existingPublisher ? existingPublisher._id : null;
};
/**
 * A helper function to check the pricing status for a confirmed duplicate book.
 * @param {object} existingBook - The book document from the database.
 * @param {object} pricingData - The new pricing data from the request.
 * @returns {object} An object with the pricing action and details.
 */
const checkPricingLogic = async (existingBook, pricingData, agentId) => {
  const { source, rate, discount } = pricingData;

  // Ensure we only search pricing belonging to SAME agent
  const existingPricing = await BookPricing.findOne({
    book: existingBook._id,
    source,
    agentId, // 🔐 Tenant restriction added
  });

  // 1️⃣ New pricing source → Add new price
  if (!existingPricing) {
    return {
      action: "ADD_PRICE",
      message: "New pricing source for this duplicate book.",
      details: { bookId: existingBook._id },
    };
  }

  // 2️⃣ Same source but different rate or discount → Update price
  const isRateDifferent = existingPricing.rate !== rate;
  const isDiscountDifferent = existingPricing.discount !== discount;

  if (isRateDifferent || isDiscountDifferent) {
    const differences = {};
    if (isRateDifferent) {
      differences.rate = { old: existingPricing.rate, new: rate };
    }
    if (isDiscountDifferent) {
      differences.discount = {
        old: existingPricing.discount,
        new: discount || 0,
      };
    }

    return {
      action: "UPDATE_PRICE",
      message: "Existing pricing source found with different values.",
      details: {
        bookId: existingBook._id,
        pricingId: existingPricing._id,
        differences,
      },
    };
  }

  // 3️⃣ Identical pricing → No Change
  return {
    action: "NO_CHANGE",
    message: "Identical pricing already exists for this source.",
    details: {
      bookId: existingBook._id,
      pricingId: existingPricing._id,
    },
  };
};



/**
 * =================================================================
 * NEW: Main controller to check book status based on new rules
 * =================================================================
 */
export const checkBookStatus = async (req, res) => {
  try {
    const agentId = req.user?.agentId;
    if (!agentId) {
      return res.status(403).json({ message: "Agent not assigned" });
    }

    const { bookData, pricingData, publisherData } = req.body;

    if (!bookData?.title || !publisherData?.publisher_name) {
      return res.status(400).json({ message: "Book title and publisher name are required." });
    }

    const publisherId = await findPublisherId(publisherData.publisher_name, agentId);

    // ---- RULE 1 & 2: Check by ISBN ----
    if (bookData.isbn) {
      const bookByIsbn = await Book.findOne({
        isbn: bookData.isbn,
        agentId: agentId // 🟢 Tenant Filter Added
      }).populate("publisher");

      if (bookByIsbn) {
        if (bookByIsbn.title.toLowerCase() === bookData.title.toLowerCase()) {
          const pricing = await checkPricingLogic(bookByIsbn, pricingData , agentId);
          return res.status(200).json({
            success: true,
            bookStatus: "DUPLICATE",
            pricingStatus: pricing.action,
            message: `Duplicate book found by ISBN. | ${pricing.message}`,
            details: { ...pricing.details, existingBook: bookByIsbn }
          });
        } else {
          return res.status(200).json({
            success: true,
            bookStatus: "CONFLICT",
            message: "A book with this ISBN already exists but has a different title.",
            details: {
              existingBook: bookByIsbn,
              conflictFields: { title: { old: bookByIsbn.title, new: bookData.title } }
            }
          });
        }
      } else {
        return res.status(200).json({
          success: true,
          bookStatus: "NEW",
          pricingStatus: "ADD_PRICE",
          message: "No matching book found (same ISBN).",
          details: {}
        });
      }
    }

    // ---- RULE 4: Check by Other Code ----
    if (bookData.other_code) {
      const bookByCode = await Book.findOne({
        other_code: bookData.other_code,
        agentId: agentId // 🟢 Tenant Filter Added
      }).populate("publisher");

      if (bookByCode) {
        if (bookByCode.title.toLowerCase() === bookData.title.toLowerCase()) {
          const pricing = await checkPricingLogic(bookByCode, pricingData , agentId);
          return res.status(200).json({
            success: true,
            bookStatus: "DUPLICATE",
            pricingStatus: pricing.action,
            message: `Duplicate book found by Other Code. | ${pricing.message}`,
            details: { ...pricing.details, existingBook: bookByCode }
          });
        } else {
          return res.status(200).json({
            success: true,
            bookStatus: "CONFLICT",
            message: "Other Code exists but linked to different title.",
            details: {
              existingBook: bookByCode,
              conflictFields: { title: { old: bookByCode.title, new: bookData.title } }
            }
          });
        }
      }
    }

    // ---- RULE 3 & 5: Match by Title & Publisher ----
    if (publisherId) {
      const escapedTitle = escapeRegex(bookData.title);

      const bookByTitleAndPublisher = await Book.findOne({
        title: new RegExp(`^${escapedTitle}$`, "i"),
        publisher: publisherId,
        agentId: agentId // 🟢 Tenant Filter Added
      }).populate("publisher");

      if (bookByTitleAndPublisher) {
        const pricing = await checkPricingLogic(bookByTitleAndPublisher, pricingData , agentId);
        return res.status(200).json({
          success: true,
          bookStatus: "DUPLICATE",
          pricingStatus: pricing.action,
          message: `Duplicate found by Title + Publisher. | ${pricing.message}`,
          details: { ...pricing.details, existingBook: bookByTitleAndPublisher }
        });
      }
    }

    // ---- RULE 6 & 7: New Book ----
    return res.status(200).json({
      success: true,
      bookStatus: "NEW",
      pricingStatus: "ADD_PRICE",
      message: "No matching book found.",
      details: {}
    });

  } catch (error) {
    console.error("Error in checkBookStatus:", error);
    res.status(500).json({ message: "Internal server error", error: error.message });
  }
};



/**
 * Determines the status of a book (NEW, DUPLICATE, or CONFLICT) without sending an HTTP response.
 * This is the reusable core logic for both the API and bulk import.
 * @param {object} bookData - The book data from the Excel row.
 * @param {object} pricingData - The pricing data from the Excel row.
 * @param {object} publisherData - The publisher data from the Excel row.
 * @returns {Promise<object>} - A status object.
 */
export const determineBookStatus = async (bookData, pricingData, publisherData, agentId) => {
  const publisherId = await findPublisherId(publisherData.publisher_name, agentId);

  // Rule 1 & 2: Check by ISBN within same tenant
  if (bookData.isbn) {
    const bookByIsbn = await Book.findOne({
      isbn: bookData.isbn,
      agentId // 🔐 Tenant restriction added
    }).populate("publisher");

    if (bookByIsbn) {
      if (bookByIsbn.title.toLowerCase() === bookData.title.toLowerCase()) {
        const pricing = await checkPricingLogic(bookByIsbn, pricingData, agentId);
        return {
          success: true,
          bookStatus: "DUPLICATE",
          pricingStatus: pricing.action,
          message: `Duplicate book found by ISBN. | ${pricing.message}`,
          details: { ...pricing.details, existingBook: bookByIsbn }
        };
      } else {
        return {
          success: true,
          bookStatus: "CONFLICT",
          message: "A book with this ISBN already exists but has a different title.",
          details: {
            existingBook: bookByIsbn,
            conflictFields: {
              title: { old: bookByIsbn.title, new: bookData.title }
            }
          }
        };
      }
    }

    return {
      success: true,
      bookStatus: "NEW",
      pricingStatus: "ADD_PRICE",
      message: "No matching book found. It can be added as a new entry.",
      details: {}
    };
  }

  // Rule 4: Check by Other Code
  if (bookData.other_code) {
    const bookByCode = await Book.findOne({
      other_code: bookData.other_code,
      agentId // 🔐 Tenant restriction added
    }).populate("publisher");

    if (bookByCode) {
      if (bookByCode.title.toLowerCase() === bookData.title.toLowerCase()) {
        const pricing = await checkPricingLogic(bookByCode, pricingData, agentId);
        return {
          success: true,
          bookStatus: "DUPLICATE",
          pricingStatus: pricing.action,
          message: `Duplicate book found by Other Code. | ${pricing.message}`,
          details: { ...pricing.details, existingBook: bookByCode }
        };
      } else {
        return {
          success: true,
          bookStatus: "CONFLICT",
          message:
            "A book with this Other Code already exists but has a different title.",
          details: {
            existingBook: bookByCode,
            conflictFields: {
              title: { old: bookByCode.title, new: bookData.title }
            }
          }
        };
      }
    }
  }

  // Rule 3 & 5: Title + Publisher match
  if (publisherId) {
    const escapedTitle = escapeRegex(bookData.title);
    const bookByTitleAndPublisher = await Book.findOne({
      title: new RegExp(`^${escapedTitle}$`, "i"),
      publisher: publisherId,
      agentId // 🔐 Tenant restriction added
    }).populate("publisher");

    if (bookByTitleAndPublisher) {
      if (
        bookData.other_code &&
        bookByTitleAndPublisher.other_code !== bookData.other_code
      ) {
        return {
          success: true,
          bookStatus: "CONFLICT",
          message:
            "A book with this Title and Publisher already exists, but with a different Other Code.",
          details: {
            existingBook: bookByTitleAndPublisher,
            conflictFields: {
              other_code: {
                old: bookByTitleAndPublisher.other_code,
                new: bookData.other_code
              }
            }
          }
        };
      }

      const pricing = await checkPricingLogic(
        bookByTitleAndPublisher,
        pricingData,
        agentId
      );

      return {
        success: true,
        bookStatus: "DUPLICATE",
        pricingStatus: pricing.action,
        message: `Duplicate book found by Title and Publisher. | ${pricing.message}`,
        details: { ...pricing.details, existingBook: bookByTitleAndPublisher }
      };
    }
  }

  // Rule 6 & 7: NEW
  return {
    success: true,
    bookStatus: "NEW",
    pricingStatus: "ADD_PRICE",
    message: "No matching book found.",
    details: {}
  };
};
