import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import User from "@/models/User";
import { inviteUserSchema } from "@/lib/validators/user";
import { inviteUser } from "@/services/userService";
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

export async function GET(request) {
  const auth = getAuth();
  const denied = requireAdmin(auth);
  if (denied) return denied;

  await connectDB();

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");

  const query = {};
  if (status) query.accountStatus = status;

  const users = await User.find(query).select("-passwordHash -passwordResetToken").sort({ createdAt: -1 }).lean();

  return NextResponse.json({ users });
}

export async function POST(request) {
  const auth = getAuth();
  const denied = requireAdmin(auth);
  if (denied) return denied;

  try {
    const body = await request.json();
    const { error, value } = inviteUserSchema.validate(body);
    if (error) {
      return NextResponse.json({ message: error.details[0].message }, { status: 400 });
    }

    await connectDB();

    const user = await inviteUser({ adminId: auth.sub, payload: value });

    return NextResponse.json(
      { message: "User invited. They'll receive an email to set their password.", user },
      { status: 201 }
    );
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: err.message || "Invite failed." }, { status: 500 });
  }
}
