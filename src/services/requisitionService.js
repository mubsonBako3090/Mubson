import Requisition from "@/models/Requisition";
import AuditLog from "@/models/AuditLog";
import User from "@/models/User";

import {
  buildApprovalChain,
  isEscalated,
  resolveProcurementOfficer,
} from "@/lib/routing";

import { REQUISITION_STATUS } from "@/constants/requisitionOptions";

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
      sum + Number(item.totalCost || 0),
    0
  );
}

async function generateRequisitionNumber() {
  const year = new Date().getFullYear();

  const count = await Requisition.countDocuments({
    requisitionNumber: {
      $regex: `^KSU/REQ/${year}/`,
    },
  });

  const seq = String(count + 1).padStart(4, "0");

  return `KSU/REQ/${year}/${seq}`;
}

/*
|--------------------------------------------------------------------------
| Save Draft
|--------------------------------------------------------------------------
*/

export async function saveDraft({
  requisitionId,
  requesterUser,
  payload,
}) {
  const items = computeItemTotals(
    payload.items || []
  );

  const estimatedCost =
    sumEstimatedCost(items);

  const data = {
    category: payload.category,
    purpose: payload.purpose,
    urgency: payload.urgency,
    items,
    estimatedCost,
  };

  let requisition;

  /*
   * Existing draft
   */
  if (requisitionId) {
    requisition =
      await Requisition.findOneAndUpdate(
        {
          _id: requisitionId,
          requester: requesterUser.id,

          status: {
            $in: [
              REQUISITION_STATUS.DRAFT,
              REQUISITION_STATUS.RETURNED,
            ],
          },
        },

        {
          $set: data,
        },

        {
          new: true,
        }
      );

    if (!requisition) {
      throw new Error(
        "Draft not found or not editable."
      );
    }
  }

  /*
   * New draft
   */
  else {
    requisition =
      await Requisition.create({
        ...data,

        requester: requesterUser.id,

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

        procurementStatus:
          "not_received",
      });
  }

  await AuditLog.create({
    actor: requesterUser.id,

    action: requisitionId
      ? "requisition.draft_update"
      : "requisition.draft_create",

    entityType: "Requisition",

    entityId: requisition._id,
  });

  return requisition;
}

/*
|--------------------------------------------------------------------------
| Submit Requisition
|--------------------------------------------------------------------------
*/

export async function submitRequisition({
  requisitionId,
  requesterUser,
}) {
  const requisition =
    await Requisition.findOne({
      _id: requisitionId,
      requester: requesterUser.id,
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
   |--------------------------------------------------------------------------
   | Build approval chain
   |--------------------------------------------------------------------------
   */

  const {
    chain,
    requiresGovernorApproval,
  } = await buildApprovalChain({
    requesterRole:
      requesterUser.role,

    collegeId:
      requisition.collegeId,

    facultyId:
      requisition.facultyId,

    department:
      requisition.department,

    estimatedCost:
      requisition.estimatedCost,
  });

  /*
   |--------------------------------------------------------------------------
   | Find Procurement Officer
   |--------------------------------------------------------------------------
   */

  const procurementOfficer =
    await resolveProcurementOfficer();

  /*
   |--------------------------------------------------------------------------
   | Save approval chain
   |--------------------------------------------------------------------------
   */

  requisition.approvalChain =
    chain;

  requisition.requiresGovernorApproval =
    requiresGovernorApproval;

  requisition.currentStepIndex = 0;

  requisition.awaitingRequesterAction =
    false;

  /*
   |--------------------------------------------------------------------------
   | Procurement information
   |--------------------------------------------------------------------------
   */

  requisition.procurementOfficer =
    procurementOfficer
      ? procurementOfficer._id
      : undefined;

  /*
   |--------------------------------------------------------------------------
   | Special case:
   |
   | VC creates the requisition.
   |
   | Since VC is the final authority,
   | no approval step is necessary.
   |
   */

  if (chain.length === 0) {
    requisition.status =
      REQUISITION_STATUS.APPROVED;

    requisition.decidedAt =
      new Date();

    requisition.procurementStatus =
      "received";

    requisition.procurementReceivedAt =
      new Date();

    requisition.submittedAt =
      new Date();
  }

  /*
   |--------------------------------------------------------------------------
   | Normal approval workflow
   |--------------------------------------------------------------------------
   */

  else {
    requisition.status =
      REQUISITION_STATUS.PENDING;

    requisition.submittedAt =
      new Date();

    requisition.procurementStatus =
      "not_received";
  }

  /*
   |--------------------------------------------------------------------------
   | Generate requisition number
   |--------------------------------------------------------------------------
   */

  if (!requisition.requisitionNumber) {
    requisition.requisitionNumber =
      await generateRequisitionNumber();
  }

  await requisition.save();

  /*
   |--------------------------------------------------------------------------
   | Audit
   |--------------------------------------------------------------------------
   */

  await AuditLog.create({
    actor: requesterUser.id,

    action:
      "requisition.submit",

    entityType:
      "Requisition",

    entityId:
      requisition._id,

    details: {
      requiresGovernorApproval,

      resubmission:
        isReturnedToRequester,

      requesterRole:
        requesterUser.role,

      approvalSteps:
        chain.map((step) => step.role),
    },
  });

  /*
   |--------------------------------------------------------------------------
   | Email requester
   |--------------------------------------------------------------------------
   */

  await sendRequisitionSubmittedEmail(
    requesterUser,
    requisition
  );

  /*
   |--------------------------------------------------------------------------
   | If there is an approval step,
   | notify first approver.
   |--------------------------------------------------------------------------
   */

  if (chain.length > 0) {
    const firstStep =
      chain[0];

    if (firstStep?.approver) {
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
  }

  /*
   |--------------------------------------------------------------------------
   | If VC created it or there are no approval steps,
   | notify Procurement immediately.
   |--------------------------------------------------------------------------
   */

  else if (procurementOfficer) {
    await sendApprovalStepEmail(
      procurementOfficer,
      requisition
    );
  }

  /*
   |--------------------------------------------------------------------------
   | Procurement-created requisition:
   |
   | chain = VC
   |
   | After VC approves, approvalService
   | sends it back to Procurement.
   |--------------------------------------------------------------------------
   */

  return requisition;
}

export function isRequisitionEscalated(
  estimatedCost
) {
  return isEscalated(
    estimatedCost
  );
}
