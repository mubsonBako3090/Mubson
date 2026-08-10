"use client";

import { useEffect } from "react";
import { COLLEGES, getCollegeById, getFaculty } from "@/constants/colleges";
import {
  ROLE_ORG_SCOPE,
  ORG_FIELD_NOT_APPLICABLE,
} from "@/constants/roles";
import SelectField from "./SelectField";

const ALL_ORG_FIELDS = ["collegeId", "facultyId", "department"];

export default function CollegeFacultyDeptSelect({
  value,
  onChange,
  role,
}) {
  const {
    collegeId = "",
    facultyId = "",
    department = "",
  } = value || {};

  /*
   * Determine which organizational fields apply to the selected role.
   *
   * If no role has been selected yet, show all fields so the user
   * can see the normal hierarchy after selecting a role.
   */
  const scope =
    role && ROLE_ORG_SCOPE[role]
      ? ROLE_ORG_SCOPE[role]
      : ALL_ORG_FIELDS;

  const showCollege = scope.includes("collegeId");
  const showFaculty = scope.includes("facultyId");
  const showDepartment = scope.includes("department");

  /*
   * Whenever the role changes, automatically clean up fields
   * that are no longer applicable.
   *
   * Examples:
   *
   * Dean → Provost
   * Faculty disappears and becomes N/A.
   *
   * Provost → VC
   * College disappears and becomes N/A.
   *
   * Requester → VC
   * College, Faculty and Department all become N/A.
   */
  useEffect(() => {
    if (!role || !ROLE_ORG_SCOPE[role]) {
      return;
    }

    const updates = {};

    if (!showCollege && collegeId !== ORG_FIELD_NOT_APPLICABLE) {
      updates.collegeId = ORG_FIELD_NOT_APPLICABLE;
    }

    if (!showFaculty && facultyId !== ORG_FIELD_NOT_APPLICABLE) {
      updates.facultyId = ORG_FIELD_NOT_APPLICABLE;
    }

    if (
      !showDepartment &&
      department !== ORG_FIELD_NOT_APPLICABLE
    ) {
      updates.department = ORG_FIELD_NOT_APPLICABLE;
    }

    if (Object.keys(updates).length > 0) {
      onChange(updates);
    }
  }, [
    role,
    showCollege,
    showFaculty,
    showDepartment,
    collegeId,
    facultyId,
    department,
    onChange,
  ]);

  const college =
    showCollege && collegeId && collegeId !== ORG_FIELD_NOT_APPLICABLE
      ? getCollegeById(collegeId)
      : null;

  const faculty =
    showFaculty &&
    collegeId &&
    collegeId !== ORG_FIELD_NOT_APPLICABLE &&
    facultyId &&
    facultyId !== ORG_FIELD_NOT_APPLICABLE
      ? getFaculty(collegeId, facultyId)
      : null;

  function handleCollegeChange(newCollegeId) {
    onChange({
      collegeId: newCollegeId,

      facultyId: showFaculty
        ? ""
        : ORG_FIELD_NOT_APPLICABLE,

      department: showDepartment
        ? ""
        : ORG_FIELD_NOT_APPLICABLE,
    });
  }

  function handleFacultyChange(newFacultyId) {
    onChange({
      facultyId: newFacultyId,

      department: showDepartment
        ? ""
        : ORG_FIELD_NOT_APPLICABLE,
    });
  }

  return (
    <>
      {/* College */}
      {showCollege && (
        <SelectField
          id="collegeId"
          label="College"
          value={
            collegeId === ORG_FIELD_NOT_APPLICABLE
              ? ""
              : collegeId || ""
          }
          onChange={(e) =>
            handleCollegeChange(e.target.value)
          }
          required
        >
          <option value="">Select college</option>

          {COLLEGES.map((collegeItem) => (
            <option
              key={collegeItem.id}
              value={collegeItem.id}
            >
              {collegeItem.name}
            </option>
          ))}
        </SelectField>
      )}

      {/* Faculty */}
      {showFaculty && (
        <SelectField
          id="facultyId"
          label="Faculty"
          value={
            facultyId === ORG_FIELD_NOT_APPLICABLE
              ? ""
              : facultyId || ""
          }
          onChange={(e) =>
            handleFacultyChange(e.target.value)
          }
          disabled={!college}
          required
        >
          <option value="">Select faculty</option>

          {college?.faculties?.map((facultyItem) => (
            <option
              key={facultyItem.id}
              value={facultyItem.id}
            >
              {facultyItem.name}
            </option>
          ))}
        </SelectField>
      )}

      {/* Department */}
      {showDepartment && (
        <SelectField
          id="department"
          label="Department"
          value={
            department === ORG_FIELD_NOT_APPLICABLE
              ? ""
              : department || ""
          }
          onChange={(e) =>
            onChange({
              department: e.target.value,
            })
          }
          disabled={!faculty}
          required
        >
          <option value="">Select department</option>

          {faculty?.departments?.map((departmentItem) => (
            <option
              key={departmentItem}
              value={departmentItem}
            >
              {departmentItem}
            </option>
          ))}
        </SelectField>
      )}
    </>
  );
    }
