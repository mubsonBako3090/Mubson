import Requisition from "@/models/Requisition";
import AuditLog from "@/models/AuditLog";
import User from "@/models/User";

import { ROLES } from "@/constants/roles";
import {
  REQUISITION_STATUS,
} from "@/constants/requisitionOptions";

import {
  buildApprovalChain,
} from "@/lib/routing";

/*
 * --------------------------------------------------
 * HELPERS
 * --------------------------------------------------
 */

function calculateItemTotal(item) {
  return (
    Number(item.quantity || 0) *
    Number(item.unitCost || 0)
  );
}

function calculateTotalCost(items = []) {
  return items.reduce(
    (total, item) =>
      total + calculateItemTotal(item),
    0
  );
}

/*
 * --------------------------------------------------
 * ROLE PERMISSION
 * --------------------------------------------------
 *
 * Only these roles can create a consolidated
 * requisition.
 */

const CONSOLIDATION_ROLES = [
  ROLES.DEAN,
  ROLES.PROVOST,
  ROLES.VC,
  ROLES.PROCUREMENT,
];

/*
 * --------------------------------------------------
 * CAN CONSOLIDATE?
 * --------------------------------------------------
 */

export function canCreateConsolidatedRequisition(
  role
) {
  return CONSOLIDATION_ROLES.includes(role);
}

/*
 * --------------------------------------------------
 * ORGANIZATIONAL ACCESS
 * --------------------------------------------------
 *
 * Determines whether the user is allowed to
 * consolidate a particular requisition.
 *
 * Dean:
 *   Only requisitions belonging to the Dean's
 *   faculty.
 *
 * Provost:
 *   Requisitions belonging to the Provost's college.
 *
 * VC:
 *   University-wide.
 *
 * Procurement:
 *   University-wide.
 */

function canAccessRequisition(
  requisition,
  user
) {
  if (user.role === ROLES.VC) {
    return true;
  }

  if (
    user.role ===
    ROLES.PROCUREMENT
  ) {
    return true;
  }

  if (
    user.role === ROLES.DEAN
  ) {
    return (
      String(
        requisition.facultyId
      ) ===
        String(user.facultyId) &&
      String(
        requisition.collegeId
      ) ===
        String(user.collegeId)
    );
  }

  if (
    user.role === ROLES.PROVOST
  ) {
    return (
      String(
        requisition.collegeId
      ) ===
      String(user.collegeId)
    );
  }

  return false;
}

/*
 * --------------------------------------------------
 * CREATE CONSOLIDATED REQUISITION
 * --------------------------------------------------
 *
 * sourceRequisitionIds:
 *   Array of existing requisition IDs.
 *
 * user:
 *   Currently authenticated user.
 */

export async function createConsolidatedRequisition({
  sourceRequisitionIds,
  user,
}) {
  if (
    !canCreateConsolidatedRequisition(
      user.role
    )
  ) {
    throw new Error(
      "Your role is not authorized to create consolidated requisitions."
    );
  }

  if (
    !Array.isArray(
      sourceRequisitionIds
    ) ||
    sourceRequisitionIds.length === 0
  ) {
    throw new Error(
      "Select at least one requisition to consolidate."
    );
  }

  /*
   * Remove duplicate IDs.
   */

  const uniqueIds = [
    ...new Set(
      sourceRequisitionIds.map(
        (id) => String(id)
      )
    ),
  ];

  /*
   * Fetch source requisitions.
   */

  const sourceRequisitions =
    await Requisition.find({
      _id: {
        $in: uniqueIds,
      },
    })
      .populate(
        "requester",
        "fullName email role"
      )
      .lean();

  if (
    sourceRequisitions.length !==
    uniqueIds.length
  ) {
    throw new Error(
      "One or more selected requisitions could not be found."
    );
  }

  /*
   * --------------------------------------------------
   * VALIDATE SOURCE REQUISITIONS
   * --------------------------------------------------
   */

  for (const requisition of sourceRequisitions) {
    /*
     * Only submitted requisitions should be
     * consolidated.
     *
     * Drafts should not enter the consolidation
     * process.
     */

    if (
      requisition.status ===
      REQUISITION_STATUS.DRAFT
    ) {
      throw new Error(
        `Requisition ${
          requisition.requisitionNumber ||
          requisition._id
        } is still a draft.`
      );
    }

    /*
     * Do not consolidate an already consolidated
     * requisition again.
     */

    if (
      requisition.isConsolidated
    ) {
      throw new Error(
        `Requisition ${
          requisition.requisitionNumber ||
          requisition._id
        } is already consolidated.`
      );
    }

    /*
     * Check organizational authority.
     */

    if (
      !canAccessRequisition(
        requisition,
        user
      )
    ) {
      throw new Error(
        `You are not authorized to consolidate requisition ${
          requisition.requisitionNumber ||
          requisition._id
        }.`
      );
    }
  }

  /*
   * --------------------------------------------------
   * BUILD ITEM BREAKDOWN
   * --------------------------------------------------
   *
   * Every item keeps the department that requested it.
   *
   * Example:
   *
   * Laptop
   * Computer Science
   * Quantity: 10
   *
   * Laptop
   * Software Engineering
   * Quantity: 7
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
          Number(
            item.quantity || 0
          ),

        unitCost:
          Number(
            item.unitCost || 0
          ),

        totalCost:
          calculateItemTotal(item),
      });
    }
  }

  if (
    consolidatedItems.length === 0
  ) {
    throw new Error(
      "The selected requisitions do not contain any items."
    );
  }

  /*
   * --------------------------------------------------
   * REQUESTING UNITS
   * --------------------------------------------------
   */

  const requestingUnitsMap =
    new Map();

  for (const requisition of sourceRequisitions) {
    const key = [
      requisition.collegeId,
      requisition.facultyId,
      requisition.department,
    ].join("|");

    if (
      !requestingUnitsMap.has(key)
    ) {
      requestingUnitsMap.set(
        key,
        {
          collegeId:
            requisition.collegeId,

          facultyId:
            requisition.facultyId,

          department:
            requisition.department,
        }
      );
    }
  }

  const requestingUnits = [
    ...requestingUnitsMap.values(),
  ];

  /*
   * --------------------------------------------------
   * ESTIMATED COST
   * --------------------------------------------------
   */

  const estimatedCost =
    calculateTotalCost(
      consolidatedItems
    );

  /*
   * --------------------------------------------------
   * CREATE CONSOLIDATED REQUISITION
   * --------------------------------------------------
   *
   * We do NOT use a source requisition's requester
   * as the requester.
   *
   * The person performing the consolidation becomes
   * the requester/creator of the consolidated record.
   */

  const consolidated =
    await Requisition.create({
      requester: user.id,

      requesterRole:
        user.role,

      isConsolidated: true,

      sourceRequisitions:
        sourceRequisitions.map(
          (r) => r._id
        ),

      consolidatedBy:
        user.id,

      requestingUnits,

      /*
       * Consolidated requisitions do not have one
       * single organizational owner.
       *
       * These fields are therefore not used for the
       * consolidated record.
       */

      category:
        "Consolidated Requirements",

      purpose:
        `Consolidated requirements from ${requestingUnits.length} organizational unit(s).`,

      urgency:
        determineHighestUrgency(
          sourceRequisitions
        ),

      items:
        consolidatedItems,

      estimatedCost,

      status:
        REQUISITION_STATUS.DRAFT,

      approvalChain: [],

      currentStepIndex: 0,

      awaitingRequesterAction:
        false,

      requiresGovernorApproval:
        false,
    });

  /*
   * --------------------------------------------------
   * AUDIT LOG
   * --------------------------------------------------
   */

  await AuditLog.create({
    actor: user.id,

    action:
      "requisition.consolidated_create",

    entityType:
      "Requisition",

    entityId:
      consolidated._id,

    details: {
      sourceRequisitions:
        sourceRequisitions.map(
          (r) =>
            r.requisitionNumber ||
            String(r._id)
        ),

      requestingUnits,

      estimatedCost,

      consolidatedByRole:
        user.role,
    },
  });

  return consolidated;
}

/*
 * --------------------------------------------------
 * HIGHEST URGENCY
 * --------------------------------------------------
 */

function determineHighestUrgency(
  requisitions
) {
  const priority = {
    urgent: 4,
    high: 3,
    normal: 2,
    low: 1,
  };

  let highest = "normal";
  let highestValue =
    priority.normal;

  for (const requisition of requisitions) {
    const value =
      priority[
        requisition.urgency
      ] || 0;

    if (value > highestValue) {
      highestValue = value;
      highest =
        requisition.urgency;
    }
  }

  return highest;
    }
