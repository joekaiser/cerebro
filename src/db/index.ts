// import { config } from "@/config.ts";
// import log from "@/log.ts";
// import { connect } from "mongoose";

// let cachedConnection: typeof import("mongoose") | null = null;

// export async function getMongoConnection() {
//   if (cachedConnection) {
//     return cachedConnection;
//   }

//   try {
//     const mongoUri = config.CB_DATABASE_URL();

//     cachedConnection = await connect(mongoUri);
//     return cachedConnection;
//   } catch (error) {
//     log.error("MongoDB connection error:", error);
//     throw error;
//   }
// }

import { config } from "@/config.ts";
import log from "@/log.ts";
import mongoose from "mongoose";

export async function connectToMongo() {
  log.info("Connecting to MongoDB");
  const url = config.CB_DATABASE_URL();
  await mongoose.connect(url);
}
