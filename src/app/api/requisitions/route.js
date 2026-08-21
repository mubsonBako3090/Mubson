import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { verifyToken } from "@/lib/auth";
import { connectDB } from "@/lib/db";

import Requisition from "@/models/Requisition";

import {
  draftRequisitionSchema,
} from "@/lib/validators/requisition";

import {
  saveDraft,
} from "@/services/requisitionService";

function getAuth() {
  const token = cookies().get("token")?.value;

  return token ? verifyToken(token) : null;
}

/*
 * GET /api/requisitions
 *
 * IMPORTANT:
 *
 * Every role sees ONLY requisitions that they personally
 * initiated.
 *
 * Approval queues are handled separately by:
 *
 * /api/approvals
 *
 * Procurement processing queues should also be handled
 * separately from this endpoint.
 */
export async function GET(request) {
  const auth = getAuth();

  if (!auth) {
    return NextResponse.json(
      {
        message: "Unauthorized",
      },
      {
        status: 401,
      }
    );
  }

  await connectDB();

  const { searchParams } =
    new URL(request.url);

  const status =
    searchParams.get("status");

  /*
   * --------------------------------------------------
   * CURRENT USER'S REQUISITIONS ONLY
   * --------------------------------------------------
   *
   * This applies to EVERY role:
   *
   * Requester
   * HOD
   * Dean
   * Provost
   * VC
   * Procurement
   * Admin
   *
   * Therefore nobody sees requisitions initiated
   * by another user simply by visiting:
   *
   * /requisitions
   */
  const query = {
    requester: auth.sub,
  };

  /*
   * Optional status filter.
   *
   * Example:
   *
   * /requisitions?status=draft
   * /requisitions?status=pending
   * /requisitions?status=approved
   */
  if (status) {
    query.status = status;
  }

  const requisitions =
    await Requisition.find(query)
      .sort({
        createdAt: -1,
      })
      .populate(
        "requester",
        "fullName email role"
      )
      .lean();

  return NextResponse.json({
    requisitions,
  });
}

/*
 * POST /api/requisitions
 *
 * Create a new draft.
 */
export async function POST(request) {
  const auth = getAuth();

  if (!auth) {
    return NextResponse.json(
      {
        message: "Unauthorized",
      },
      {
        status: 401,
      }
    );
  }

  try {
    const body =
      await request.json();

    const {
      error,
      value,
    } =
      draftRequisitionSchema.validate(
        body
      );

    if (error) {
      return NextResponse.json(
        {
          message:
            error.details[0]
              .message,
        },
        {
          status: 400,
        }
      );
    }

    await connectDB();

    /*
     * The authenticated user's role and
     * organisational information are taken
     * from the JWT.
     *
     * The frontend cannot decide who owns
     * the requisition.
     */
    const requisition =
      await saveDraft({
        requesterUser: {
          id: auth.sub,

          role:
            auth.role,

          collegeId:
            auth.collegeId,

          facultyId:
            auth.facultyId,

          department:
            auth.department,
        },

        payload: value,
      });

    return NextResponse.json(
      {
        requisition,
      },
      {
        status: 201,
      }
    );
  } catch (err) {
    console.error(err);

    return NextResponse.json(
      {
        message:
          err.message ||
          "Failed to create requisition.",
      },
      {
        status: 500,
      }
    );
  }
}
