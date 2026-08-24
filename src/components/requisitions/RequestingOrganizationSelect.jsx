"use client";

import { useEffect } from "react";
import {
  COLLEGES,
  getCollegeById,
  getFaculty,
} from "@/constants/colleges";

import { ROLES } from "@/constants/roles";

import SelectField from "@/components/forms/SelectField";
import styles from "./RequestingOrganizationSelect.module.css";

/*
 * scope describes how much of the organization the current
 * user is allowed to pick, based on their role:
 *
 *  - Procurement: fully open, university-wide.
 *  - Dean: college + faculty locked to their own; only
 *    department is a live choice, limited to that faculty.
 *  - Provost: college locked to their own; faculty and
 *    department are live choices, limited to that college.
 */
export default function RequestingOrganizationSelect({
  value,
  onChange,
  requesterRole,
  homeCollegeId,
  homeFacultyId,
}) {
  const lockCollege =
    requesterRole === ROLES.DEAN ||
    requesterRole === ROLES.PROVOST;

  const lockFaculty =
    requesterRole === ROLES.DEAN;

  const {
    collegeId = "",
    facultyId = "",
    department = "",
  } = value || {};

  const college = collegeId
    ? getCollegeById(collegeId)
    : null;

  const faculty =
    college && facultyId
      ? getFaculty(collegeId, facultyId)
      : null;

  /*
   * If the selected college changes, the old
   * faculty and department are no longer valid.
   */
  useEffect(() => {
    if (
      facultyId &&
      !faculty
    ) {
      onChange({
        facultyId: "",
        department: "",
      });
    }
  }, [
    collegeId,
    facultyId,
    faculty,
    onChange,
  ]);

  /*
   * Dean/Provost: seed the locked field(s) with their own
   * college (and faculty, for a Dean) as soon as we know
   * them, so the payload is never submitted empty.
   */
  useEffect(() => {
    if (
      lockCollege &&
      homeCollegeId &&
      collegeId !== homeCollegeId
    ) {
      onChange({
        collegeId: homeCollegeId,
        facultyId: lockFaculty
          ? homeFacultyId || ""
          : "",
        department: "",
      });
    }
  }, [
    lockCollege,
    lockFaculty,
    homeCollegeId,
    homeFacultyId,
    collegeId,
    onChange,
  ]);

  useEffect(() => {
    if (
      lockFaculty &&
      homeFacultyId &&
      facultyId !== homeFacultyId
    ) {
      onChange({
        facultyId: homeFacultyId,
        department: "",
      });
    }
  }, [
    lockFaculty,
    homeFacultyId,
    facultyId,
    onChange,
  ]);

  function handleCollegeChange(
    newCollegeId
  ) {
    onChange({
      collegeId: newCollegeId,
      facultyId: "",
      department: "",
    });
  }

  function handleFacultyChange(
    newFacultyId
  ) {
    onChange({
      facultyId: newFacultyId,
      department: "",
    });
  }

  const description = lockFaculty
    ? "Select which department within your faculty this requisition is for."
    : lockCollege
    ? "Select which faculty and department within your college this requisition is for."
    : "Select the College, Faculty, and Department whose needs are being requested. This is especially important when Procurement is initiating the requisition on behalf of a department.";

  return (
    <div className={styles.wrapper}>
      <div className={styles.heading}>
        Requesting Organization
      </div>

      <p className={styles.description}>
        {description}
      </p>

      <SelectField
        id="requestingCollegeId"
        label="Requesting College"
        value={collegeId}
        onChange={(e) =>
          handleCollegeChange(
            e.target.value
          )
        }
        disabled={lockCollege}
        required
      >
        <option value="">
          Select requesting college
        </option>

        {COLLEGES.map((item) => (
          <option
            key={item.id}
            value={item.id}
          >
            {item.name}
          </option>
        ))}
      </SelectField>

      <SelectField
        id="requestingFacultyId"
        label="Requesting Faculty"
        value={facultyId}
        onChange={(e) =>
          handleFacultyChange(
            e.target.value
          )
        }
        disabled={!college || lockFaculty}
        required
      >
        <option value="">
          Select requesting faculty
        </option>

        {college?.faculties?.map(
          (item) => (
            <option
              key={item.id}
              value={item.id}
            >
              {item.name}
            </option>
          )
        )}
      </SelectField>

      <SelectField
        id="requestingDepartment"
        label="Requesting Department"
        value={department}
        onChange={(e) =>
          onChange({
            department:
              e.target.value,
          })
        }
        disabled={!faculty}
        required
      >
        <option value="">
          Select requesting department
        </option>

        {faculty?.departments?.map(
          (item) => (
            <option
              key={item}
              value={item}
            >
              {item}
            </option>
          )
        )}
      </SelectField>
    </div>
  );
      }
