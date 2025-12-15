// import mongoose from "mongoose";

// const bookPricingSchema = new mongoose.Schema({
//   book_id: { type: mongoose.Schema.Types.ObjectId, ref: "Book", required: true },
//   currency: { type: String, required: true },
//   rate: { type: Number, required: true },
//   discount: { type: Number, default: 0 },
//   source: String,
//   last_updated: { type: Date, default: Date.now }
// }, { timestamps: true });

// module.exports = mongoose.model("BookPricing", bookPricingSchema);
import { Schema, model } from 'mongoose';

const bookPricingSchema = new Schema({
  agentId: { type: Schema.Types.ObjectId, ref: "Agent", required: true },
  book: {
    type: Schema.Types.ObjectId,
    ref: "Book",
    required: true
  },
  stock: { type: Number, default: 0, required: true },
  currency: { type: String, required: true },
  rate: { type: Number, required: true },
  discount: { type: Number, default: 0 },
  binding_type: { type: String, default: null },
  source: String,
  last_updated: { type: Date, default: Date.now }
}, { timestamps: true });

bookPricingSchema.index({ agentId: 1 });
const BookPricing = model("BookPricing", bookPricingSchema);
export default BookPricing;