import mongoose from "mongoose";

let cached = global.__mongooseConn;
if (!cached) cached = global.__mongooseConn = { conn: null, promise: null };

export const connectDB = async (uri) => {
  if (cached.conn) return cached.conn;
  if (!uri) throw new Error("MONGO_URI is not set");
  if (!cached.promise) {
    cached.promise = mongoose
      .connect(uri, { bufferCommands: false })
      .then((m) => {
        console.log("database connected ✅");
        return m;
      })
      .catch((err) => {
        cached.promise = null;
        throw err;
      });
  }
  cached.conn = await cached.promise;
  return cached.conn;
};
