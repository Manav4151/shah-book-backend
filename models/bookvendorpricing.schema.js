import { Schema, model } from "mongoose";

const bookVendorPricingSchema = new Schema({
  agentId: {
    type: Schema.Types.ObjectId,
    ref: "Agent",
    required: true,
  },

  // Book reference
  book: {
    type: Schema.Types.ObjectId,
    ref: "Book",
    required: true,
  },

  // Vendor reference (NEW FIELD)
  vendor: {
    type: Schema.Types.ObjectId,
    ref: "Vendor",
    required: true,
  },

  // Vendor-specific stock
  stock: {
    type: Number,
    default: 0,
    required: true,
  },

  // Pricing values
  currency: {
    type: String,
    required: true,
  },

  rate: {
    type: Number,
    required: true,
  },

  discount: {
    type: Number,
    default: 0,
  },

  binding_type: {
    type: String,
    default: null,
  },

  last_updated: {
    type: Date,
    default: Date.now,
  },
}, { timestamps: true });


// ⭐ VERY IMPORTANT:
// Prevent same vendor giving duplicate pricing for the same book
bookVendorPricingSchema.index(
  { agentId: 1, book: 1, vendor: 1 },
  { unique: true }
);

// Add basic index for filtering by agent
bookVendorPricingSchema.index({ agentId: 1 });

export const BookVendorPricing = model("BookVendorPricing", bookVendorPricingSchema);
export default BookVendorPricing;
