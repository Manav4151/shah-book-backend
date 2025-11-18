import express from "express";
import cors from "cors";
import path from "path";
import router from "./routes/book.routes.js";
// import emailRouter from "./routes/email.routes.js";
import quotationRouter from "./routes/quotation.routes.js";
import commonRouter from "./routes/common.routes.js";
import templateRouter from "./routes/template.routes.js";
import googleRoutes from "./routes/google.routes.js";
import newEmailRouter from "./routes/new.eamil.routes.js";
import companyProfileRouter from "./routes/company.profile.routes.js";
import { connectDB } from "./config/db.js";
import { auth } from "./lib/auth.js";
import { toNodeHandler } from "better-auth/node";
import { errorHandler, notFoundHandler } from "./middleware/errorhandler.middleware.js";
const app = express();
const PORT = process.env.PORT || 8000;

// --- Middleware ---
// Enable Cross-Origin Resource Sharing to allow requests from your frontend
app.use(cors({
  // origin: "*",
  origin: ["http://localhost:3000", "http://localhost:800", "http://127.0.0.1:5500", "http://localhost:5500", "http://127.0.0.1:8000", "http://127.0.0.1:300"],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Cookie']
}));
// Parse incoming JSON requests and put the parsed data in req.body
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.get("/favicon.ico", (req, res) => res.status(204).end());
// --- Database Connection ---
connectDB();


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
// app.use('/api/emails', emailRouter);
// Use the template routes for any request to /api/templates
app.use('/api/templates', templateRouter);
// Use the quotation routes for any request to /api/quotation
app.use('/api/quotations', quotationRouter);
// Use the company profile routes for any request to /api/company-profiles
app.use('/api/company-profiles', companyProfileRouter);
// google api routes
app.use("/api/google", googleRoutes);
// new email flow routes
// app.use('/api/new-email', newEmailRouter);
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
});