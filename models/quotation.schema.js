import { Schema, model } from 'mongoose';

const quotationItemSchema = new Schema({
    book: { type: Schema.Types.ObjectId, ref: 'Book', required: true },
    quantity: { type: Number, required: true, min: 1, default: 1 },
    unitPrice: { type: Number, required: true },
    discount: { type: Number, default: 0 }, // Discount percentage
    totalPrice: { type: Number, required: true },
});
// 📨 Embedded Email Info Schema
const emailInfoSchema = new Schema({
    messageId: { type: String, required: true }, // Gmail message ID
    sender: { type: String, required: true },    // e.g., user@gmail.com
    subject: { type: String, required: true },   // Email subject
    receivedAt: { type: Date, required: true },  // When email received
    snippet: { type: String },                   // Optional short preview
}, { _id: false });

// 📦 Quotation Schema
const quotationSchema = new Schema(
    {
        quotationId: { type: String, unique: true }, // e.g., Q-2024-001
        customer: { type: Schema.Types.ObjectId, ref: 'Customer', required: true },
        items: [quotationItemSchema],
        subTotal: { type: Number, required: true },
        totalDiscount: { type: Number, default: 0 },
        grandTotal: { type: Number, required: true },
        status: {
            type: String,
            enum: ['Draft', 'Sent', 'Accepted', 'Rejected'],
            default: 'Draft',
        },
        validUntil: { type: Date },
        // 📨 Add Email Metadata here
        emailInfo: { type: emailInfoSchema, required: false },
    },
    { timestamps: true }
);

// Auto-incrementing quotationId (optional, but good practice)
// ✅ Auto-generate quotationId: QT-YYYY-XXXX
quotationSchema.pre('validate', async function (next) {
    if (this.isNew && !this.quotationId) {
        const now = new Date();
        const year = now.getFullYear();

        // Find last quotation in the same year
        const prefix = `QT-${year}`;
        const lastQuotation = await this.constructor
            .findOne({ quotationId: { $regex: `^${prefix}-` } })
            .sort({ createdAt: -1 })
            .lean();

        let nextNumber = 1;
        if (lastQuotation && lastQuotation.quotationId) {
            const lastNumber = parseInt(lastQuotation.quotationId.split('-')[2]);
            nextNumber = lastNumber + 1;
        }

        const formattedNumber = String(nextNumber).padStart(3, '0');
        this.quotationId = `${prefix}-${formattedNumber}`;
    }
    next();
});


const Quotation = model('Quotation', quotationSchema);
export default Quotation;