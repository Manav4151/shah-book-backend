import Quotation from "../models/quotation.schema.js";
import PDFDocument from 'pdfkit';
import { logger } from '../lib/logger.js';
import Book from "../models/book.schema.js";
import BookPricing from "../models/BookPricing.js";
import Publisher from "../models/publisher.schema.js";
import Customer from "../models/customer.schema.js";

export const getQuotations = async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const quotations = await Quotation.find({}, {
        quotationId: 1,
        customer: 1,
        subTotal: 1,
        totalDiscount: 1,
        grandTotal: 1,
        status: 1,
        validUntil: 1,
        createdAt: 1
    })

        .populate({
            path: 'customer',
            select: 'name' // Just fetch customer name, not all details
        })
        .sort({ createdAt: -1 }) // Show the most recent quotations first
        .skip(skip)
        .limit(limit);

    const totalQuotations = await Quotation.countDocuments();

    res.status(200).json({
        success: true,
        message: "Quotations fetched successfully",
        quotations,
        pagination: {
            currentPage: page,
            totalPages: Math.ceil(totalQuotations / limit),
            totalItems: totalQuotations
        }
    },);
};
// quitation preview api
export const previewQuotation = async (req, res) => {
    try {
        const userId = req.user?.id || 'anonymous';
        const { bookIds } = req.body;
        const books = await Book.find({ _id: { $in: bookIds } });
        const result = await Promise.all(
            books.map(async (book) => {
                const lowestPricing = await BookPricing.findOne({ book: book._id })
                    .sort({ rate: 1 }) // get lowest price
                    .lean();

                const publisher = await Publisher.findById(book.publisher);

                return {
                    bookId: book._id,
                    title: book.title,
                    author: book.author,
                    isbn: book.isbn,
                    publisher_name: publisher.name,
                    edition: book.edition,
                    source: lowestPricing ? lowestPricing.source : 'N/A',
                    lowestPrice: lowestPricing ? lowestPricing.rate : null,
                    currency: lowestPricing ? lowestPricing.currency : 'N/A',
                };
            })
        );


        res.status(200).json({ success: true, data: result });
    } catch (error) {
        logger.error('Error previewing quotation:', error);
        res.status(500).json({ success: false, message: 'Server error while previewing quotation.' });
    }
}




/**
 * Create a new quotation
 * Expected payload:
 * {
 *   customer: "<customerId>",
 *   items: [
 *     { book: "<bookId>", quantity: 1, unitPrice: 100, discount: 5, totalPrice: 95 }
 *   ],
 *   subTotal: 100,
 *   totalDiscount: 5,
 *   grandTotal: 95,
 *   status: "Draft",
 *   validUntil: "2024-12-31T00:00:00.000Z"
 * }
 */
export const createQuotation = async (req, res) => {
    try {
        const { customer, items, subTotal, totalDiscount, grandTotal, status, validUntil } = req.body;

        // ✅ Basic validation
        if (!customer || !items?.length) {
            return res.status(400).json({ success: false, message: 'Customer and at least one item are required.' });
        }

        // ✅ Optionally verify references exist (not mandatory but good practice)
        // const customerExists = await Customer.findById(customer);
        // if (!customerExists) {
        //   return res.status(404).json({ message: 'Customer not found.' });
        // }

        // Validate book references (optional strict check)
        // const bookIds = items.map(i => i.book);
        // const foundBooks = await Book.find({ _id: { $in: bookIds } });
        // if (foundBooks.length !== bookIds.length) {
        //   return res.status(400).json({ message: 'Some book IDs are invalid.' });
        // }

        // ✅ Create new quotation
        const quotation = new Quotation({
            customer,
            items,
            subTotal,
            totalDiscount,
            grandTotal,
            status: status || 'Draft',
            validUntil,
        });

        // Save quotation (auto-generates quotationId)
        await quotation.save();

        return res.status(201).json({
            success: true,
            message: 'Quotation created successfully',
            quotation,
        });
    } catch (error) {
        console.error('Error creating quotation:', error);
        res.status(500).json({ success: false, message: 'Internal Server Error', error: error.message });
    }
};

// quotation pdf download and preview
/**
 * @desc    Generate and stream a quotation PDF for direct download
 * @route   GET /api/quotations/:id/download
 */
export const downloadQuotationPDF = async (req, res) => {
    try {
        const { id } = req.params;
        const quotation = await fetchQuotationData(id);

        // Manually check if data was found
        if (!quotation) {
            return res.status(404).json({ success: false, message: 'Quotation not found' });
        }

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="quotation-${quotation.quotationId}.pdf"`);

        buildAndStreamPdf(res, quotation);

    } catch (error) {
        // Manually log and send a server error response
        logger.error('Error generating PDF for download:', error);
        if (!res.headersSent) {
            res.status(500).json({ success: false, message: 'Server error while generating PDF.' });
        }
    }
};

/**
 * @desc    Generate and stream a quotation PDF for inline preview
 * @route   GET /api/quotations/:id/preview
 */
export const previewQuotationPDF = async (req, res) => {
    try {
        const { id } = req.params;
        const quotation = await fetchQuotationData(id);

        if (!quotation) {
            return res.status(404).json({ success: false, message: 'Quotation not found' });
        }

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="quotation-${quotation.quotationId}.pdf"`);

        buildAndStreamPdf(res, quotation);

    } catch (error) {
        logger.error('Error generating PDF preview:', error);
        if (!res.headersSent) {
            res.status(500).json({ success: false, message: 'Server error while generating PDF.' });
        }
    }
};


// --- Reusable Logic ---

const fetchQuotationData = async (id) => {
    // This function can still throw an error, which will be caught by the controllers above.
    const quotation = await Quotation.findById(id)
        .populate({ path: 'items.book', select: 'title isbn' });
    return quotation;
};

function buildAndStreamPdf(res, quotation) {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    doc.pipe(res);

    generateHeader(doc);
    generateCustomerInformation(doc, quotation);
    generateQuotationTable(doc, quotation);
    generateFooter(doc);

    doc.end();
}

// --- PDF Generation Helper Functions ---
// (These helper functions remain exactly the same as before)

function generateHeader(doc) {
    doc.fillColor('#444444').fontSize(20).text('Your Company Name', 50, 57)
        .fontSize(10).text('123 Main Street', 200, 65, { align: 'right' })
        .text('City, State, 12345', 200, 80, { align: 'right' })
        .moveDown();
}

function generateCustomerInformation(doc, quotation) {
    doc.fillColor('#444444').fontSize(20).text('Quotation', 50, 160);
    generateHr(doc, 185);
    const customerInfoTop = 200;
    doc.fontSize(10)
        .text('Quotation ID:', 50, customerInfoTop).font('Helvetica-Bold').text(quotation.quotationId, 150, customerInfoTop)
        .font('Helvetica').text('Issue Date:', 50, customerInfoTop + 15).text(new Date(quotation.createdAt).toLocaleDateString(), 150, customerInfoTop + 15)
        .text('Valid Until:', 50, customerInfoTop + 30).text(new Date(quotation.validUntil).toLocaleDateString(), 150, customerInfoTop + 30)
        .font('Helvetica-Bold').text(quotation.customer.customerName, 300, customerInfoTop)
        .font('Helvetica').text(quotation.customer.address?.street || '', 300, customerInfoTop + 15)
        .text(`${quotation.customer.address?.city || ''}, ${quotation.customer.address?.state || ''}`, 300, customerInfoTop + 30)
        .moveDown();
    generateHr(doc, 252);
}

function generateQuotationTable(doc, quotation) {
    const tableTop = 330;
    doc.font('Helvetica-Bold');
    generateTableRow(doc, tableTop, 'Item', 'Qty', 'Unit Price', 'Discount (%)', 'Line Total');
    generateHr(doc, tableTop + 20);
    doc.font('Helvetica');
    let i = 0;
    for (const item of quotation.items) {
        const y = tableTop + (i + 1) * 30;
        generateTableRow(doc, y, item.book.title, item.quantity, formatCurrency(item.unitPrice), item.discount, formatCurrency(item.totalPrice));
        generateHr(doc, y + 20);
        i++;
    }
    const subtotalPosition = tableTop + (i + 1) * 30;
    generateTableRow(doc, subtotalPosition, '', '', '', 'Subtotal', formatCurrency(quotation.subTotal));
    const discountPosition = subtotalPosition + 20;
    generateTableRow(doc, discountPosition, '', '', '', 'Total Discount', formatCurrency(quotation.totalDiscount));
    const grandTotalPosition = discountPosition + 20;
    doc.font('Helvetica-Bold');
    generateTableRow(doc, grandTotalPosition, '', '', '', 'Grand Total', formatCurrency(quotation.grandTotal));
    doc.font('Helvetica');
}

function generateFooter(doc) {
    doc.fontSize(10).text('Thank you for your business.', 50, 780, { align: 'center', width: 500 });
}

function generateTableRow(doc, y, item, qty, unitPrice, discount, lineTotal) {
    doc.fontSize(10).text(item, 50, y)
        .text(qty.toString(), 280, y, { width: 90, align: 'right' })
        .text(unitPrice.toString(), 330, y, { width: 90, align: 'right' })
        .text(discount.toString(), 400, y, { width: 90, align: 'right' })
        .text(lineTotal.toString(), 0, y, { align: 'right' });
}

function generateHr(doc, y) {
    doc.strokeColor('#aaaaaa').lineWidth(1).moveTo(50, y).lineTo(550, y).stroke();
}

function formatCurrency(amount) {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
}