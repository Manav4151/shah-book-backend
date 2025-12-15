import Quotation from "../models/quotation.schema.js";
import PDFDocument from 'pdfkit';
import { logger } from '../lib/logger.js';
import Book from "../models/book.schema.js";
import BookPricing from "../models/BookPricing.js";
import Publisher from "../models/publisher.schema.js";
import Customer from "../models/customer.schema.js";
import CompanyProfile from "../models/company.profile.schema.js";
import { createTransport } from "nodemailer";
import { ApiResponse } from "../lib/api-response.js";
import { AppError } from "../lib/api-error.js";
import gmailAuthModel from "../models/googleAuth.model.js";
import { getGoogleClient } from "../config/googleClient.js";
import { google } from "googleapis";
export const getQuotations = async (req, res) => {
  try {
    const agentId = req.user?.agentId;

    if (!agentId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized - Agent not found"
      });
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // 🔐 Multi-Tenant Filtering
    const filter = { agentId };

    const quotations = await Quotation.find(filter, {
      quotationId: 1,
      customer: 1,
      subTotal: 1,
      totalDiscount: 1,
      grandTotal: 1,
      status: 1,
      validUntil: 1,
      createdAt: 1,
      emailInfo: 1
    })
      .populate({
        path: "customer",
        select: "name"
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const totalQuotations = await Quotation.countDocuments(filter);

    res.status(200).json({
      success: true,
      message: "Quotations fetched successfully",
      quotations,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalQuotations / limit),
        totalItems: totalQuotations
      }
    });
    
  } catch (error) {
    console.error("Error fetching quotations:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching quotations",
      error: error.message
    });
  }
};


// Get single quotation by ID
export const getQuotationById = async (req, res) => {
  try {
    const agentId = req.user?.agentId;
    const { id } = req.params;

    if (!agentId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized - Agent not found"
      });
    }

    const quotation = await Quotation.findOne({
      _id: id,
      agentId: agentId // 🔐 Only fetch if this quotation belongs to current agent
    })
      .populate({
        path: "customer",
        select: "name customerName address email phone"
      })
      .populate({
        path: "items.book",
        select: "title isbn author publisher edition",
        populate: {
          path: "publisher",
          select: "name"
        }
      });

    if (!quotation) {
      return res.status(404).json({
        success: false,
        message: "Quotation not found or access denied"
      });
    }

    res.status(200).json({
      success: true,
      message: "Quotation fetched successfully",
      quotation
    });

  } catch (error) {
    logger.error("Error fetching quotation by ID:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching quotation",
      error: error.message
    });
  }
};

// quitation preview api
export const previewQuotation = async (req, res) => {
  try {
    const agentId = req.user?.agentId;
    const userId = req.user?.id;

    if (!agentId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized - Agent ID missing"
      });
    }

    const { bookIds } = req.body;

    if (!Array.isArray(bookIds) || bookIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "bookIds must be a non-empty array"
      });
    }

    // Fetch only books from the same agent
    const books = await Book.find({
      _id: { $in: bookIds },
      agentId: agentId
    });

    if (books.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No books found for your agent"
      });
    }

    const result = await Promise.all(
      books.map(async (book) => {
        // Fetch lowest pricing for this book inside tenant
        const lowestPricing = await BookPricing.findOne({
          book: book._id,
          agentId: agentId
        })
          .sort({ rate: 1 })
          .lean();

        // Fetch publisher inside tenant
        const publisher = await Publisher.findOne({
          _id: book.publisher,
          agentId: agentId
        }).lean();

        return {
          bookId: book._id,
          title: book.title,
          author: book.author,
          isbn: book.isbn,
          edition: book.edition,
          publisher_name: publisher?.name || "Unknown",
          source: lowestPricing?.source || "N/A",
          lowestPrice: lowestPricing?.rate || null,
          currency: lowestPricing?.currency || "N/A",
        };
      })
    );

    res.status(200).json({
      success: true,
      data: result
    });

  } catch (error) {
    logger.error("Error previewing quotation:", error);
    res.status(500).json({
      success: false,
      message: "Server error while previewing quotation",
      error: error.message
    });
  }
};




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
 *   validUntil: "2024-12-31T00:00:00.000Z",
 *   emailInfo: {
 *     messageId: "gmail_message_id",
 *     sender: "user@gmail.com",
 *     subject: "Email subject",
 *     receivedAt: "2024-12-31T00:00:00.000Z",
 *     snippet: "Optional email snippet"
 *   }
 * }
 */
export const createQuotation = async (req, res) => {
  try {
    const agentId = req.user?.agentId;

    if (!agentId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized - Agent not found"
      });
    }

    const { customer, items, subTotal, totalDiscount, grandTotal, status, validUntil, emailInfo } = req.body;

    if (!customer || !items?.length) {
      return res.status(400).json({
        success: false,
        message: "Customer and at least one item are required."
      });
    }

    // 🔐 Multi-Tenant Filtering: Ensure customer belongs to same agent
    const customerExists = await Customer.findOne({ _id: customer, agentId });
    if (!customerExists) {
      return res.status(403).json({
        success: false,
        message: "Access denied - Invalid customer for this agent"
      });
    }

    // 🔐 Ensure all books belong to same agent
    const bookIds = items.map((i) => i.book);
    const validBooksCount = await Book.countDocuments({
      _id: { $in: bookIds },
      agentId
    });

    if (validBooksCount !== bookIds.length) {
      return res.status(403).json({
        success: false,
        message: "Some books do not belong to this agent"
      });
    }

    const quotationData = {
      agentId,
      customer,
      items,
      subTotal,
      totalDiscount,
      grandTotal,
      status: status || "Draft",
      validUntil
    };

    if (emailInfo) {
      quotationData.emailInfo = {
        messageId: emailInfo.messageId,
        sender: emailInfo.sender,
        subject: emailInfo.subject,
        receivedAt: emailInfo.receivedAt,
        snippet: emailInfo.snippet
      };
    }

    const quotation = new Quotation(quotationData);
    await quotation.save();

    return res.status(201).json({
      success: true,
      message: "Quotation created successfully",
      quotation
    });
  } catch (error) {
    console.error("Error creating quotation:", error);
    res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message
    });
  }
};


/**
 * Update an existing quotation
 * Expected payload (all fields optional except those you want to update):
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
export const updateQuotation = async (req, res) => {
  try {
    const agentId = req.user?.agentId;

    if (!agentId) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized - Agent ID missing"
      });
    }

    const { id } = req.params;
    const { customer, items, subTotal, totalDiscount, grandTotal, status, validUntil } = req.body;

    // Fetch quotation for THIS agent only
    const quotation = await Quotation.findOne({
      _id: id,
      agentId: agentId
    });

    if (!quotation) {
      return res.status(404).json({
        success: false,
        message: "Quotation not found for this agent"
      });
    }

    // Restriction: Accepted / Rejected quotations cannot change
    if (["Accepted", "Rejected"].includes(quotation.status)) {
      return res.status(400).json({
        success: false,
        message: "Cannot edit quotations that are already Accepted or Rejected"
      });
    }

    // Update only passed fields
    if (customer) quotation.customer = customer;
    if (items && items.length > 0) quotation.items = items;
    if (subTotal !== undefined) quotation.subTotal = subTotal;
    if (totalDiscount !== undefined) quotation.totalDiscount = totalDiscount;
    if (grandTotal !== undefined) quotation.grandTotal = grandTotal;
    if (status) quotation.status = status;
    if (validUntil) quotation.validUntil = validUntil;

    // Validate items if provided
    if (items && items.length === 0) {
      return res.status(400).json({
        success: false,
        message: "At least one item is required."
      });
    }

    await quotation.save();

    // Fetch updated quotation with population
    const updatedQuotation = await Quotation.findOne({
      _id: id,
      agentId: agentId
    })
      .populate({
        path: "customer",
        select: "name customerName address email phone"
      })
      .populate({
        path: "items.book",
        select: "title isbn author publisher edition",
        populate: {
          path: "publisher",
          select: "name"
        }
      });

    return res.status(200).json({
      success: true,
      message: "Quotation updated successfully",
      quotation: updatedQuotation,
    });

  } catch (error) {
    console.error("Error updating quotation:", error);
    res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message
    });
  }
};


// quotation pdf download and preview
/**
 * @desc    Generate and stream a quotation PDF for direct download
 * @route   GET /api/quotations/:id/download
 */
export const downloadQuotationPDF = async (req, res) => {
  try {
    const agentId = req.user?.agentId;
    if (!agentId) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized - Agent ID missing"
      });
    }

    const { id } = req.params;
    const { profileId } = req.query;

    // Fetch data **restricted by agent**
    const [quotation, companyProfile] = await Promise.all([
      Quotation.findOne({
        _id: id,
        agentId: agentId
      })
        .populate({
          path: "customer",
          select: "name address phone email"
        })
        .populate({
          path: "items.book",
          select: "title isbn author publisher edition",
          populate: { path: "publisher", select: "name" }
        }),

      CompanyProfile.findOne({
        _id: profileId,
        agentId: agentId
      }),
    ]);

    if (!quotation) {
      return res.status(404).json({
        success: false,
        message: "Quotation not found for this agent"
      });
    }

    if (!companyProfile) {
      return res.status(404).json({
        success: false,
        message: "Company profile not found for this agent"
      });
    }

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="quotation-${quotation.quotationId}.pdf"`
    );

    // Stream PDF
    await buildAndStreamPdf(res, quotation, companyProfile);

  } catch (error) {
    logger.error("Error generating PDF for download:", error);
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        message: "Server error while generating PDF",
        error: error.message
      });
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
        const { profileId } = req.query;
        const agentId = req.user?.agentId;

        if (!profileId) {
            return res.status(400).json({ success: false, message: "Missing profileId" });
        }

        const [quotation, companyProfile] = await Promise.all([
            fetchQuotationData(id, agentId), // Secured fetch
            CompanyProfile.findOne({ _id: profileId, agentId }) // Agent restricted
        ]);

        if (!quotation) {
            return res.status(404).json({ success: false, message: "Quotation not found OR unauthorized" });
        }
        if (!companyProfile) {
            return res.status(404).json({ success: false, message: "Company profile not found OR unauthorized" });
        }

        // PDF Headers
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `inline; filename="quotation-${quotation.quotationId}.pdf"`);

        logger.info(`Streaming PDF for quotation: ${quotation.quotationId}`);

        await buildAndStreamPdf(res, quotation, companyProfile);

    } catch (error) {
        logger.error("Error generating PDF preview:", error);
        
        if (!res.headersSent) {
            res.status(500).json({
                success: false,
                message: "Server error while generating PDF"
            });
        }
    }
};

export const sendQuotationEmail = async (req, res) => {
  try {
    const agentId = req.user?.agentId;
    const userId = req.user?.id;
    logger.info(`Agent ID: ${agentId}, User ID: ${userId}`);
    if (!agentId || !userId) {
      return res.status(403).json(
        new AppError("Unauthorized - Missing user or agent context", 403)
      );
    }

    const { to, subject, text, html, quotationId, profileId } = req.body;

    if (!to || !subject || !text) {
      return res.status(400).json(
        new AppError("To, Subject, and Text body are required", 400)
      );
    }

    // -------------------------------------------
    // 1️⃣ Fetch OAuth tokens for Gmail (Agent-Scoped)
    // -------------------------------------------
    const authData = await gmailAuthModel.findOne({
      agentId // ensure belongs to same agent
    });

    if (!authData) {
      return res.status(401).json(
        new AppError("Gmail not connected for this agent", 401)
      );
    }

    const oauth2Client = getGoogleClient();
    oauth2Client.setCredentials({
      access_token: authData.accessToken,
      refresh_token: authData.refreshToken,
    });

    const gmail = google.gmail({ version: "v1", auth: oauth2Client });

    let emailParts = [
      `From: ${authData.email}\r\n`,
      `To: ${to}\r\n`,
      `Subject: ${subject}\r\n`,
      `MIME-Version: 1.0\r\n`,
    ];

    let attachments = [];
    let messageBody = html || text;

    // -------------------------------------------
    // 2️⃣ Quotation PDF Attachment (Agent Scoped)
    // -------------------------------------------
    if (quotationId && profileId) {
      const [quotation, companyProfile] = await Promise.all([
        fetchQuotationData(quotationId, agentId),
        CompanyProfile.findOne({
          _id: profileId,
          agentId
        }),
      ]);

      if (!quotation) {
        return res.status(403).json(
          new AppError("Quotation not found for this agent", 403)
        );
      }

      if (!companyProfile) {
        return res.status(403).json(
          new AppError("Company profile not found for this agent", 403)
        );
      }

      const pdfBuffer = await buildPdfBuffer(quotation, companyProfile);

      attachments.push({
        filename: `quotation-${quotation.quotationId}.pdf`,
        mimeType: "application/pdf",
        data: pdfBuffer.toString("base64"),
      });
    }

    // -------------------------------------------
    // 3️⃣ Additional File Upload attachment
    // -------------------------------------------
    if (req.file) {
      attachments.push({
        filename: req.file.originalname,
        mimeType: req.file.mimetype,
        data: req.file.buffer.toString("base64"),
      });
    }

    let finalEmail;

    // -------------------------------------------
    // 4️⃣ Build MIME structure
    // -------------------------------------------
    if (attachments.length > 0) {
      const boundary = "myboundary123";
      emailParts.push(`Content-Type: multipart/mixed; boundary="${boundary}"\r\n\r\n`);

      let mixedBody = "";

      mixedBody += `--${boundary}\r\n`;
      mixedBody += `Content-Type: text/html; charset="UTF-8"\r\n`;
      mixedBody += `Content-Transfer-Encoding: 7bit\r\n\r\n`;
      mixedBody += `${messageBody}\r\n\r\n`;

      attachments.forEach(att => {
        mixedBody += `--${boundary}\r\n`;
        mixedBody += `Content-Type: ${att.mimeType}; name="${att.filename}"\r\n`;
        mixedBody += `Content-Disposition: attachment; filename="${att.filename}"\r\n`;
        mixedBody += `Content-Transfer-Encoding: base64\r\n\r\n`;
        mixedBody += `${att.data}\r\n\r\n`;
      });

      mixedBody += `--${boundary}--\r\n`;
      finalEmail = emailParts.join("") + mixedBody;
    } else {
      emailParts.push(`Content-Type: text/html; charset="UTF-8"\r\n\r\n`);
      finalEmail = emailParts.join("") + messageBody;
    }

    const encodedMessage = Buffer.from(finalEmail)
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

    await gmail.users.messages.send({
      userId: "me",
      requestBody: { raw: encodedMessage },
    });

    // Update quotation status 📨
    if (quotationId) {
      await Quotation.findOneAndUpdate(
        { _id: quotationId, agentId },
        { status: "Sent" }
      );
    }

    return res.status(200).json({
      success: true,
      message: "Email sent successfully",
    });

  } catch (error) {
    console.error("Send Quotation Email Error:", error);
    return res.status(500).json(
      new AppError("Error sending quotation email", 500, error.message)
    );
  }
};




// --- Reusable Logic ---

/**
 * Fetch Quotation with Full Book + Publisher Info (Agent Scoped)
 */
export const fetchQuotationData = async (id, agentId) => {
  logger.info(`Fetching Quotation: ${id}`);
  const quotation = await Quotation.findOne({
    _id: id,
    agentId,  // Prevent cross-tenant access
  })
    .populate({
      path: "customer",
      select: "name customerName address email phone",
    })
    .populate({
      path: "items.book",
      select: "title isbn author edition publisher",
      populate: {
        path: "publisher",
        select: "name",
      },
    })
    .lean(); // Better performance for read-only operations

  if (!quotation) {
    throw new Error("Quotation not found or unauthorized access");
  }

  return quotation;
};

export const buildPdfBuffer = (quotation, companyProfile) => {
    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({ size: "A4", margin: 50 });

            // Collect PDF chunks here
            let buffers = [];

            // Capture data as it is generated
            doc.on("data", buffers.push.bind(buffers));

            // On end → combine chunks into a Buffer
            doc.on("end", () => {
                const pdfBuffer = Buffer.concat(buffers);
                resolve(pdfBuffer);
            });

            // Generate the PDF using your same functions
            generateHeader(doc, companyProfile);
            generateCustomerInformation(doc, quotation);
            generateQuotationTable(doc, quotation);
            generateFooter(doc);

            // Finalize PDF
            doc.end();

        } catch (err) {
            reject(err);
        }
    });
};
function buildAndStreamPdf(res, quotation, companyProfile) {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    doc.pipe(res);

    generateHeader(doc, companyProfile);
    generateCustomerInformation(doc, quotation);
    generateQuotationTable(doc, quotation);
    generateFooter(doc);

    doc.end();
}

// --- PDF Generation Helper Functions ---
// (These helper functions remain exactly the same as before)

function generateHeader(doc, profile) {
    const addressLine1 = profile.address?.street || '';
    const addressLine2 = `${profile.address?.city || ''}, ${profile.address?.state || ''} ${profile.address?.zipCode || ''}`.trim();

    doc.fillColor('#444444')
        .fontSize(20)
        .text(profile.companyName, 50, 57) // Dynamic Company Name
        .fontSize(10)
        .text(addressLine1, 200, 65, { align: 'right' }) // Dynamic Address
        .text(addressLine2, 200, 80, { align: 'right' }) // Dynamic Address
        .moveDown();
}

function generateCustomerInformation(doc, quotation) {
    doc.fillColor('#444444').fontSize(20).text('Quotation', 50, 160);
    generateHr(doc, 185);
    const customerInfoTop = 200;
    const customerName = quotation.customer?.customerName || quotation.customer?.name || 'N/A';
    doc.fontSize(10)
        .text('Quotation ID:', 50, customerInfoTop).font('Helvetica-Bold').text(quotation.quotationId, 150, customerInfoTop)
        .font('Helvetica').text('Issue Date:', 50, customerInfoTop + 15).text(new Date(quotation.createdAt).toLocaleDateString(), 150, customerInfoTop + 15)
        .text('Valid Until:', 50, customerInfoTop + 30).text(new Date(quotation.validUntil).toLocaleDateString(), 150, customerInfoTop + 30)
        .font('Helvetica-Bold').text(customerName, 300, customerInfoTop)
        .font('Helvetica').text(quotation.customer?.address?.street || '', 300, customerInfoTop + 15)
        .text(`${quotation.customer?.address?.city || ''}, ${quotation.customer?.address?.state || ''}`, 300, customerInfoTop + 30)
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

