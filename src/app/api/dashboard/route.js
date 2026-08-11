import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { verifyToken } from "@/lib/auth";
import { connectDB } from "@/lib/db";

import Requisition from "@/models/Requisition";
import Approval from "@/models/Approval";
import User from "@/models/User";

import {
  REQUISITION_STATUS,
  APPROVAL_ACTIONS,
} from "@/constants/requisitionOptions";

import {
  ROLES,
  APPROVER_ROLES,
} from "@/constants/roles";

/*
 * Get the currently authenticated user from the JWT cookie.
 */
function getAuth() {
  const token = cookies().get("token")?.value;

  return token ? verifyToken(token) : null;
}

/*
 * GET /api/dashboard
 *
 * Returns dashboard statistics according to the
 * currently logged-in user's role.
 */
export async function GET() {
  try {
    const auth = getAuth();

    if (!auth) {
      return NextResponse.json(
        { message: "Unauthorized" },
        { status: 401 }
      );
    }

    await connectDB();

    /*
     * --------------------------------------------------
     * REQUESTER DASHBOARD
     * --------------------------------------------------
     *
     * Requesters only see statistics for requisitions
     * that they created.
     */
    if (auth.role === ROLES.REQUESTER) {
      const requesterFilter = {
        requester: auth.sub,
      };

      const [
        draftCount,
        pendingCount,
        returnedCount,
        approvedCount,
        rejectedCount,
        totalCount,
      ] = await Promise.all([
        Requisition.countDocuments({
          ...requesterFilter,
          status: REQUISITION_STATUS.DRAFT,
        }),

        Requisition.countDocuments({
          ...requesterFilter,
          status: REQUISITION_STATUS.PENDING,
        }),

        Requisition.countDocuments({
          ...requesterFilter,
          status: REQUISITION_STATUS.RETURNED,
        }),

        Requisition.countDocuments({
          ...requesterFilter,
          status: REQUISITION_STATUS.APPROVED,
        }),

        Requisition.countDocuments({
          ...requesterFilter,
          status: REQUISITION_STATUS.REJECTED,
        }),

        Requisition.countDocuments(
          requesterFilter
        ),
      ]);

      return NextResponse.json({
        role: auth.role,

        draftCount,
        pendingCount,
        returnedCount,
        approvedCount,
        rejectedCount,

        totalCount,
      });
    }

    /*
     * --------------------------------------------------
     * APPROVER DASHBOARD
     * --------------------------------------------------
     *
     * Applies to:
     *
     * HOD
     * Dean
     * Provost
     * VC
     *
     * "Awaiting Your Approval" uses the exact same
     * current-step logic as /api/approvals.
     */
    if (APPROVER_ROLES.includes(auth.role)) {
      /*
       * Find requisitions that are currently waiting
       * for this specific approver.
       */
      const possiblePending = await Requisition.find({
        status: {
          $in: [
            REQUISITION_STATUS.PENDING,
            REQUISITION_STATUS.RETURNED,
          ],
        },

        awaitingRequesterAction: {
          $ne: true,
        },

        "approvalChain.approver": auth.sub,
      })
        .select(
          "_id currentStepIndex approvalChain status awaitingRequesterAction"
        )
        .lean();

      /*
       * Narrow the results to only requisitions where
       * this user's step is the CURRENT step.
       */
      const pendingMyStep =
        possiblePending.filter((requisition) => {
          const currentStep =
            requisition.approvalChain[
              requisition.currentStepIndex
            ];

          return (
            currentStep &&
            String(currentStep.approver) ===
              String(auth.sub) &&
            currentStep.type === "approval"
          );
        }).length;

      /*
       * Historical actions performed by this approver.
       */
      const [
        approvedByMe,
        returnedByMe,
        rejectedByMe,
      ] = await Promise.all([
        Approval.countDocuments({
          approver: auth.sub,
          action: APPROVAL_ACTIONS.APPROVE,
        }),

        Approval.countDocuments({
          approver: auth.sub,
          action: APPROVAL_ACTIONS.RETURN,
        }),

        Approval.countDocuments({
          approver: auth.sub,
          action: APPROVAL_ACTIONS.REJECT,
        }),
      ]);

      /*
       * Total number of requisitions this approver
       * has ever handled.
       */
      const reviewedByMe =
        await Approval.countDocuments({
          approver: auth.sub,
        });

      return NextResponse.json({
        role: auth.role,

        pendingMyStep,

        approvedByMe,
        returnedByMe,
        rejectedByMe,

        reviewedByMe,
      });
    }

    /*
     * --------------------------------------------------
     * PROCUREMENT DASHBOARD
     * --------------------------------------------------
     *
     * Procurement is NOT an approval authority.
     *
     * VC approval changes the requisition status to
     * APPROVED and moves currentStepIndex to the
     * Procurement processing stage.
     *
     * Therefore we identify requisitions ready for
     * Procurement using:
     *
     * status = approved
     * finalApprovalAt exists
     * current step = procurement
     */
    if (auth.role === ROLES.PROCUREMENT) {
      const approvedRequisitions =
        await Requisition.find({
          status:
            REQUISITION_STATUS.APPROVED,

          finalApprovalAt: {
            $exists: true,
          },

          "approvalChain": {
            $elemMatch: {
              role: ROLES.PROCUREMENT,
              type: "processing",
            },
          },
        })
          .select(
            "_id currentStepIndex approvalChain"
          )
          .lean();

      /*
       * Only count requisitions whose CURRENT stage
       * is Procurement.
       */
      const readyForProcurement =
        approvedRequisitions.filter(
          (requisition) => {
            const currentStep =
              requisition.approvalChain[
                requisition.currentStepIndex
              ];

            return (
              currentStep &&
              currentStep.role ===
                ROLES.PROCUREMENT &&
              currentStep.type === "processing"
            );
          }
        ).length;

      /*
       * Total approved requisitions currently
       * available to Procurement.
       */
      const totalApproved =
        await Requisition.countDocuments({
          status:
            REQUISITION_STATUS.APPROVED,

          finalApprovalAt: {
            $exists: true,
          },
        });

      return NextResponse.json({
        role: auth.role,

        readyForProcurement,

        /*
         * These are included for future Procurement
         * processing functionality.
         */
        totalApproved,

        processingCount: 0,
        completedCount: 0,
      });
    }

    /*
     * --------------------------------------------------
     * ADMIN DASHBOARD
     * --------------------------------------------------
     *
     * Admin sees university-wide statistics.
     */
    if (auth.role === ROLES.ADMIN) {
      const [
        totalUsers,
        pendingUsers,
        activeUsers,
        deactivatedUsers,

        totalRequisitions,
        activeRequisitions,

        draftRequisitions,
        pendingRequisitions,
        returnedRequisitions,
        approvedRequisitions,
        rejectedRequisitions,
      ] = await Promise.all([
        /*
         * USERS
         */
        User.countDocuments(),

        User.countDocuments({
          accountStatus: "pending",
        }),

        User.countDocuments({
          accountStatus: "active",
        }),

        User.countDocuments({
          accountStatus: "deactivated",
        }),

        /*
         * REQUISITIONS
         */
        Requisition.countDocuments(),

        Requisition.countDocuments({
          status: {
            $in: [
              REQUISITION_STATUS.PENDING,
              REQUISITION_STATUS.RETURNED,
            ],
          },
        }),

        Requisition.countDocuments({
          status: REQUISITION_STATUS.DRAFT,
        }),

        Requisition.countDocuments({
          status: REQUISITION_STATUS.PENDING,
        }),

        Requisition.countDocuments({
          status: REQUISITION_STATUS.RETURNED,
        }),

        Requisition.countDocuments({
          status: REQUISITION_STATUS.APPROVED,
        }),

        Requisition.countDocuments({
          status: REQUISITION_STATUS.REJECTED,
        }),
      ]);

      return NextResponse.json({
        role: auth.role,

        /*
         * User statistics
         */
        totalUsers,
        pendingUsers,
        activeUsers,
        deactivatedUsers,

        /*
         * Requisition statistics
         */
        totalRequisitions,
        activeRequisitions,

        draftRequisitions,
        pendingRequisitions,
        returnedRequisitions,
        approvedRequisitions,
        rejectedRequisitions,
      });
    }

    /*
     * --------------------------------------------------
     * UNKNOWN ROLE
     * --------------------------------------------------
     */
    return NextResponse.json(
      {
        message:
          "No dashboard statistics are configured for this role.",
      },
      { status: 403 }
    );
  } catch (error) {
    console.error(
      "Dashboard API error:",
      error
    );

    return NextResponse.json(
      {
        message:
          error.message ||
          "Failed to load dashboard statistics.",
      },
      { status: 500 }
    );
  }
    }
