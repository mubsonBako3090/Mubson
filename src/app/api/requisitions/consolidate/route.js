import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { verifyToken } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import Requisition from "@/models/Requisition";

import {
  canCreateConsolidatedRequisition,
  getConsolidatableRequisitions,
  validateConsolidationSelection,
  buildConsolidatedItems,
  buildRequestingUnits,
} from "@/lib/consolidation";

import { ROLES } from "@/constants/roles";
import { REQUISITION_STATUS } from "@/constants/requisitionOptions";

/*
 * --------------------------------------------------
 * AUTHENTICATION
 * --------------------------------------------------
 */

function getAuth() {
  const token = cookies().get("token")?.value;

  return token ? verifyToken(token) : null;
}

/*
 * --------------------------------------------------
 * GET
 * --------------------------------------------------
 *
 * GET /api/requisitions/consolidate
 *
 * Returns requisitions that the currently logged-in
 * user is allowed to select for consolidation.
 *
 * Dean:
 *   Faculty scope
 *
 * Provost:
 *   College scope
 *
 * VC:
 *   University scope
 *
 * Procurement:
 *   University-wide
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
      !canCreateConsolidatedRequisition(
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

    await connectDB();

    const requisitions =
      await getConsolidatableRequisitions({
        id: auth.sub,
        role: auth.role,
        collegeId: auth.collegeId,
        facultyId: auth.facultyId,
        department: auth.department,
      });

    return NextResponse.json({
      requisitions,
    });
  } catch (error) {
    console.error(
      "Consolidation GET error:",
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
 * POST
 * --------------------------------------------------
 *
 * POST /api/requisitions/consolidate
 *
 * Creates a consolidated requisition from multiple
 * existing requisitions.
 *
 * IMPORTANT:
 *
 * Creating a consolidated requisition does NOT mean
 * approving it.
 *
 * The new requisition still enters the appropriate
 * approval workflow.
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
      !canCreateConsolidatedRequisition(
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

    const body = await request.json();

    const {
      requisitionIds,
      purpose,
      urgency,
      category,
    } = body;

    /*
     * --------------------------------------------------
     * BASIC VALIDATION
     * --------------------------------------------------
     */

    if (
      !Array.isArray(requisitionIds) ||
      requisitionIds.length === 0
    ) {
      return NextResponse.json(
        {
          message:
            "Select at least one requisition to consolidate.",
        },
        {
          status: 400,
        }
      );
    }

    await connectDB();

    /*
     * --------------------------------------------------
     * AUTHORIZATION
     * --------------------------------------------------
     *
     * This is important.
     *
     * We do not trust the requisition IDs sent by
     * the browser.
     *
     * Every selected requisition is checked against
     * the user's actual organizational scope.
     */

    const selectedRequisitions =
      await validateConsolidationSelection({
        user: {
          id: auth.sub,
          role: auth.role,
          collegeId: auth.collegeId,
          facultyId: auth.facultyId,
          department: auth.department,
        },

        requisitionIds,
      });

    /*
     * --------------------------------------------------
     * BUILD CONSOLIDATED ITEMS
     * --------------------------------------------------
     *
     * Every item retains its originating department.
     */

    const items =
      buildConsolidatedItems(
        selectedRequisitions
      );

    if (items.length === 0) {
      return NextResponse.json(
        {
          message:
            "The selected requisitions contain no items.",
        },
        {
          status: 400,
        }
      );
    }

    /*
     * --------------------------------------------------
     * REQUESTING UNITS
     * --------------------------------------------------
     */

    const requestingUnits =
      buildRequestingUnits(
        selectedRequisitions
      );

    /*
     * --------------------------------------------------
     * ESTIMATED COST
     * --------------------------------------------------
     */

    const estimatedCost =
      items.reduce(
        (sum, item) =>
          sum +
          Number(
            item.totalCost || 0
          ),
        0
      );

    /*
     * --------------------------------------------------
     * ORGANIZATIONAL SNAPSHOT
     * --------------------------------------------------
     *
     * A consolidated requisition can represent many
     * organizational units, so the normal single
     * college/faculty/department fields are not used
     * as the primary organizational source.
     */

    const firstUnit =
      requestingUnits[0];

    /*
     * --------------------------------------------------
     * CREATE CONSOLIDATED REQUISITION
     * --------------------------------------------------
     */

    const requisition =
      await Requisition.create({
        requester: auth.sub,

        requesterRole:
          auth.role,

        isConsolidated: true,

        sourceRequisitions:
          selectedRequisitions.map(
            (r) => r._id
          ),

        consolidatedBy:
          auth.sub,

        requestingUnits,

        /*
         * These fields are optional for consolidated
         * requisitions according to the model.
         *
         * We populate them with the first unit only
         * for compatibility with existing code.
         */
        collegeId:
          firstUnit?.collegeId,

        facultyId:
          firstUnit?.facultyId,

        department:
          firstUnit?.department,

        category:
          category || "Other",

        purpose:
          purpose ||
          "Consolidated institutional requirements.",

        urgency:
          urgency || "normal",

        items,

        estimatedCost,

        status:
          REQUISITION_STATUS.DRAFT,

        currentStepIndex: 0,

        awaitingRequesterAction: false,

        /*
         * Procurement processing starts only after
         * the approval workflow reaches Procurement.
         */
        procurementStatus:
          undefined,

        procurementOfficer:
          undefined,

        procurementReceivedAt:
          undefined,

        procurementStartedAt:
          undefined,

        procurementCompletedAt:
          undefined,
      });

    /*
     * --------------------------------------------------
     * MARK SOURCE REQUISITIONS
     * --------------------------------------------------
     *
     * We do NOT delete or approve the original
     * requisitions.
     *
     * They remain available as historical records.
     *
     * The new consolidated requisition simply records
     * their IDs in sourceRequisitions.
     */

    /*
     * --------------------------------------------------
     * RESPONSE
     * --------------------------------------------------
     */

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
      "Consolidation POST error:",
      error
    );

    return NextResponse.json(
      {
        message:
          error.message ||
          "Failed to create consolidated requisition.",
      },
      {
        status: 500,
      }
    );
  }
          }
