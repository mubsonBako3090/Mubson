import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { verifyToken } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { ROLES } from "@/constants/roles";
import { updateProcurementProcessing } from "@/services/approvalService";

function getAuth() {
  const token = cookies().get("token")?.value;
  return token ? verifyToken(token) : null;
}

export async function POST(request, { params }) {
  const auth = getAuth();

  if (!auth) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  if (auth.role !== ROLES.PROCUREMENT) {
    return NextResponse.json({ message: "Only Procurement Officers can process a requisition." }, { status: 403 });
  }

  try {
    const body = await request.json();
    await connectDB();
    const requisition = await updateProcurementProcessing({
      requisitionId: params.id,
      procurementUser: { id: auth.sub },
      action: body.action,
      comment: body.comment,
    });
    return NextResponse.json({ requisition });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: err.message || "Procurement processing update failed." }, { status: 400 });
  }
}
