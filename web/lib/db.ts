import mongoose from "mongoose";
const uri = process.env.MONGODB_URI ?? "mongodb://127.0.0.1:27017/swiftmednav";
let cached = (global as unknown as { _mongoose?: Promise<typeof mongoose> })._mongoose;
export async function db() {
  if (!cached) cached = mongoose.connect(uri, { dbName: "swiftmednav" });
  (global as unknown as { _mongoose?: unknown })._mongoose = cached;
  return cached;
}
