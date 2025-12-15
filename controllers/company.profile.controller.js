import { logger } from "../lib/logger.js";
import CompanyProfile from "../models/company.profile.schema.js";


/**
 * @desc    Create a new company profile
 * @route   POST /api/company-profiles
 */
export const createCompanyProfile = async (req, res) => {
    try {
        const { profileName, companyName, address, phone, email, logoUrl } = req.body;
        const agentId = req.user?.agentId; // Extract agent from logged-in user

        if (!agentId) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized: Agent ID missing"
            });
        }

        // Basic Validation
        if (!profileName || !companyName) {
            return res.status(400).json({
                success: false,
                message: "Profile Name and Company Name are required."
            });
        }

        // Duplicate check under same agent only
        const existingProfile = await CompanyProfile.findOne({
            profileName: profileName.trim(),
            agentId
        });

        if (existingProfile) {
            return res.status(409).json({
                success: false,
                message: "A profile with this name already exists for your account."
            });
        }

        const newProfile = new CompanyProfile({
            agentId,
            profileName: profileName.trim(),
            companyName,
            address,
            phone,
            email,
            logoUrl
        });

        const savedProfile = await newProfile.save();

        return res.status(201).json({
            success: true,
            message: "Company Profile created successfully",
            data: savedProfile
        });

    } catch (error) {
        logger.error("Error creating company profile:", error);
        return res.status(500).json({
            success: false,
            message: "Server error while creating company profile."
        });
    }
};


/**
 * @desc    Get all company profiles (for dropdown lists)
 * @route   GET /api/company-profiles
 */
export const getAllCompanyProfiles = async (req, res) => {
    try {
        const agentId = req.user?.agentId;

        if (!agentId) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized: Agent ID missing"
            });
        }

        const profiles = await CompanyProfile.find({ agentId })
            .select("_id profileName companyName")
            .sort({ createdAt: -1 }); // Optional: latest first

        res.status(200).json({
            success: true,
            data: profiles
        });

    } catch (error) {
        logger.error("Error fetching company profiles:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};
