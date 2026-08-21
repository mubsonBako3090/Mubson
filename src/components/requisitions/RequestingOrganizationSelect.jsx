"use client";

import { useEffect } from "react";
import {
  COLLEGES,
  getCollegeById,
  getFaculty,
} from "@/constants/colleges";

import SelectField from "@/components/forms/SelectField";
import styles from "./RequestingOrganizationSelect.module.css";

export default function RequestingOrganizationSelect({
  value,
  onChange,
}) {
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

  return (
    <div className={styles.wrapper}>
      <div className={styles.heading}>
        Requesting Organization
      </div>

      <p className={styles.description}>
        Select the College, Faculty, and Department
        whose needs are being requested. This is
        especially important when Procurement is
        initiating the requisition on behalf of a
        department.
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
        disabled={!college}
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
