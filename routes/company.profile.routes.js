import express from 'express';
import { createCompanyProfile, getAllCompanyProfiles } from '../controllers/company.profile.controller.js';
import { auth } from '../lib/auth.js';
import { authenticate } from '../middleware/auth.middleware.js';
 // Adjust path

const router = express.Router();
router.use(authenticate);
// @route   POST /api/company-profiles
// @desc    Create a new profile
router.post('/', createCompanyProfile);

// @route   GET /api/company-profiles
// @desc    Get all profiles for dropdowns
router.get('/', getAllCompanyProfiles);

export default router;