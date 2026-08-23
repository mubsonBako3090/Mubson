import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { verifyToken } from "@/lib/auth";
import { connectDB } from "@/lib/db";

import Requisition from "@/models/Requisition";

import { ROLES } from "@/constants/roles";
import { REQUISITION_STATUS } from "@/constants/requisitionOptions";
import { COLLEGES } from "@/constants/colleges";

function getAuth() {
  const token = cookies().get("token")?.value;
  return token ? verifyToken(token) : null;
}

/*
 * --------------------------------------------------
 * GET /api/requisitions/consolidate/organizations
 * --------------------------------------------------
 *
 * Returns requisitions that the logged-in user is
 * authorized to consolidate.
 *
 * Authority:
 *
 * DEAN
 *   -> faculties under their college
 *
 * PROVOST
 *   -> all faculties/departments under their college
 *
 * VC
 *   -> university-wide
 *
 * PROCUREMENT
 *   -> university-wide
 *
 * ADMIN
 *   -> university-wide
 */
export async function GET() {
  const auth = getAuth();

  if (!auth) {
    return NextResponse.json(
      { message: "Unauthorized" },
      { status: 401 }
    );
  }

  const allowedRoles = [
    ROLES.DEAN,
    ROLES.PROVOST,
    ROLES.VC,
    ROLES.PROCUREMENT,
    ROLES.ADMIN,
  ];

  if (!allowedRoles.includes(auth.role)) {
    return NextResponse.json(
      {
        message:
          "Your role is not allowed to create consolidated requisitions.",
      },
      { status: 403 }
    );
  }

  await connectDB();

  /*
   * --------------------------------------------------
   * ELIGIBLE SOURCE REQUISITIONS
   * --------------------------------------------------
   *
   * We allow requisitions that have entered the
   * workflow but have not already been consolidated.
   *
   * Drafts and rejected requisitions are excluded.
   */
  const baseQuery = {
    status: {
      $in: [
        REQUISITION_STATUS.PENDING,
        REQUISITION_STATUS.RETURNED,
        REQUISITION_STATUS.APPROVED,
      ],
    },

    isConsolidated: {
      $ne: true,
    },

    consolidatedInto: {
      $exists: false,
    },
  };

  /*
   * --------------------------------------------------
   * APPLY ORGANIZATIONAL SCOPE
   * --------------------------------------------------
   */

  let query = {
    ...baseQuery,
  };

  /*
   * DEAN
   *
   * A Dean only consolidates requisitions from
   * their own college and faculty.
   */
  if (auth.role === ROLES.DEAN) {
    query.collegeId = auth.collegeId;
    query.facultyId = auth.facultyId;
  }

  /*
   * PROVOST
   *
   * A Provost can consolidate requisitions from
   * all faculties/departments in their college.
   */
  else if (auth.role === ROLES.PROVOST) {
    query.collegeId = auth.collegeId;
  }

  /*
   * VC
   *
   * University-wide.
   *
   * No organizational restriction.
   */

  /*
   * PROCUREMENT
   *
   * University-wide.
   *
   * Procurement visits departments across the
   * university and can select requirements from
   * multiple colleges.
   */

  /*
   * ADMIN
   *
   * University-wide.
   */

  const requisitions =
    await Requisition.find(query)
      .sort({
        collegeId: 1,
        facultyId: 1,
        department: 1,
        createdAt: 1,
      })
      .populate(
        "requester",
        "fullName email role"
      )
      .lean();

  /*
   * --------------------------------------------------
   * BUILD ORGANIZATIONAL TREE
   * --------------------------------------------------
   *
   * Result:
   *
   * College
   *   Faculty
   *     Department
   *       Requisitions
   */
  const organizationMap = new Map();

  for (const requisition of requisitions) {
    const collegeId =
      requisition.collegeId || "N/A";

    const facultyId =
      requisition.facultyId || "N/A";

    const department =
      requisition.department || "N/A";

    if (!organizationMap.has(collegeId)) {
      organizationMap.set(collegeId, {
        collegeId,
        faculties: new Map(),
      });
    }

    const college =
      organizationMap.get(collegeId);

    if (!college.faculties.has(facultyId)) {
      college.faculties.set(
        facultyId,
        {
          facultyId,
          departments: new Map(),
        }
      );
    }

    const faculty =
      college.faculties.get(facultyId);

    if (!faculty.departments.has(department)) {
      faculty.departments.set(
        department,
        {
          department,
          requisitions: [],
        }
      );
    }

    faculty.departments
      .get(department)
      .requisitions
      .push(requisition);
  }

  /*
   * --------------------------------------------------
   * CONVERT MAPS TO ARRAYS
   * --------------------------------------------------
   */
  const organizations =
    [...organizationMap.values()].map(
      (college) => ({
        collegeId: college.collegeId,

        faculties: [
          ...college.faculties.values(),
        ].map((faculty) => ({
          facultyId: faculty.facultyId,

          departments: [
            ...faculty.departments.values(),
          ],
        })),
      })
    );

  return NextResponse.json({
    organizations,
  });
}
