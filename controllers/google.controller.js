import { google } from "googleapis";
import { oauth2Client, generateAuthUrl, getToken, setCredentials } from "../config/googleClient.js";
import gmailAuthModel from "../models/googleAuth.model.js";
import { ObjectId } from "mongodb";
import { Buffer } from "buffer";
import { log } from "console";



/**
 * Step 1: Generate Google OAuth URL for user to authenticate
 */
export function getAuthUrl(req, res) {
    const userId = req.user?.id || 'anonymous';
    // const { userId } = req.query;
    if (!userId) return res.status(400).json({ message: "userId is required" });




    const url = generateAuthUrl(
        userId // pass user id to callback for saving tokens
    );
    console.log("url", url);

    res.json({ url });
}

/**
 * Step 2: Callback from Google after user gives permission
 */
export async function oauthCallback(req, res) {
    const code = req.query.code;
    const userId = req.query.state;
    console.log("Code", code);
    console.log("User ID", userId);

    try {

        const { tokens } = await oauth2Client.getToken(code);
        // console.log("Tokens:", tokens);
        setCredentials(tokens);

        // Get user email from Google
        const oauth2 = google.oauth2({ version: "v2", auth: oauth2Client });
        const userInfo = await oauth2.userinfo.get();
        console.log("User Info:", userInfo.data);
        // Save tokens in DB
        const authData = await gmailAuthModel.findOneAndUpdate(
            { userId },
            {
                userId,
                email: userInfo.data.email,
                accessToken: tokens.access_token,
                refreshToken: tokens.refresh_token,
                scope: tokens.scope,
                tokenType: tokens.token_type,
                expiryDate: tokens.expiry_date,
            },
            { upsert: true, new: true }
        );
        // Redirect to frontend
        res.redirect(`http://localhost:3000/emails`);
    } catch (error) {
        console.error("OAuth Callback Error:", error);
        res.status(500).json({ message: "Authentication failed", error });
    }
}

/**
 * Step 3: Fetch list of emails
 */
export async function listEmails(req, res) {
    const userId = req.user?.id || 'anonymous';
    const { search, from, status, newer_than } = req.query;

    // Build the search query
    let queryParts = [];
    if (search) queryParts.push(search);       // General search term
    if (from) queryParts.push(`from:${from}`); // e.g., from=saarang
    if (status) queryParts.push(`is:${status}`); // e.g., status=unread
    if (newer_than) queryParts.push(`newer_than:${newer_than}`); // e.g., newer_than=7d
    const searchQuery = queryParts.join(' '); // Combine all parts with a space
    try {
        const newUserId = new ObjectId(req.user.id);
        const authData = await gmailAuthModel.findOne({ userId: newUserId });
        if (!authData) return res.status(401).json({ message: "Gmail not connected" });

        // Set credentials from DB
        setCredentials({
            access_token: authData.accessToken,
            refresh_token: authData.refreshToken
        });

        const gmail = google.gmail({ version: "v1", auth: oauth2Client });
        const emailList = [];
        // Get list of messages
        const response = await gmail.users.messages.list({
            userId: "me",
            maxResults: 10, // You can increase or implement pagination
            q: searchQuery,
        });
        const messages = response.data.messages || [];
        // Step 2: Loop over message IDs and fetch details
        for (const msg of messages) {
            const msgDetail = await gmail.users.messages.get({
                userId: "me",
                id: msg.id,
                format: "metadata", // "metadata" is faster than "full"
                metadataHeaders: ["From", "Subject", "Date"],
            });

            const headers = msgDetail.data.payload.headers;

            // Extract useful fields
            const from = headers.find(h => h.name === "From")?.value || "";
            const subject = headers.find(h => h.name === "Subject")?.value || "";
            const date = headers.find(h => h.name === "Date")?.value || "";

            emailList.push({
                id: msg.id,
                threadId: msg.threadId,
                from,
                subject,
                date,
            });
        }
        res.json(emailList);
    } catch (error) {
        console.error("List Emails Error:", error);
        res.status(500).json({ message: "Error fetching emails", error });
    }
}

/**
 * Step 4: Fetch full email content by message ID
 */
export async function getEmailContent(req, res) {
    const { messageId } = req.query;
    const userId = req.user?.id || 'anonymous';
    console.log("userId", userId);
    console.log("messageId", messageId);

    try {
        const authData = await gmailAuthModel.findOne({ userId });
        if (!authData) return res.status(401).json({ message: "Gmail not connected" });

        setCredentials({
            access_token: authData.accessToken,
            refresh_token: authData.refreshToken
        });

        const gmail = google.gmail({ version: "v1", auth: oauth2Client });

        const response = await gmail.users.messages.get({
            userId: "me",
            id: messageId,
            format: "full"
        });
        const jsonMail = formatGmailMessage(response.data);

        // Always include attachment data if attachments exist - avoids separate API calls
        if (Array.isArray(jsonMail.attachments) && jsonMail.attachments.length > 0) {
            // Fetch attachment data in parallel
            const hydrated = await Promise.all(jsonMail.attachments.map(async (att) => {
                try {
                    if (!att.attachmentId) {
                        return { ...att, dataUrl: null };
                    }

                    const attResp = await gmail.users.messages.attachments.get({
                        userId: "me",
                        messageId,
                        id: att.attachmentId
                    });
                    const raw = attResp.data?.data;
                    if (!raw) {
                        return { ...att, dataUrl: null };
                    }
                    // Gmail returns URL-safe base64
                    const b64 = raw.replace(/-/g, '+').replace(/_/g, '/');
                    // Return as data URL for easy inline preview on the client
                    const dataUrl = `data:${att.mimeType || 'application/octet-stream'};base64,${b64}`;
                    return { ...att, dataUrl };
                } catch (e) {
                    console.error('Failed to fetch attachment data', att.filename, e);
                    return { ...att, dataUrl: null };
                }
            }));

            jsonMail.attachments = hydrated;
        }

        res.json(jsonMail);
    } catch (error) {
        console.error("Get Email Content Error:", error);
        res.status(500).json({ message: "Error fetching email content", error });
    }
}

/**
 * Format a Gmail API message response into clean JSON
 * @param {object} message - Gmail API message response (response.data)
 * @returns {object} Formatted email data
 */
export function formatGmailMessage(message) {
    if (!message || !message.payload) {
        return { error: "Invalid message format" };
    }

    const headers = message.payload.headers || [];

    const getHeader = (name) =>
        headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value || "";

    const from = getHeader("From");
    const subject = getHeader("Subject");
    const date = getHeader("Date");

    // Extract sender name + email
    const fromEmail = from.match(/<(.+)>/)?.[1] || from;
    const fromName = from.replace(/<(.+)>/, "").trim();

    // Decode HTML or plain text body
    let body = "";
    function findBody(part) {
        if (!part) return;
        if ((part.mimeType === "text/html" || part.mimeType === "text/plain") && part.body?.data) {
            const data = part.body.data.replace(/-/g, "+").replace(/_/g, "/");
            body = Buffer.from(data, "base64").toString("utf8");
        } else if (part.parts) {
            part.parts.forEach(findBody);
        }
    }
    findBody(message.payload);

    // Extract attachments
    const attachments = [];
    function findAttachments(part) {
        if (part.filename && part.body?.attachmentId) {
            attachments.push({
                filename: part.filename,
                mimeType: part.mimeType,
                attachmentId: part.body.attachmentId,
            });
        }
        if (part.parts) part.parts.forEach(findAttachments);
    }
    findAttachments(message.payload);

    return {
        messageId: message.id,
        fromEmail,
        fromName,
        subject,
        body,
        dateOfMessage: date,
        attachments,
    };
}

/**
 * Download email attachment using Gmail API
 * @route GET /api/google/emails/:messageId/attachments/:filename
 */
export async function downloadGoogleEmailAttachment(req, res) {
    const { messageId, filename } = req.params;
    const userId = req.user?.id || 'anonymous';

    try {
        const authData = await gmailAuthModel.findOne({ userId });
        if (!authData) {
            return res.status(401).json({ message: "Gmail not connected" });
        }

        setCredentials({
            access_token: authData.accessToken,
            refresh_token: authData.refreshToken
        });

        const gmail = google.gmail({ version: "v1", auth: oauth2Client });

        // First, get the message to find the attachment
        const messageResponse = await gmail.users.messages.get({
            userId: "me",
            id: messageId,
            format: "full"
        });

        const message = messageResponse.data;
        if (!message || !message.payload) {
            return res.status(404).json({ message: "Email not found" });
        }

        // Find the attachment by filename
        let attachmentId = null;
        let attachmentMimeType = null;

        function findAttachment(part) {
            if (part.filename && part.body?.attachmentId) {
                // Decode filename to handle URL encoding
                const decodedFilename = decodeURIComponent(filename);
                if (part.filename === filename || part.filename === decodedFilename ||
                    part.filename.includes(decodedFilename) || decodedFilename.includes(part.filename)) {
                    attachmentId = part.body.attachmentId;
                    attachmentMimeType = part.mimeType;
                    return;
                }
            }
            if (part.parts) {
                part.parts.forEach(findAttachment);
            }
        }

        findAttachment(message.payload);

        if (!attachmentId) {
            return res.status(404).json({ message: "Attachment not found" });
        }

        // Download the attachment
        const attachmentResponse = await gmail.users.messages.attachments.get({
            userId: "me",
            messageId: messageId,
            id: attachmentId
        });

        // Decode base64 attachment data
        const attachmentData = attachmentResponse.data.data;
        const data = attachmentData.replace(/-/g, "+").replace(/_/g, "/");
        const buffer = Buffer.from(data, "base64");

        // Set proper headers
        const contentType = attachmentMimeType || 'application/octet-stream';
        const safeFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '_');

        res.setHeader('Content-Type', contentType);
        res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"; filename*=UTF-8''${encodeURIComponent(filename)}`);
        res.setHeader('Content-Length', buffer.length);
        res.setHeader('Cache-Control', 'no-cache');

        // Send the buffer
        res.send(buffer);

        console.log(`Attachment downloaded successfully: ${filename} (${buffer.length} bytes)`);
    } catch (error) {
        console.error('Error downloading Google email attachment:', error);
        res.status(500).json({ message: "Error downloading attachment", error: error.message });
    }
}


