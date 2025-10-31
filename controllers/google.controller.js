import { google } from "googleapis";
import { oauth2Client, generateAuthUrl, getToken, setCredentials } from "../config/googleClient.js";
import gmailAuthModel from "../models/googleAuth.model.js";


/**
 * Step 1: Generate Google OAuth URL for user to authenticate
 */
export function getAuthUrl(req, res) {
    const { userId } = req.query;

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
        console.log("Tokens:", tokens);
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
                refreshToken: "IF YOU WANT TO AVOID EXPIRY, USE THIS REFRESH TOKEN",
                scope: tokens.scope,
                tokenType: tokens.token_type,
                expiryDate: tokens.expiry_date,
            },
            { upsert: true, new: true }
        );

        res.send(`<h2>Gmail Connected Successfully!</h2><p>You can close this window.</p>`);
    } catch (error) {
        console.error("OAuth Callback Error:", error);
        res.status(500).json({ message: "Authentication failed", error });
    }
}

/**
 * Step 3: Fetch list of emails
 */
export async function listEmails(req, res) {
    const { userId } = req.query;

    try {
        const authData = await gmailAuthModel.findOne({ userId });
        if (!authData) return res.status(401).json({ message: "Gmail not connected" });

        // Set credentials from DB
        setCredentials({
            access_token: authData.accessToken,
            // refresh_token: authData.refreshToken
        });

        const gmail = google.gmail({ version: "v1", auth: oauth2Client });
        const emailList = [];
        // Get list of messages
        const response = await gmail.users.messages.list({
            userId: "me",
            maxResults: 10 // You can increase or implement pagination
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
    const { userId, messageId } = req.query;
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
        console.log("email in json", jsonMail);

        console.log("jsonMail", jsonMail);
        res.json(response.data);
    } catch (error) {
        console.error("Get Email Content Error:", error);
        res.status(500).json({ message: "Error fetching email content", error });
    }
}

import { Buffer } from "buffer";

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

/* 
https://accounts.google.com/o/oauth2/v2/auth?access_type=offline&scope=https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fgmail.readonly&response_type=code&client_id=1044696955589-gu8m541rt59honip64c5dei2ntnmqmct.apps.googleusercontent.com&redirect_uri=http%3A%2F%2Flocalhost%3A5050%2Fapi%2Fgoogle%2Foauth2callback
*/