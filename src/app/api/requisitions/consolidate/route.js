import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { verifyToken } from "@/lib/auth";
import { connectDB } from "@/lib/db";

import Requisition from "@/models/Requisition";

import {
  createConsolidatedRequisition,
} from "@/services/consolidatedRequisitionService";

import { ROLES } from "@/constants/roles";

import {
  REQUISITION_STATUS,
} from "@/constants/requisitionOptions";

/*
 * --------------------------------------------------
 * AUTHENTICATION
 * --------------------------------------------------
 */

function getAuth() {
  const token = cookies().get("token")?.value;

  return token
    ? verifyToken(token)
    : null;
}

/*
 * --------------------------------------------------
 * ALLOWED ROLES
 * --------------------------------------------------
 */

const ALLOWED_ROLES = [
  ROLES.DEAN,
  ROLES.PROVOST,
  ROLES.VC,
  ROLES.PROCUREMENT,
];

/*
 * --------------------------------------------------
 * BUILD ORGANIZATIONAL FILTER
 * --------------------------------------------------
 *
 * Dean:
 *   Only requisitions from their faculty.
 *
 * Provost:
 *   Only requisitions from their college.
 *
 * VC:
 *   University-wide.
 *
 * Procurement:
 *   University-wide.
 */

function getOrganizationFilter(auth) {
  if (auth.role === ROLES.DEAN) {
    return {
      facultyId: auth.facultyId,
      collegeId: auth.collegeId,
    };
  }

  if (auth.role === ROLES.PROVOST) {
    return {
      collegeId: auth.collegeId,
    };
  }

  /*
   * VC and Procurement are university-wide.
   */

  return {};
}

/*
 * --------------------------------------------------
 * GET /api/requisitions/consolidate
 * --------------------------------------------------
 *
 * Returns requisitions available to the current
 * user for consolidation.
 */

export async function GET() {
  try {
    const auth = getAuth();

    if (!auth) {
      return NextResponse.json(
        {
          message: "Unauthorized",
        },
        {
          status: 401,
        }
      );
    }

    if (
      !ALLOWED_ROLES.includes(
        auth.role
      )
    ) {
      return NextResponse.json(
        {
          message:
            "Your role is not authorized to consolidate requisitions.",
        },
        {
          status: 403,
        }
      );
    }

    await connectDB();

    /*
     * --------------------------------------------------
     * ORGANIZATIONAL FILTER
     * --------------------------------------------------
     */

    const organizationFilter =
      getOrganizationFilter(auth);

    /*
     * --------------------------------------------------
     * FIND AVAILABLE REQUISITIONS
     * --------------------------------------------------
     *
     * We intentionally exclude:
     *
     * - drafts
     * - rejected requisitions
     * - already consolidated requisitions
     * - requisitions with no items
     *
     * Pending and approved requisitions can be
     * considered for consolidation.
     */

    const requisitions =
      await Requisition.find({
        ...organizationFilter,

        status: {
          $in: [
            REQUISITION_STATUS.PENDING,
            REQUISITION_STATUS.APPROVED,
          ],
        },

        isConsolidated: {
          $ne: true,
        },

        "items.0": {
          $exists: true,
        },
      })
        .populate(
          "requester",
          "fullName email role"
        )
        .select(
          [
            "_id",
            "requisitionNumber",
            "requester",
            "requesterRole",
            "collegeId",
            "facultyId",
            "department",
            "category",
            "purpose",
            "urgency",
            "items",
            "estimatedCost",
            "status",
            "submittedAt",
            "createdAt",
          ].join(" ")
        )
        .sort({
          submittedAt: -1,
          createdAt: -1,
        })
        .lean();

    /*
     * --------------------------------------------------
     * RESPONSE
     * --------------------------------------------------
     */

    return NextResponse.json({
      role: auth.role,

      count:
        requisitions.length,

      requisitions,
    });
  } catch (error) {
    console.error(
      "Get consolidation candidates error:",
      error
    );

    return NextResponse.json(
      {
        message:
          error.message ||
          "Failed to load requisitions available for consolidation.",
      },
      {
        status: 500,
      }
    );
  }
}

/*
 * --------------------------------------------------
 * POST /api/requisitions/consolidate
 * --------------------------------------------------
 */

export async function POST(request) {
  try {
    const auth = getAuth();

    if (!auth) {
      return NextResponse.json(
        {
          message: "Unauthorized",
        },
        {
          status: 401,
        }
      );
    }

    if (
      !ALLOWED_ROLES.includes(
        auth.role
      )
    ) {
      return NextResponse.json(
        {
          message:
            "Your role is not authorized to create consolidated requisitions.",
        },
        {
          status: 403,
        }
      );
    }

    const body =
      await request.json();

    const {
      sourceRequisitionIds,
    } = body;

    if (
      !Array.isArray(
        sourceRequisitionIds
      )
    ) {
      return NextResponse.json(
        {
          message:
            "sourceRequisitionIds must be an array.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      sourceRequisitionIds.length ===
      0
    ) {
      return NextResponse.json(
        {
          message:
            "Select at least one requisition.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      sourceRequisitionIds.length >
      100
    ) {
      return NextResponse.json(
        {
          message:
            "You cannot consolidate more than 100 requisitions at once.",
        },
        {
          status: 400,
        }
      );
    }

    await connectDB();

    const requisition =
      await createConsolidatedRequisition({
        sourceRequisitionIds,
        user: {
          id: auth.sub,
          role: auth.role,
          collegeId:
            auth.collegeId,
          facultyId:
            auth.facultyId,
          department:
            auth.department,
        },
      });

    return NextResponse.json(
      {
        message:
          "Consolidated requisition created successfully.",

        requisition,
      },
      {
        status: 201,
      }
    );
  } catch (error) {
    console.error(
      "Create consolidated requisition error:",
      error
    );

    return NextResponse.json(
      {
        message:
          error.message ||
          "Failed to create consolidated requisition.",
      },
      {
        status: 400,
      }
    );
  }
}
