import { Schema, model } from 'mongoose';

const customerSchema = new Schema(
    {
        name: { type: String, required: true, trim: true },
        phone: { type: String, required: true, unique: true, trim: true },
        contactPerson: { type: String, trim: true },
        contactPersonEmail: { type: String, unique: true,trim: true , lowercase: true,
                match: [/.+\@.+\..+/, 'Please fill a valid email address'],},
        contactPersonPhone: { type: String, unique: true,trim: true },
        email: { type: String, required: true, unique: true, trim: true, lowercase: true,
                match: [/.+\@.+\..+/, 'Please fill a valid email address'], },
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

const Customer = model('Customer', customerSchema,);
export default Customer;