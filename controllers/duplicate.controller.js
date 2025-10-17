import Book from '../models/book.schema.js';
import BookPricing from '../models/BookPricing.js';
import Publisher from '../models/publisher.schema.js';

/**
 * ----------------------------------------------------------------
 * 헬퍼 함수 (Helper Functions)
 * ----------------------------------------------------------------
 */

/**
 * Finds an existing book based on a specific match logic:
 * 1. ISBN -> Title -> Publisher
 * 2. Other Code -> Title -> Publisher
 * 3. Title only (results in a conflict if found)
 * @param {object} bookData - The new book data.
 * @param {string|null} publisherId - The MongoDB ObjectId of the publisher.
 * @returns {object} An object with status, message, and book details.
 */
export const findBookMatch = async (bookData, publisherId ,publisherData) => {
  const { isbn, other_code, title } = bookData;

  // Helper to build conflict responses
  const buildConflictResponse = (existingBook, newBookData, conflictFields) => ({
    status: 'CONFLICT',
    message: `Conflict detected. A book with this identifier already exists but has different details. Please verify.`,
    existingBook,
    newData: newBookData,
    conflictFields,
  });

  // 1. Check by ISBN
  if (isbn) {
    const bookByIsbn = await Book.findOne({ isbn }).populate('publisher');
    if (bookByIsbn) {
      const isTitleMatch = bookByIsbn.title.toLowerCase() === title.toLowerCase();
      if (isTitleMatch) {
        const isPublisherMatch = String(bookByIsbn.publisher?._id) === String(publisherId);
        console.log(isPublisherMatch);
        if (isPublisherMatch) {
          return { status: 'DUPLICATE', message: 'Exact duplicate book found by ISBN.', book: bookByIsbn };
        }
        console.log('Title matches, but publisher doesn\'t');
        console.log(bookByIsbn.publisher?.name);
        console.log(bookData.publisher_name);
        // Title matches, but publisher doesn't
        return buildConflictResponse(bookByIsbn, bookData, {
          publisher: { old: bookByIsbn.publisher?.name, new: publisherData.publisher_name }
        });
      }
      // ISBN matches, but title doesn't
      return buildConflictResponse(bookByIsbn, bookData, {
        title: { old: bookByIsbn.title, new: title }
      });
    }
  }

  // 2. Check by Other Code
  if (other_code) {
    const bookByOtherCode = await Book.findOne({ other_code }).populate('publisher');
    if (bookByOtherCode) {
      // Same logic as ISBN check
      const isTitleMatch = bookByOtherCode.title.toLowerCase() === title.toLowerCase();
      if (isTitleMatch) {
        const isPublisherMatch = String(bookByOtherCode.publisher?._id) === String(publisherId);
        if (isPublisherMatch) {
          return { status: 'DUPLICATE', message: 'Exact duplicate book found by Other Code.', book: bookByOtherCode };
        }
        return buildConflictResponse(bookByOtherCode, bookData, {
            publisher: { old: bookByOtherCode.publisher?.name, new: publisherData.publisher_name }

        });
      }
      return buildConflictResponse(bookByOtherCode, bookData, {
        title: { old: bookByOtherCode.title, new: title }
      });
    }
  }

  // 3. Last check: by Title
  const bookByTitle = await Book.findOne({ title: new RegExp(`^${title}$`, "i") }).populate('publisher');
  if (bookByTitle) {
    // If we reach here, ISBN/other_code did not match, but the title did. This is a conflict.
    return buildConflictResponse(bookByTitle, bookData, {
      identifier: {
        old: { isbn: bookByTitle.isbn, other_code: bookByTitle.other_code },
        new: { isbn: bookData.isbn, other_code: bookData.other_code }
      }
    });
  }

  // 4. No matches found
  return { status: 'NEW', message: 'No matching book found.', book: null };
};


/**
 * Checks the pricing status for an existing book.
 * @param {object} existingBook - The book document from the database.
 * @param {object} pricingData - The new pricing data from the request.
 * @returns {object} An object with the pricing action and details.
 */
export const checkPricingStatus = async (existingBook, pricingData) => {
  const { source, rate, discount } = pricingData;

  const existingPricing = await BookPricing.findOne({
    book: existingBook._id,
    source,
  });

  // If source is new for this book, add a new price.
  if (!existingPricing) {
    return {
      action: 'ADD_PRICE',
      message: 'New pricing source for this book.',
      details: { bookId: existingBook._id }
    };
  }

  // If source exists, check for differences.
  const isRateDifferent = existingPricing.rate !== rate;
  const isDiscountDifferent = existingPricing.discount !== discount;

  if (isRateDifferent || isDiscountDifferent) {
    return {
      action: 'UPDATE_PRICE',
      message: 'Existing pricing found with different values.',
      details: {
        bookId: existingBook._id,
        pricingId: existingPricing._id,
        differences: {
          rate: isRateDifferent ? { old: existingPricing.rate, new: rate } : undefined,
          discount: isDiscountDifferent ? { old: existingPricing.discount, new: discount } : undefined,
        }
      }
    };
  }

  // If everything is identical.
  return {
    action: 'NO_CHANGE',
    message: 'Identical pricing already exists for this source.',
    details: {
      bookId: existingBook._id,
      pricingId: existingPricing._id
    }
  };
};
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
 * ----------------------------------------------------------------
 * 기본 컨트롤러 (Main Controller)
 * ----------------------------------------------------------------
 */

export const checkDuplicate = async (req, res) => {
  try {
    const { bookData, pricingData, publisherData } = req.body;

    // 1. Validate Input
    if (!bookData || !pricingData || !publisherData) {
      return res.status(400).json({ message: "bookData, pricingData, and publisherData are required" });
    }

    // You can add more granular validation here (e.g., for title, source, etc.)
    
    // Normalize ISBN if it exists
    if (bookData.isbn) {
        bookData.isbn = cleanIsbnInput(bookData.isbn); // Assuming you have this helper
        if (!isValidIsbn(bookData.isbn)) { // Assuming you have this helper
            return res.status(400).json({ message: 'Invalid ISBN provided.' });
        }
    }

    // 2. Find Publisher
    const publisher = await Publisher.findOne({ name: publisherData.publisher_name });
    // Note: You might want to handle the case where the publisher is not found.
    // For now, we'll pass `publisher?._id` which will be `null` if not found.

    // 3. Find Book Match
    const bookMatch = await findBookMatch(bookData, publisher?._id ,publisherData);

    // 4. Handle Different Match Statuses
    if (bookMatch.status === 'NEW') {
      // If the book is new, the pricing is also new.
      return res.status(200).json({
        bookStatus: 'NEW',
        pricingStatus: 'ADD_PRICE',
        message: 'This is a new book and new price.',
        newData: bookData,
      });
    }

    if (bookMatch.status === 'CONFLICT') {
      // If there's a conflict, return the details immediately.
      // You can decide if you still want to check pricing for a conflicted book.
      // Here, we stop and ask the user to resolve the book conflict first.
      return res.status(200).json({ // 409 Conflict is a good HTTP status code here
        bookStatus: 'CONFLICT',
        message: bookMatch.message,
        details: bookMatch,
      });
    }

    // This means bookMatch.status is 'DUPLICATE'
    if (bookMatch.status === 'DUPLICATE') {
      // If the book is a duplicate, we must check the pricing.
      const pricing = await checkPricingStatus(bookMatch.book, pricingData);

      return res.status(200).json({
        bookStatus: 'DUPLICATE',
        pricingStatus: pricing.action,
        message: `${bookMatch.message} | ${pricing.message}`,
        details: {
          ...pricing.details,
          existingBook: bookMatch.book,
        },
      });
    }

  } catch (error) {
    console.error("Error in checkBookStatus:", error);
    res.status(500).json({ message: "Internal server error", error: error.message });
  }
};

