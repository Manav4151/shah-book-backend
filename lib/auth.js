
// import dotenv from "dotenv";
// dotenv.config();
// import { betterAuth } from "better-auth";
// import { MongoClient } from "mongodb";
// import { mongodbAdapter } from "better-auth/adapters/mongodb";
// import { admin, openAPI } from "better-auth/plugins"; // Import the admin plugin
// import { Resend } from "resend";
// import { logger } from "./logger.js";


// // --- END: DEBUG LOG ---
// const mongoUrl = process.env.MONGODB_URL || "mongodb://127.0.0.1:27017";
// const dbName = process.env.MONGODB_NAME || "demo";
// const client = new MongoClient(mongoUrl);
// const db = client.db(dbName);
// // const resend = new Resend(process.env.RESEND_API_KEY);
// // --- START: DEBUG LOG ---
// try {
//   console.log("Initializing better-auth with baseURL:", process.env.BETTER_AUTH_URL || "http://localhost:8000");
//   console.log("MongoDB URL:", mongoUrl);
//   console.log("Database name:", dbName);
// } catch (error) {
//   console.error("Error initializing auth configuration:", error);
// }

// // --- END: DEBUG LOG ---
// export const auth = betterAuth({
//   baseURL: process.env.BETTER_AUTH_URL || "http://localhost:5050",
//   trustedOrigins: [
//     "https://postedit.revanai.in",
//     "http://localhost:3000",
//     "http://192.168.1.50:3000",
//     "http://localhost:3001",
//     "http://127.0.0.1:3000",
//     "http://127.0.0.1:3001",
//     "http://localhost:5050"
//   ],
//   advanced: {
//     allowNonBrowserRequests: true
//   },
//   database: mongodbAdapter(db),

//   // 🔥 THIS PART IS MISSING IN YOUR CODE
//   adminPanel: {
//     enabled: true,
//     basePath: "/admin", // panel will be served at /api/auth/admin
//     secure: false // allow in local/dev without HTTPS
//   },

//   // Add user roles to user profile. Default all users to USER.
//   user: {
//     additionalFields: {
//       role: {
//         type: "string",
//         required: false,
//         defaultValue: "SALES_EXECUTIVE",
//         enum: ["SALES_EXECUTIVE", "ADMIN", "INVENTORY_MANAGER"],
//       },

//     },
//   },

//   plugins: [
//     openAPI(),
//     admin({
//       // Ensure users with role "ADMIN" (uppercase) are treated as admins
//       adminRoles: ["ADMIN"],
//     }),
//   ],

//   emailAndPassword: {
//     enabled: true,
//     sendResetPassword: async ({ user, token, url }) => {
//       logger.info("Password reset email functionality is configured.");
//     },
//   },


// });


// // --- START: DEBUG LOG ---
// console.log("DEBUG: better-auth object configured.");
// // --- END: DEBUG LOG ---


import dotenv from "dotenv";
dotenv.config();
import { betterAuth } from "better-auth";
import { MongoClient } from "mongodb";
import { mongodbAdapter } from "better-auth/adapters/mongodb";
import { admin, openAPI } from "better-auth/plugins";
import { logger } from "./logger.js";

const mongoUrl = process.env.MONGODB_URL || "mongodb://127.0.0.1:27017";
const dbName = process.env.MONGODB_NAME || "demo";
const client = new MongoClient(mongoUrl);
const db = client.db(dbName);

// Define your roles as a constant to avoid typos elsewhere in your app
export const ROLES = {
  ADMIN: "admin",
  INVENTORY_MANAGER: "inventory_manager",
  SALES_EXECUTIVE: "sales_executive",
};

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL || "http://localhost:5050",
  trustedOrigins: [
    "https://postedit.revanai.in",
    "http://localhost:3000",
    "http://192.168.1.50:3000", // Fixed typo (was hhttp)
    "http://localhost:3001",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:3001",
    "http://localhost:5050"
  ],
  advanced: {
    allowNonBrowserRequests: true
  },
  database: mongodbAdapter(db),

  // 1. Define the Role field here
  user: {
    additionalFields: {
      // role: {
      //   type: "string",
      //   required: false,
      //   defaultValue: ROLES.SALES_EXECUTIVE, // Default for new signups
      //   input: false, // PREVENT users from sending their own role during signup API calls
      // },
    },
  },

  plugins: [
    openAPI(),
    // 2. Configure Admin Plugin
    admin({
      defaultRole: ROLES.SALES_EXECUTIVE, // internal default
      adminRoles: [ROLES.ADMIN], // Only "ADMIN" can access better-auth admin routes
      impersonationSessionDuration: 60 * 60, // 1 hour
    }),
  ],

  emailAndPassword: {
    enabled: true,
    sendResetPassword: async ({ user, token, url }) => {
      logger.info(`Reset password url for ${user.email}: ${url}`);
    },
  },
});