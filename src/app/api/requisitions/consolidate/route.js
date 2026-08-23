import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { verifyToken } from "@/lib/auth";
import { connectDB } from "@/lib/db";

import Requisition from "@/models/Requisition";
import AuditLog from "@/models/AuditLog";

import { ROLES } from "@/constants/roles";
import { REQUISITION_STATUS, URGENCY_LEVELS } from "@/constants/requisitionOptions";

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

// Kept in sync with the canonical urgency levels used across the app,
// instead of a separately-maintained list that can drift out of sync.
const ALLOWED_URGENCIES = URGENCY_LEVELS.map((u) => u.value);

/*
 * --------------------------------------------------
 * POST /api/requisitions/consolidate
 * --------------------------------------------------
 *
 * Creates ONE new requisition from multiple
 * existing requisitions.
 */
export async function POST(request) {
  const auth = getAuth();

  if (!auth) {
    return NextResponse.json(
      { message: "Unauthorized" },
      { status: 401 }
    );
  }

  if (!CONSOLIDATION_ROLES.includes(auth.role)) {
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
      category: providedCategory,
      urgency,
      purpose,
    } = body;

    /*
     * --------------------------------------------------
     * BASIC VALIDATION
     * --------------------------------------------------
     */

    if (!Array.isArray(requisitionIds) || requisitionIds.length === 0) {
      return NextResponse.json(
        { message: "Select at least one requisition." },
        { status: 400 }
      );
    }

    // Prevent duplicate IDs.
    const uniqueIds = [...new Set(requisitionIds.map((id) => String(id)))];
    if (uniqueIds.length !== requisitionIds.length) {
      return NextResponse.json(
        { message: "A requisition cannot be selected more than once." },
        { status: 400 }
      );
    }

    if (!purpose?.trim()) {
      return NextResponse.json(
        { message: "A purpose is required." },
        { status: 400 }
      );
    }

    if (!providedCategory?.trim()) {
      return NextResponse.json(
        { message: "Category is required." },
        { status: 400 }
      );
    }

    // Validate urgency if provided, or make it required.
    if (!urgency?.trim()) {
      return NextResponse.json(
        { message: "Urgency is required." },
        { status: 400 }
      );
    }
    if (!ALLOWED_URGENCIES.includes(urgency.toLowerCase())) {
      return NextResponse.json(
        { message: `Urgency must be one of: ${ALLOWED_URGENCIES.join(", ")}.` },
        { status: 400 }
      );
    }

    await connectDB();

    /*
     * --------------------------------------------------
     * LOAD SOURCE REQUISITIONS
     * --------------------------------------------------
     */

    const sourceRequisitions = await Requisition.find({
      _id: { $in: uniqueIds },
      status: {
        $in: [
          REQUISITION_STATUS.PENDING,
          REQUISITION_STATUS.RETURNED,
          REQUISITION_STATUS.APPROVED,
        ],
      },
      isConsolidated: { $ne: true },
      consolidatedInto: { $exists: false },
    }).lean();

    if (sourceRequisitions.length !== uniqueIds.length) {
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
     * CATEGORY CONSISTENCY CHECK
     * --------------------------------------------------
     */
    const sourceCategories = [
      ...new Set(sourceRequisitions.map((r) => r.category)),
    ];
    // Filter out undefined/null categories, though they shouldn't happen.
    const validSourceCategories = sourceCategories.filter((c) => c != null);
    if (validSourceCategories.length > 1) {
      return NextResponse.json(
        {
          message:
            "All requisitions in a consolidated requisition must belong to the same category.",
        },
        { status: 400 }
      );
    }
    const sourceCategory = validSourceCategories[0]; // all same

    // Ensure the provided category matches the source category.
    if (providedCategory.trim() !== sourceCategory) {
      return NextResponse.json(
        {
          message:
            "Provided category does not match the category of the source requisitions.",
        },
        { status: 400 }
      );
    }

    /*
     * --------------------------------------------------
     * AUTHORITY CHECK
     * --------------------------------------------------
     */
    for (const requisition of sourceRequisitions) {
      if (auth.role === ROLES.DEAN) {
        // Dean must have collegeId and facultyId in the token.
        if (!auth.collegeId || !auth.facultyId) {
          return NextResponse.json(
            {
              message:
                "Dean role is missing required college/faculty information.",
            },
            { status: 403 }
          );
        }
        if (
          String(requisition.collegeId) !== String(auth.collegeId) ||
          String(requisition.facultyId) !== String(auth.facultyId)
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

      if (auth.role === ROLES.PROVOST) {
        if (!auth.collegeId) {
          return NextResponse.json(
            {
              message:
                "Provost role is missing required college information.",
            },
            { status: 403 }
          );
        }
        if (String(requisition.collegeId) !== String(auth.collegeId)) {
          return NextResponse.json(
            {
              message:
                "A Provost can only consolidate requisitions from their own college.",
            },
            { status: 403 }
          );
        }
      }
      // VC, PROCUREMENT, ADMIN have university‑wide access – no additional checks.
    }

    /*
     * --------------------------------------------------
     * BUILD DEPARTMENT-SPECIFIC ITEMS
     * --------------------------------------------------
     */
    const consolidatedItems = [];
    for (const requisition of sourceRequisitions) {
      for (const item of requisition.items || []) {
        consolidatedItems.push({
          name: item.name,
          requestingCollegeId: requisition.collegeId,
          requestingFacultyId: requisition.facultyId,
          requestingDepartment: requisition.department,
          quantity: Number(item.quantity || 0),
          unitCost: Number(item.unitCost || 0),
          totalCost: Number(
            item.totalCost ??
              (Number(item.quantity || 0) * Number(item.unitCost || 0))
          ),
        });
      }
    }

    if (consolidatedItems.length === 0) {
      return NextResponse.json(
        { message: "The selected requisitions contain no items." },
        { status: 400 }
      );
    }

    /*
     * --------------------------------------------------
     * CALCULATE TOTAL
     * --------------------------------------------------
     */
    const estimatedCost = consolidatedItems.reduce(
      (sum, item) => sum + Number(item.totalCost || 0),
      0
    );

    /*
     * --------------------------------------------------
     * ORGANIZATIONAL UNITS (deduplicated)
     * --------------------------------------------------
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
          collegeId: requisition.collegeId,
          facultyId: requisition.facultyId,
          department: requisition.department,
        });
      }
    }
    const requestingUnits = [...unitMap.values()];

    // Derive a shared collegeId/facultyId when every source unit agrees,
    // even if they don't agree on department — this lets the approval
    // chain still route a Dean's (same faculty) or Provost's (same
    // college) multi-unit consolidation correctly. "N/A" only when the
    // units genuinely disagree (Procurement/VC consolidating across
    // colleges), where routing doesn't need a single college anyway.
    const distinctColleges = [
      ...new Set(requestingUnits.map((u) => u.collegeId)),
    ];
    const distinctFaculties = [
      ...new Set(requestingUnits.map((u) => u.facultyId)),
    ];
    const commonCollegeId =
      distinctColleges.length === 1 ? distinctColleges[0] : "N/A";
    const commonFacultyId =
      distinctColleges.length === 1 && distinctFaculties.length === 1
        ? distinctFaculties[0]
        : "N/A";

    const singleUnit =
      requestingUnits.length === 1 ? requestingUnits[0] : null;

    /*
     * --------------------------------------------------
     * CREATE CONSOLIDATED REQUISITION (as DRAFT)
     * --------------------------------------------------
     */
    const consolidated = await Requisition.create({
      requester: auth.sub,
      requesterRole: auth.role,
      isConsolidated: true,
      sourceRequisitions: sourceRequisitions.map((r) => r._id),
      consolidatedBy: auth.sub,
      requestingUnits,
      // If multiple units, store "N/A" at top level – keep as string for compatibility.
      collegeId: commonCollegeId,
      facultyId: commonFacultyId,
      department: singleUnit?.department || "N/A",
      category: sourceCategory, // Use the validated source category.
      purpose: purpose.trim(),
      urgency: urgency.trim().toLowerCase(),
      items: consolidatedItems,
      estimatedCost,
      status: REQUISITION_STATUS.DRAFT,
      awaitingRequesterAction: false,
      currentStepIndex: 0,
      approvalChain: [],
    });

    /*
     * --------------------------------------------------
     * LINK SOURCE REQUISITIONS (with concurrency safety)
     * --------------------------------------------------
     *
     * We use updateMany with an extra condition to ensure that
     * no source has been consolidated by another simultaneous request.
     */
    const updateResult = await Requisition.updateMany(
      {
        _id: { $in: sourceRequisitions.map((r) => r._id) },
        // Only update if they are still eligible (no consolidatedInto yet).
        consolidatedInto: { $exists: false },
        isConsolidated: { $ne: true },
      },
      {
        $set: {
          consolidatedInto: consolidated._id,
          consolidatedAt: new Date(),
        },
      }
    );

    // If not all sources were updated, rollback the new requisition and error.
    if (updateResult.modifiedCount !== sourceRequisitions.length) {
      // Delete the newly created consolidated requisition.
      await Requisition.deleteOne({ _id: consolidated._id });
      return NextResponse.json(
        {
          message:
            "One or more requisitions were consolidated by another request. Please try again.",
        },
        { status: 409 } // Conflict
      );
    }

    /*
     * --------------------------------------------------
     * AUDIT LOG
     * --------------------------------------------------
     */
    await AuditLog.create({
      actor: auth.sub,
      action: "requisition.consolidated_create",
      entityType: "Requisition",
      entityId: consolidated._id,
      details: {
        requesterRole: auth.role,
        sourceRequisitions: sourceRequisitions.map((r) => String(r._id)),
        requestingUnits,
        itemCount: consolidatedItems.length,
        estimatedCost,
      },
    });

    return NextResponse.json(
      { requisition: consolidated },
      { status: 201 }
    );
  } catch (error) {
    console.error("Consolidated requisition error:", error);
    return NextResponse.json(
      { message: error.message || "Failed to create consolidated requisition." },
      { status: 500 }
    );
  }
  }
