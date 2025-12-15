import { Schema, model } from 'mongoose';
import Agent from './agent.schema.js';

const quotationItemSchema = new Schema({
    book: { type: Schema.Types.ObjectId, ref: 'Book', required: true },
    quantity: { type: Number, required: true, min: 1, default: 1 },
    unitPrice: { type: Number, required: true },
    discount: { type: Number, default: 0 },
    totalPrice: { type: Number, required: true },
});

const emailInfoSchema = new Schema({
    messageId: { type: String },
    sender: { type: String },
    subject: { type: String },
    receivedAt: { type: Date },
    snippet: { type: String },
}, { _id: false });

const quotationSchema = new Schema(
    {
        agentId: { type: Schema.Types.ObjectId, ref: "Agent", required: true },
        quotationId: { type: String, unique: true },
        customer: { type: Schema.Types.ObjectId, ref: 'Customer' },
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
        emailInfo: emailInfoSchema,
    },
    { timestamps: true }
);


// 🔥 Auto-generate Quotation ID with Agent Code
quotationSchema.pre('validate', async function (next) {
    if (!this.isNew || this.quotationId) return next();

    const year = new Date().getFullYear();

    // Fetch agent code
    const agent = await Agent.findById(this.agentId).lean();
    if (!agent || !agent.agentCode) {
        return next(new Error("Agent Code not found for quotation ID generation"));
    }

    const prefix = `QT-${agent.agentCode}-${year}`;

    // Find last quotation for this agent + year
    const lastQuotation = await this.constructor
        .findOne({ quotationId: { $regex: `^${prefix}-` } })
        .sort({ createdAt: -1 })
        .lean();

    let nextNumber = 1;
    if (lastQuotation?.quotationId) {
        const parts = lastQuotation.quotationId.split('-');
        nextNumber = parseInt(parts[3]) + 1; // last numeric part
    }

    const formattedNum = String(nextNumber).padStart(3, '0');
    this.quotationId = `${prefix}-${formattedNum}`;

    next();
});


quotationSchema.index({ agentId: 1 });

const Quotation = model('Quotation', quotationSchema);
export default Quotation;
