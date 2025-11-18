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
const findPublisherId = async (publisherName) => {
  if (!publisherName) return null;
  const cleanName = publisherName.trim().toUpperCase();
  const existingPublisher = await Publisher.findOne({
    name: cleanName
  });
  return existingPublisher ? existingPublisher._id : null;
};

/**
 * A helper function to check the pricing status for a confirmed duplicate book.
 * @param {object} existingBook - The book document from the database.
 * @param {object} pricingData - The new pricing data from the request.
 * @returns {object} An object with the pricing action and details.
 */
const checkPricingLogic = async (existingBook, pricingData) => {
  const { source, rate, discount } = pricingData;

  const existingPricing = await BookPricing.findOne({
    book: existingBook._id,
    source,
  });

  // 1. New pricing source for this book -> Add new price
  if (!existingPricing) {
    return {
      action: 'ADD_PRICE',
      message: 'New pricing source for this duplicate book.',
      details: { bookId: existingBook._id }
    };
  }

  // 2. Same source, but different price/discount -> Update price
  const isRateDifferent = existingPricing.rate !== rate;
  const isDiscountDifferent = existingPricing.discount !== discount;

  if (isRateDifferent || isDiscountDifferent) {
    const differences = {};
    if (isRateDifferent) {
      differences.rate = { old: existingPricing.rate, new: rate };
    }
    if (isDiscountDifferent) {
      differences.discount = { old: existingPricing.discount, new: (discount || 0) };
    }
    return {
      action: 'UPDATE_PRICE',
      message: 'Existing pricing source found with different values.',
      details: {
        bookId: existingBook._id,
        pricingId: existingPricing._id,
        differences: differences
      }

    };
  }

  // 3. Same source and same price/discount -> No change
  return {
    action: 'NO_CHANGE',
    message: 'Identical pricing already exists for this source.',
    details: {
      bookId: existingBook._id,
      pricingId: existingPricing._id
    }
  };
};


/**
 * =================================================================
 * NEW: Main controller to check book status based on new rules
 * =================================================================
 */
export const checkBookStatus = async (req, res) => {
  try {
    const { bookData, pricingData, publisherData } = req.body;

    if (!bookData?.title || !publisherData?.publisher_name) {
      return res.status(400).json({ message: "Book title and publisher name are required." });
    }

    const publisherId = await findPublisherId(publisherData.publisher_name);
    if (!publisherId) {
      // You might want to handle this case differently, e.g., create the publisher
      // For now, we treat it as a potential new book unless matched by other means.
    }

    // Rule 1 & 2: Check by ISBN first if it exists.
    if (bookData.isbn) {
      const bookByIsbn = await Book.findOne({ isbn: bookData.isbn }).populate('publisher');
      if (bookByIsbn) {
        // ISBN match found. Now, check title.
        if (bookByIsbn.title.toLowerCase() === bookData.title.toLowerCase()) {
          // Rule 2: Same ISBN and Title -> DUPLICATE.
          const pricing = await checkPricingLogic(bookByIsbn, pricingData);
          return res.status(200).json({
            success: true,
            bookStatus: 'DUPLICATE',
            pricingStatus: pricing.action,
            message: `Duplicate book found by ISBN. | ${pricing.message}`,
            details: { ...pricing.details, existingBook: bookByIsbn },
          });
        } else {
          // Same ISBN, different Title -> CONFLICT.
          return res.status(200).json({
            success: true,
            bookStatus: 'CONFLICT',
            message: 'A book with this ISBN already exists but has a different title.',
            details: {
              existingBook: bookByIsbn,
              conflictFields: { title: { old: bookByIsbn.title, new: bookData.title } }
            },
          });
        }
      }
      else {
        return res.status(200).json({
          success: true,
          bookStatus: 'NEW',
          pricingStatus: 'ADD_PRICE', // A new book always requires adding a new price
          message: 'No matching book found. It can be added as a new entry.',
          details: {},
        });
      }
    }

    // Rule 4: If no ISBN match or no ISBN provided, check by Other Code.
    if (bookData.other_code) {
      const bookByCode = await Book.findOne({ other_code: bookData.other_code }).populate('publisher');
      if (bookByCode) {
        if (bookByCode.title.toLowerCase() === bookData.title.toLowerCase()) {
          // Same Other Code and Title -> DUPLICATE.
          const pricing = await checkPricingLogic(bookByCode, pricingData);
          return res.status(200).json({
            success: true,
            bookStatus: 'DUPLICATE',
            pricingStatus: pricing.action,
            message: `Duplicate book found by Other Code. | ${pricing.message}`,
            details: { ...pricing.details, existingBook: bookByCode },
          });
        } else {
          // Same Other Code, different Title -> CONFLICT.
          return res.status(200).json({
            success: true,
            bookStatus: 'CONFLICT',
            message: 'A book with this Other Code already exists but has a different title.',
            details: {
              existingBook: bookByCode,
              conflictFields: { title: { old: bookByCode.title, new: bookData.title } }
            },
          });
        }
      }
    }

    // Rule 3 & 5: Last check. Find by Title and Publisher.
    if (publisherId) {
      const escapedTitle = escapeRegex(bookData.title);
      const bookByTitleAndPublisher = await Book.findOne({
        title: new RegExp(`^${escapedTitle}$`, "i"),
        publisher: publisherId
      }).populate('publisher');

      if (bookByTitleAndPublisher) {
        // A book with the same title and publisher exists.
        // Rule 3: This is a CONFLICT if the new book has a different ISBN.
        // if (bookData.isbn && bookByTitleAndPublisher.isbn !== bookData.isbn) {
        //   return res.status(200).json({
        //     bookStatus: 'CONFLICT',
        //     message: 'A book with this Title and Publisher already exists, but with a different ISBN.',
        //     details: {
        //       existingBook: bookByTitleAndPublisher,
        //       conflictFields: { isbn: { old: bookByTitleAndPublisher.isbn, new: bookData.isbn } }
        //     },
        //   });
        // }
        // Rule 5: It's a DUPLICATE if identifiers are missing or match.
        const pricing = await checkPricingLogic(bookByTitleAndPublisher, pricingData);
        return res.status(200).json({
          success: true,
          bookStatus: 'DUPLICATE',
          pricingStatus: pricing.action,
          message: `Duplicate book found by Title and Publisher. | ${pricing.message}`,
          details: { ...pricing.details, existingBook: bookByTitleAndPublisher },
        });
      }
    }

    // Rule 6 & 7: If none of the above checks found anything, it's a NEW book.
    return res.status(200).json({
      success: true,
      bookStatus: 'NEW',
      pricingStatus: 'ADD_PRICE', // A new book always requires adding a new price
      message: 'No matching book found. It can be added as a new entry.',
      details: {},
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
export const determineBookStatus = async (bookData, pricingData, publisherData) => {
  const publisherId = await findPublisherId(publisherData.publisher_name);

  // Rule 1 & 2: Check by ISBN first
  if (bookData.isbn) {
    const bookByIsbn = await Book.findOne({ isbn: bookData.isbn }).populate('publisher');
    if (bookByIsbn) {
      if (bookByIsbn.title.toLowerCase() === bookData.title.toLowerCase()) {
        const pricing = await checkPricingLogic(bookByIsbn, pricingData);
        return {
          success: true,
          bookStatus: 'DUPLICATE',
          pricingStatus: pricing.action,
          message: `Duplicate book found by ISBN. | ${pricing.message}`,
          details: { ...pricing.details, existingBook: bookByIsbn },
        };
      } else {
        return {
          success: true,
          bookStatus: 'CONFLICT',
          message: 'A book with this ISBN already exists but has a different title.',
          details: {
            existingBook: bookByIsbn,
            conflictFields: { title: { old: bookByIsbn.title, new: bookData.title } }
          },
        };
      }
    }
    else {
      return {
        success: true,
        bookStatus: 'NEW',
        pricingStatus: 'ADD_PRICE', // A new book always requires adding a new price
        message: 'No matching book found. It can be added as a new entry.',
        details: {},
      };
    }
  }

  // Rule 4: Check by Other Code
  else if (bookData.other_code) {
    const bookByCode = await Book.findOne({ other_code: bookData.other_code }).populate('publisher');
    if (bookByCode) {
      if (bookByCode.title.toLowerCase() === bookData.title.toLowerCase()) {
        const pricing = await checkPricingLogic(bookByCode, pricingData);
        return {
          success: true,
          bookStatus: 'DUPLICATE',
          pricingStatus: pricing.action,
          message: `Duplicate book found by Other Code. | ${pricing.message}`,
          details: { ...pricing.details, existingBook: bookByCode },
        };
      } else {
        return {
          success: true,
          bookStatus: 'CONFLICT',
          message: 'A book with this Other Code already exists but has a different title.',
          details: {
            existingBook: bookByCode,
            conflictFields: { title: { old: bookByCode.title, new: bookData.title } }
          },
        };
      }
    }
  }

  // Rule 3 & 5: Check by Title and Publisher
  if (publisherId) {
    const escapedTitle = escapeRegex(bookData.title);
    const bookByTitleAndPublisher = await Book.findOne({
      title: new RegExp(`^${escapedTitle}$`, "i"),
      publisher: publisherId
    }).populate('publisher');

    if (bookByTitleAndPublisher) {

      // *** Refinement: Also check for other_code conflict ***
      if (bookData.other_code && bookByTitleAndPublisher.other_code !== bookData.other_code) {
        return {
          success: true,
          bookStatus: 'CONFLICT',
          message: 'A book with this Title and Publisher already exists, but with a different Other Code.',
          details: {
            existingBook: bookByTitleAndPublisher,
            conflictFields: { other_code: { old: bookByTitleAndPublisher.other_code, new: bookData.other_code } }
          },
        };
      }
      const pricing = await checkPricingLogic(bookByTitleAndPublisher, pricingData);
      return {
        success: true,
        bookStatus: 'DUPLICATE',
        pricingStatus: pricing.action,
        message: `Duplicate book found by Title and Publisher. | ${pricing.message}`,
        details: { ...pricing.details, existingBook: bookByTitleAndPublisher },
      };
    }
  }

  // Rule 6 & 7: Fallback to NEW
  return {
    success: true,
    bookStatus: 'NEW',
    pricingStatus: 'ADD_PRICE',
    message: 'No matching book found.',
    details: {},
  };
};