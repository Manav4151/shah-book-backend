import express from "express";
import cors from "cors";
import path from "path";
import router from "./routes/book.routes.js";
import emailRouter from "./routes/email.routes.js";
import quotationRouter from "./routes/quotation.routes.js";
import commonRouter from "./routes/common.routes.js";
import { connectDB } from "./config/db.js";
import { auth } from "./lib/auth.js";
import { toNodeHandler } from "better-auth/node";
import { errorHandler, notFoundHandler } from "./middleware/errorhandler.middleware.js";
const app = express();
const PORT = process.env.PORT || 8000;
// --- Sanity Check ---
console.log("--- SERVER STARTING ---");
// --- Middleware ---
// Enable Cross-Origin Resource Sharing to allow requests from your frontend
app.use(cors({
  origin: [
    'http://localhost:3000',  // Next.js default port
    'http://localhost:3001',  // Alternative Next.js port
    'http://127.0.0.1:3000',
    'http://127.0.0.1:3001'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Cookie']
}));
// Parse incoming JSON requests and put the parsed data in req.body
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --- Database Connection ---
connectDB();

// --- authentication middleware ---
// --- Authentication Middleware ---
console.log("Attempting to mount better-auth handler...");
try {
  app.use("/api/auth", toNodeHandler(auth));
  console.log("✅ SUCCESS: better-auth handler mounted at /api/auth.");
} catch (error) {
  console.error("❌ FAILED to mount better-auth handler:", error);
}

// --- Static Files ---
// Serve static files from public directory
app.use('/public', express.static(path.join(process.cwd(), 'public')));

// --- API Routes ---
// Use the book routes for any request to /api/books
app.use('/api/books', router);
// Use the email routes for any request to /api/emails
app.use('/api/emails', emailRouter);

// Use the quotation routes for any request to /api/quotation
app.use('/api/quotations', quotationRouter);

// customer routes
app.use('/api', commonRouter);
// Debug middleware to log all requests
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path} - Origin: ${req.headers.origin || 'No origin'}`);
  console.log('Headers:', req.headers);
  next();
});

// --- Error Handling ---
// Handle 404 errors
app.use(notFoundHandler);
// Global error handler
app.use(errorHandler);

// --- Start the server ---
app.listen(PORT, () => {
  console.log(`🚀 Server is running on port ${PORT}`);
  console.log(`👉 Admin Panel should be at: http://localhost:${PORT}/api/auth/admin`);
});