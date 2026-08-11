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

import {
  sendRequisitionSubmittedEmail,
  sendApprovalStepEmail,
} from "@/lib/mailer";

function computeItemTotals(items = []) {
  return items.map((item) => ({
    ...item,

    totalCost:
      Number(item.quantity || 0) *
      Number(item.unitCost || 0),
  }));
}

function sumEstimatedCost(items = []) {
  return items.reduce(
    (sum, item) =>
      sum +
      Number(item.totalCost || 0),
    0
  );
}

async function generateRequisitionNumber() {
  const year =
    new Date().getFullYear();

  const count =
    await Requisition.countDocuments({
      requisitionNumber: {
        $regex: `^KSU/REQ/${year}/`,
      },
    });

  const seq = String(
    count + 1
  ).padStart(4, "0");

  return `KSU/REQ/${year}/${seq}`;
}

/*
 * Creates a new draft or updates an existing draft/returned requisition.
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

  /*
   * requesterRole is deliberately taken from the
   * authenticated user rather than the frontend.
   */
  const data = {
    category: payload.category,
    purpose: payload.purpose,
    urgency: payload.urgency,
    items,
    estimatedCost,

    requesterRole:
      requesterUser.role,
  };

  let requisition;

  /*
   * UPDATE EXISTING REQUISITION
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

    /*
     * Only drafts and requisitions returned
     * to the requester can be edited.
     */
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
     * Preserve the original role snapshot.
     */
    if (!requisition.requesterRole) {
      requisition.requesterRole =
        requesterUser.role;
    }

    /*
     * If it is being edited after being returned,
     * reset it to draft so the requester can submit again.
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
   * CREATE NEW DRAFT
   */
  else {
    requisition =
      await Requisition.create({
        ...data,

        requester:
          requesterUser.id,

        /*
         * THIS FIXES YOUR CURRENT ERROR.
         */
        requesterRole:
          requesterUser.role,

        collegeId:
          requesterUser.collegeId,

        facultyId:
          requesterUser.facultyId,

        department:
          requesterUser.department,

        status:
          REQUISITION_STATUS.DRAFT,
      });
  }

  await AuditLog.create({
    actor:
      requesterUser.id,

    action: requisitionId
      ? "requisition.draft_update"
      : "requisition.draft_create",

    entityType:
      "Requisition",

    entityId:
      requisition._id,
  });

  return requisition;
}

/*
 * Submits a draft into the approval chain.
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
   * Make sure older requisitions that were created
   * before requesterRole was introduced receive the field.
   */
  if (!requisition.requesterRole) {
    requisition.requesterRole =
      requesterUser.role;
  }

  /*
   * Build routing according to who created
   * the requisition.
   */
  const {
    chain,
    requiresGovernorApproval,
  } = await buildApprovalChain({
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

  /*
   * Generate requisition number only once.
   */
  if (!requisition.requisitionNumber) {
    requisition.requisitionNumber =
      await generateRequisitionNumber();
  }

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
   * Notify the first approval/processing stage.
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
