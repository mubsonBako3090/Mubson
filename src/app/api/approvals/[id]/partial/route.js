import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { verifyToken } from "@/lib/auth";
import { connectDB } from "@/lib/db";

import {
  partialResolveSchema,
} from "@/lib/validators/requisition";

import {
  partialResolveItems,
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
 * Lets the current approver split off specific ITEMS from
 * a pending requisition (consolidated or not) and return
 * or reject just those, without deciding on the rest. See
 * partialResolveItems() for the exact semantics.
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
      await partialResolveItems({
        requisitionId: params.id,

        approverUser: {
          id: auth.sub,
        },

        itemIndexes:
          value.itemIndexes,

        action: value.action,

        comment:
          value.comment.trim(),
      });

    return NextResponse.json({
      requisition:
        result.requisition,

      splitInto:
        result.splitInto,

      closed: result.closed,
    });
  } catch (err) {
    console.error(err);

    return NextResponse.json(
      {
        message:
          err.message ||
          "Failed to handle those items separately.",
      },
      {
        status: 400,
      }
    );
  }
}
