"use client";

import { useEffect, useState } from "react";
import {
  COLLEGES,
  getCollegeById,
  getFaculty,
} from "@/constants/colleges";

import { ROLES } from "@/constants/roles";

import SelectField from "@/components/forms/SelectField";
import styles from "./RequestingOrganizationSelect.module.css";

function unitKey(unit) {
  return [
    unit.collegeId,
    unit.facultyId,
    unit.department,
  ].join("|");
}

/*
 * value: an array of { collegeId, facultyId, department },
 * one entry per requesting unit picked so far.
 *
 * scope by role:
 *  - Procurement: fully open, university-wide, can add
 *    units from any college/faculty/department.
 *  - Provost: college locked to their own; can add multiple
 *    faculty/department combinations within that college.
 *  - Dean: college + faculty locked to their own; can add
 *    multiple departments within that faculty.
 */
export default function RequestingOrganizationSelect({
  value,
  onChange,
  requesterRole,
  homeCollegeId,
  homeFacultyId,
}) {
  const units = value || [];

  const lockCollege =
    requesterRole === ROLES.DEAN ||
    requesterRole === ROLES.PROVOST;

  const lockFaculty =
    requesterRole === ROLES.DEAN;

  /*
   * Staging selections — the picker used to build up the
   * next unit before it's added to the list. Kept local;
   * only committed units live in `value`.
   */
  const [stagingCollegeId, setStagingCollegeId] =
    useState(lockCollege ? homeCollegeId || "" : "");

  const [stagingFacultyId, setStagingFacultyId] =
    useState(lockFaculty ? homeFacultyId || "" : "");

  const [stagingDepartment, setStagingDepartment] =
    useState("");

  /*
   * Seed / re-lock staging college & faculty once the
   * requester's own profile values are known.
   */
  useEffect(() => {
    if (lockCollege && homeCollegeId) {
      setStagingCollegeId(homeCollegeId);
    }
  }, [lockCollege, homeCollegeId]);

  useEffect(() => {
    if (lockFaculty && homeFacultyId) {
      setStagingFacultyId(homeFacultyId);
    }
  }, [lockFaculty, homeFacultyId]);

  const stagingCollege = stagingCollegeId
    ? getCollegeById(stagingCollegeId)
    : null;

  const stagingFacultyObj =
    stagingCollege && stagingFacultyId
      ? getFaculty(
          stagingCollegeId,
          stagingFacultyId
        )
      : null;

  function handleStagingCollegeChange(newCollegeId) {
    setStagingCollegeId(newCollegeId);
    setStagingFacultyId("");
    setStagingDepartment("");
  }

  function handleStagingFacultyChange(newFacultyId) {
    setStagingFacultyId(newFacultyId);
    setStagingDepartment("");
  }

  function handleAdd() {
    if (
      !stagingCollegeId ||
      !stagingFacultyId ||
      !stagingDepartment
    ) {
      return;
    }

    const newUnit = {
      collegeId: stagingCollegeId,
      facultyId: stagingFacultyId,
      department: stagingDepartment,
    };

    const alreadyAdded = units.some(
      (u) => unitKey(u) === unitKey(newUnit)
    );

    if (alreadyAdded) {
      return;
    }

    onChange({
      requestingUnits: [
        ...units,
        newUnit,
      ],
    });

    /*
     * Keep college/faculty selected (locked ones stay locked
     * anyway) so adding several departments in a row is quick;
     * only department resets.
     */
    setStagingDepartment("");
  }

  function handleRemove(index) {
    onChange({
      requestingUnits: units.filter(
        (_, i) => i !== index
      ),
    });
  }

  function labelFor(unit) {
    if (requesterRole === ROLES.DEAN) {
      return unit.department;
    }

    if (requesterRole === ROLES.PROVOST) {
      const faculty = getFaculty(
        unit.collegeId,
        unit.facultyId
      );

      return `${faculty?.name || unit.facultyId} — ${unit.department}`;
    }

    const college = getCollegeById(
      unit.collegeId
    );

    const faculty = getFaculty(
      unit.collegeId,
      unit.facultyId
    );

    return `${college?.name || unit.collegeId} — ${
      faculty?.name || unit.facultyId
    } — ${unit.department}`;
  }

  const description =
    requesterRole === ROLES.DEAN
      ? "Add every department within your faculty this requisition covers."
      : requesterRole === ROLES.PROVOST
      ? "Add every faculty/department within your college this requisition covers."
      : "Add every College/Faculty/Department whose needs are being requested. This is especially important when Procurement is initiating the requisition on behalf of other units.";

  return (
    <div className={styles.wrapper}>
      <div className={styles.heading}>
        Requesting Organization
      </div>

      <p className={styles.description}>
        {description}
      </p>

      {units.length > 0 && (
        <ul className={styles.unitList}>
          {units.map((unit, index) => (
            <li
              key={unitKey(unit)}
              className={styles.unitChip}
            >
              <span>{labelFor(unit)}</span>

              <button
                type="button"
                className={styles.unitRemoveBtn}
                onClick={() =>
                  handleRemove(index)
                }
                aria-label="Remove"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      <SelectField
        id="requestingCollegeId"
        label="Requesting College"
        value={stagingCollegeId}
        onChange={(e) =>
          handleStagingCollegeChange(
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
        value={stagingFacultyId}
        onChange={(e) =>
          handleStagingFacultyChange(
            e.target.value
          )
        }
        disabled={
          !stagingCollege || lockFaculty
        }
        required
      >
        <option value="">
          Select requesting faculty
        </option>

        {stagingCollege?.faculties?.map(
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
        value={stagingDepartment}
        onChange={(e) =>
          setStagingDepartment(
            e.target.value
          )
        }
        disabled={!stagingFacultyObj}
        required
      >
        <option value="">
          Select requesting department
        </option>

        {stagingFacultyObj?.departments?.map(
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

      <button
        type="button"
        className={styles.addUnitBtn}
        onClick={handleAdd}
        disabled={
          !stagingCollegeId ||
          !stagingFacultyId ||
          !stagingDepartment
        }
      >
        + Add department
      </button>
    </div>
  );
      }
