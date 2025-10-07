import { Schema, model } from 'mongoose';

const customerSchema = new Schema(
    {
        customerName: { type: String, required: true, trim: true },
        contactPerson: { type: String, trim: true },
        email: { type: String, required: true, unique: true, trim: true },
        phone: { type: String, trim: true },
        address: {
            street: String,
            city: String,
            state: String,
            zipCode: String,
            country: String,
        },
    },
    { timestamps: true }
);

const Customer = model('Customer', customerSchema , );
export default Customer;