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
 * Get authenticated user.
 */
function getAuth() {
  const token =
    cookies().get("token")?.value;

  return token
    ? verifyToken(token)
    : null;
}

/*
 * GET /api/dashboard
 *
 * Returns statistics according to
 * the logged-in user's role.
 */
export async function GET() {
  try {
    const auth = getAuth();

    if (!auth) {
      return NextResponse.json(
        {
          message:
            "Unauthorized",
        },
        {
          status: 401,
        }
      );
    }

    await connectDB();

    /*
     * ==================================================
     * REQUESTER DASHBOARD
     * ==================================================
     */
    if (
      auth.role ===
      ROLES.REQUESTER
    ) {
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
          status:
            REQUISITION_STATUS.DRAFT,
        }),

        Requisition.countDocuments({
          ...requesterFilter,
          status:
            REQUISITION_STATUS.PENDING,
        }),

        Requisition.countDocuments({
          ...requesterFilter,
          status:
            REQUISITION_STATUS.RETURNED,
        }),

        Requisition.countDocuments({
          ...requesterFilter,
          status:
            REQUISITION_STATUS.APPROVED,
        }),

        Requisition.countDocuments({
          ...requesterFilter,
          status:
            REQUISITION_STATUS.REJECTED,
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
     * ==================================================
     * APPROVER DASHBOARD
     * ==================================================
     *
     * HOD
     * Dean
     * Provost
     * VC
     */
    if (
      APPROVER_ROLES.includes(
        auth.role
      )
    ) {
      /*
       * Find requisitions where this user
       * appears somewhere in the chain.
       */
      const possiblePending =
        await Requisition.find({
          status: {
            $in: [
              REQUISITION_STATUS.PENDING,
              REQUISITION_STATUS.RETURNED,
            ],
          },

          awaitingRequesterAction: {
            $ne: true,
          },

          "approvalChain.approver":
            auth.sub,
        })
          .select(
            "_id currentStepIndex approvalChain status awaitingRequesterAction"
          )
          .lean();

      /*
       * Only count requisitions where
       * this user is CURRENTLY responsible.
       */
      const pendingMyStep =
        possiblePending.filter(
          (requisition) => {
            const currentStep =
              requisition
                .approvalChain[
                requisition
                  .currentStepIndex
              ];

            return (
              currentStep &&
              String(
                currentStep.approver
              ) ===
                String(auth.sub) &&
              currentStep.type ===
                "approval"
            );
          }
        ).length;

      /*
       * Historical actions.
       */
      const [
        approvedByMe,
        returnedByMe,
        rejectedByMe,
      ] = await Promise.all([
        Approval.countDocuments({
          approver: auth.sub,
          action:
            APPROVAL_ACTIONS.APPROVE,
        }),

        Approval.countDocuments({
          approver: auth.sub,
          action:
            APPROVAL_ACTIONS.RETURN,
        }),

        Approval.countDocuments({
          approver: auth.sub,
          action:
            APPROVAL_ACTIONS.REJECT,
        }),
      ]);

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
     * ==================================================
     * PROCUREMENT DASHBOARD
     * ==================================================
     *
     * Procurement is NOT an approval authority.
     *
     * VC approval creates:
     *
     * status = approved
     * procurementStatus = ready
     * procurementOfficer = assigned officer
     *
     * ==================================================
     */
    if (
      auth.role ===
      ROLES.PROCUREMENT
    ) {
      const [
        readyForProcurement,
        processingCount,
        completedCount,
      ] = await Promise.all([
        /*
         * Ready to be processed.
         */
        Requisition.countDocuments({
          status:
            REQUISITION_STATUS.APPROVED,

          procurementStatus:
            "ready",

          procurementOfficer:
            auth.sub,
        }),

        /*
         * Currently being processed.
         */
        Requisition.countDocuments({
          status:
            REQUISITION_STATUS.APPROVED,

          procurementStatus:
            "processing",

          procurementOfficer:
            auth.sub,
        }),

        /*
         * Processing completed.
         */
        Requisition.countDocuments({
          status:
            REQUISITION_STATUS.APPROVED,

          procurementStatus:
            "completed",

          procurementOfficer:
            auth.sub,
        }),
      ]);

      return NextResponse.json({
        role: auth.role,

        readyForProcurement,
        processingCount,
        completedCount,

        totalProcurementItems:
          readyForProcurement +
          processingCount +
          completedCount,
      });
    }

    /*
     * ==================================================
     * ADMIN DASHBOARD
     * ==================================================
     */
    if (
      auth.role ===
      ROLES.ADMIN
    ) {
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
          accountStatus:
            "pending",
        }),

        User.countDocuments({
          accountStatus:
            "active",
        }),

        User.countDocuments({
          accountStatus:
            "deactivated",
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
          status:
            REQUISITION_STATUS.DRAFT,
        }),

        Requisition.countDocuments({
          status:
            REQUISITION_STATUS.PENDING,
        }),

        Requisition.countDocuments({
          status:
            REQUISITION_STATUS.RETURNED,
        }),

        Requisition.countDocuments({
          status:
            REQUISITION_STATUS.APPROVED,
        }),

        Requisition.countDocuments({
          status:
            REQUISITION_STATUS.REJECTED,
        }),
      ]);

      return NextResponse.json({
        role: auth.role,

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
      });
    }

    /*
     * ==================================================
     * UNKNOWN ROLE
     * ==================================================
     */
    return NextResponse.json(
      {
        message:
          "No dashboard statistics are configured for this role.",
      },
      {
        status: 403,
      }
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
      {
        status: 500,
      }
    );
  }
        }
