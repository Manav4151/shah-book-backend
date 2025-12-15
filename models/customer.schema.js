import { Schema, model } from 'mongoose';

const customerSchema = new Schema(
    {
        agentId: { type: Schema.Types.ObjectId, ref: "Agent", required: true },
        name: { type: String, required: true, trim: true },
        phone: { type: String, required: true,  trim: true },
        contactPerson: { type: String, trim: true },
        contactPersonEmail: { type: String, trim: true , lowercase: true,
                match: [/.+\@.+\..+/, 'Please fill a valid email address'],},
        contactPersonPhone: { type: String,trim: true },
        email: { type: String, required: true, trim: true, lowercase: true,
                match: [/.+\@.+\..+/, 'Please fill a valid email address'], },
        discount: { type: Number, default: 0 },
        address: {
            street: {
                type: String,
                trim: true,
            },
            city: {
                type: String,
                trim: true,
            },
            state: {
                type: String,
                trim: true,
            },
            zipCode: {
                type: String,
                trim: true,
            },
            country: {
                type: String,
                trim: true,
            },
        },
    },
    { timestamps: true }
);

customerSchema.index({ agentId: 1, email: 1 }, { unique: true });
const Customer = model('Customer', customerSchema,);
export default Customer;