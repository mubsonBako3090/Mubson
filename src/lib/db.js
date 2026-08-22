import mongoose from "mongoose";

// Side-effect imports: every model must be registered on the shared
// Mongoose connection before any route calls .populate(). A route's own
// import chain won't reliably pull these in (e.g. a GET handler that only
// imports Requisition has no reason to import User, yet still needs the
// User schema registered to populate("requester", ...)). Registering all
// models once here — on every connectDB() call — closes that gap for
// every current and future route.
import "@/models/User";
import "@/models/Requisition";
import "@/models/Approval";
import "@/models/AuditLog";

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  throw new Error("Missing MONGODB_URI environment variable");
}

// Reuse the connection across hot reloads / serverless invocations.
let cached = global._mongooseConn;
if (!cached) {
  cached = global._mongooseConn = { conn: null, promise: null };
}

export async function connectDB() {
  if (cached.conn) return cached.conn;

  if (!cached.promise) {
    cached.promise = mongoose
      .connect(MONGODB_URI, { bufferCommands: false })
      .then((mongooseInstance) => mongooseInstance);
  }

  cached.conn = await cached.promise;
  return cached.conn;
}
