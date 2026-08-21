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

  // Base query: always show the user's own requisitions
  let query = {
    $or: [{ requester: auth.sub }],
  };

  // If the user is NOT a plain "REQUESTER", also show all submitted requisitions (excluding drafts)
  if (auth.role !== ROLES.REQUESTER) {
    query.$or.push({ status: { $ne: "draft" } });
  }

  // If a status filter is provided in the URL, override the above logic
  if (status) {
    // Replace the query with a simple status filter, but keep the requester filter?
    // Typically, if a user asks for ?status=approved, they want to see all approved,
    // not just their own. So we remove the $or and apply a combined filter if needed.
    // For simplicity, we'll keep the $or and add an additional status condition.
    // But to respect the status param exactly, we can rebuild:
    if (auth.role === ROLES.REQUESTER) {
      // Requesters see only their own with that status
      query = { requester: auth.sub, status };
    } else {
      // Other roles see all with that status (excluding drafts if they want? 
      // They might want to see drafts if they ask explicitly, so we allow)
      query = { status };
    }
  }

  const requisitions = await Requisition.find(query)
    .sort({ createdAt: -1 })
    .populate("requester", "fullName email role")
    .lean();

  return NextResponse.json({ requisitions });
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
    ROLES.ADMIN,
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
