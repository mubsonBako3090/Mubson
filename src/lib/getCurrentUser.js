import { cookies } from "next/headers";

import { verifyToken } from "@/lib/auth";
import { connectDB } from "@/lib/db";

import User from "@/models/User";

/*
 * Server-component-only helper.
 *
 * Reads the JWT session cookie, verifies the token, then loads
 * the current user from MongoDB.
 *
 * Returns null if:
 *
 * - there is no authentication cookie
 * - the JWT is invalid
 * - the JWT has expired
 * - the user no longer exists
 * - the user's account is not active
 */
export async function getCurrentUser() {
  /*
   * Get authentication token from the HTTP-only cookie.
   */
  const token = cookies().get("token")?.value;

  if (!token) {
    return null;
  }

  /*
   * Verify JWT signature and expiration.
   */
  const payload = verifyToken(token);

  if (!payload) {
    return null;
  }

  /*
   * Load the current user from MongoDB.
   */
  await connectDB();

  const user = await User.findById(payload.sub)
    .select(
      "-passwordHash -passwordResetToken"
    )
    .lean();

  if (!user) {
    return null;
  }

  /*
   * Make sure a deactivated account cannot continue
   * using the system simply because its JWT has not expired yet.
   */
  if (user.accountStatus !== "active") {
    return null;
  }

  /*
   * Return only the information required by the application.
   */
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
