import { google } from "googleapis";
import EmailMetadata from "../models/email.schema.js";
import gmailAuthModel from "../models/googleAuth.model.js";
import { oauth2Client, setCredentials } from "../config/googleClient.js";


// ===== Utility Helpers =====
const getHeaderValue = (headers, name) => {
  const header = headers.find(h => h.name.toLowerCase() === name.toLowerCase());
  return header ? header.value : "";
};

const parseEmailAddress = (addressStr) => {
  if (!addressStr) return { name: "", email: "" };
  const match = addressStr.match(/(.*)<(.*)>/);
  return match
    ? { name: match[1].trim(), email: match[2].trim() }
    : { name: "", email: addressStr.trim() };
};

// ==============================
// 📬 SYNC EMAILS (CRON or Manual Refresh)
// ==============================
export const syncEmails = async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ error: "Missing userId" });

 

    const user = await gmailAuthModel.findOne({ userId });
    if (!user) return res.status(404).json({ error: "User not found" });
    
    
    
    setCredentials({
                access_token: user.accessToken,
                refresh_token: user.refreshToken
            })

    const gmail = google.gmail({ version: "v1", auth: oauth2Client });

    const listResponse = await gmail.users.messages.list({
      userId: "me",
      labelIds: ["INBOX"],
      maxResults: 30
    });

    const messages = listResponse.data.messages || [];
    if (messages.length === 0)
      return res.json({ message: "No emails found in inbox." });

    const emailMetadataList = [];

    for (const msg of messages) {
      try {
        const fullMessage = await gmail.users.messages.get({
          userId: "me",
          id: msg.id,
          format: "metadata",
          metadataHeaders: ["From", "To", "Cc", "Subject", "Date"]
        });

        const headers = fullMessage.data.payload?.headers || [];
        const fromValue = getHeaderValue(headers, "From");
        const toValue = getHeaderValue(headers, "To");
        const ccValue = getHeaderValue(headers, "Cc");
        const subjectValue = getHeaderValue(headers, "Subject");
        const dateValue = getHeaderValue(headers, "Date");

        const emailData = {
          userId: user._id,
          messageId: msg.id,
          threadId: fullMessage.data.threadId,
          historyId: fullMessage.data.historyId || "",
          from: parseEmailAddress(fromValue),
          to: toValue
            ? toValue.split(",").map(t => parseEmailAddress(t.trim()))
            : [],
          cc: ccValue
            ? ccValue.split(",").map(c => parseEmailAddress(c.trim()))
            : [],
          subject: subjectValue || "(No Subject)",
          date: dateValue ? new Date(dateValue) : null,
          snippet: fullMessage.data.snippet || "",
          labelIds: fullMessage.data.labelIds || [],
          syncedAt: new Date()
        };

        const updated = await EmailMetadata.findOneAndUpdate(
          { messageId: msg.id, userId: user._id },
          { $set: emailData },
          { upsert: true, new: true }
        );
        
        emailMetadataList.push(updated);
      } catch (err) {
        console.error("Email sync error for message:", msg.id, err.message);
      }
    }

    res.json({
      message: `✅ Synced ${emailMetadataList.length} emails successfully.`,
      count: emailMetadataList.length
    });
  } catch (error) {
    console.error("syncEmails error:", error);
    res.status(500).json({ error: "Failed to sync emails", details: error.message });
  }
};

// ==============================
// 📄 FETCH EMAIL LIST (from DB)
// ==============================
export const getEmailList = async (req, res) => {
  try {
    const { userId, status, from, to, quotationId } = req.query;
    const filter = { userId };

    if (status) filter.status = status;
    if (quotationId) filter.quotationId = quotationId;
    if (from) filter["from.email"] = { $regex: from, $options: "i" };
    if (to) filter["to.email"] = { $regex: to, $options: "i" };

    const emails = await EmailMetadata.find(filter)
      .sort({ date: -1 })
      .limit(50)
      .lean();

    res.json({ count: emails.length, data: emails });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch email list", details: error.message });
  }
};

// ==============================
// 📧 FETCH EMAIL DETAIL (from Gmail directly)
// ==============================
export const getEmailDetail = async (req, res) => {
  try {
    const { userId, messageId } = req.query;
    if (!userId || !messageId)
      return res.status(400).json({ error: "Missing userId or messageId" });

    const user = await gmailAuthModel.findOne({ userId });
    if (!user) return res.status(404).json({ error: "User not found" });

    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );

    oauth2Client.setCredentials({
      access_token: user.gmailAccessToken,
      refresh_token: user.gmailRefreshToken
    });

    const gmail = google.gmail({ version: "v1", auth: oauth2Client });

    const response = await gmail.users.messages.get({
      userId: "me",
      id: messageId,
      format: "full"
    });

    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch email detail", details: error.message });
  }
};
