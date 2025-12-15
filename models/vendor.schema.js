import { Schema, model } from "mongoose";

const vendorSchema = new Schema({
  agentId: {
    type: Schema.Types.ObjectId,
    ref: "Agent",
    required: true,
  },

  // Vendor business name
  name: {
    type: String,
    required: true,
    trim: true,
  },

  // Optional business details
  contactPerson: {
    type: String,
    trim: true,
  },

  email: {
    type: String,
    trim: true,
    lowercase: true,
  },

  phone: {
    type: String,
    trim: true,
  },

  // Full address structure
  address: {
    street: String,
    city: String,
    state: String,
    country: String,
    pincode: String,
  },

  gstNumber: {
    type: String,
    trim: true,
  },

  website: {
    type: String,
    trim: true,
  },

  notes: {
    type: String,
  }

}, { timestamps: true });

// Vendor Unique for each Agent
vendorSchema.index({ agentId: 1, name: 1 }, { unique: true });

export const Vendor = model("Vendor", vendorSchema);
export default Vendor;
