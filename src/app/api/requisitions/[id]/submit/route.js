import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { verifyToken } from "@/lib/auth";
import { connectDB } from "@/lib/db";

import User from "@/models/User";
import Requisition from "@/models/Requisition";

import {
  submitRequisitionSchema,
} from "@/lib/validators/requisition";

import {
  submitRequisition,
} from "@/services/requisitionService";

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
    await connectDB();

    const existing =
      await Requisition.findOne({
        _id: params.id,
        requester: auth.sub,
      }).lean();

    if (!existing) {
      return NextResponse.json(
        {
          message:
            "Requisition not found.",
        },
        {
          status: 404,
        }
      );
    }

    /*
     * Validate the completed requisition.
     */
    const {
      error,
    } =
      submitRequisitionSchema.validate({
        category:
          existing.category,

        purpose:
          existing.purpose,

        urgency:
          existing.urgency,

        items:
          existing.items,
      });

    if (error) {
      return NextResponse.json(
        {
          message:
            `Requisition is incomplete: ${error.details[0].message}`,
        },
        {
          status: 400,
        }
      );
    }

    const requesterUser =
      await User.findById(
        auth.sub
      ).lean();

    if (!requesterUser) {
      return NextResponse.json(
        {
          message:
            "Requester account not found.",
        },
        {
          status: 404,
        }
      );
    }

    /*
     * Pass the complete authenticated user
     * information to the service.
     */
    const requisition =
      await submitRequisition({
        requisitionId:
          params.id,

        requesterUser: {
          id: auth.sub,

          fullName:
            requesterUser.fullName,

          email:
            requesterUser.email,

          role:
            requesterUser.role,

          collegeId:
            requesterUser.collegeId,

          facultyId:
            requesterUser.facultyId,

          department:
            requesterUser.department,
        },
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
          "Submission failed.",
      },
      {
        status: 500,
      }
    );
  }
        }
