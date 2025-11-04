import mongoose from "mongoose";

const emailAddressSchema = new mongoose.Schema({
  name: { type: String, default: "" },
  email: { type: String, default: "" }
});

const emailMetadataSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

    // Gmail identifiers
    messageId: { type: String, required: true, unique: true },
    threadId: { type: String, required: true },
    historyId: { type: String },

    // Participants
    from: emailAddressSchema,
    to: [emailAddressSchema],
    cc: [emailAddressSchema],

    // Content summary
    subject: { type: String, default: "(No Subject)" },
    snippet: { type: String, default: "" },
    date: { type: Date },

    // Gmail label info
    labelIds: [String],

    // Business linkage
    quotationId: { type: mongoose.Schema.Types.ObjectId, ref: "Quotation", default: null },
    status: {
      type: String,
      enum: ["pending", "linked", "approved", "archived"],
      default: "pending"
    },

    // Sync tracking
    syncedAt: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

emailMetadataSchema.index({ messageId: 1, userId: 1 }, { unique: true });
emailMetadataSchema.index({ quotationId: 1 });
emailMetadataSchema.index({ status: 1 });
emailMetadataSchema.index({ date: -1 });

export default mongoose.model("EmailMetadata", emailMetadataSchema);
