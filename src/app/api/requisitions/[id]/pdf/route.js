import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import mongoose from "mongoose";

import { verifyToken } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import Requisition from "@/models/Requisition";

// IMPORTANT:
// Requisition contains ref: "User".
// This import registers the User model with Mongoose
// before populate("requester") is executed.
import "@/models/User";

import { generateRequisitionPDF } from "@/lib/pdf";

/*
 * PDFKit requires the Node.js runtime.
 */
export const runtime = "nodejs";

/*
 * This route uses cookies and MongoDB, so it must
 * always be executed dynamically.
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
     * 2. GET REQUISITION ID
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

    /*
     * --------------------------------------------------
     * 3. VALIDATE MONGODB OBJECT ID
     * --------------------------------------------------
     */
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
     * 4. CONNECT TO DATABASE
     * --------------------------------------------------
     */
    await connectDB();

    /*
     * --------------------------------------------------
     * 5. FIND REQUISITION
     * --------------------------------------------------
     *
     * User.js has been imported above, so the
     * "User" schema is registered before populate().
     */
    const requisition = await Requisition.findById(
      requisitionId
    )
      .populate("requester", "fullName")
      .lean();

    /*
     * --------------------------------------------------
     * 6. CHECK WHETHER REQUISITION EXISTS
     * --------------------------------------------------
     */
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
     * 7. GENERATE PDF
     * --------------------------------------------------
     */
    const pdfBuffer = await generateRequisitionPDF(
      requisition,
      requisition.requester
    );

    /*
     * --------------------------------------------------
     * 8. CHECK PDF BUFFER
     * --------------------------------------------------
     */
    if (!pdfBuffer || pdfBuffer.length === 0) {
      throw new Error(
        "PDF generation returned an empty document."
      );
    }

    /*
     * --------------------------------------------------
     * 9. CREATE SAFE FILE NAME
     * --------------------------------------------------
     */
    const requisitionNumber =
      requisition.requisitionNumber ||
      "draft-requisition";

    const safeFileName = String(requisitionNumber)
      .replace(/[^a-zA-Z0-9_-]/g, "_")
      .substring(0, 100);

    /*
     * --------------------------------------------------
     * 10. RETURN PDF
     * --------------------------------------------------
     */
    return new Response(
      new Uint8Array(pdfBuffer),
      {
        status: 200,

        headers: {
          "Content-Type": "application/pdf",

          "Content-Disposition":
            `attachment; filename="${safeFileName}.pdf"`,

          "Content-Length":
            String(pdfBuffer.length),

          "Cache-Control":
            "no-store, no-cache, must-revalidate",
        },
      }
    );
  } catch (error) {
    /*
     * --------------------------------------------------
     * ERROR LOGGING
     * --------------------------------------------------
     *
     * This will show the actual problem in Vercel
     * Function Logs if something else goes wrong.
     */
    console.error(
      "===================================="
    );

    console.error(
      "REQUISITION PDF GENERATION ERROR"
    );

    console.error(
      "===================================="
    );

    console.error(error);

    console.error(
      "Message:",
      error?.message
    );

    console.error(
      "Stack:",
      error?.stack
    );

    return NextResponse.json(
      {
        success: false,
        message:
          "Failed to generate requisition PDF.",

        /*
         * Only expose the error during development.
         */
        error:
          process.env.NODE_ENV ===
          "development"
            ? error?.message
            : undefined,
      },
      { status: 500 }
    );
  }
  }
