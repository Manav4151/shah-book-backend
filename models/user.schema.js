import mongoose from "mongoose";

const UserSchema = new mongoose.Schema(
  {
    name: String,
    email: String,
    emailVerified: Boolean,
    role: String,
    agentId : String,
  },
  { timestamps: true, collection: "user" }
);

export const User = mongoose.model("User", UserSchema);
