import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { verifyToken } from "@/lib/auth";
import { connectDB } from "@/lib/db";

import Requisition from "@/models/Requisition";

import { ROLES } from "@/constants/roles";
import {
  REQUISITION_STATUS,
} from "@/constants/requisitionOptions";

/*
 * --------------------------------------------------
 * AUTH
 * --------------------------------------------------
 */

function getAuth() {
  const token = cookies().get("token")?.value;

  return token
    ? verifyToken(token)
    : null;
}

/*
 * --------------------------------------------------
 * ALLOWED ROLES
 * --------------------------------------------------
 */

const ALLOWED_ROLES = [
  ROLES.DEAN,
  ROLES.PROVOST,
  ROLES.VC,
  ROLES.PROCUREMENT,
];

/*
 * --------------------------------------------------
 * ORGANIZATIONAL ACCESS
 * --------------------------------------------------
 */

function getOrganizationFilter(auth) {
  /*
   * Dean:
   * Only their faculty.
   */
  if (auth.role === ROLES.DEAN) {
    return {
      collegeId: auth.collegeId,
      facultyId: auth.facultyId,
    };
  }

  /*
   * Provost:
   * Entire college.
   */
  if (auth.role === ROLES.PROVOST) {
    return {
      collegeId: auth.collegeId,
    };
  }

  /*
   * VC:
   * Entire university.
   *
   * Procurement:
   * Entire university.
   */
  return {};
}

/*
 * --------------------------------------------------
 * GET
 * --------------------------------------------------
 *
 * Returns:
 *
 * College
 *   Faculty
 *      Department
 *         Requisitions
 *
 * This structure will make it possible for the
 * frontend to provide different selection experiences
 * depending on the role.
 */

export async function GET() {
  try {
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

    if (
      !ALLOWED_ROLES.includes(
        auth.role
      )
    ) {
      return NextResponse.json(
        {
          message:
            "Your role is not authorized to access consolidation data.",
        },
        {
          status: 403,
        }
      );
    }

    await connectDB();

    const organizationFilter =
      getOrganizationFilter(auth);

    /*
     * Only submitted requisitions.
     *
     * Drafts are excluded.
     *
     * Already consolidated requisitions
     * are excluded.
     */

    const requisitions =
      await Requisition.find({
        ...organizationFilter,

        status: {
          $in: [
            REQUISITION_STATUS.PENDING,
            REQUISITION_STATUS.APPROVED,
          ],
        },

        isConsolidated: {
          $ne: true,
        },

        "items.0": {
          $exists: true,
        },
      })
        .populate(
          "requester",
          "fullName email role"
        )
        .select(
          [
            "_id",
            "requisitionNumber",
            "requester",
            "requesterRole",
            "collegeId",
            "facultyId",
            "department",
            "category",
            "purpose",
            "urgency",
            "items",
            "estimatedCost",
            "status",
            "submittedAt",
            "createdAt",
          ].join(" ")
        )
        .sort({
          submittedAt: -1,
          createdAt: -1,
        })
        .lean();

    /*
     * --------------------------------------------------
     * GROUP DATA
     * --------------------------------------------------
     */

    const colleges = new Map();

    for (const requisition of requisitions) {
      const collegeId =
        requisition.collegeId ||
        "N/A";

      const facultyId =
        requisition.facultyId ||
        "N/A";

      const department =
        requisition.department ||
        "N/A";

      /*
       * ----------------------------------------------
       * COLLEGE
       * ----------------------------------------------
       */

      if (
        !colleges.has(collegeId)
      ) {
        colleges.set(
          collegeId,
          {
            collegeId,

            faculties:
              new Map(),
          }
        );
      }

      const college =
        colleges.get(
          collegeId
        );

      /*
       * ----------------------------------------------
       * FACULTY
       * ----------------------------------------------
       */

      if (
        !college.faculties.has(
          facultyId
        )
      ) {
        college.faculties.set(
          facultyId,
          {
            facultyId,

            departments:
              new Map(),
          }
        );
      }

      const faculty =
        college.faculties.get(
          facultyId
        );

      /*
       * ----------------------------------------------
       * DEPARTMENT
       * ----------------------------------------------
       */

      if (
        !faculty.departments.has(
          department
        )
      ) {
        faculty.departments.set(
          department,
          {
            department,

            requisitions: [],
          }
        );
      }

      const departmentGroup =
        faculty.departments.get(
          department
        );

      departmentGroup.requisitions.push(
        requisition
      );
    }

    /*
     * --------------------------------------------------
     * CONVERT MAPS TO JSON ARRAYS
     * --------------------------------------------------
     */

    const organizationData =
      Array.from(
        colleges.values()
      ).map((college) => ({
        collegeId:
          college.collegeId,

        faculties:
          Array.from(
            college.faculties.values()
          ).map((faculty) => ({
            facultyId:
              faculty.facultyId,

            departments:
              Array.from(
                faculty.departments.values()
              ),
          })),
      }));

    /*
     * --------------------------------------------------
     * RESPONSE
     * --------------------------------------------------
     */

    return NextResponse.json({
      role: auth.role,

      count:
        requisitions.length,

      organizations:
        organizationData,
    });
  } catch (error) {
    console.error(
      "Consolidation organization API error:",
      error
    );

    return NextResponse.json(
      {
        message:
          error.message ||
          "Failed to load organizational requisition data.",
      },
      {
        status: 500,
      }
    );
  }
}
