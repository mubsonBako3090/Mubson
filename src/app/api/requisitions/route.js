import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import Requisition from "@/models/Requisition";
import { draftRequisitionSchema } from "@/lib/validators/requisition";
import { saveDraft } from "@/services/requisitionService";
import { ROLES } from "@/constants/roles";

function getAuth() {
  const token = cookies().get("token")?.value;
  return token ? verifyToken(token) : null;
}

// GET: list requisitions. Requesters see their own; approvers/admin/procurement
// see requisitions relevant to their role (kept simple here — full role-based
// scoping for approvers happens in the approvals queue endpoint in Stage 4).
export async function GET(request) {
  const auth = getAuth();
  if (!auth) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  await connectDB();

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");

  const query = {};
  if (auth.role === ROLES.REQUESTER) {
    query.requester = auth.sub;
  }
  if (status) {
    query.status = status;
  }

  const requisitions = await Requisition.find(query)
    .sort({ createdAt: -1 })
    .populate("requester", "fullName email")
    .lean();

  return NextResponse.json({ requisitions });
}

// POST: create a new draft.
export async function POST(request) {
  const auth = getAuth();
  if (!auth) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  try {
    const body = await request.json();
    const { error, value } = draftRequisitionSchema.validate(body);
    if (error) {
      return NextResponse.json({ message: error.details[0].message }, { status: 400 });
    }

    await connectDB();

    const requisition = await saveDraft({
      requesterUser: {
        id: auth.sub,
        collegeId: auth.collegeId,
        facultyId: auth.facultyId,
        department: auth.department,
      },
      payload: value,
    });

    return NextResponse.json({ requisition }, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: err.message || "Failed to create requisition." }, { status: 500 });
  }
}
