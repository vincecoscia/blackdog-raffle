import mongoose from "mongoose";

const uri = process.env.MONGODB_URI;

if (!uri) {
  throw new Error("MONGODB_URI is not set. Add it to .env (see .env.example).");
}

// Serverless functions are re-invoked constantly; caching the connection promise
// on `global` means a warm lambda reuses its socket instead of paying a fresh
// TLS + auth handshake to Atlas on every request. In dev it also survives HMR.
const cached = global._mongoose ?? (global._mongoose = { conn: null, promise: null });

export default async function connectDB() {
  if (cached.conn) return cached.conn;

  if (!cached.promise) {
    cached.promise = mongoose
      .connect(uri, { bufferCommands: false, maxPoolSize: 10 })
      .then((m) => m)
      .catch((err) => {
        cached.promise = null; // let the next call retry instead of caching a rejection
        throw err;
      });
  }

  cached.conn = await cached.promise;
  return cached.conn;
}
