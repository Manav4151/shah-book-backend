import { Router } from "express";
const router = Router();
import { getAuthUrl, oauthCallback, listEmails, getEmailContent } from "../controllers/google.controller.js";
import { authenticate } from "../middleware/auth.middleware.js";

// Apply authentication middleware to all template routes
// router.use(authenticate);
// Redirect user to Google OAuth
router.get("/auth-url", getAuthUrl);

// Callback from Google
router.get("/oauth2callback", oauthCallback);

// Get list of user's emails
router.get("/emails", listEmails);

// Get specific email content
router.get("/email", getEmailContent);

export default router;
