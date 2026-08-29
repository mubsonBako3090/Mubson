import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { verifyToken } from "@/lib/auth";
import { connectDB } from "@/lib/db";

import Requisition from "@/models/Requisition";
import AuditLog from "@/models/AuditLog";

import { REQUISITION_STATUS } from "@/constants/requisitionOptions";

function getAuth() {
  const token = cookies().get("token")?.value;
  return token ? verifyToken(token) : null;
}

/*
 * --------------------------------------------------
 * POST /api/requisitions/[id]/detach-source
 * --------------------------------------------------
 *
 * Drops ONE source requisition from a still-draft
 * consolidated requisition (the review step before
 * "Send to Next Approver"). The dropped source is
 * restored to being independently pending again — its
 * own approvalChain/currentStepIndex were never touched
 * while it was folded in, so it resumes exactly where it
 * was.
 *
 * If that was the last remaining source, the now-empty
 * consolidated draft is deleted outright rather than left
 * behind as a shell with nothing in it.
 */
export async function POST(request, { params }) {
  const auth = getAuth();

  if (!auth) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { sourceRequisitionId } = body;

    if (!sourceRequisitionId) {
      return NextResponse.json(
        { message: "sourceRequisitionId is required." },
        { status: 400 }
      );
    }

    await connectDB();

    const requisition = await Requisition.findOne({
      _id: params.id,
      requester: auth.sub,
    });

    if (!requisition) {
      return NextResponse.json(
        { message: "Requisition not found." },
        { status: 404 }
      );
    }

    if (!requisition.isConsolidated) {
      return NextResponse.json(
        { message: "This requisition is not a consolidated requisition." },
        { status: 400 }
      );
    }

    if (requisition.status !== REQUISITION_STATUS.DRAFT) {
      return NextResponse.json(
        {
          message:
            "This consolidated requisition has already been sent and can no longer be edited here.",
        },
        { status: 400 }
      );
    }

    const stillIncluded = requisition.sourceRequisitions.some(
      (id) => String(id) === String(sourceRequisitionId)
    );

    if (!stillIncluded) {
      return NextResponse.json(
        { message: "That requisition is not part of this consolidation." },
        { status: 400 }
      );
    }

    /*
     * Remove the source and every item tagged to it.
     */
    requisition.sourceRequisitions = requisition.sourceRequisitions.filter(
      (id) => String(id) !== String(sourceRequisitionId)
    );

    requisition.items = requisition.items.filter(
      (item) => String(item.sourceRequisitionId) !== String(sourceRequisitionId)
    );

    /*
     * Restore the detached source to independent pending
     * status — visible again in approval queues and in the
     * consolidate listing, right where it left off.
     */
    await Requisition.findByIdAndUpdate(sourceRequisitionId, {
      $unset: { consolidatedInto: "", consolidatedAt: "" },
    });

    await AuditLog.create({
      actor: auth.sub,
      action: "requisition.consolidated_detach_source",
      entityType: "Requisition",
      entityId: requisition._id,
      details: { detachedSource: String(sourceRequisitionId) },
    });

    /*
     * Nothing left to consolidate — delete the empty draft
     * rather than leave a shell behind.
     */
    if (requisition.sourceRequisitions.length === 0) {
      await Requisition.deleteOne({ _id: requisition._id });

      return NextResponse.json({ deleted: true });
    }

    /*
     * Re-derive requestingUnits and the top-level
     * collegeId/facultyId/department from what's left,
     * mirroring the same logic used at creation time.
     */
    const unitMap = new Map();
    for (const item of requisition.items) {
      const key = [
        item.requestingCollegeId,
        item.requestingFacultyId,
        item.requestingDepartment,
      ].join("|");

      if (!unitMap.has(key)) {
        unitMap.set(key, {
          collegeId: item.requestingCollegeId,
          facultyId: item.requestingFacultyId,
          department: item.requestingDepartment,
        });
      }
    }
    const requestingUnits = [...unitMap.values()];

    const distinctColleges = [...new Set(requestingUnits.map((u) => u.collegeId))];
    const distinctFaculties = [...new Set(requestingUnits.map((u) => u.facultyId))];

    const commonCollegeId = distinctColleges.length === 1 ? distinctColleges[0] : "N/A";
    const commonFacultyId =
      distinctColleges.length === 1 && distinctFaculties.length === 1
        ? distinctFaculties[0]
        : "N/A";

    requisition.requestingUnits = requestingUnits;
    requisition.collegeId = commonCollegeId;
    requisition.facultyId = commonFacultyId;
    requisition.department =
      requestingUnits.length === 1 ? requestingUnits[0].department : "N/A";
    requisition.isConsolidated = requestingUnits.length > 1;

    requisition.estimatedCost = requisition.items.reduce(
      (sum, item) => sum + Number(item.totalCost || 0),
      0
    );

    await requisition.save();

    return NextResponse.json({ requisition });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { message: err.message || "Failed to detach requisition." },
      { status: 500 }
    );
  }
        }
