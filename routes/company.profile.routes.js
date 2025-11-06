import express from 'express';
import { createCompanyProfile, getAllCompanyProfiles } from '../controllers/company.profile.controller.js';
 // Adjust path

const router = express.Router();

// @route   POST /api/company-profiles
// @desc    Create a new profile
router.post('/', createCompanyProfile);

// @route   GET /api/company-profiles
// @desc    Get all profiles for dropdowns
router.get('/', getAllCompanyProfiles);

export default router;