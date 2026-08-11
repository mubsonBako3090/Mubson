import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import mongoose from "mongoose";

import { verifyToken } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import Requisition from "@/models/Requisition";
import { generateRequisitionPDF } from "@/lib/pdf";

/*
 * PDFKit requires the Node.js runtime.
 */
export const runtime = "nodejs";

/*
 * This route must always run dynamically because it:
 * - reads authentication cookies
 * - connects to MongoDB
 * - generates a PDF
 */
export const dynamic = "force-dynamic";

/**
 * Get the authenticated user from the JWT cookie.
 */
function getAuth() {
  try {
    const cookieStore = cookies();
    const token = cookieStore.get("token")?.value;

    if (!token) {
      return null;
    }

    return verifyToken(token);
  } catch (error) {
    console.error("PDF authentication error:", error);
    return null;
  }
}

/**
 * GET /api/requisitions/[id]/pdf
 *
 * Generates and returns a PDF version of a requisition.
 */
export async function GET(request, { params }) {
  try {
    /*
     * --------------------------------------------------
     * 1. AUTHENTICATION
     * --------------------------------------------------
     */
    const auth = getAuth();

    if (!auth) {
      return NextResponse.json(
        {
          success: false,
          message: "Unauthorized. Please log in again.",
        },
        { status: 401 }
      );
    }

    /*
     * --------------------------------------------------
     * 2. VALIDATE REQUISITION ID
     * --------------------------------------------------
     */
    const requisitionId = params?.id;

    if (!requisitionId) {
      return NextResponse.json(
        {
          success: false,
          message: "Requisition ID is required.",
        },
        { status: 400 }
      );
    }

    if (!mongoose.isValidObjectId(requisitionId)) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid requisition ID.",
        },
        { status: 400 }
      );
    }

    /*
     * --------------------------------------------------
     * 3. CONNECT TO DATABASE
     * --------------------------------------------------
     */
    await connectDB();

    /*
     * --------------------------------------------------
     * 4. FIND REQUISITION
     * --------------------------------------------------
     */
    const requisition = await Requisition.findById(requisitionId)
      .populate("requester", "fullName")
      .lean();

    if (!requisition) {
      return NextResponse.json(
        {
          success: false,
          message: "Requisition not found.",
        },
        { status: 404 }
      );
    }

    /*
     * --------------------------------------------------
     * 5. GENERATE PDF
     * --------------------------------------------------
     */
    const pdfBuffer = await generateRequisitionPDF(
      requisition,
      requisition.requester
    );

    /*
     * Make sure PDF generation actually returned data.
     */
    if (!pdfBuffer || pdfBuffer.length === 0) {
      throw new Error("PDF generation returned an empty document.");
    }

    /*
     * --------------------------------------------------
     * 6. CREATE SAFE FILE NAME
     * --------------------------------------------------
     */
    const requisitionNumber =
      requisition.requisitionNumber || "draft-requisition";

    const safeFileName = String(requisitionNumber)
      .replace(/[^a-zA-Z0-9_-]/g, "_")
      .substring(0, 100);

    /*
     * --------------------------------------------------
     * 7. RETURN PDF
     * --------------------------------------------------
     *
     * Uint8Array makes the binary response explicit and
     * compatible with the Web Response API used by
     * Next.js Route Handlers.
     */
    return new Response(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${safeFileName}.pdf"`,
        "Content-Length": String(pdfBuffer.length),
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    });
  } catch (error) {
    /*
     * IMPORTANT:
     * This gives us the real error in Vercel's Function Logs
     * instead of silently returning a generic HTTP 500.
     */
    console.error("====================================");
    console.error("REQUISITION PDF GENERATION ERROR");
    console.error("====================================");
    console.error(error);
    console.error("Message:", error?.message);
    console.error("Stack:", error?.stack);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to generate requisition PDF.",
        error:
          process.env.NODE_ENV === "development"
            ? error?.message
            : undefined,
      },
      { status: 500 }
    );
  }
}
