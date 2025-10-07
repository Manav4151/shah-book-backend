import Quotation from "../models/quotation.schema.js";
import PDFDocument from 'pdfkit';
import { logger } from '../lib/logger.js';
export const getQuotations = async (req, res) =>{
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const quotations = await Quotation.find({})
   
    .populate({
        path: 'items.book',
        select: 'title author isbn' // Select book details for each item
    })
    .sort({ createdAt: -1 }) // Show the most recent quotations first
    .skip(skip)
    .limit(limit);

const totalQuotations = await Quotation.countDocuments();

res.status(200).json({
    message: "Quotations fetched successfully",
    quotations,
    pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalQuotations / limit),
        totalItems: totalQuotations
    }
},);
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