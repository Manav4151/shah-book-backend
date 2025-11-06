import mongoose from 'mongoose';

const addressSchema = new mongoose.Schema({
    street: String,
    city: String,
    state: String,
    zipCode: String
}, { _id: false });

const companyProfileSchema = new mongoose.Schema({
    profileName: { // e.g., "Main Book Company", "Vardhman Decoration"
        type: String,
        required: true,
        unique: true
    },
    companyName: {
        type: String,
        required: true
    },
    address: addressSchema,
    phone: String,
    email: String,
    logoUrl: String // Optional: URL to a logo image
}, { timestamps: true });

const CompanyProfile = mongoose.model('CompanyProfile', companyProfileSchema);
export default CompanyProfile;