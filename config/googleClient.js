import { google } from "googleapis";

// Initialize OAuth2 Client with credentials from .env
export const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
);
export const generateAuthUrl = (userId) => {
    return oauth2Client.generateAuthUrl({
        // access_type: "offline",
        scope: ["https://www.googleapis.com/auth/gmail.readonly", "https://www.googleapis.com/auth/userinfo.email",
            "https://www.googleapis.com/auth/userinfo.profile",],
        // prompt: "consent",
        state: userId
    });
};

export const getToken = async (code) => {
    const { tokens } = await oauth2Client.getToken(code);
    return tokens;
};

export const setCredentials = (tokens) => {
    oauth2Client.setCredentials(tokens);
};

