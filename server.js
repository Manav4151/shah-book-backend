// // Import necessary modules
// import express, { json } from 'express';
// import { connect } from 'imap-simple';
// import { simpleParser } from 'mailparser';
// import { createTransport } from 'nodemailer';
// import multer, { memoryStorage } from 'multer';
// import cors from 'cors'; 
// import { join } from 'path';
// // require('dotenv').config();

import { cleanIsbnForValidation, validateISBN } from "./utils/isbnValidator.js";

// const app = express();
// const port = 5001;

// // Middleware
// app.use(cors()); // <-- Add the CORS middleware
// app.use(json());
// // app.use(static(join(__dirname))); // Serve static files like index.html


// // Multer setup for handling file uploads (attachments)
// const upload = multer({ storage: memoryStorage() });

// // --- IMAP Configuration for fetching emails ---
// const imapConfig = {
//     imap: {
//         user: "20manavpatel@gmail.com",
//         password: 'thuz hbnp dlix avhl', // Not used with OAuth2
//         host: 'imap.gmail.com',
//         port: 993,
//         tls: true,
//         authTimeout: 30000,
//         tlsOptions: {
//             rejectUnauthorized: false
//         },
//         // xoauth2: {
//         //     user: "20manavpatel@gmail.com",
//         //     clientId: process.env.OAUTH_CLIENT_ID,
//         //     clientSecret: process.env.OAUTH_CLIENT_SECRET,
//         //     refreshToken: process.env.OAUTH_REFRESH_TOKEN,
//         // },
//     },
// };

// // --- Nodemailer (SMTP) Configuration for sending emails ---
// const transporter = createTransport({
//     host: 'smtp.gmail.com',
//     port: 465,
//     secure: true,
//     auth: {
//         user: "20manavpatel@gmail.com",
//         pass: "thuz hbnp dlix avhl",
//     },
// });


// // === API ENDPOINTS ===

// /**
//  * @route   GET /api/emails
//  * @desc    Get list of latest 20 emails
//  */
// app.get('/api/emails', async (req, res) => {
//     try {
//         const connection = await connect(imapConfig);
//         await connection.openBox('INBOX');

//         // Search for all emails and fetch the last 20
//         const searchCriteria = ['ALL'];
//         const fetchOptions = {
//             bodies: ['HEADER.FIELDS (FROM TO SUBJECT DATE)'],
//             markSeen: false,
//         };
//         const messages = await connection.search(searchCriteria, fetchOptions);
        
//         // Sort messages by UID in descending order and take the latest 20
//         const recentMessages = messages.sort((a, b) => b.attributes.uid - a.attributes.uid).slice(0, 20);

//         const emails = recentMessages.map(item => {
//             const header = item.parts.find(part => part.which === 'HEADER.FIELDS (FROM TO SUBJECT DATE)').body;
//             return {
//                 uid: item.attributes.uid,
//                 from: header.from[0],
//                 subject: header.subject[0],
//                 date: header.date[0],
//             };
//         });

//         connection.end();
//         res.json(emails);
//     } catch (error) {
//         console.error('Error fetching emails:', error);
//         res.status(500).send('Error fetching emails.');
//     }
// });

// /**
//  * @route   GET /api/emails/:uid
//  * @desc    Get a single email by its UID
//  */
// app.get('/api/emails/:uid', async (req, res) => {
//     try {
//         const connection = await connect(imapConfig);
//         await connection.openBox('INBOX');
//         const { uid } = req.params;

//         const fetchOptions = {
//             bodies: [''],
//             markSeen: true,
//         };
//         const messages = await connection.search([['UID', uid]], fetchOptions);

//         if (!messages.length) {
//             connection.end();
//             return res.status(404).send('Email not found.');
//         }

//         const emailBody = messages[0].parts.find(part => part.which === '').body;
//         const parsedEmail = await simpleParser(emailBody);

//         // We are not downloading attachments here, just listing them.
//         // A full implementation would require another endpoint to download them.
//         const simplifiedAttachments = parsedEmail.attachments.map(att => ({
//             filename: att.filename,
//             contentType: att.contentType,
//             size: att.size,
//         }));

//         const emailData = {
//             from: parsedEmail.from.text,
//             to: parsedEmail.to.text,
//             subject: parsedEmail.subject,
//             date: parsedEmail.date,
//             html: parsedEmail.html || parsedEmail.textAsHtml,
//             attachments: simplifiedAttachments,
//         };

//         connection.end();
//         res.json(emailData);

//     } catch (error) {
//         console.error('Error fetching single email:', error);
//         res.status(500).send('Error fetching email.');
//     }
// });

// /**
//  * @route   POST /api/send
//  * @desc    Send a new email
//  */
// app.post('/api/send', upload.single('attachment'), async (req, res) => {
//     const { to, subject, text } = req.body;
    
//     if (!to || !subject || !text) {
//         return res.status(400).send('To, Subject, and Text body are required.');
//     }

//     try {
//         const mailOptions = {
//             from: `You <${process.env.EMAIL_USER}>`,
//             to: to,
//             subject: subject,
//             html: text, // Sending as HTML
//         };

//         // If a file was uploaded, add it as an attachment
//         if (req.file) {
//             mailOptions.attachments = [{
//                 filename: req.file.originalname,
//                 content: req.file.buffer,
//                 contentType: req.file.mimetype,
//             }, ];
//         }

//         await transporter.sendMail(mailOptions);
//         res.status(200).send('Email sent successfully!');
//     } catch (error) {
//         console.error('Error sending email:', error);
//         res.status(500).send('Error sending email.');
//     }
// });


// // Start the server
// app.listen(port, () => {
//     console.log(`Email client server listening at http://localhost:${port}`);
// }).on('error', (err) => {
//     console.error('Server failed to start:', err);
// });


// test.js

function processBookRow(row, mapping, sourceName, helpers = {}) {
    const {
        validateISBN = () => true, // default placeholder
        cleanIsbnForValidation = v => v.replace(/[-\s]/g, '') // default ISBN cleaning
    } = helpers;

    // Define collection groups
    const pricingFields = ['rate', 'currency', 'discount'];
    const publisherFields = ['publisher_name'];

    // Initialize clean containers
    const data = {
        bookData: {},
        pricingData: { source: sourceName },
        publisherData: {}
    };

    // Iterate through row based on mapping
    for (const excelHeader in mapping) {
        const schemaField = mapping[excelHeader]; // db field
        const rawValue = row[excelHeader];

        if (rawValue === undefined || rawValue === null) continue;

        const cleanValue = String(rawValue).trim();
        if (!cleanValue) continue; // ignore empty values

        // Assign to appropriate object
        if (pricingFields.includes(schemaField)) {
            data.pricingData[schemaField] = cleanValue;
        } else if (publisherFields.includes(schemaField)) {
            data.publisherData[schemaField] = cleanValue;
        } else {
            data.bookData[schemaField] = cleanValue;
        }
    }

    // Final Cleanup & Type Conversion

    // ISBN validation and cleaning
    if (data.bookData.isbn) {
        if (validateISBN(data.bookData.isbn)) {
            data.bookData.isbn = cleanIsbnForValidation(data.bookData.isbn);
        } else {
            data.bookData.isbn = null;
        }
    }

    // Convert numbers safely
    const numberFields = ['year', 'rate', 'discount'];
    numberFields.forEach(field => {
        if (data.bookData[field]) data.bookData[field] = Number(data.bookData[field]) || null;
        if (data.pricingData[field]) data.pricingData[field] = Number(data.pricingData[field]) || null;
    });

    // Default discount
    if (data.pricingData.discount === undefined || data.pricingData.discount === null) {
        data.pricingData.discount = 0;
    }

    // Default currency
    if (!data.pricingData.currency) {
        data.pricingData.currency = 'INR';
    }

    // Standardize optional fields to null if missing
    const optionalFields = ['classification', 'binding_type', 'edition', 'remarks'];
    optionalFields.forEach(field => {
        if (data.bookData[field] === undefined) {
            data.bookData[field] = null;
        }
    });

    return data;
}


const row = {
    "ISBN": "978-4433221100",
    "Title": "Machine Learning",
    "Author": "David Lee",
    "Price": "79.99",
    "Currency": "EUR",
    "Publisher": "AI Books",
    "Year": "2023",
    "Discount": "12",
    "Classification": "Artificial Intelligence",
    "Binding Type": "Hardcover",
    "Edition": "1st Edition",
    "Remarks": "Cutting-edge techniques"
  };

const mapping = {
  "ISBN": "isbn",
  "Title": "title",
  "Author": "author",
  "Price": "rate",
  "Currency": "currency",
  "Publisher": "publisher_name",
  "Year": "year",
  "Discount": "discount",
  "Classification": "classification",
  "Binding Type": "binding_type",
  "Edition": "edition",
  "Remarks": "remarks"
};



const result = processBookRow(row, mapping, 'ExcelImport', {
    validateISBN,
    cleanIsbnForValidation
  });
console.log(result);

const res = validateISBN('978-1-60309-502-0');
console.log(res);