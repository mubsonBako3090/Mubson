import Requisition from "@/models/Requisition";
import AuditLog from "@/models/AuditLog";
import User from "@/models/User";

import {
  buildApprovalChain,
  isEscalated,
} from "@/lib/routing";
import {
  getCollegeById,
  getFaculty,
} from "@/constants/colleges";
import {
  REQUISITION_STATUS,
} from "@/constants/requisitionOptions";

import { ROLES } from "@/constants/roles";

import {
  sendRequisitionSubmittedEmail,
  sendApprovalStepEmail,
} from "@/lib/mailer";

/*
 * --------------------------------------------------
 * ITEM TOTALS
 * --------------------------------------------------
 */

function computeItemTotals(
  items = []
) {
  return items.map((item) => ({
    ...item,

    totalCost:
      Number(item.quantity || 0) *
      Number(item.unitCost || 0),
  }));
}

function sumEstimatedCost(
  items = []
) {
  return items.reduce(
    (sum, item) =>
      sum +
      Number(
        item.totalCost || 0
      ),
    0
  );
}

/*
 * --------------------------------------------------
 * REQUISITION NUMBER
 * --------------------------------------------------
 */

async function generateRequisitionNumber() {
  const year =
    new Date().getFullYear();

  const count =
    await Requisition.countDocuments(
      {
        requisitionNumber: {
          $regex: `^KSU/REQ/${year}/`,
        },
      }
    );

  const seq = String(
    count + 1
  ).padStart(4, "0");

  return `KSU/REQ/${year}/${seq}`;
}

/*
 * --------------------------------------------------
 * ORGANIZATION
 * --------------------------------------------------
 *
 * Normal requester:
 *
 *   User's own organization
 *
 * Procurement:
 *
 *   Organization selected in the form
 *
 * This is the key Option B change.
 */

function getRequestingOrganization({
  requesterUser,
  payload,
}) {
  const isProcurement =
    requesterUser.role ===
    ROLES.PROCUREMENT;

  if (isProcurement) {
    return {
      collegeId:
        payload.collegeId ||
        "N/A",

      facultyId:
        payload.facultyId ||
        "N/A",

      department:
        payload.department ||
        "N/A",
    };
  }

  /*
   * DEAN can initiate a requisition on behalf of any
   * department within their own faculty.
   *
   * College and faculty are always locked to the Dean's
   * own — never taken from the payload — so a Dean can
   * never route a requisition through a different
   * faculty's approval chain. Only department is chosen
   * from the payload, and it's validated against the
   * Dean's own faculty below.
   */
  if (requesterUser.role === ROLES.DEAN) {
    const faculty = getFaculty(
      requesterUser.collegeId,
      requesterUser.facultyId
    );

    const requestedDepartment =
      payload.department ||
      requesterUser.department;

    const isValidDepartment =
      faculty?.departments?.includes(
        requestedDepartment
      );

    if (!isValidDepartment) {
      throw new Error(
        "Selected department is not part of your faculty."
      );
    }

    return {
      collegeId:
        requesterUser.collegeId,

      facultyId:
        requesterUser.facultyId,

      department:
        requestedDepartment,
    };
  }

  /*
   * PROVOST can initiate a requisition on behalf of any
   * faculty/department within their own college.
   *
   * College is always locked to the Provost's own — never
   * taken from the payload. Faculty and department are
   * chosen from the payload and validated against the
   * Provost's own college below.
   */
  if (requesterUser.role === ROLES.PROVOST) {
    const requestedFacultyId =
      payload.facultyId ||
      requesterUser.facultyId;

    const faculty = getFaculty(
      requesterUser.collegeId,
      requestedFacultyId
    );

    if (!faculty) {
      throw new Error(
        "Selected faculty is not part of your college."
      );
    }

    const requestedDepartment =
      payload.department ||
      requesterUser.department;

    const isValidDepartment =
      faculty.departments?.includes(
        requestedDepartment
      );

    if (!isValidDepartment) {
      throw new Error(
        "Selected department is not part of the selected faculty."
      );
    }

    return {
      collegeId:
        requesterUser.collegeId,

      facultyId:
        requestedFacultyId,

      department:
        requestedDepartment,
    };
  }

  return {
    collegeId:
      requesterUser.collegeId,

    facultyId:
      requesterUser.facultyId,

    department:
      requesterUser.department,
  };
}

/*
 * --------------------------------------------------
 * SAVE DRAFT
 * --------------------------------------------------
 */

export async function saveDraft({
  requisitionId,
  requesterUser,
  payload,
}) {
  const items =
    computeItemTotals(
      payload.items || []
    );

  const estimatedCost =
    sumEstimatedCost(items);

  const organization =
    getRequestingOrganization({
      requesterUser,
      payload,
    });

  const data = {
    category:
      payload.category,

    purpose:
      payload.purpose,

    urgency:
      payload.urgency,

    items,

    estimatedCost,

    requesterRole:
      requesterUser.role,

    collegeId:
      organization.collegeId,

    facultyId:
      organization.facultyId,

    department:
      organization.department,
  };

  let requisition;

  /*
   * --------------------------------------------------
   * UPDATE
   * --------------------------------------------------
   */

  if (requisitionId) {
    requisition =
      await Requisition.findOne({
        _id: requisitionId,

        requester:
          requesterUser.id,
      });

    if (!requisition) {
      throw new Error(
        "Requisition not found."
      );
    }

    const editable =
      requisition.status ===
        REQUISITION_STATUS.DRAFT ||
      (
        requisition.status ===
          REQUISITION_STATUS.RETURNED &&
        requisition.awaitingRequesterAction
      );

    if (!editable) {
      throw new Error(
        "This requisition is not editable."
      );
    }

    requisition.category =
      data.category;

    requisition.purpose =
      data.purpose;

    requisition.urgency =
      data.urgency;

    requisition.items =
      data.items;

    requisition.estimatedCost =
      data.estimatedCost;

    /*
     * Only Procurement may update
     * the requesting organization
     * from the requisition form.
     *
     * For normal users, preserve the
     * original organizational snapshot.
     */
    if (
      requesterUser.role ===
      ROLES.PROCUREMENT
    ) {
      requisition.collegeId =
        data.collegeId;

      requisition.facultyId =
        data.facultyId;

      requisition.department =
        data.department;
    }

    if (
      !requisition.requesterRole
    ) {
      requisition.requesterRole =
        requesterUser.role;
    }

    /*
     * Returned → Draft.
     */
    if (
      requisition.status ===
        REQUISITION_STATUS.RETURNED &&
      requisition.awaitingRequesterAction
    ) {
      requisition.status =
        REQUISITION_STATUS.DRAFT;

      requisition.awaitingRequesterAction =
        false;
    }

    await requisition.save();
  }

  /*
   * --------------------------------------------------
   * CREATE
   * --------------------------------------------------
   */

  else {
    requisition =
      await Requisition.create({
        ...data,

        requester:
          requesterUser.id,

        status:
          REQUISITION_STATUS.DRAFT,
      });
  }

  await AuditLog.create({
    actor:
      requesterUser.id,

    action:
      requisitionId
        ? "requisition.draft_update"
        : "requisition.draft_create",

    entityType:
      "Requisition",

    entityId:
      requisition._id,

    details: {
      requesterRole:
        requesterUser.role,

      requestingCollege:
        requisition.collegeId,

      requestingFaculty:
        requisition.facultyId,

      requestingDepartment:
        requisition.department,
    },
  });

  return requisition;
}

/*
 * --------------------------------------------------
 * SUBMIT
 * --------------------------------------------------
 */

export async function submitRequisition({
  requisitionId,
  requesterUser,
}) {
  const requisition =
    await Requisition.findOne({
      _id: requisitionId,

      requester:
        requesterUser.id,
    });

  if (!requisition) {
    throw new Error(
      "Requisition not found."
    );
  }

  const isFreshDraft =
    requisition.status ===
    REQUISITION_STATUS.DRAFT;

  const isReturnedToRequester =
    requisition.status ===
      REQUISITION_STATUS.RETURNED &&
    requisition.awaitingRequesterAction;

  if (
    !isFreshDraft &&
    !isReturnedToRequester
  ) {
    throw new Error(
      "This requisition is not awaiting your submission."
    );
  }

  /*
   * --------------------------------------------------
   * PROCUREMENT VALIDATION
   * --------------------------------------------------
   *
   * Procurement must explicitly identify
   * the organization whose requirements
   * are being requested.
   */

  const isProcurement =
    requesterUser.role ===
    ROLES.PROCUREMENT;

  if (isProcurement) {
    if (
      !requisition.collegeId ||
      requisition.collegeId ===
        "N/A" ||
      !requisition.facultyId ||
      requisition.facultyId ===
        "N/A" ||
      !requisition.department ||
      requisition.department ===
        "N/A"
    ) {
      throw new Error(
        "Procurement must select the requesting College, Faculty and Department before submitting."
      );
    }
  }

  /*
   * Make sure older records have
   * requesterRole.
   */

  if (
    !requisition.requesterRole
  ) {
    requisition.requesterRole =
      requesterUser.role;
  }

  /*
   * --------------------------------------------------
   * BUILD APPROVAL CHAIN
   * --------------------------------------------------
   */

  const {
    chain,
    requiresGovernorApproval,
  } =
    await buildApprovalChain({
      requesterRole:
        requisition.requesterRole,

      collegeId:
        requisition.collegeId,

      facultyId:
        requisition.facultyId,

      department:
        requisition.department,

      estimatedCost:
        requisition.estimatedCost,
    });

  requisition.approvalChain =
    chain;

  requisition.requiresGovernorApproval =
    requiresGovernorApproval;

  requisition.currentStepIndex =
    0;

  requisition.awaitingRequesterAction =
    false;

  requisition.status =
    REQUISITION_STATUS.PENDING;

  requisition.submittedAt =
    new Date();

  requisition.finalApprovalAt =
    undefined;

  requisition.procurementReceivedAt =
    undefined;

  requisition.procurementStartedAt =
    undefined;

  requisition.procurementCompletedAt =
    undefined;

  /*
   * Generate number only once.
   */

  if (
    !requisition.requisitionNumber
  ) {
    requisition.requisitionNumber =
      await generateRequisitionNumber();
  }

  /*
   * Procurement requisitions should
   * start without an active processing
   * status because they are still waiting
   * for VC approval.
   */

  requisition.procurementStatus =
    undefined;

  requisition.procurementOfficer =
    undefined;

  await requisition.save();

  await AuditLog.create({
    actor:
      requesterUser.id,

    action:
      "requisition.submit",

    entityType:
      "Requisition",

    entityId:
      requisition._id,

    details: {
      requesterRole:
        requisition.requesterRole,

      requestingCollege:
        requisition.collegeId,

      requestingFaculty:
        requisition.facultyId,

      requestingDepartment:
        requisition.department,

      requiresGovernorApproval,

      resubmission:
        isReturnedToRequester,
    },
  });

  await sendRequisitionSubmittedEmail(
    requesterUser,
    requisition
  );

  /*
   * Notify first approval authority.
   */

  const firstStep =
    chain[0];

  if (
    firstStep?.approver
  ) {
    const approver =
      await User.findById(
        firstStep.approver
      );

    if (approver) {
      await sendApprovalStepEmail(
        approver,
        requisition
      );
    }
  }

  return requisition;
}

/*
 * --------------------------------------------------
 * CREATE CONSOLIDATED REQUISITION
 * --------------------------------------------------
 *
 * Used by:
 *
 * Dean
 * Provost
 * VC
 * Procurement
 *
 * A consolidated requisition combines the items from
 * multiple existing requisitions into ONE requisition.
 *
 * IMPORTANT:
 *
 * The original requisitions are NOT deleted.
 *
 * Each copied item keeps:
 *
 * College
 * Faculty
 * Department
 * Quantity
 *
 * through the requesting* fields on ItemSchema.
 */
export async function createConsolidatedRequisition({
  requisitionIds,
  creatorUser,
  purpose,
  urgency,
}) {
  /*
   * --------------------------------------------------
   * VALIDATE INPUT
   * --------------------------------------------------
   */

  if (
    !Array.isArray(requisitionIds) ||
    requisitionIds.length === 0
  ) {
    throw new Error(
      "At least one requisition must be selected."
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
    }).lean();

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
   *
   * Only submitted/approved requisitions should
   * become part of a consolidated requisition.
   *
   * Drafts must never be consolidated.
   */

  for (const requisition of sourceRequisitions) {
    if (
      requisition.status ===
      REQUISITION_STATUS.DRAFT
    ) {
      throw new Error(
        `Requisition ${
          requisition.requisitionNumber ||
          requisition._id
        } is still a draft and cannot be consolidated.`
      );
    }

    /*
     * Do not allow an already consolidated
     * requisition to be consolidated again.
     */
    if (requisition.isConsolidated) {
      throw new Error(
        `Requisition ${
          requisition.requisitionNumber ||
          requisition._id
        } has already been consolidated.`
      );
    }
  }

  /*
   * --------------------------------------------------
   * BUILD CONSOLIDATED ITEMS
   * --------------------------------------------------
   *
   * Every item receives the organizational
   * information from its original requisition.
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
          Number(item.quantity || 0) *
          Number(item.unitCost || 0),
      });
    }
  }

  if (
    consolidatedItems.length === 0
  ) {
    throw new Error(
      "The selected requisitions contain no items."
    );
  }

  /*
   * --------------------------------------------------
   * CALCULATE TOTAL COST
   * --------------------------------------------------
   */

  const estimatedCost =
    sumEstimatedCost(
      consolidatedItems
    );

  /*
   * --------------------------------------------------
   * BUILD REQUESTING UNITS
   * --------------------------------------------------
   *
   * Remove duplicate organizational units.
   */

  const unitMap = new Map();

  for (const requisition of sourceRequisitions) {
    const key = [
      requisition.collegeId || "",
      requisition.facultyId || "",
      requisition.department || "",
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
   * DETERMINE CATEGORY
   * --------------------------------------------------
   *
   * If all source requisitions have the same
   * category, preserve it.
   *
   * Otherwise use "Other".
   */

  const categories = [
    ...new Set(
      sourceRequisitions
        .map(
          (r) => r.category
        )
        .filter(Boolean)
    ),
  ];

  const category =
    categories.length === 1
      ? categories[0]
      : "Other";

  /*
   * --------------------------------------------------
   * DETERMINE URGENCY
   * --------------------------------------------------
   *
   * Use the highest urgency among the source
   * requisitions.
   */

  const urgencyPriority = {
    low: 1,
    normal: 2,
    high: 3,
    urgent: 4,
  };

  const sourceUrgencies =
    sourceRequisitions
      .map(
        (r) => r.urgency
      )
      .filter(Boolean);

  let consolidatedUrgency =
    urgency || "normal";

  if (
    !urgency &&
    sourceUrgencies.length > 0
  ) {
    consolidatedUrgency =
      sourceUrgencies.reduce(
        (highest, current) =>
          (urgencyPriority[current] || 0) >
          (urgencyPriority[highest] || 0)
            ? current
            : highest,
        "low"
      );
  }

  /*
   * --------------------------------------------------
   * PURPOSE
   * --------------------------------------------------
   */

  const consolidatedPurpose =
    purpose ||
    `Consolidated requirements from ${sourceRequisitions.length} requisition(s).`;

  /*
   * --------------------------------------------------
   * ORGANIZATION FOR CONSOLIDATED RECORD
   * --------------------------------------------------
   *
   * There is no single college/faculty/department
   * because multiple units may be represented.
   */

  /*
   * --------------------------------------------------
   * CREATE CONSOLIDATED REQUISITION
   * --------------------------------------------------
   */

  const consolidated =
    await Requisition.create({
      requester:
        creatorUser.id,

      requesterRole:
        creatorUser.role,

      isConsolidated:
        true,

      sourceRequisitions:
        sourceRequisitions.map(
          (r) => r._id
        ),

      consolidatedBy:
        creatorUser.id,

      requestingUnits,

      /*
       * These are intentionally not used for
       * consolidated requisitions.
       */
      collegeId: undefined,
      facultyId: undefined,
      department: undefined,

      category,

      purpose:
        consolidatedPurpose,

      urgency:
        consolidatedUrgency,

      items:
        consolidatedItems,

      estimatedCost,

      status:
        REQUISITION_STATUS.DRAFT,
    });

  /*
   * --------------------------------------------------
   * AUDIT LOG
   * --------------------------------------------------
   */

  await AuditLog.create({
    actor:
      creatorUser.id,

    action:
      "requisition.consolidated_create",

    entityType:
      "Requisition",

    entityId:
      consolidated._id,

    details: {
      sourceRequisitions:
        sourceRequisitions.map(
          (r) => String(r._id)
        ),

      sourceCount:
        sourceRequisitions.length,

      requestingUnits,

      estimatedCost,

      createdByRole:
        creatorUser.role,
    },
  });

  return consolidated;
}

/*
 * --------------------------------------------------
 * MARK SOURCE REQUISITIONS AS CONSOLIDATED
 * --------------------------------------------------
 *
 * We deliberately keep this separate from
 * createConsolidatedRequisition().
 *
 * The UI/API can decide when the source records
 * should become unavailable for another batch.
 */
export async function markRequisitionsAsConsolidated({
  requisitionIds,
  consolidatedRequisitionId,
  actorId,
}) {
  if (
    !Array.isArray(requisitionIds) ||
    requisitionIds.length === 0
  ) {
    return;
  }

  await Requisition.updateMany(
    {
      _id: {
        $in: requisitionIds,
      },
    },
    {
      $set: {
        consolidatedInto:
          consolidatedRequisitionId,
      },
    }
  );

  await AuditLog.create({
    actor: actorId,

    action:
      "requisition.sources_consolidated",

    entityType:
      "Requisition",

    entityId:
      consolidatedRequisitionId,

    details: {
      sourceRequisitions:
        requisitionIds,
    },
  });
    }

export function isRequisitionEscalated(
  estimatedCost
) {
  return isEscalated(
    estimatedCost
  );
  }
