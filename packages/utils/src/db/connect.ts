import process from "node:process";
import mongoose from "mongoose";

declare global {
  // eslint-disable-next-line no-var
  var __yuiju_mongo_connection:
    | Promise<typeof mongoose>
    | null
    | undefined;
}

export const connectDB = async () => {
  if (globalThis.__yuiju_mongo_connection) {
    return globalThis.__yuiju_mongo_connection;
  }

  const uri = process.env.MONGO_URI;
  if (!uri) {
    throw new Error("MONGO_URI environment variable is not defined");
  }

  const connectionPromise = mongoose.connect(uri);
  globalThis.__yuiju_mongo_connection = connectionPromise;
  return connectionPromise;
};
