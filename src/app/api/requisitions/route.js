import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { verifyToken } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import Requisition from "@/models/Requisition";
import { draftRequisitionSchema } from "@/lib/validators/requisition";
import { saveDraft } from "@/services/requisitionService";
import { ROLES } from "@/constants/roles";

// --------------------------------------------
// Helper: get authenticated user from token
// --------------------------------------------
function getAuth() {
  const token = cookies().get("token")?.value;
  return token ? verifyToken(token) : null;
}

// --------------------------------------------
// GET /api/requisitions
// --------------------------------------------
export async function GET(request) {
  const auth = getAuth();

  if (!auth) {
    return NextResponse.json(
      { message: "Unauthorized" },
      { status: 401 }
    );
  }

  await connectDB();

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");

  /*
   * --------------------------------------------------
   * REQUISITION VISIBILITY
   * --------------------------------------------------
   *
   * The normal Requisitions page shows ONLY requisitions
   * created by the currently logged-in user.
   *
   * Approval work is handled separately through:
   *
   *     /api/approvals
   *
   * Consolidated requisitions will also be handled
   * separately when we implement the batch system.
   */

  let query = {
    requester: auth.sub,
  };

  /*
   * Optional status filter.
   *
   * Example:
   *
   * /requisitions?status=draft
   *
   * will show only THIS USER'S drafts.
   *
   * /requisitions?status=approved
   *
   * will show only THIS USER'S approved requisitions.
   */
  if (status) {
    query.status = status;
  }

  /*
   * Admin is the only role that should have
   * university-wide visibility from this page.
   */
  if (auth.role === ROLES.ADMIN) {
    query = {};

    if (status) {
      query.status = status;
    }
  }

  const requisitions = await Requisition.find(query)
    .sort({ createdAt: -1 })
    .populate(
      "requester",
      "fullName email role"
    )
    .lean();

  return NextResponse.json({
    requisitions,
  });
}

// --------------------------------------------
// POST /api/requisitions
// --------------------------------------------
export async function POST(request) {
  const auth = getAuth();

  if (!auth) {
    return NextResponse.json(
      { message: "Unauthorized" },
      { status: 401 }
    );
  }

  // ✅ Roles that are allowed to create requisitions
  const ALLOWED_TO_CREATE = [
    ROLES.REQUESTER,
    ROLES.HOD,
    ROLES.DEAN,
    ROLES.PROVOST,
    ROLES.PROCUREMENT,
    // Add any other roles that should be able to create
  ];

  if (!ALLOWED_TO_CREATE.includes(auth.role)) {
    return NextResponse.json(
      { message: "Forbidden: Your role does not allow creating requisitions." },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();

    const { error, value } = draftRequisitionSchema.validate(body);
    if (error) {
      return NextResponse.json(
        { message: error.details[0].message },
        { status: 400 }
      );
    }

    await connectDB();

    const requisition = await saveDraft({
      requesterUser: {
        id: auth.sub,
        role: auth.role,
        collegeId: auth.collegeId,
        facultyId: auth.facultyId,
        department: auth.department,
      },
      payload: value,
    });

    return NextResponse.json(
      { requisition },
      { status: 201 }
    );
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { message: err.message || "Failed to create requisition." },
      { status: 500 }
    );
  }
        }
