import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { connectDB } from "@/lib/db";
import User from "@/models/User";
import AuditLog from "@/models/AuditLog";

import { loginSchema } from "@/lib/validators/user";
import {
  verifyPassword,
  signToken,
  verifyToken,
} from "@/lib/auth";

export async function POST(request) {
  try {
    /*
     * IMPORTANT:
     *
     * The application uses one authenticated session per browser profile.
     *
     * If a valid token already exists, do not allow another login to silently
     * replace the current user's identity.
     *
     * This prevents:
     *
     * Tab A → HOD
     * Tab B → Provost
     *
     * from causing Tab A to become Provost after refresh.
     */
    const existingToken = cookies().get("token")?.value;

    if (existingToken && verifyToken(existingToken)) {
      return NextResponse.json(
        {
          message:
            "You are already signed in. Log out first before signing in with another account in this browser.",
        },
        {
          status: 409,
        }
      );
    }

    // Read request body.
    const body = await request.json();

    // Validate login data.
    const { error, value } = loginSchema.validate(body);

    if (error) {
      return NextResponse.json(
        {
          message: error.details[0].message,
        },
        {
          status: 400,
        }
      );
    }

    // Connect to MongoDB.
    await connectDB();

    // Find user by email.
    const user = await User.findOne({
      email: value.email,
    });

    if (!user) {
      return NextResponse.json(
        {
          message: "Invalid email or password.",
        },
        {
          status: 401,
        }
      );
    }

    // Verify password.
    const passwordOk = await verifyPassword(
      value.password,
      user.passwordHash
    );

    if (!passwordOk) {
      return NextResponse.json(
        {
          message: "Invalid email or password.",
        },
        {
          status: 401,
        }
      );
    }

    // Check account approval status.
    if (user.accountStatus === "pending") {
      return NextResponse.json(
        {
          message:
            "Your account is awaiting admin approval.",
        },
        {
          status: 403,
        }
      );
    }

    // Check whether account has been deactivated.
    if (user.accountStatus === "deactivated") {
      return NextResponse.json(
        {
          message:
            "Your account has been deactivated. Contact an administrator.",
        },
        {
          status: 403,
        }
      );
    }

    // Create JWT.
    const token = signToken(user);

    // Update last login timestamp.
    user.lastLoginAt = new Date();

    await user.save();

    // Record login in audit trail.
    await AuditLog.create({
      actor: user._id,
      action: "login",
      entityType: "User",
      entityId: user._id,
    });

    /*
     * Return user information to the client.
     *
     * Do NOT return passwordHash or other sensitive information.
     */
    const response = NextResponse.json({
      message: "Login successful.",

      user: {
        id: user._id.toString(),
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        collegeId: user.collegeId,
        facultyId: user.facultyId,
        department: user.department,
      },
    });

    /*
     * IMPORTANT:
     *
     * There is intentionally NO:
     *
     * maxAge: 60 * 60 * 24
     *
     * here.
     *
     * This makes the cookie a session cookie rather than deliberately
     * persisting it for 24 hours.
     *
     * The JWT itself still has its configured expiration from:
     *
     * JWT_EXPIRES_IN
     */
    response.cookies.set("token", token, {
      httpOnly: true,

      secure:
        process.env.NODE_ENV === "production",

      sameSite: "lax",

      path: "/",
    });

    return response;
  } catch (err) {
    console.error(err);

    return NextResponse.json(
      {
        message: "Login failed.",
      },
      {
        status: 500,
      }
    );
  }
      }
