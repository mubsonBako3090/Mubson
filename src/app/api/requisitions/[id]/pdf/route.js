import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import Requisition from "@/models/Requisition";
import { generateRequisitionPDF } from "@/lib/pdf";

function getAuth() {
  const token = cookies().get("token")?.value;
  return token ? verifyToken(token) : null;
}

export async function GET(request, { params }) {
  const auth = getAuth();
  if (!auth) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  await connectDB();

  const requisition = await Requisition.findById(params.id).populate("requester", "fullName").lean();
  if (!requisition) {
    return NextResponse.json({ message: "Requisition not found." }, { status: 404 });
  }

  const pdfBuffer = await generateRequisitionPDF(requisition, requisition.requester);

  return new NextResponse(pdfBuffer, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${requisition.requisitionNumber || "draft-requisition"}.pdf"`,
    },
  });
}
