import CompanyProfile from "../models/company.profile.schema.js";


/**
 * @desc    Create a new company profile
 * @route   POST /api/company-profiles
 */
export const createCompanyProfile = async (req, res) => {
    try {
        // Get all data from the request body
        const { 
            profileName, 
            companyName, 
            address, 
            phone, 
            email, 
            logoUrl 
        } = req.body;

        // Basic validation
        if (!profileName || !companyName) {
            return res.status(400).json({ 
                success: false, 
                message: 'Profile Name and Company Name are required.' 
            });
        }

        // Check if a profile with this name already exists
        const existingProfile = await CompanyProfile.findOne({ profileName });
        if (existingProfile) {
            return res.status(409).json({ 
                success: false, 
                message: 'A profile with this name already exists.' 
            });
        }

        const newProfile = new CompanyProfile({
            profileName,
            companyName,
            address,
            phone,
            email,
            logoUrl
        });

        const savedProfile = await newProfile.save();

        res.status(201).json({ 
            success: true, 
            message: 'Company profile created successfully.', 
            data: savedProfile 
        });

    } catch (error) {
        logger.error('Error creating company profile:', error); // Assuming you have a logger
        res.status(500).json({ success: false, message: 'Server error.' });
    }
};

/**
 * @desc    Get all company profiles (for dropdown lists)
 * @route   GET /api/company-profiles
 */
export const getAllCompanyProfiles = async (req, res) => {
    try {
        // We only select the 'id' and 'profileName'
        // This is efficient and all the frontend needs for a dropdown.
        const profiles = await CompanyProfile.find().select('_id profileName companyName');

        res.status(200).json({
            success: true,
            data: profiles
        });

    } catch (error) {
        logger.error('Error fetching company profiles:', error);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
};