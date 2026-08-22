import Requisition from "@/models/Requisition";
import { ROLES } from "@/constants/roles";

/*
 * --------------------------------------------------
 * CONSOLIDATION AUTHORIZATION
 * --------------------------------------------------
 *
 * Determines whether a user is allowed to create
 * a consolidated requisition.
 *
 * Dean:
 *   Can consolidate requisitions within their faculty.
 *
 * Provost:
 *   Can consolidate requisitions within their college.
 *
 * VC:
 *   Can consolidate university-wide.
 *
 * Procurement:
 *   Can consolidate requirements from multiple
 *   colleges/faculties/departments.
 *
 * Requester/HOD:
 *   Cannot create consolidated requisitions.
 */

export function canCreateConsolidatedRequisition(role) {
  return [
    ROLES.DEAN,
    ROLES.PROVOST,
    ROLES.VC,
    ROLES.PROCUREMENT,
  ].includes(role);
}

/*
 * --------------------------------------------------
 * ORGANIZATIONAL SCOPE
 * --------------------------------------------------
 *
 * Returns the scope that a user is allowed to
 * consolidate.
 */

export function getConsolidationScope(user) {
  if (!user) {
    return {
      type: "none",
      collegeId: null,
      facultyId: null,
    };
  }

  switch (user.role) {
    case ROLES.DEAN:
      return {
        type: "faculty",
        collegeId: user.collegeId,
        facultyId: user.facultyId,
      };

    case ROLES.PROVOST:
      return {
        type: "college",
        collegeId: user.collegeId,
        facultyId: null,
      };

    case ROLES.VC:
      return {
        type: "university",
        collegeId: null,
        facultyId: null,
      };

    case ROLES.PROCUREMENT:
      return {
        type: "procurement",
        collegeId: null,
        facultyId: null,
      };

    default:
      return {
        type: "none",
        collegeId: null,
        facultyId: null,
      };
  }
}

/*
 * --------------------------------------------------
 * CHECK WHETHER A REQUISITION IS WITHIN SCOPE
 * --------------------------------------------------
 */

export function requisitionIsWithinScope({
  requisition,
  user,
}) {
  if (!requisition || !user) {
    return false;
  }

  const scope = getConsolidationScope(user);

  /*
   * Procurement can work across the university.
   */
  if (scope.type === "procurement") {
    return true;
  }

  /*
   * VC has university-wide scope.
   */
  if (scope.type === "university") {
    return true;
  }

  /*
   * Provost can consolidate requisitions
   * belonging to their college.
   */
  if (scope.type === "college") {
    return (
      String(requisition.collegeId) ===
      String(scope.collegeId)
    );
  }

  /*
   * Dean can consolidate requisitions
   * belonging to their faculty.
   */
  if (scope.type === "faculty") {
    return (
      String(requisition.collegeId) ===
        String(scope.collegeId) &&
      String(requisition.facultyId) ===
        String(scope.facultyId)
    );
  }

  return false;
}

/*
 * --------------------------------------------------
 * GET CONSOLIDATABLE REQUISITIONS
 * --------------------------------------------------
 *
 * Returns requisitions that a Dean, Provost, VC,
 * or Procurement Officer may select for consolidation.
 *
 * We intentionally restrict this to requisitions
 * that have already entered the approval workflow.
 *
 * Drafts are never consolidated.
 */

export async function getConsolidatableRequisitions(user) {
  if (!canCreateConsolidatedRequisition(user.role)) {
    return [];
  }

  const candidates = await Requisition.find({
    status: {
      $in: ["pending", "approved"],
    },

    /*
     * A consolidated requisition should not itself
     * be selected again.
     */
    isConsolidated: {
      $ne: true,
    },

    /*
     * Returned requisitions waiting for requester
     * action should not be selected.
     */
    awaitingRequesterAction: {
      $ne: true,
    },
  })
    .populate(
      "requester",
      "fullName email role collegeId facultyId department"
    )
    .sort({
      createdAt: -1,
    })
    .lean();

  return candidates.filter((requisition) =>
    requisitionIsWithinScope({
      requisition,
      user,
    })
  );
}

/*
 * --------------------------------------------------
 * VALIDATE SELECTED REQUISITIONS
 * --------------------------------------------------
 *
 * Before creating a consolidated requisition,
 * verify that every selected requisition is actually
 * accessible to the user.
 */

export async function validateConsolidationSelection({
  user,
  requisitionIds,
}) {
  if (!canCreateConsolidatedRequisition(user.role)) {
    throw new Error(
      "Your role is not authorized to create consolidated requisitions."
    );
  }

  if (
    !Array.isArray(requisitionIds) ||
    requisitionIds.length === 0
  ) {
    throw new Error(
      "Select at least one requisition to consolidate."
    );
  }

  const uniqueIds = [
    ...new Set(
      requisitionIds.map((id) =>
        String(id)
      )
    ),
  ];

  const requisitions =
    await Requisition.find({
      _id: {
        $in: uniqueIds,
      },

      status: {
        $in: ["pending", "approved"],
      },

      isConsolidated: {
        $ne: true,
      },

      awaitingRequesterAction: {
        $ne: true,
      },
    }).lean();

  if (
    requisitions.length !==
    uniqueIds.length
  ) {
    throw new Error(
      "One or more selected requisitions are invalid or unavailable for consolidation."
    );
  }

  for (const requisition of requisitions) {
    if (
      !requisitionIsWithinScope({
        requisition,
        user,
      })
    ) {
      throw new Error(
        "You are not authorized to consolidate one or more of the selected requisitions."
      );
    }
  }

  return requisitions;
}

/*
 * --------------------------------------------------
 * BUILD CONSOLIDATED ITEMS
 * --------------------------------------------------
 *
 * Every item keeps its originating organizational
 * information.
 *
 * Example:
 *
 * Computer
 *   Computer Science
 *   Quantity: 10
 *
 * Computer
 *   Electrical Engineering
 *   Quantity: 8
 */

export function buildConsolidatedItems(
  requisitions
) {
  const items = [];

  for (const requisition of requisitions) {
    for (const item of requisition.items || []) {
      items.push({
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
          Number(item.totalCost || 0),
      });
    }
  }

  return items;
}

/*
 * --------------------------------------------------
 * BUILD REQUESTING UNITS
 * --------------------------------------------------
 *
 * Creates a unique list of all organizational units
 * represented in the consolidated requisition.
 */

export function buildRequestingUnits(
  requisitions
) {
  const map = new Map();

  for (const requisition of requisitions) {
    const key = [
      requisition.collegeId || "",
      requisition.facultyId || "",
      requisition.department || "",
    ].join("|");

    if (!map.has(key)) {
      map.set(key, {
        collegeId:
          requisition.collegeId,

        facultyId:
          requisition.facultyId,

        department:
          requisition.department,
      });
    }
  }

  return Array.from(map.values());
  }
