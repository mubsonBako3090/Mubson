import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { verifyToken } from "@/lib/auth";
import { connectDB } from "@/lib/db";

import Requisition from "@/models/Requisition";
import AuditLog from "@/models/AuditLog";

import { ROLES } from "@/constants/roles";
import {
  REQUISITION_STATUS,
} from "@/constants/requisitionOptions";

function getAuth() {
  const token = cookies().get("token")?.value;
  return token ? verifyToken(token) : null;
}

/*
 * --------------------------------------------------
 * ALLOWED CONSOLIDATION ROLES
 * --------------------------------------------------
 */
const CONSOLIDATION_ROLES = [
  ROLES.DEAN,
  ROLES.PROVOST,
  ROLES.VC,
  ROLES.PROCUREMENT,
  ROLES.ADMIN,
];

/*
 * --------------------------------------------------
 * POST /api/requisitions/consolidate
 * --------------------------------------------------
 *
 * Creates ONE new requisition from multiple
 * existing requisitions.
 *
 * Example:
 *
 * College A
 *   Faculty X
 *     Computer Science
 *       Printer x 3
 *
 * College B
 *   Faculty Y
 *     Mathematics
 *       Printer x 4
 *
 * becomes:
 *
 * ONE consolidated requisition
 *
 * Items:
 *
 * Printer
 *   Computer Science -> 3
 *   Mathematics      -> 4
 */
export async function POST(request) {
  const auth = getAuth();

  if (!auth) {
    return NextResponse.json(
      { message: "Unauthorized" },
      { status: 401 }
    );
  }

  if (
    !CONSOLIDATION_ROLES.includes(
      auth.role
    )
  ) {
    return NextResponse.json(
      {
        message:
          "Your role is not authorized to create consolidated requisitions.",
      },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();

    const {
      requisitionIds,
      category,
      urgency,
      purpose,
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
            "Select at least one requisition.",
        },
        { status: 400 }
      );
    }

    /*
     * Prevent duplicate IDs.
     */
    const uniqueIds = [
      ...new Set(
        requisitionIds.map((id) =>
          String(id)
        )
      ),
    ];

    if (
      uniqueIds.length !==
      requisitionIds.length
    ) {
      return NextResponse.json(
        {
          message:
            "A requisition cannot be selected more than once.",
        },
        { status: 400 }
      );
    }

    if (!purpose?.trim()) {
      return NextResponse.json(
        {
          message:
            "A purpose is required.",
        },
        { status: 400 }
      );
    }

    await connectDB();

    /*
     * --------------------------------------------------
     * LOAD SOURCE REQUISITIONS
     * --------------------------------------------------
     */

    const sourceRequisitions =
      await Requisition.find({
        _id: {
          $in: uniqueIds,
        },

        status: {
          $in: [
            REQUISITION_STATUS.PENDING,
            REQUISITION_STATUS.RETURNED,
            REQUISITION_STATUS.APPROVED,
          ],
        },

        isConsolidated: {
          $ne: true,
        },

        consolidatedInto: {
          $exists: false,
        },
      }).lean();

    /*
     * Every selected requisition must exist.
     */
    if (
      sourceRequisitions.length !==
      uniqueIds.length
    ) {
      return NextResponse.json(
        {
          message:
            "One or more selected requisitions are no longer eligible for consolidation.",
        },
        { status: 400 }
      );
    }

    /*
     * --------------------------------------------------
     * AUTHORITY CHECK
     * --------------------------------------------------
     *
     * This is extremely important.
     *
     * The frontend may display certain requisitions,
     * but the API must enforce the same restriction.
     */

    for (const requisition of sourceRequisitions) {
      /*
       * DEAN
       *
       * Same college AND same faculty.
       */
      if (auth.role === ROLES.DEAN) {
        if (
          String(
            requisition.collegeId
          ) !== String(auth.collegeId) ||
          String(
            requisition.facultyId
          ) !== String(auth.facultyId)
        ) {
          return NextResponse.json(
            {
              message:
                "A Dean can only consolidate requisitions from their own faculty.",
            },
            { status: 403 }
          );
        }
      }

      /*
       * PROVOST
       *
       * Same college.
       */
      if (auth.role === ROLES.PROVOST) {
        if (
          String(
            requisition.collegeId
          ) !== String(auth.collegeId)
        ) {
          return NextResponse.json(
            {
              message:
                "A Provost can only consolidate requisitions from their own college.",
            },
            { status: 403 }
          );
        }
      }

      /*
       * VC
       *
       * University-wide.
       */

      /*
       * PROCUREMENT
       *
       * University-wide.
       */

      /*
       * ADMIN
       *
       * University-wide.
       */
    }

    /*
     * --------------------------------------------------
     * BUILD DEPARTMENT-SPECIFIC ITEMS
     * --------------------------------------------------
     *
     * We DO NOT simply merge identical item names.
     *
     * Each source item remains traceable to its
     * original organizational unit.
     *
     * Example:
     *
     * Printer — Computer Science — 3
     * Printer — Mathematics — 4
     *
     * Both remain separate records.
     */

    const consolidatedItems = [];

    for (const requisition of sourceRequisitions) {
      for (const item of requisition.items || []) {
        consolidatedItems.push({
          name: item.name,

          requestingCollegeId:
            requisition.collegeId,

          requestingFacultyId:
            requisition.facultyId,

          requestingDepartment:
            requisition.department,

          quantity:
            Number(item.quantity || 0),

          unitCost:
            Number(item.unitCost || 0),

          totalCost:
            Number(
              item.totalCost ??
                (
                  Number(item.quantity || 0) *
                  Number(item.unitCost || 0)
                )
            ),
        });
      }
    }

    if (
      consolidatedItems.length === 0
    ) {
      return NextResponse.json(
        {
          message:
            "The selected requisitions contain no items.",
        },
        { status: 400 }
      );
    }

    /*
     * --------------------------------------------------
     * CALCULATE TOTAL
     * --------------------------------------------------
     */

    const estimatedCost =
      consolidatedItems.reduce(
        (sum, item) =>
          sum +
          Number(
            item.totalCost || 0
          ),
        0
      );

    /*
     * --------------------------------------------------
     * ORGANIZATIONAL UNITS
     * --------------------------------------------------
     *
     * Remove duplicates.
     */

    const unitMap = new Map();

    for (const requisition of sourceRequisitions) {
      const key = [
        requisition.collegeId,
        requisition.facultyId,
        requisition.department,
      ].join("|");

      if (!unitMap.has(key)) {
        unitMap.set(key, {
          collegeId:
            requisition.collegeId,

          facultyId:
            requisition.facultyId,

          department:
            requisition.department,
        });
      }
    }

    const requestingUnits = [
      ...unitMap.values(),
    ];

    /*
     * --------------------------------------------------
     * TOP-LEVEL ORGANIZATION
     * --------------------------------------------------
     *
     * A consolidated requisition can represent
     * multiple organizations.
     *
     * Therefore:
     *
     * collegeId/facultyId/department
     *
     * are only populated when the consolidated
     * requisition represents exactly one unit.
     *
     * The detailed organization is stored in:
     *
     * requestingUnits
     *
     * and each item also contains its source.
     */

    const singleUnit =
      requestingUnits.length === 1
        ? requestingUnits[0]
        : null;

    /*
     * --------------------------------------------------
     * CREATE CONSOLIDATED REQUISITION
     * --------------------------------------------------
     *
     * IMPORTANT:
     *
     * It starts as a DRAFT.
     *
     * The creator can review it before submitting.
     */
    const consolidated =
      await Requisition.create({
        requester: auth.sub,

        requesterRole:
          auth.role,

        isConsolidated: true,

        sourceRequisitions:
          sourceRequisitions.map(
            (r) => r._id
          ),

        consolidatedBy:
          auth.sub,

        requestingUnits,

        /*
         * If multiple colleges/faculties are
         * represented, use N/A at the top level.
         *
         * The actual source organization remains
         * available in requestingUnits and items.
         */
        collegeId:
          singleUnit?.collegeId ||
          "N/A",

        facultyId:
          singleUnit?.facultyId ||
          "N/A",

        department:
          singleUnit?.department ||
          "N/A",

        category,

        purpose: purpose.trim(),

        urgency,

        items:
          consolidatedItems,

        estimatedCost,

        status:
          REQUISITION_STATUS.DRAFT,

        awaitingRequesterAction:
          false,

        currentStepIndex: 0,

        approvalChain: [],
      });

    /*
     * --------------------------------------------------
     * LINK SOURCE REQUISITIONS
     * --------------------------------------------------
     *
     * Mark the source requisitions so they cannot
     * accidentally be consolidated again.
     */
    await Requisition.updateMany(
      {
        _id: {
          $in: sourceRequisitions.map(
            (r) => r._id
          ),
        },
      },
      {
        $set: {
          consolidatedInto:
            consolidated._id,

          consolidatedAt:
            new Date(),
        },
      }
    );

    /*
     * --------------------------------------------------
     * AUDIT LOG
     * --------------------------------------------------
     */

    await AuditLog.create({
      actor: auth.sub,

      action:
        "requisition.consolidated_create",

      entityType:
        "Requisition",

      entityId:
        consolidated._id,

      details: {
        requesterRole:
          auth.role,

        sourceRequisitions:
          sourceRequisitions.map(
            (r) => String(r._id)
          ),

        requestingUnits,

        itemCount:
          consolidatedItems.length,

        estimatedCost,
      },
    });

    return NextResponse.json(
      {
        requisition:
          consolidated,
      },
      { status: 201 }
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
      { status: 500 }
    );
  }
          }
