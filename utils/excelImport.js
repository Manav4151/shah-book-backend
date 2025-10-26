/**
 * @file services/importService.js
 * @description A comprehensive service for a two-step Excel book import process.
 * 1. Validation & Mapping: Analyzes an Excel file for user review.
 * 2. Bulk Import: Processes the file using user-approved mappings and robust conflict detection.
 */

// -----------------------------------------------------------------------------
// SECTION 1: IMPORTS
// -----------------------------------------------------------------------------
import fs from 'fs/promises';
import path from 'path';
import xlsx from 'xlsx';

// Mongoose Models
import Book from '../models/book.schema.js';
import BookPricing from '../models/BookPricing.js';
import Publisher from '../models/publisher.schema.js';

// Core business logic (reused from the API controller for consistency)
// import { findBookMatch, checkPricingStatus } from '../controllers/duplicate.controller.js';

// // Utility helpers
// import { cleanIsbnInput } from '../helpers/isbnHelper.js';
import { logger } from '../lib/logger.js';
import { cleanIsbnForValidation, validateISBN } from './isbnValidator.js';
import { determineBookStatus } from '../controllers/duplicate.controller.js';
import { getOrCreatePublisher } from '../controllers/book.controller.js';

// -----------------------------------------------------------------------------
// SECTION 2: STEP 1 - VALIDATION & MAPPING
// (This section is for your "Mapping API")
// -----------------------------------------------------------------------------

/**
 * @constant defaultHeaderMap
 * @description A dictionary to automatically map common Excel headers to database fields.
 */
const defaultHeaderMap = {
    "ISBN": "isbn",
    "Non ISBN": "nonisbn",
    "Other Code": "other_code",
    "Title": "title",
    "Author": "author",
    "EDITION": "edition",
    "Edition": "edition",
    "Year": "year",
    "Publisher": "publisher_name",
    "Binding Type": "binding_type",
    "Classification": "classification",
    "Remarks": "remarks",
    "Price": "rate",
    "Rate": "rate",
    "Currency": "currency",
    "Discount": "discount",
};

/**
 * Analyzes an Excel file's headers and provides a suggested mapping for user review.
 * This function should be called first, after the user uploads a file.
 *
 * @param {string} filePath - Path to the Excel file.
 * @returns {Promise<object>} A result object with headers, a suggested mapping, and validation checks.
 */
export async function validateExcelMapping(filePath) {
    try {
        const workbook = xlsx.readFile(filePath);
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const headers = xlsx.utils.sheet_to_json(sheet, { header: 1 })[0];

        if (!headers || headers.length === 0) {
            return { success: false, message: "Excel file has no headers or is empty." };
        }

        const mapping = {};
        const unmappedHeaders = [];

        headers.forEach(header => {
            const cleanHeader = header.trim();
            if (defaultHeaderMap[cleanHeader]) {
                mapping[cleanHeader] = defaultHeaderMap[cleanHeader];
            } else {
                unmappedHeaders.push(cleanHeader);
            }
        });

        const mappedFields = Object.values(mapping);

        // Define required fields for books and pricing separately
        const requiredBookFields = ['title', 'author'];
        const requiredPricingFields = ['rate', 'currency'];

        // Check which fields are mapped for books and pricing
        const mappedBookFields = mappedFields.filter(field =>
            ['title', 'author', 'isbn', 'year', 'edition', 'classification', 'binding_type', 'remarks'].includes(field)
        );

        const mappedPricingFields = mappedFields.filter(field =>
            ['rate', 'currency', 'discount', 'source'].includes(field)
        );

        // Find missing fields for each category
        const missingBookFields = requiredBookFields.filter(field => !mappedBookFields.includes(field));
        const missingPricingFields = requiredPricingFields.filter(field => !mappedPricingFields.includes(field));

        return {
            success: true,
            message: "Validation complete. Please review the suggested mapping.",
            headers: headers.filter(h => h && h.trim()),
            mapping, // The automatically generated mapping to show the user
            unmappedHeaders,
            validation: {
                hasRequiredBookFields: missingBookFields.length === 0,
                hasRequiredPricingFields: missingPricingFields.length === 0,
                missingBookFields,
                missingPricingFields,
                totalRows: headers.length > 0 ? headers.length - 1 : 0, // Exclude header row
                mappedFields: {
                    book: mappedBookFields,
                    pricing: mappedPricingFields
                }
            }
        };

    } catch (error) {
        logger.error('Error validating Excel mapping:', error);
        return { success: false, message: "Error reading or validating the Excel file.", error: error.message };
    }
}

// -----------------------------------------------------------------------------
// SECTION 3: STEP 2 - BULK IMPORT
// (This section is for your "Import API", which receives the user-approved mapping)
// -----------------------------------------------------------------------------

// --- Helper Functions for the Import Process ---

/**
 * Finds a publisher by name or creates it if it doesn't exist.
 * @param {string} publisherName - The name of the publisher.
 * @returns {Promise<string|null>} The MongoDB ObjectId of the publisher.
 */
// async function findOrCreatePublisher(publisherName) {
//     if (!publisherName || !publisherName.trim()) return null;
//     const cleanName = publisherName.trim();
//     let publisher = await Publisher.findOne({ name: cleanName });
//     if (publisher) return publisher._id;
//     const newPublisher = new Publisher({ name: cleanName });
//     await newPublisher.save();
//     return newPublisher._id;
// }

// new logic if not working than uncomment above one and remove below one



/**
 * Processes a single Excel row using a user-approved mapping and transforms it
 * into a structured object identical to the single-entry API's request body.
 *
 * @param {object} row - The raw data from a single Excel row.
 * @param {object} mapping - The user-confirmed mapping (e.g., { "Book Title": "title", "Pub Name": "publisher_name" }).
 * @param {string} sourceName - The name for this import batch (e.g., the original filename).
 * @returns {{bookData: object, pricingData: object, publisherData: object}} - The structured, cleaned, and type-coerced data.
 */
function processRowData(row, mapping, sourceName) {
    // 1. Initialize the final data structure.
    const data = {
        bookData: {},
        pricingData: { source: sourceName }, // Pre-populate with the source name
        publisherData: {}
    };

    // 2. Define which database fields belong to which model. This is the sorting key.
    const pricingFields = ['rate', 'currency', 'discount'];
    const publisherFields = ['publisher_name'];

    // 3. Iterate through the user-approved mapping to process the row.
    for (const excelHeader in mapping) {
        const schemaField = mapping[excelHeader]; // e.g., "title", "rate", "publisher_name"
        const rawValue = row[excelHeader];

        // 4. Process only if the cell has a value.
        if (rawValue !== undefined && rawValue !== null) {
            const cleanValue = String(rawValue).trim();
            if (cleanValue) { // Ensure the value is not just whitespace
                // 5. Sort the clean value into the correct object.
                if (pricingFields.includes(schemaField)) {
                    data.pricingData[schemaField] = cleanValue;
                } else if (publisherFields.includes(schemaField)) {
                    data.publisherData[schemaField] = cleanValue;
                } else {
                    data.bookData[schemaField] = cleanValue;
                }
            }
        }
    }

    // 6. Perform final data cleaning, type coercion, and set default values.
    if (data.bookData.year) {
        data.bookData.year = Number(data.bookData.year) || null;
    }
    if (data.bookData.isbn) {
        // Assuming you have this helper available
        data.bookData.isbn = validateISBN(data.bookData.isbn) ? cleanIsbnForValidation(data.bookData.isbn) : null;
    }

    if (data.pricingData.rate) {
        data.pricingData.rate = Number(data.pricingData.rate) || null;
    }
    data.pricingData.discount = data.pricingData.discount ? Number(data.pricingData.discount) : 0;
    if (!data.pricingData.currency) {
        data.pricingData.currency = 'INR'; // Defaulting to INR as per your example
    }

    // 7. Return the perfectly structured object, ready for your core logic.
    return data;
}

/**
 * Writes conflict details to a timestamped JSON log file for later review.
 * @param {Array} conflictDetails - The array of conflict objects.
 * @param {string} sourceName - The original filename to include in the log's name.
 * @returns {Promise<string|null>} The path to the created log file.
 */
async function writeConflictLog(conflictDetails, sourceName) {
    try {
        const logsDir = path.resolve(process.cwd(), 'logs');
        await fs.mkdir(logsDir, { recursive: true });
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const logFileName = `import-conflicts-${sourceName}-${timestamp}.json`;
        const logFilePath = path.join(logsDir, logFileName);
        const logContent = JSON.stringify(conflictDetails, null, 2);
        await fs.writeFile(logFilePath, logContent);
        logger.info(`Conflict log created at: ${logFilePath}`);
        return logFilePath;
    } catch (error) {
        logger.error("Failed to write conflict log file.", error);
        return null;
    }
}

/**
 * The main import function. It takes the user-approved mapping and processes the file.
 *
 * @param {string} filePath - Path to the Excel file.
 * @param {object} mapping - The user-confirmed column mapping from Step 1.
 * @param {string} sourceName - A name for this import batch, e.g., the original filename.
 * @returns {Promise<object>} An object with detailed statistics and a path to the conflict log.
 */
export async function bulkImportExcel(filePath, mapping, sourceName) {
    try {
        logger.info(`Starting bulk import for source: ${sourceName}`);
        const workbook = xlsx.readFile(filePath);
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const sheetData = xlsx.utils.sheet_to_json(sheet);

        const stats = {
            totalRows: sheetData.length,
            processed: 0,
            booksAdded: 0,
            pricesAdded: 0,
            pricesUpdated: 0,
            skippedAsDuplicate: 0,
            skippedAsConflict: 0,
            errors: 0,
            conflictDetails: [],
            errorDetails: [],
        };

        for (const [index, row] of sheetData.entries()) {
            const rowNum = index + 2;
            try {
                const { bookData, pricingData, publisherData } = processRowData(row, mapping, sourceName);
                if (!bookData.title || !pricingData.rate) {
                    throw new Error("Missing required data (Title or Price).");
                }


                // 1. Call the new helper instead of the old findBookMatch
                const statusResult = await determineBookStatus(bookData, pricingData, publisherData);
                // logger.info('publisherId', publisherId);
                // --- LOGIC UPDATED BELOW ---

                // 2. Use the result from the helper in your switch statement
                switch (statusResult.bookStatus) {
                    case 'NEW':
                        // This case creates a new book and its pricing
                        const publisherId = await getOrCreatePublisher(publisherData.publisher_name);
                        let savedBook = null;
                        try {
                            const newBook = new Book({ ...bookData, publisher: publisherId });
                            savedBook = await newBook.save();
                            const newPricing = new BookPricing({ ...pricingData, book: savedBook._id });
                            await newPricing.save();
                            stats.booksAdded++;
                            stats.pricesAdded++;
                        } catch (dbError) {
                            if (savedBook?._id) {
                                await Book.findByIdAndDelete(savedBook._id);
                            }
                            throw new Error(`Database save failed: ${dbError.message}. Book creation rolled back.`);
                        }
                        break;

                    case 'DUPLICATE':
                        // This case handles all pricing actions for duplicates
                        const { existingBook, pricingId } = statusResult.details;

                        if (statusResult.pricingStatus === 'ADD_PRICE') {
                            const newPricing = new BookPricing({ ...pricingData, book: existingBook._id });
                            await newPricing.save();
                            stats.pricesAdded++;
                        } else if (statusResult.pricingStatus === 'UPDATE_PRICE') {
                            logger.info('pricingId', pricingId);
                            logger.info('pricingData', pricingData);
                            await BookPricing.findByIdAndUpdate(pricingId, { rate: pricingData.rate, discount: pricingData.discount });
                            stats.pricesUpdated++;
                        } else { // 'NO_CHANGE'
                            stats.skippedAsDuplicate++;
                        }
                        break;

                    case 'CONFLICT':
                        // This case logs the conflict and skips the row
                        stats.skippedAsConflict++;
                        stats.conflictDetails.push({
                            row: rowNum,
                            data: row,
                            conflict: statusResult.details.conflictFields,
                            message: statusResult.message
                        });
                        break;
                }
                // --- END OF CHANGES ---
                stats.processed++;

            } catch (error) {
                stats.errors++;
                stats.errorDetails.push({ row: rowNum, error: error.message, data: row });
                logger.error(`Error processing row ${rowNum}:`, error);
            }
        }

        let conflictLogFile = null;
        if (stats.skippedAsConflict > 0) {
            conflictLogFile = await writeConflictLog(stats.conflictDetails, sourceName);
        }

        logger.info('Bulk import process completed.', { sourceName, stats });
        return {
            success: true,
            message: "Import completed successfully.",
            stats,
            logFile: conflictLogFile ? path.basename(conflictLogFile) : null,
            logFileUrl: conflictLogFile ? `http://localhost:5050/api/logs/${encodeURIComponent(path.basename(conflictLogFile))}/download` : null,
            conflictLogFile,
        };

    } catch (error) {
        logger.error('Fatal error during bulk import:', { sourceName, error });
        return { success: false, message: "A fatal error occurred during the import.", error: error.message };
    }
}


// This bundles all your named exports into a single default object
export default {
    validateExcelMapping,
    bulkImportExcel
};