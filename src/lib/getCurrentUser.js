import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import User from "@/models/User";

// Server-component-only helper. Reads the JWT cookie, verifies it, and
// loads the full user record. Returns null if there's no valid session —
// callers in (main)/layout.js redirect to /login when this is null
// (middleware already blocks unauthenticated requests, this is the
// server-side data fetch for rendering role-aware UI).
export async function getCurrentUser() {
  const token = cookies().get("token")?.value;
  if (!token) return null;

  const payload = verifyToken(token);
  if (!payload) return null;

  await connectDB();
  const user = await User.findById(payload.sub).lean();
  if (!user) return null;

  return {
    id: user._id.toString(),
    fullName: user.fullName,
    email: user.email,
    role: user.role,
    collegeId: user.collegeId,
    facultyId: user.facultyId,
    department: user.department,
  };
}
