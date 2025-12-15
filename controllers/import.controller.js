import xlsx from 'xlsx';
import Publisher from '../models/publisher.schema.js';
import Book from '../models/book.schema.js';
import BookPricing from '../models/BookPricing.js';
import Vendor from '../models/vendor.schema.js';
import BookVendorPricing from '../models/bookvendorpricing.schema.js';

export const previewFile = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: "No file uploaded" });
    console.log("file reach hear0");
    
    // Read file buffer
    const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];

    // Convert to JSON (header: 1 returns array of arrays)
    const data = xlsx.utils.sheet_to_json(sheet, { header: 1 });
    
    // First row is headers
    const headers = data[0] || [];
    
    res.json({ headers });
  } catch (error) {
    console.log(error);
    
    res.status(500).json({ message: error.message });
  }
};

// if not work un comment this
// export const processImport = async (req, res) => {
//   try {
//     let { mapping, type, isUpdateAllDetail, source: userSource } = req.body;
//     const agentId = req.user.agentId; 
    
//     // 1. Parse Mapping
//     if (typeof mapping === 'string') {
//         try { mapping = JSON.parse(mapping); } 
//         catch (e) { return res.status(400).json({ message: "Invalid mapping format" }); }
//     }

//     // 2. Parse File
//     if (!req.file) return res.status(400).json({ message: "No file uploaded" });
    
//     // Support both Buffer (Memory) and Path (Disk)
//     let workbook;
//     if (req.file.buffer) {
//         workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
//     } else if (req.file.path) {
//         workbook = xlsx.readFile(req.file.path);
//     }
    
//     const sheet = workbook.Sheets[workbook.SheetNames[0]];
//     const rows = xlsx.utils.sheet_to_json(sheet, { defval: "" }); 
    
//     const report = { success: 0, created: 0, updated_stock: 0, errors: [] };

//     // Helper to map row to DB fields
//     const getMappedData = (row) => {
//       const data = {};
//       for (const [excelHeader, dbField] of Object.entries(mapping)) {
//         if (dbField && dbField !== 'none') {
//            const cellValue = row[excelHeader];
//            if (cellValue !== undefined && cellValue !== "") {
//                data[dbField] = cellValue;
//            }
//         }
//       }
//       return data;
//     };

//     for (const row of rows) {
//       try {
//         const data = getMappedData(row);
        
//         // Basic Validation
//         if (!data.isbn || !data.publisher) continue;

//         // 3. Resolve Publisher (Get ObjectId)
//         const pubName = String(data.publisher).trim();
//         let publisher = await Publisher.findOne({ agentId, name: pubName });
//         if (!publisher) {
//            publisher = await Publisher.create({ agentId, name: pubName });
//         }

//         // 4. Find Book
//         let book = await Book.findOne({ agentId, isbn: data.isbn, publisher: publisher._id });

//         // 5. Create Book if missing
//         if (!book) {
//            book = await Book.create({
//              agentId,
//              publisher: publisher._id, // Assign the ObjectId, NOT the string name
//              isbn: data.isbn,
//              title: data.title || "Imported Book",
//              author: data.author,
//              edition: data.edition,
//              year: data.year
//            });
//            report.created++;
//         } 
//         // 6. Update Book Details (FIXED LOGIC)
//         else if (type === 'general_book_info' && isUpdateAllDetail === 'true') {
//            // We must sanitize 'data' to prevent overwriting ObjectId fields with strings
//            const updateData = { ...data };
           
//            delete updateData.publisher; // <--- CRITICAL FIX: Remove string publisher
//            delete updateData.isbn;      // Prevent modifying ISBN
//            delete updateData.agentId;   // Prevent modifying Agent
           
//            // Only update fields that are actually present in the Excel file
//            Object.assign(book, updateData);
//            await book.save();
//         }

//         // 7. Handle Pricing & Stock
//         const sourceName = userSource || data.source || "Manual Import";
//         const hasStockData = data.stock !== undefined;
//         const hasPriceData = data.rate !== undefined;
//         // 1. Define Permissions based on Import Type
//         const allowStockUpdate = type === 'stock_feed' || type === 'general_book_info';
//         const allowPriceUpdate = type === 'price_list' || type === 'general_book_info';

//         // Check if we effectively have data to update based on permissions
//         // We only "have" data if it exists in the file AND the type allows us to use it
//         const shouldUpdatePricing = 
//             (hasStockData && allowStockUpdate) || 
//             (hasPriceData && allowPriceUpdate);

//         if (shouldUpdatePricing) {
            
//             const updateFields = { last_updated: new Date() };
            
//             // 2. STRICTLY update fields only if Allowed
//             if (hasStockData && allowStockUpdate) {
//                 updateFields.stock = Number(data.stock);
//             }
            
//             if (hasPriceData && allowPriceUpdate) {
//                 updateFields.rate = Number(data.rate);
//                 if (data.currency) updateFields.currency = data.currency;
//                 if (data.discount) updateFields.discount = Number(data.discount);
//             }

//             // 3. Dynamic Defaults ($setOnInsert)
//             // If a field is NOT in updateFields (either missing data or not allowed), 
//             // we must provide a default for NEW documents.
//             const defaults = {};
            
//             // If stock is not being updated, default it to 0 for NEW records
//             if (updateFields.stock === undefined) defaults.stock = 0;
            
//             // If rate is not being updated, default it to 0 for NEW records
//             if (updateFields.rate === undefined) defaults.rate = 0;
            
//             // Default currency
//             if (updateFields.currency === undefined) defaults.currency = 'INR';

//             if (Object.keys(updateFields).length > 1) { // >1 because last_updated is always there
//                 await BookPricing.findOneAndUpdate(
//                     { agentId, book: book._id, source: sourceName },
//                     { 
//                         $set: updateFields,
//                         $setOnInsert: defaults 
//                     },
//                     { upsert: true, new: true }
//                 );
//                 report.updated_stock++;
//             }
//         }
//         report.success++;

//       } catch (err) {
//         report.errors.push(`Row Error: ${err.message}`);
//       }
//     }

//     // Cleanup file if it was saved to disk
//     if (req.file.path) {
//         try { fs.unlinkSync(req.file.path); } catch(e) {}
//     }

//     res.json(report);

//   } catch (error) {
//     if (req.file?.path) try { fs.unlinkSync(req.file.path); } catch(e) {}
//     res.status(500).json({ message: error.message });
//   }
// };

// new function

// export const processImport = async (req, res) => {
//   try {
//     let { mapping, type, isUpdateAllDetail, source: userSource } = req.body;
//     const agentId = req.user.agentId; 
    
//     // 1. Parse Mapping
//     if (typeof mapping === 'string') {
//         try { mapping = JSON.parse(mapping); } 
//         catch (e) { return res.status(400).json({ message: "Invalid mapping format" }); }
//     }

//     // 2. Parse File
//     if (!req.file) return res.status(400).json({ message: "No file uploaded" });
    
//     let workbook;
//     if (req.file.buffer) {
//         workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
//     } else if (req.file.path) {
//         workbook = xlsx.readFile(req.file.path);
//     }
    
//     const sheet = workbook.Sheets[workbook.SheetNames[0]];
//     const rows = xlsx.utils.sheet_to_json(sheet, { defval: "" }); 
    
//     const report = { success: 0, created: 0, updated_stock: 0, errors: [] };

//     const getMappedData = (row) => {
//       const data = {};
//       for (const [excelHeader, dbField] of Object.entries(mapping)) {
//         if (dbField && dbField !== 'none') {
//            const cellValue = row[excelHeader];
//            if (cellValue !== undefined && cellValue !== "") {
//                data[dbField] = cellValue;
//            }
//         }
//       }
//       return data;
//     };

//     for (const row of rows) {
//       try {
//         const data = getMappedData(row);
        
//         // -------------------------------------------------------------
//         // VALIDATION: Strict checks based on Type
//         // -------------------------------------------------------------
//         if (!data.publisher) continue; // Publisher is always required
        
//         // If Type is Stock List -> Quantity is Mandatory
//         if (type === 'stock_feed' && data.stock === undefined) {
//             report.errors.push(`Row Skipped (Missing Stock): ${JSON.stringify(data)}`);
//             continue;
//         }

//         // If Type is Price List -> Price is Mandatory
//         if (type === 'price_list' && data.rate === undefined) {
//              report.errors.push(`Row Skipped (Missing Price): ${JSON.stringify(data)}`);
//              continue;
//         }

//         // -------------------------------------------------------------
//         // MATCHING LOGIC (Fixed: ISBN OR Title+Publisher)
//         // -------------------------------------------------------------
        
//         // 1. Resolve Publisher
//         const pubName = String(data.publisher).trim();
//         let publisher = await Publisher.findOne({ agentId, name: pubName });
//         if (!publisher) {
//            publisher = await Publisher.create({ agentId, name: pubName });
//         }

//         // 2. Find Book (The "OR" Logic)
//         let book;
//         if (data.isbn) {
//             // Priority 1: Match by ISBN
//             book = await Book.findOne({ agentId, isbn: data.isbn, publisher: publisher._id });
//         } 
        
//         if (!book && data.title) {
//             // Priority 2: Match by Title + Publisher (if no ISBN match found)
//             book = await Book.findOne({ agentId, title: data.title, publisher: publisher._id });
//         }

//         // -------------------------------------------------------------
//         // CREATE / UPDATE BOOK
//         // -------------------------------------------------------------
//         if (!book) {
//            // Create New
//            book = await Book.create({
//              agentId,
//              publisher: publisher._id,
//              isbn: data.isbn || undefined, // Allow creating without ISBN if only Title exists
//              title: data.title || "Imported Book",
//              author: data.author,
//              edition: data.edition,
//              year: data.year
//            });
//            report.created++;
//         } 
//         else if (type === 'general_book_info' && isUpdateAllDetail === 'true') {
//            // General Update
//            const updateData = { ...data };
//            delete updateData.publisher; 
//            delete updateData.isbn;      
//            delete updateData.agentId;   
//            Object.assign(book, updateData);
//            await book.save();
//         }

//         // -------------------------------------------------------------
//         // PRICING & STOCK
//         // -------------------------------------------------------------
//         const hasStockData = data.stock !== undefined;
//         const hasPriceData = data.rate !== undefined;

//         const allowStockUpdate = type === 'stock_feed' || type === 'general_book_info';
//         const allowPriceUpdate = type === 'price_list' || type === 'general_book_info';

//         const shouldUpdatePricing = (hasStockData && allowStockUpdate) || (hasPriceData && allowPriceUpdate);

//         if (shouldUpdatePricing) {
            
//             const sourceName = userSource || data.source || "Manual Import";
//             const updateFields = { last_updated: new Date() };
            
//             // STRICT Permissions
//             if (hasStockData && allowStockUpdate) {
//                 updateFields.stock = Number(data.stock);
//             }
            
//             if (hasPriceData && allowPriceUpdate) {
//                 updateFields.rate = Number(data.rate);
//                 if (data.currency) updateFields.currency = data.currency;
//                 if (data.discount) updateFields.discount = Number(data.discount);
//             }

//             // Defaults for NEW entries ($setOnInsert)
//             const defaults = {};
//             if (updateFields.stock === undefined) defaults.stock = 0;
//             if (updateFields.rate === undefined) defaults.rate = 0;
//             if (updateFields.currency === undefined) defaults.currency = 'INR';

//             if (Object.keys(updateFields).length > 1) { 
//                 await BookPricing.findOneAndUpdate(
//                     { agentId, book: book._id, source: sourceName },
//                     { 
//                         $set: updateFields,
//                         $setOnInsert: defaults 
//                     },
//                     { upsert: true, new: true }
//                 );
//                 report.updated_stock++;
//             }
//         }
//         report.success++;

//       } catch (err) {
//         report.errors.push(`Row Error: ${err.message}`);
//       }
//     }

//     if (req.file.path) try { fs.unlinkSync(req.file.path); } catch(e) {}
//     res.json(report);

//   } catch (error) {
//     if (req.file?.path) try { fs.unlinkSync(req.file.path); } catch(e) {}
//     res.status(500).json({ message: error.message });
//   }
// };

// vendor flow 
// Make sure to import your new models at the top of your file
export const processImport = async (req, res) => {
  try {
    // 1. Changed 'source' to 'vendor' in destructuring
    let { mapping, type, isUpdateAllDetail, vendor: userVendorName } = req.body;
    const agentId = req.user.agentId; 
    
    // 1. Parse Mapping
    if (typeof mapping === 'string') {
        try { mapping = JSON.parse(mapping); } 
        catch (e) { return res.status(400).json({ message: "Invalid mapping format" }); }
    }

    // 2. Parse File
    if (!req.file) return res.status(400).json({ message: "No file uploaded" });
    
    let workbook;
    if (req.file.buffer) {
        workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
    } else if (req.file.path) {
        workbook = xlsx.readFile(req.file.path);
    }
    
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = xlsx.utils.sheet_to_json(sheet, { defval: "" }); 
    
    const report = { success: 0, created: 0, updated_stock: 0, errors: [] };

    // Optimization: If a default vendor is provided, resolve it ONCE here to save DB calls
    let defaultVendorDoc = null;
    if (userVendorName) {
        const vName = String(userVendorName).trim();
        defaultVendorDoc = await Vendor.findOne({ agentId, name: vName });
        if (!defaultVendorDoc) {
            defaultVendorDoc = await Vendor.create({ agentId, name: vName });
        }
    }

    const getMappedData = (row) => {
      const data = {};
      for (const [excelHeader, dbField] of Object.entries(mapping)) {
        if (dbField && dbField !== 'none') {
           const cellValue = row[excelHeader];
           if (cellValue !== undefined && cellValue !== "") {
               data[dbField] = cellValue;
           }
        }
      }
      return data;
    };

    for (const row of rows) {
      try {
        const data = getMappedData(row);
        
        // -------------------------------------------------------------
        // VALIDATION: Strict checks based on Type
        // -------------------------------------------------------------
        if (!data.publisher) continue; 
        
        if (type === 'stock_feed' && data.stock === undefined) {
            report.errors.push(`Row Skipped (Missing Stock): ${JSON.stringify(data)}`);
            continue;
        }

        if (type === 'price_list' && data.rate === undefined) {
             report.errors.push(`Row Skipped (Missing Price): ${JSON.stringify(data)}`);
             continue;
        }

        // -------------------------------------------------------------
        // MATCHING LOGIC (Book & Publisher)
        // -------------------------------------------------------------
        
        // 1. Resolve Publisher
        const pubName = String(data.publisher).trim();
        let publisher = await Publisher.findOne({ agentId, name: pubName });
        if (!publisher) {
           publisher = await Publisher.create({ agentId, name: pubName });
        }

        // 2. Find Book 
        let book;
        if (data.isbn) {
           book = await Book.findOne({ agentId, isbn: data.isbn, publisher: publisher._id });
        } 
        

        // -------------------------------------------------------------
        // CREATE / UPDATE BOOK
        // -------------------------------------------------------------
        if (!book) {
           book = await Book.create({
             agentId,
             publisher: publisher._id,
             isbn: data.isbn || undefined,
             title: data.title || "Imported Book",
             author: data.author,
             edition: data.edition,
             year: data.year
           });
           report.created++;
        } 
        else if (type === 'general_book_info' && isUpdateAllDetail === 'true') {
           const updateData = { ...data };
           delete updateData.publisher; 
           delete updateData.isbn;      
           delete updateData.agentId;   
           Object.assign(book, updateData);
           await book.save();
        }

        // -------------------------------------------------------------
        // PRICING & STOCK (UPDATED FOR VENDOR SCHEMA)
        // -------------------------------------------------------------
        const hasStockData = data.stock !== undefined;
        const hasPriceData = data.rate !== undefined;

        const allowStockUpdate = type === 'stock_feed' || type === 'general_book_info';
        const allowPriceUpdate = type === 'price_list' || type === 'general_book_info';

        const shouldUpdatePricing = (hasStockData && allowStockUpdate) || (hasPriceData && allowPriceUpdate);

        if (shouldUpdatePricing) {
            
            // --- NEW VENDOR LOGIC START ---
            let currentVendorDoc = defaultVendorDoc;

            // If no default vendor (or row specific vendor), find/create per row
            if (!currentVendorDoc) {
                const rowVendorName = data.vendor ;
                currentVendorDoc = await Vendor.findOne({ agentId, name: rowVendorName });
                if (!currentVendorDoc) {
                    currentVendorDoc = await Vendor.create({ agentId, name: rowVendorName });
                }
            }
            // --- NEW VENDOR LOGIC END ---

            const updateFields = { last_updated: new Date() };
            
            if (hasStockData && allowStockUpdate) {
                updateFields.stock = Number(data.stock);
            }
            
            if (hasPriceData && allowPriceUpdate) {
                updateFields.rate = Number(data.rate);
                if (data.currency) updateFields.currency = data.currency;
                if (data.discount) updateFields.discount = Number(data.discount);
            }

            // Defaults for NEW entries
            const defaults = {};
            if (updateFields.stock === undefined) defaults.stock = 0;
            if (updateFields.rate === undefined) defaults.rate = 0;
            if (updateFields.currency === undefined) defaults.currency = 'INR';

            if (Object.keys(updateFields).length > 1) { 
                // UPDATED: Using BookVendorPricing and querying by 'vendor' ID
                await BookVendorPricing.findOneAndUpdate(
                    { 
                        agentId, 
                        book: book._id, 
                        vendor: currentVendorDoc._id //
                    },
                    { 
                        $set: updateFields,
                        $setOnInsert: defaults 
                    },
                    { upsert: true, new: true }
                );
                report.updated_stock++;
            }
        }
        report.success++;

      } catch (err) {
        report.errors.push(`Row Error: ${err.message}`);
      }
    }

    if (req.file.path) try { fs.unlinkSync(req.file.path); } catch(e) {}
    res.json(report);

  } catch (error) {
    if (req.file?.path) try { fs.unlinkSync(req.file.path); } catch(e) {}
    res.status(500).json({ message: error.message });
  }
};
export const getDbFields = (req, res) => {
    // Return the list of fields your system supports importing into
    const fields = [
        { key: "isbn", label: "ISBN Code", required: true },
        { key: "title", label: "Book Title", required: true },
        { key: "author", label: "Author Name", required: false },
        { key: "publisher", label: "Publisher Name", required: true },
        { key: "edition", label: "Edition", required: false },
        { key: "year", label: "Publish Year", required: false },
        { key: "stock", label: "Stock Quantity", required: false },
        { key: "currency", label: "Currency (USD/EUR)", required: false },
        { key: "rate", label: "Price/Rate", required: false },
        { key: "discount", label: "Discount %", required: false },
        { key: "stock" , label: "Stock Quantity", required: false }
    ];
    
    res.json(fields);
};