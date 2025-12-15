
import mongoose from "mongoose";;

import dotenv from "dotenv";
import { logger } from "better-auth";
dotenv.config();

export async function connectDB() {
    try {
       
        const mongoUrl = process.env.MONGODB_URL || "mongodb://127.0.0.1:27017";
        const dbName = process.env.MONGODB_NAME || "demo";
        logger.info(`Connecting to MongoDB at ${mongoUrl}`);
        logger.info(`Using database ${dbName}`);
        await mongoose.connect(mongoUrl, {
      dbName:dbName,
    });
        console.log("✅ MongoDB Connected");
    } catch (err) {
        console.error("❌ MongoDB Connection Error:", err.message);
        process.exit(1);
    }
};

