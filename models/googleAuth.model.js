import { Schema, model } from "mongoose";

/**
 * This schema stores Gmail OAuth tokens for each user.
 * One record per user.
 */
const GmailAuthSchema = new Schema({
    userId: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true,
        unique: true
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

export default model("GmailAuth", GmailAuthSchema);
