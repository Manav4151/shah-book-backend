
import { connect } from "mongoose";

import dotenv from "dotenv";
dotenv.config();

export async function connectDB() {
    try {
        console.log("MONGODB_ATLAS_URL", process.env.MONGODB_ATLAS_URL);
        const mongoUrl = process.env.MONGODB_ATLAS_URL || "mongodb://127.0.0.1:27017";
        const dbName = process.env.MONGODB_ATLAS_NAME || "demo";
        // const mongoUrl = process.env.MONGODB_URL || "mongodb://127.0.0.1:27017";
        // const dbName = process.env.MONGODB_NAME || "demo";
        await connect(`${mongoUrl}/${dbName}`);
        console.log("✅ MongoDB Connected");
    } catch (err) {
        console.error("❌ MongoDB Connection Error:", err.message);
        process.exit(1);
    }
};

