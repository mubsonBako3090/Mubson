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
   * ADMIN
   * --------------------------------------------------
   *
   * Admin can see all requisitions.
   */
  if (auth.role === ROLES.ADMIN) {
    const query = status
      ? { status }
      : {};

    const requisitions =
      await Requisition.find(query)
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

  /*
   * --------------------------------------------------
   * LOAD REQUISITIONS RELEVANT TO THIS USER
   * --------------------------------------------------
   *
   * We first get:
   *
   * 1. Requisitions created by the current user.
   *
   * 2. For approval roles, requisitions that are
   *    potentially somewhere in their approval chain.
   *
   * 3. For Procurement, requisitions assigned to them
   *    or ready for Procurement processing.
   *
   * We then apply precise current-step filtering.
   */

  let requisitions = [];

  /*
   * --------------------------------------------------
   * REQUESTER
   * --------------------------------------------------
   *
   * A normal requester sees ONLY requisitions
   * they created.
   */
  if (auth.role === ROLES.REQUESTER) {
    const query = {
      requester: auth.sub,
    };

    if (status) {
      query.status = status;
    }

    requisitions =
      await Requisition.find(query)
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

  /*
   * --------------------------------------------------
   * APPROVAL ROLES
   * --------------------------------------------------
   *
   * HOD
   * Dean
   * Provost
   * VC
   *
   * They see:
   *
   * 1. Requisitions they personally created.
   *
   * 2. Requisitions currently waiting for THEIR
   *    approval.
   *
   * IMPORTANT:
   *
   * We do NOT simply search for:
   *
   * approvalChain.approver === auth.sub
   *
   * because that would also return requisitions
   * that have already passed this approver.
   *
   * Instead, we check:
   *
   * approvalChain[currentStepIndex]
   */
  if (
    APPROVER_ROLES.includes(auth.role)
  ) {
    const query = {
      $or: [
        {
          requester: auth.sub,
        },
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

          "approvalChain.approver":
            auth.sub,
        },
      ],
    };

    /*
     * Do not apply status directly to the whole
     * query before filtering because we need to
     * preserve the user's own requisitions too.
     */
    if (status) {
      query.$or = query.$or.map(
        (condition) => ({
          ...condition,
          status,
        })
      );
    }

    const possibleRequisitions =
      await Requisition.find(query)
        .sort({ createdAt: -1 })
        .populate(
          "requester",
          "fullName email role"
        )
        .lean();

    /*
     * IMPORTANT:
     *
     * Only include an approval requisition if
     * this user's step is the CURRENT step.
     *
     * The user's own requisitions are always included.
     */
    requisitions =
      possibleRequisitions.filter(
        (requisition) => {
          /*
           * User's own requisition.
           */
          if (
            String(
              requisition.requester?._id ||
                requisition.requester
            ) === String(auth.sub)
          ) {
            return true;
          }

          /*
           * Requisition awaiting this user's
           * current approval.
           */
          const currentStep =
            requisition.approvalChain?.[
              requisition.currentStepIndex
            ];

          return (
            currentStep &&
            currentStep.type ===
              "approval" &&
            String(
              currentStep.approver
            ) === String(auth.sub)
          );
        }
      );

    return NextResponse.json({
      requisitions,
    });
  }

  /*
   * --------------------------------------------------
   * PROCUREMENT
   * --------------------------------------------------
   *
   * Procurement is NOT an approval authority.
   *
   * Procurement sees:
   *
   * 1. Requisitions they personally initiated.
   *
   * 2. Requisitions assigned to them.
   *
   * 3. Ready requisitions available to Procurement.
   */
  if (
    auth.role === ROLES.PROCUREMENT
  ) {
    const query = {
      $or: [
        {
          requester: auth.sub,
        },

        {
          procurementOfficer:
            auth.sub,
        },

        {
          status:
            REQUISITION_STATUS.APPROVED,

          procurementStatus:
            "ready",
        },
      ],
    };

    if (status) {
      query.$or = query.$or.map(
        (condition) => ({
          ...condition,
          status,
        })
      );
    }

    requisitions =
      await Requisition.find(query)
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

  /*
   * --------------------------------------------------
   * FALLBACK
   * --------------------------------------------------
   *
   * Any unexpected role gets only its own
   * requisitions.
   */
  const query = {
    requester: auth.sub,
  };

  if (status) {
    query.status = status;
  }

  requisitions =
    await Requisition.find(query)
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
