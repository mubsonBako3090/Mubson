import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { verifyToken } from "@/lib/auth";
import { connectDB } from "@/lib/db";

import {
  partialResolveSchema,
} from "@/lib/validators/requisition";

import {
  partialResolveSource,
} from "@/services/approvalService";

function getAuth() {
  const token =
    cookies().get("token")?.value;

  return token
    ? verifyToken(token)
    : null;
}

/*
 * --------------------------------------------------
 * POST /api/approvals/[id]/partial
 * --------------------------------------------------
 *
 * Lets the current approver on a pending consolidated
 * requisition split off ONE source and return or reject
 * it independently, without deciding on the whole merged
 * batch. See partialResolveSource() for the exact
 * semantics of each action.
 */
export async function POST(
  request,
  { params }
) {
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
      partialResolveSchema.validate(
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

    const result =
      await partialResolveSource({
        requisitionId: params.id,

        approverUser: {
          id: auth.sub,
        },

        sourceRequisitionId:
          value.sourceRequisitionId,

        action: value.action,

        comment:
          value.comment.trim(),
      });

    return NextResponse.json({
      requisition:
        result.requisition,

      closed: result.closed,
    });
  } catch (err) {
    console.error(err);

    return NextResponse.json(
      {
        message:
          err.message ||
          "Failed to handle that requisition separately.",
      },
      {
        status: 400,
      }
    );
  }
        }
