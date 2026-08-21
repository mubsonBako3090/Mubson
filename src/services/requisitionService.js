import Requisition from "@/models/Requisition";
import AuditLog from "@/models/AuditLog";
import User from "@/models/User";

import {
  buildApprovalChain,
  isEscalated,
} from "@/lib/routing";

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

export function isRequisitionEscalated(
  estimatedCost
) {
  return isEscalated(
    estimatedCost
  );
  }
