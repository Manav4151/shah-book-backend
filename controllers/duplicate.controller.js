import Book from '../models/book.schema.js';
import BookPricing from '../models/BookPricing.js';
import Publisher from '../models/publisher.schema.js';

/**
 * ----------------------------------------------------------------
 * 헬퍼 함수 (Helper Functions)
 * ----------------------------------------------------------------
 */

// /**
//  * Finds an existing book based on a specific match logic:
//  * 1. ISBN -> Title -> Publisher
//  * 2. Other Code -> Title -> Publisher
//  * 3. Title only (results in a conflict if found)
//  * @param {object} bookData - The new book data.
//  * @param {string|null} publisherId - The MongoDB ObjectId of the publisher.
//  * @returns {object} An object with status, message, and book details.
//  */
// export const findBookMatch = async (bookData, publisherId ,publisherData) => {
//   const { isbn, other_code, title } = bookData;

//   // Helper to build conflict responses
//   const buildConflictResponse = (existingBook, newBookData, conflictFields) => ({
//     status: 'CONFLICT',
//     message: `Conflict detected. A book with this identifier already exists but has different details. Please verify.`,
//     existingBook,
//     newData: newBookData,
//     conflictFields,
//   });

//   // 1. Check by ISBN
//   if (isbn) {
//     const bookByIsbn = await Book.findOne({ isbn }).populate('publisher');
//     if (bookByIsbn) {
//       const isTitleMatch = bookByIsbn.title.toLowerCase() === title.toLowerCase();
//       if (isTitleMatch) {
//         const isPublisherMatch = String(bookByIsbn.publisher?._id) === String(publisherId);
//         console.log(isPublisherMatch);
//         if (isPublisherMatch) {
//           return { status: 'DUPLICATE', message: 'Exact duplicate book found by ISBN.', book: bookByIsbn };
//         }
//         console.log('Title matches, but publisher doesn\'t');
//         console.log(bookByIsbn.publisher?.name);
//         console.log(bookData.publisher_name);
//         // Title matches, but publisher doesn't
//         return buildConflictResponse(bookByIsbn, bookData, {
//           publisher: { old: bookByIsbn.publisher?.name, new: publisherData.publisher_name }
//         });
//       }
//       // ISBN matches, but title doesn't
//       return buildConflictResponse(bookByIsbn, bookData, {
//         title: { old: bookByIsbn.title, new: title }
//       });
//     }
//   }

//   // 2. Check by Other Code
//   if (other_code) {
//     const bookByOtherCode = await Book.findOne({ other_code }).populate('publisher');
//     if (bookByOtherCode) {
//       // Same logic as ISBN check
//       const isTitleMatch = bookByOtherCode.title.toLowerCase() === title.toLowerCase();
//       if (isTitleMatch) {
//         const isPublisherMatch = String(bookByOtherCode.publisher?._id) === String(publisherId);
//         if (isPublisherMatch) {
//           return { status: 'DUPLICATE', message: 'Exact duplicate book found by Other Code.', book: bookByOtherCode };
//         }
//         return buildConflictResponse(bookByOtherCode, bookData, {
//             publisher: { old: bookByOtherCode.publisher?.name, new: publisherData.publisher_name }

//         });
//       }
//       return buildConflictResponse(bookByOtherCode, bookData, {
//         title: { old: bookByOtherCode.title, new: title }
//       });
//     }
//   }

//   // 3. Last check: by Title
//   const bookByTitle = await Book.findOne({ title: new RegExp(`^${title}$`, "i") }).populate('publisher');
//   if (bookByTitle) {
//     // If we reach here, ISBN/other_code did not match, but the title did. This is a conflict.
//     return buildConflictResponse(bookByTitle, bookData, {
//       identifier: {
//         old: { isbn: bookByTitle.isbn, other_code: bookByTitle.other_code },
//         new: { isbn: bookData.isbn, other_code: bookData.other_code }
//       }
//     });
//   }

//   // 4. No matches found
//   return { status: 'NEW', message: 'No matching book found.', book: null };
// };


/**
 * Checks the pricing status for an existing book.
 * @param {object} existingBook - The book document from the database.
 * @param {object} pricingData - The new pricing data from the request.
 * @returns {object} An object with the pricing action and details.
 */
// export const checkPricingStatus = async (existingBook, pricingData) => {
//   const { source, rate, discount } = pricingData;

//   const existingPricing = await BookPricing.findOne({
//     book: existingBook._id,
//     source,
//   });

//   // If source is new for this book, add a new price.
//   if (!existingPricing) {
//     return {
//       action: 'ADD_PRICE',
//       message: 'New pricing source for this book.',
//       details: { bookId: existingBook._id }
//     };
//   }

//   // If source exists, check for differences.
//   const isRateDifferent = existingPricing.rate !== rate;
//   const isDiscountDifferent = existingPricing.discount !== discount;

//   if (isRateDifferent || isDiscountDifferent) {
//     return {
//       action: 'UPDATE_PRICE',
//       message: 'Existing pricing found with different values.',
//       details: {
//         bookId: existingBook._id,
//         pricingId: existingPricing._id,
//         differences: {
//           rate: isRateDifferent ? { old: existingPricing.rate, new: rate } : undefined,
//           discount: isDiscountDifferent ? { old: existingPricing.discount, new: discount } : undefined,
//         }
//       }
//     };
//   }

//   // If everything is identical.
//   return {
//     action: 'NO_CHANGE',
//     message: 'Identical pricing already exists for this source.',
//     details: {
//       bookId: existingBook._id,
//       pricingId: existingPricing._id
//     }
//   };
// };
export const cleanIsbnInput = (isbnInput) => {
  // 1. Handle null, undefined, or empty inputs to prevent errors.
  if (!isbnInput) {
    return '';
  }

  // 2. Ensure the input is a string so we can use string manipulation methods.
  // This also safely handles cases where the ISBN is passed as a number.
  const isbnString = String(isbnInput);

  // 3. Use a regular expression to remove any character that is NOT a digit (0-9)
  //    or the letter 'X' (which is valid as a checksum in ISBN-10).
  //    - `[^0-9Xx]` is a negated set. It matches any character that is not in the set.
  //    - The `g` flag ensures it replaces all occurrences, not just the first.
  const cleaned = isbnString.replace(/[^0-9Xx]/g, '');

  // 4. Convert the result to uppercase. This standardizes the checksum character
  //    'x' to 'X', ensuring consistency.
  return cleaned.toUpperCase();
};
export const isValidIsbn = (isbn) => {
  if (!isbn) {
    return false;
  }
  return isbn.length === 10 || isbn.length === 13;
};


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
            bookStatus: 'DUPLICATE',
            pricingStatus: pricing.action,
            message: `Duplicate book found by ISBN. | ${pricing.message}`,
            details: { ...pricing.details, existingBook: bookByIsbn },
          });
        } else {
          // Same ISBN, different Title -> CONFLICT.
          return res.status(200).json({
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
            bookStatus: 'DUPLICATE',
            pricingStatus: pricing.action,
            message: `Duplicate book found by Other Code. | ${pricing.message}`,
            details: { ...pricing.details, existingBook: bookByCode },
          });
        } else {
          // Same Other Code, different Title -> CONFLICT.
          return res.status(200).json({
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
      const bookByTitleAndPublisher = await Book.findOne({
        title: new RegExp(`^${bookData.title}$`, "i"),
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
          bookStatus: 'DUPLICATE',
          pricingStatus: pricing.action,
          message: `Duplicate book found by Title and Publisher. | ${pricing.message}`,
          details: { ...pricing.details, existingBook: bookByTitleAndPublisher },
        });
      }
    }

    // Rule 6 & 7: If none of the above checks found anything, it's a NEW book.
    return res.status(200).json({
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
          bookStatus: 'DUPLICATE',
          pricingStatus: pricing.action,
          message: `Duplicate book found by ISBN. | ${pricing.message}`,
          details: { ...pricing.details, existingBook: bookByIsbn },
        };
      } else {
        return {
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
          bookStatus: 'DUPLICATE',
          pricingStatus: pricing.action,
          message: `Duplicate book found by Other Code. | ${pricing.message}`,
          details: { ...pricing.details, existingBook: bookByCode },
        };
      } else {
        return {
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
    const bookByTitleAndPublisher = await Book.findOne({
      title: new RegExp(`^${bookData.title}$`, "i"),
      publisher: publisherId
    }).populate('publisher');

    if (bookByTitleAndPublisher) {

      // *** Refinement: Also check for other_code conflict ***
      if (bookData.other_code && bookByTitleAndPublisher.other_code !== bookData.other_code) {
        return {
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
        bookStatus: 'DUPLICATE',
        pricingStatus: pricing.action,
        message: `Duplicate book found by Title and Publisher. | ${pricing.message}`,
        details: { ...pricing.details, existingBook: bookByTitleAndPublisher },
      };
    }
  }

  // Rule 6 & 7: Fallback to NEW
  return {
    bookStatus: 'NEW',
    pricingStatus: 'ADD_PRICE',
    message: 'No matching book found.',
    details: {},
  };
};