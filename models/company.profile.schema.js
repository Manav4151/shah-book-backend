import mongoose from 'mongoose';

const addressSchema = new mongoose.Schema({
    street: String,
    city: String,
    state: String,
    zipCode: String
}, { _id: false });

const companyProfileSchema = new mongoose.Schema({
        agentId: { type: mongoose.Schema.Types.ObjectId, ref: "Agent", required: true },
    profileName: { // e.g., "Main Book Company", "Vardhman Decoration"
        type: String,
        required: true,
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
companyProfileSchema.index({ agentId: 1 , profileName: 1 }, { unique: true });
const CompanyProfile = mongoose.model('CompanyProfile', companyProfileSchema);
export default CompanyProfile;