import { connect } from 'imap-simple';
import { simpleParser } from 'mailparser';
import { createTransport } from 'nodemailer';
import multer from 'multer';
import { ApiResponse } from '../lib/api-response.js';
import { AppError } from '../lib/api-error.js';
import { logger } from '../lib/logger.js';
import dotenv from 'dotenv';
import { PDFParse } from 'pdf-parse';
dotenv.config();

console.log("Environment Variables:");
console.log("IMAP Configuration:", process.env.EMAIL_USER, process.env.EMAIL_PASSWORD, process.env.EMAIL_HOST_IMAP, process.env.EMAIL_PORT_IMAP);

// IMAP Configuration for fetching emails
const imapConfig = {
    imap: {
        user: process.env.EMAIL_USER,
        password: process.env.EMAIL_PASSWORD,
        host: 'imap.gmail.com',
        port: 993,
        tls: true,
        authTimeout: 30000,
        tlsOptions: {
            rejectUnauthorized: false
        },
    },
};

// Nodemailer (SMTP) Configuration for sending emails
const transporter = createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD,
    },
});

/**
 * @desc    Get list of latest emails
 * @route   GET /api/emails
 * @access  Private
 */
export const getEmails = async (req, res) => {
    try {
        logger.info('Fetching emails from IMAP server');

        const connection = await connect(imapConfig);
        await connection.openBox('INBOX');

        // Search for all emails and fetch the last 20
        const searchCriteria = ['ALL'];
        const fetchOptions = {
            bodies: ['HEADER.FIELDS (FROM TO SUBJECT DATE)'],
            markSeen: false,
        };
        const messages = await connection.search(searchCriteria, fetchOptions);

        // Sort messages by UID in descending order and take the latest 20
        const recentMessages = messages.sort((a, b) => b.attributes.uid - a.attributes.uid).slice(0, 20);

        const emails = recentMessages.map(item => {
            const header = item.parts.find(part => part.which === 'HEADER.FIELDS (FROM TO SUBJECT DATE)').body;
            return {
                uid: item.attributes.uid,
                from: header.from[0],
                subject: header.subject[0],
                date: header.date[0],
            };
        });

        connection.end();

        logger.info(`Successfully fetched ${emails.length} emails`);
        return res.status(200).json(new ApiResponse(200, emails, "Emails fetched successfully"));
    } catch (error) {
        logger.error('Error fetching emails:', error);
        return res.status(500).json(new AppError("Error fetching emails", 500, error.message));
    }
};

/**
 * @desc    Get a single email by its UID
 * @route   GET /api/emails/:uid
 * @access  Private
 */
export const getEmailById = async (req, res) => {
    try {
        const { uid } = req.params;
        logger.info(`Fetching email with UID: ${uid}`);

        const connection = await connect(imapConfig);
        await connection.openBox('INBOX');

        const fetchOptions = {
            bodies: [''],
            markSeen: true,
        };
        const messages = await connection.search([['UID', uid]], fetchOptions);

        if (!messages.length) {
            connection.end();
            logger.warn(`Email with UID ${uid} not found`);
            return res.status(404).json(new AppError("Email not found", 404));
        }

        const emailBody = messages[0].parts.find(part => part.which === '').body;
        const parsedEmail = await simpleParser(emailBody);
        const processedAttachments = await processEmailAttachments(parsedEmail);
        // Process attachments
        const simplifiedAttachments = parsedEmail.attachments.map(att => ({
            filename: att.filename,
            contentType: att.contentType,
            size: att.size,
        }));

        const emailData = {
            uid: uid,
            from: parsedEmail.from.text,
            to: parsedEmail.to.text,
            subject: parsedEmail.subject,
            date: parsedEmail.date,
            html: parsedEmail.html || parsedEmail.textAsHtml,
            text: parsedEmail.text,
            attachments: processedAttachments,
        };

        connection.end();

        logger.info(`Successfully fetched email with UID: ${uid}`);
        return res.status(200).json(new ApiResponse(200, emailData, "Email fetched successfully"));
    } catch (error) {
        logger.error('Error fetching single email:', error);
        return res.status(500).json(new AppError("Error fetching email", 500, error.message));
    }
};

/**
 * @desc    Send a new email
 * @route   POST /api/emails/send
 * @access  Private
 */
export const sendEmail = async (req, res) => {
    try {
        const { to, subject, text, html } = req.body;

        if (!to || !subject || !text) {
            return res.status(400).json(new AppError("To, Subject, and Text body are required", 400));
        }

        logger.info(`Sending email to: ${to}, subject: ${subject}`);

        const mailOptions = {
            from: `Book Management System <20manavpatel@gmail.com>`,
            to: to,
            subject: subject,
            text: text,
            html: html || text, // Use HTML if provided, otherwise use text
        };

        // If a file was uploaded, add it as an attachment
        if (req.file) {
            mailOptions.attachments = [{
                filename: req.file.originalname,
                content: req.file.buffer,
                contentType: req.file.mimetype,
            }];
        }

        await transporter.sendMail(mailOptions);

        logger.info(`Email sent successfully to: ${to}`);
        return res.status(200).json(new ApiResponse(200, null, "Email sent successfully"));
    } catch (error) {
        logger.error('Error sending email:', error);
        return res.status(500).json(new AppError("Error sending email", 500, error.message));
    }
};


/**
 * Parses all attachments from a mail object, extracting text from PDFs.
 * @param {object} mail - The mail object from mailparser.
 * @returns {Promise<Array<object>>} - A promise that resolves to the array of processed attachments.
 */
async function processEmailAttachments(mail) {
    const processedAttachments = [];

    if (!mail.attachments) {
        return []; // No attachments, return empty array
    }

    // Loop through all attachments concurrently
    await Promise.all(mail.attachments.map(async (attachment) => {

        let extractedText = null; // Default to null

        // --- THIS IS THE CORE LOGIC ---
        if (attachment.contentType === 'application/pdf' && attachment.content) {
            try {
                // pdf-parse works directly with the buffer from mailparser
                const pdfData = Uint8Array.from(attachment.content);
                const data = new PDFParse(pdfData);
                extractedText = await data.getText();
            } catch (err) {
                console.error(`Failed to parse PDF: ${attachment.filename}`, err);
                extractedText = `[Error: Failed to parse PDF: ${attachment.filename}]`;
            }
        }
        // --- End of core logic ---

        else if (attachment.contentType === 'text/plain' && attachment.content) {
            // Also good to handle plain text files
            extractedText = attachment.content.toString('utf8');
        }

        processedAttachments.push({
            filename: attachment.filename,
            contentType: attachment.contentType,
            sizeInBytes: attachment.size,
            extractedText: extractedText // This will be the full text or null
        });
    }));

    return processedAttachments;
}
/**
 * @desc    Download email attachment
 * @route   GET /api/emails/:uid/attachments/:filename
 * @access  Private
 */
export const downloadAttachment = async (req, res) => {
    try {
        const { uid, filename } = req.params;
        logger.info(`Downloading attachment: ${filename} from email UID: ${uid}`);

        const connection = await connect(imapConfig);
        await connection.openBox('INBOX');

        const fetchOptions = {
            bodies: [''],
            markSeen: false,
        };
        const messages = await connection.search([['UID', uid]], fetchOptions);

        if (!messages.length) {
            connection.end();
            return res.status(404).json(new AppError("Email not found", 404));
        }

        const emailBody = messages[0].parts.find(part => part.which === '').body;
        const parsedEmail = await simpleParser(emailBody);

        // Find the specific attachment
        const attachment = parsedEmail.attachments.find(att => att.filename === filename);

        if (!attachment) {
            connection.end();
            return res.status(404).json(new AppError("Attachment not found", 404));
        }

        connection.end();

        // Set headers for file download
        res.setHeader('Content-Type', attachment.contentType);
        res.setHeader('Content-Disposition', `attachment; filename="${attachment.filename}"`);
        res.setHeader('Content-Length', attachment.size);

        res.send(attachment.content);

        logger.info(`Attachment downloaded successfully: ${filename}`);
    } catch (error) {
        logger.error('Error downloading attachment:', error);
        return res.status(500).json(new AppError("Error downloading attachment", 500, error.message));
    }
};
