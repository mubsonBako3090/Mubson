import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import { uploadToCloudinary } from "@/lib/cloudinary";
import { ACCEPTED_UPLOAD_TYPES } from "@/constants/requisitionOptions";
import { connectDB } from "@/lib/db";
import Requisition from "@/models/Requisition";

function getAuth() {
  const token = cookies().get("token")?.value;
  return token ? verifyToken(token) : null;
}

// Expects JSON body: { requisitionId, fileName, fileType, fileBase64 }
// fileBase64 must include the data URI prefix, e.g. "data:application/pdf;base64,...."
export async function POST(request) {
  const auth = getAuth();
  if (!auth) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  try {
    const { requisitionId, fileName, fileType, fileBase64 } = await request.json();

    if (!ACCEPTED_UPLOAD_TYPES.includes(fileType)) {
      return NextResponse.json(
        { message: "Unsupported file type. Only PDF, image, and Word documents are allowed." },
        { status: 400 }
      );
    }

    const { url, publicId } = await uploadToCloudinary(fileBase64, `ksu-procurement/requisitions/${requisitionId}`);

    await connectDB();
    const requisition = await Requisition.findOneAndUpdate(
      { _id: requisitionId, requester: auth.sub },
      { $push: { attachments: { url, publicId, fileName, fileType } } },
      { new: true }
    );

    if (!requisition) {
      return NextResponse.json({ message: "Requisition not found." }, { status: 404 });
    }

    return NextResponse.json({ requisition });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: "Upload failed." }, { status: 500 });
  }
}
