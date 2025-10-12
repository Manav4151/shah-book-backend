import { Schema, model } from 'mongoose';

const publisherSchema = new Schema(
    {
        name: {
            type: String,
            required: [true, 'Publisher name is required'],
            trim: true,
            unique: true,
            index: true,
        },
        phone: { type: String, unique: true, trim: true },
        email: {
            type: String,
            trim: true,
            lowercase: true,
            match: [/.+\@.+\..+/, 'Please fill a valid email address'],
        },

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
        contactPerson: { type: String, trim: true },
        contactPersonEmail: {
            type: String, unique: true, trim: true, lowercase: true,
            match: [/.+\@.+\..+/, 'Please fill a valid email address'],
        },
        contactPersonPhone: { type: String, unique: true, trim: true },
    },
    {
        timestamps: true, // Automatically adds createdAt and updatedAt fields
    }
);

// Index for efficient searching by name
publisherSchema.index({ name: 'text' });

const Publisher = model('Publisher', publisherSchema);

export default Publisher;