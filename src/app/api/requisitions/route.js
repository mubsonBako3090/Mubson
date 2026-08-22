import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { verifyToken } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import Requisition from "@/models/Requisition";
import { draftRequisitionSchema } from "@/lib/validators/requisition";
import { saveDraft } from "@/services/requisitionService";
import { ROLES } from "@/constants/roles";
import { REQUISITION_STATUS } from "@/constants/requisitionOptions";
// --------------------------------------------
// Helper: get authenticated user from token
// --------------------------------------------
function getAuth() {
  const token = cookies().get("token")?.value;
  return token ? verifyToken(token) : null;
}

// --------------------------------------------
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
   * ROLE-BASED VISIBILITY
   * --------------------------------------------------
   *
   * Every role should NOT see every requisition.
   *
   * Users can see:
   *
   * 1. Requisitions they personally created.
   *
   * 2. For approval roles (HOD, Dean, Provost, VC):
   *    requisitions currently waiting for their approval.
   *
   * 3. Procurement:
   *    requisitions they created OR requisitions assigned
   *    to them for procurement processing.
   *
   * 4. Admin:
   *    all requisitions.
   */

  let query = {};

  /*
   * --------------------------------------------------
   * ADMIN
   * --------------------------------------------------
   *
   * Admin has university-wide visibility.
   */
  if (auth.role === ROLES.ADMIN) {
    query = {};

    if (status) {
      query.status = status;
    }
  }

  /*
   * --------------------------------------------------
   * APPROVAL ROLES
   * --------------------------------------------------
   *
   * HOD / Dean / Provost / VC
   *
   * They see:
   *
   * - Their own requisitions
   * - Requisitions currently waiting for them
   *
   * They do NOT see every submitted requisition.
   */
  else if (
    auth.role === ROLES.HOD ||
    auth.role === ROLES.DEAN ||
    auth.role === ROLES.PROVOST ||
    auth.role === ROLES.VC
  ) {
    const visibilityConditions = [
      /*
       * Requisitions created by this user.
       */
      {
        requester: auth.sub,
      },

      /*
       * Requisitions currently waiting
       * for this user's approval.
       */
      {
        status: {
          $in: [
            REQUISITION_STATUS.PENDING,
            REQUISITION_STATUS.RETURNED,
          ],
        },

        awaitingRequesterAction: {
          $ne: true,
        },

        approvalChain: {
          $elemMatch: {
            approver: auth.sub,
          },
        },
      },
    ];

    query = {
      $or: visibilityConditions,
    };

    /*
     * If a status filter is supplied, apply it
     * together with the visibility rules.
     */
    if (status) {
      query.status = status;
    }
  }

  /*
   * --------------------------------------------------
   * PROCUREMENT
   * --------------------------------------------------
   *
   * Procurement is not an approval authority.
   *
   * Procurement sees:
   *
   * 1. Requisitions they personally initiated.
   *
   * 2. Requisitions assigned to them for processing.
   *
   * 3. Requisitions ready for Procurement processing
   *    when no specific officer has been assigned yet.
   */
  else if (auth.role === ROLES.PROCUREMENT) {
    const visibilityConditions = [
      /*
       * Requisitions initiated by this Procurement Officer.
       */
      {
        requester: auth.sub,
      },

      /*
       * Requisitions specifically assigned
       * to this Procurement Officer.
       */
      {
        procurementOfficer: auth.sub,
      },

      /*
       * Approved requisitions waiting for
       * Procurement processing.
       *
       * procurementOfficer may still be empty
       * when the system has not assigned one.
       */
      {
        status: REQUISITION_STATUS.APPROVED,
        procurementStatus: "ready",
      },
    ];

    query = {
      $or: visibilityConditions,
    };

    if (status) {
      query.status = status;
    }
  }

  /*
   * --------------------------------------------------
   * REQUESTER
   * --------------------------------------------------
   *
   * Requesters can ONLY see requisitions
   * they personally created.
   */
  else {
    query = {
      requester: auth.sub,
    };

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
