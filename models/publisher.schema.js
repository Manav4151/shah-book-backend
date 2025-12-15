import { Schema, model } from "mongoose";

const publisherSchema = new Schema(
  {
    agentId: {
      type: Schema.Types.ObjectId,
      ref: "Agent",
      required: true,
    },

    name: {
      type: String,
      required: [true, "Publisher name is required"],
      trim: true,
    },

    phone: { type: String, trim: true },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      match: [/.+@.+\..+/, "Please enter a valid email"],
    },

    address: {
      street: { type: String, trim: true },
      city: { type: String, trim: true },
      state: { type: String, trim: true },
      zipCode: { type: String, trim: true },
      country: { type: String, trim: true },
    },

    contactPerson: { type: String, trim: true },
    contactPersonEmail: {
      type: String,
      trim: true,
      lowercase: true,
      sparse: true,
      match: [/.+@.+\..+/, "Please enter a valid email"],
    },
    contactPersonPhone: { type: String, trim: true, sparse: true },
  },
  {
    timestamps: true,
  }
);

// 📍 Tenant-based uniqueness
publisherSchema.index(
  { agentId: 1, name: 1 },
  { unique: true }
);

// Optional performance indexes
publisherSchema.index({ agentId: 1 });

const Publisher = model('Publisher', publisherSchema);

export default Publisher;
