// import dotenv from "dotenv";
// dotenv.config();
// import { betterAuth } from "better-auth";
// import { MongoClient } from "mongodb";
// import { mongodbAdapter } from "better-auth/adapters/mongodb";
// import { openAPI, admin } from "better-auth/plugins";
// import { Resend } from "resend";
// import { logger } from "./logger.js";
// const mongoUrl = process.env.MONGODB_URL || "mongodb://127.0.0.1:27017";
// const dbName = process.env.MONGODB_NAME || "demo";
// const client = new MongoClient(mongoUrl);
// const db = client.db(dbName);
// // const resend = new Resend(process.env.RESEND_API_KEY);

// // Add error handling for auth initialization
// try {
//   console.log("Initializing better-auth with baseURL:", process.env.BETTER_AUTH_URL || "http://localhost:8000");
//   console.log("MongoDB URL:", mongoUrl);
//   console.log("Database name:", dbName);
// } catch (error) {
//   console.error("Error initializing auth configuration:", error);
// }

// export const auth = betterAuth({
//   baseURL: process.env.BETTER_AUTH_URL || "http://localhost:8000",
//   // advanced: {
//   //   crossSubDomainCookies: {
//   //     enabled: true,
//   //     domain: ".revanai.in",
//   //   },ß
//   // },
//   trustedOrigins: [
//     "https://postedit.revanai.in",
//     "http://localhost:3000",
//     "hhttp://192.168.1.50:3000",
//     "http://localhost:3001",
//     "http://127.0.0.1:3000",
//     "http://127.0.0.1:3001"
//   ],
//   database: mongodbAdapter(db),
//   plugins: [openAPI(), admin()],
//   emailAndPassword: {
//     enabled: true,
//     sendResetPassword: async ({ user, token, url }) => {
//       const { data, error } = await resend.emails.send({
//         from: "PostEdit <postedit@updates.revanai.in>",
//         to: [user.email],
//         subject: "Reset Your PostEdit Password",
//         html: `
//       <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
//         <h2 style="color: #2563eb; text-align: center;">Password Reset Request</h2>
//         <p>Hello ${user.name || "there"},</p>
//         <p>We received a request to reset your PostEdit account password. Click the button below to set a new password:</p>

//         <div style="text-align: center; margin: 30px 0;">
//           <a href="${url}" 
//              style="background-color: #2563eb; color: white; padding: 12px 24px; 
//                     text-decoration: none; border-radius: 6px; font-weight: bold; 
//                     display: inline-block;">
//             Reset Password
//           </a>
//         </div>

//         <p>Or copy and paste this link into your browser:</p>
//         <p style="word-break: break-all; color: #2563eb; background-color: #f3f4f6; 
//                   padding: 10px; border-radius: 4px; font-size: 14px;">
//           ${url}
//         </p>

//         <p>If you didn't request this password reset, you can safely ignore this email. 
//            Your password will remain unchanged.</p>

//         <p>Thanks,<br>The PostEdit Team</p>

//         <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 20px 0;">
//         <p style="font-size: 12px; color: #6b7280; text-align: center;">
//           This is an automated message, please do not reply directly to this email.
//         </p>
//       </div>
//     `,
//       });
//       logger.info("Reset Password Link Send Successfully", {
//         userId: user.id,
//         email: user.email,
//       });
//       if (error) {
//         logger.error("Error sending reset email:", {
//           error: error.message,
//           email: user.email,
//         });
//       }
//     },
//   },
//   user: {
//     additionalFields: {
//       languages: [
//         {
//           type: "string",
//           required: false,
//         },
//       ],
//     },
//   },
// });


import dotenv from "dotenv";
dotenv.config();
import { betterAuth } from "better-auth";
import { MongoClient } from "mongodb";
import { mongodbAdapter } from "better-auth/adapters/mongodb";
import { admin, openAPI } from "better-auth/plugins"; // Import the admin plugin
import { Resend } from "resend";
import { logger } from "./logger.js";

// --- START: DEBUG LOG ---
console.log("DEBUG: Reading lib/auth.js file.");
// --- END: DEBUG LOG ---
const mongoUrl = process.env.MONGODB_URL || "mongodb://127.0.0.1:27017";
const dbName = process.env.MONGODB_NAME || "demo";
const client = new MongoClient(mongoUrl);
const db = client.db(dbName);
// const resend = new Resend(process.env.RESEND_API_KEY);
// --- START: DEBUG LOG ---
const adminPlugin = admin({ requiredRole: "ADMIN" });
console.log("DEBUG: Admin plugin created:", adminPlugin ? "Yes" : "No");
// --- END: DEBUG LOG ---
export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL || "http://localhost:8000",
  trustedOrigins: [
    "https://postedit.revanai.in",
    "http://localhost:3000",
    "http://192.168.1.50:3000",
    "http://localhost:3001",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:3001",
    "http://localhost:5050"
  ],
  advanced: {
    allowNonBrowserRequests: true
  },
  database: mongodbAdapter(db),

  // 🔥 THIS PART IS MISSING IN YOUR CODE
  adminPanel: {
    enabled: true,
    basePath: "/admin", // panel will be served at /api/auth/admin
    secure: false // allow in local/dev without HTTPS
  },

  plugins: [
    openAPI(),
    admin({
      requiredRole: "ADMIN",
    }),
  ],

  emailAndPassword: {
    enabled: true,
    sendResetPassword: async ({ user, token, url }) => {
      logger.info("Password reset email functionality is configured.");
    },
  },

  user: {
    additionalFields: {
      role: {
        type: "string",
        required: true,
        default: "USER",
      },
    },
  },
});


// --- START: DEBUG LOG ---
console.log("DEBUG: better-auth object configured.");
// --- END: DEBUG LOG ---