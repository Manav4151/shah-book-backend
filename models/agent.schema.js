import mongoose from "mongoose";

const agentSchema = new mongoose.Schema(
  {
    agentCode: {
      type: String,
      unique: true,
      sparse: true, // allows existing agents without a code
      trim: true,
      uppercase: true,
    },

    name: { type: String, required: true, unique: true },
    description: { type: String },

    logo: { type: String },
    adminIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    userIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],

    status: {
      type: String,
      enum: ["active", "inactive", "suspended"],
      default: "active",
    },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);


// 🔥 Auto-generate unique AG### code if not provided
agentSchema.pre("validate", async function (next) {
  if (!this.isNew || this.agentCode) return next();

  const prefix = "AG";

  // Get the highest existing code
  const lastAgent = await this.constructor
    .findOne({ agentCode: { $regex: `^${prefix}\\d+$` } })
    .sort({ createdAt: -1 })
    .lean();

  let nextNumber = 1;
  if (lastAgent?.agentCode) {
    nextNumber = parseInt(lastAgent.agentCode.replace(prefix, "")) + 1;
  }

  this.agentCode = `${prefix}${String(nextNumber).padStart(3, "0")}`;

  next();
});


export const Agent = mongoose.model("Agent", agentSchema);
export default Agent;
