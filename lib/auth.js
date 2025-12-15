import dotenv from "dotenv";
dotenv.config();
import { betterAuth } from "better-auth";
import { MongoClient } from "mongodb";
import { mongodbAdapter } from "better-auth/adapters/mongodb";
import { logger } from "./logger.js";

const mongoUrl = process.env.MONGODB_URL || "mongodb://127.0.0.1:27017";
const dbName = process.env.MONGODB_NAME || "demo";
const client = new MongoClient(mongoUrl);
const db = client.db(dbName);

export const ROLES = {
  SYSTEM_ADMIN: "system_admin",
  AGENT_ADMIN: "agent_admin",
  INVENTORY_MANAGER: "inventory_manager",
  SALES_EXECUTIVE: "sales_executive",
  USER: "user",
};

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL || "http://localhost:5050",
  trustedOrigins: [
    "https://postedit.revanai.in",
    "http://localhost:3000",
    "http://192.168.1.50:3000",
    "http://localhost:3001",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:3001",
    "http://localhost:5050",
  ],

  advanced: {
    allowNonBrowserRequests: true,
  },

  database: mongodbAdapter(db),

  // 🔹 Add multi-tenant user fields
  user: {
    additionalFields: {
      role: {
        type: "string",
        required: true,
        defaultValue: ROLES.USER,
        input: false, // Prevent users from selecting role during signup
      },
      agentId: {
        type: "string",
        required: false, // System admin users have no agentId
        input: false, // Users cannot modify
      },
    },
  },

  emailAndPassword: {
    enabled: true,
    sendResetPassword: async ({ user, token, url }) => {
      logger.info(`Reset password url for ${user.email}: ${url}`);
    },
  },
});
