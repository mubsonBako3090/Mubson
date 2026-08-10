import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import Requisition from "@/models/Requisition";
import { REQUISITION_STATUS } from "@/constants/requisitionOptions";
import { APPROVER_ROLES } from "@/constants/roles";

function getAuth() {
  const token = cookies().get("token")?.value;
  return token ? verifyToken(token) : null;
}

// Lists requisitions currently sitting at this approver's step — whether
// they're freshly pending or sitting there because of a return-to-previous-approver.
export async function GET() {
  const auth = getAuth();
  if (!auth) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  if (!APPROVER_ROLES.includes(auth.role)) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  await connectDB();

  const requisitions = await Requisition.find({
    status: { $in: [REQUISITION_STATUS.PENDING, REQUISITION_STATUS.RETURNED] },
    awaitingRequesterAction: { $ne: true },
    "approvalChain.approver": auth.sub,
  })
    .populate("requester", "fullName email department")
    .sort({ submittedAt: -1 })
    .lean();

  // Filter precisely to "it's this approver's turn right now" — the query
  // above matches anyone ever in the chain, so narrow to current step.
  const myTurn = requisitions.filter((r) => {
    const step = r.approvalChain[r.currentStepIndex];
    return step && String(step.approver) === String(auth.sub);
  });

  return NextResponse.json({ requisitions: myTurn });
}
