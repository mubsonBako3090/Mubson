import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { verifyToken } from "@/lib/auth";
import { connectDB } from "@/lib/db";

import {
  approvalActionSchema,
} from "@/lib/validators/requisition";

import {
  returnStep,
} from "@/services/approvalService";

function getAuth() {
  const token =
    cookies().get("token")?.value;

  return token
    ? verifyToken(token)
    : null;
}

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
      approvalActionSchema.validate(
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

    if (
      !value.comment ||
      !value.comment.trim()
    ) {
      return NextResponse.json(
        {
          message:
            "A comment is required when returning for clarification.",
        },
        {
          status: 400,
        }
      );
    }

    await connectDB();

    const requisition =
      await returnStep({
        requisitionId:
          params.id,

        approverUser: {
          id: auth.sub,
        },

        comment:
          value.comment.trim(),
      });

    return NextResponse.json({
      requisition,
    });
  } catch (err) {
    console.error(err);

    return NextResponse.json(
      {
        message:
          err.message ||
          "Return failed.",
      },
      {
        status: 400,
      }
    );
  }
                             }
