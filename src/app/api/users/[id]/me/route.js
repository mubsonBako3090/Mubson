import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import User from "@/models/User";
import AuditLog from "@/models/AuditLog";
import { updateOwnProfileSchema } from "@/lib/validators/user";

function getAuth() {
  const token = cookies().get("token")?.value;
  return token ? verifyToken(token) : null;
}

export async function GET() {
  const auth = getAuth();
  if (!auth) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  await connectDB();
  const user = await User.findById(auth.sub).select("-passwordHash -passwordResetToken").lean();
  if (!user) return NextResponse.json({ message: "User not found." }, { status: 404 });

  return NextResponse.json({ user });
}

// A user can only update their own display name here — role and org
// placement changes go through admin edit (Stage 5), not self-service,
// since those affect approval routing.
export async function PATCH(request) {
  const auth = getAuth();
  if (!auth) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  try {
    const body = await request.json();
    const { error, value } = updateOwnProfileSchema.validate(body);
    if (error) {
      return NextResponse.json({ message: error.details[0].message }, { status: 400 });
    }

    await connectDB();

    const user = await User.findByIdAndUpdate(auth.sub, { $set: value }, { new: true }).select(
      "-passwordHash -passwordResetToken"
    );

    await AuditLog.create({
      actor: auth.sub,
      action: "user.self_edit",
      entityType: "User",
      entityId: auth.sub,
    });

    return NextResponse.json({ user });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: "Update failed." }, { status: 500 });
  }
}
