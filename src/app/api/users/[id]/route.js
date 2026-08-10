import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import User from "@/models/User";
import { editUserSchema } from "@/lib/validators/user";
import { editUser } from "@/services/userService";
import { ROLES } from "@/constants/roles";

function getAuth() {
  const token = cookies().get("token")?.value;
  return token ? verifyToken(token) : null;
}

function requireAdmin(auth) {
  if (!auth) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  if (auth.role !== ROLES.ADMIN) return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  return null;
}

export async function GET(request, { params }) {
  const auth = getAuth();
  const denied = requireAdmin(auth);
  if (denied) return denied;

  await connectDB();
  const user = await User.findById(params.id).select("-passwordHash -passwordResetToken").lean();
  if (!user) return NextResponse.json({ message: "User not found." }, { status: 404 });

  return NextResponse.json({ user });
}

// PATCH handles both profile edits and status changes (deactivate/reactivate)
// via the same accountStatus field in editUserSchema.
export async function PATCH(request, { params }) {
  const auth = getAuth();
  const denied = requireAdmin(auth);
  if (denied) return denied;

  try {
    const body = await request.json();
    const { error, value } = editUserSchema.validate(body);
    if (error) {
      return NextResponse.json({ message: error.details[0].message }, { status: 400 });
    }

    await connectDB();

    const user = await editUser({ adminId: auth.sub, userId: params.id, payload: value });

    return NextResponse.json({ user });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: err.message || "Update failed." }, { status: 500 });
  }
}
