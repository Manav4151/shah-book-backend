import { Schema, model } from "mongoose";

/**
 * This schema stores Gmail OAuth tokens for each user.
 * One record per user.
 */
const GmailAuthSchema = new Schema({
    agentId: {
        type: Schema.Types.ObjectId,
        ref: "Agent",
        required: true,
    },
    email: {
        type: String, // Gmail account that was authenticated
        required: true
    },
    accessToken: {
        type: String,
        required: true
    },
    refreshToken: {
        type: String,
        required: true
    },
    scope: String,
    tokenType: String,
    expiryDate: Number,
}, { timestamps: true });
GmailAuthSchema.index({ agentId: 1 }, { unique: true });
export default model("GmailAuth", GmailAuthSchema);
