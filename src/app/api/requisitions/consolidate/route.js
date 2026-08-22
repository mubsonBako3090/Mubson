import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { verifyToken } from "@/lib/auth";
import { connectDB } from "@/lib/db";

import {
  createConsolidatedRequisition,
} from "@/services/consolidatedRequisitionService";

import { ROLES } from "@/constants/roles";

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
 *
 * These roles are allowed to create consolidated
 * requisitions.
 *
 * Dean:
 *   Consolidates requisitions from faculties/
 *   departments under the Dean.
 *
 * Provost:
 *   Consolidates requisitions from the college.
 *
 * VC:
 *   University-wide consolidation.
 *
 * Procurement:
 *   University-wide consolidation.
 */

const ALLOWED_ROLES = [
  ROLES.DEAN,
  ROLES.PROVOST,
  ROLES.VC,
  ROLES.PROCUREMENT,
];

/*
 * --------------------------------------------------
 * POST /api/requisitions/consolidate
 * --------------------------------------------------
 *
 * Expected body:
 *
 * {
 *   "sourceRequisitionIds": [
 *     "id1",
 *     "id2",
 *     "id3"
 *   ]
 * }
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

    /*
     * Check role.
     */

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

    /*
     * Read request body.
     */

    const body =
      await request.json();

    const {
      sourceRequisitionIds,
    } = body;

    /*
     * Validate IDs.
     */

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

    /*
     * Prevent an unnecessarily large request.
     *
     * This can be increased later if required.
     */

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

    /*
     * --------------------------------------------------
     * CREATE CONSOLIDATED REQUISITION
     * --------------------------------------------------
     */

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
      "Consolidated requisition error:",
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
