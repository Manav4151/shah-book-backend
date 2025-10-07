import { Schema, model } from 'mongoose';

const quotationItemSchema = new Schema({
    book: { type: Schema.Types.ObjectId, ref: 'Book', required: true },
    quantity: { type: Number, required: true, min: 1, default: 1 },
    unitPrice: { type: Number, required: true },
    discount: { type: Number, default: 0 }, // Discount percentage
    totalPrice: { type: Number, required: true },
});

const quotationSchema = new Schema(
    {
        quotationId: { type: String, required: true, unique: true }, // e.g., Q-2024-001
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
    },
    { timestamps: true }
);

// Auto-incrementing quotationId (optional, but good practice)
quotationSchema.pre('save', async function (next) {
    if (this.isNew) {
        const lastQuotation = await this.constructor.findOne({}, {}, { sort: { 'createdAt': -1 } });
        let newId = 'Q-2024-001';
        if (lastQuotation && lastQuotation.quotationId) {
            const lastId = parseInt(lastQuotation.quotationId.split('-')[2]);
            newId = `Q-2024-${String(lastId + 1).padStart(3, '0')}`;
        }
        this.quotationId = newId;
    }
    next();
});

const Quotation = model('Quotation', quotationSchema);
export default Quotation;