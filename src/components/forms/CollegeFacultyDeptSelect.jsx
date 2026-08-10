"use client";

import { COLLEGES, getCollegeById, getFaculty } from "@/constants/colleges";
import SelectField from "./SelectField";

// Controlled cascading selector: choosing a college resets faculty/department,
// choosing a faculty resets department. Parent owns the state and passes
// down { collegeId, facultyId, department } + a single onChange(partialUpdate) handler.
export default function CollegeFacultyDeptSelect({ value, onChange }) {
  const { collegeId, facultyId, department } = value;

  const college = collegeId ? getCollegeById(collegeId) : null;
  const faculty = collegeId && facultyId ? getFaculty(collegeId, facultyId) : null;

  return (
    <>
      <SelectField
        id="collegeId"
        label="College"
        value={collegeId || ""}
        onChange={(e) => onChange({ collegeId: e.target.value, facultyId: "", department: "" })}
        required
      >
        <option value="">Select college</option>
        {COLLEGES.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </SelectField>

      <SelectField
        id="facultyId"
        label="Faculty"
        value={facultyId || ""}
        onChange={(e) => onChange({ facultyId: e.target.value, department: "" })}
        disabled={!college}
        required
      >
        <option value="">Select faculty</option>
        {college?.faculties.map((f) => (
          <option key={f.id} value={f.id}>
            {f.name}
          </option>
        ))}
      </SelectField>

      <SelectField
        id="department"
        label="Department"
        value={department || ""}
        onChange={(e) => onChange({ department: e.target.value })}
        disabled={!faculty}
        required
      >
        <option value="">Select department</option>
        {faculty?.departments.map((d) => (
          <option key={d} value={d}>
            {d}
          </option>
        ))}
      </SelectField>
    </>
  );
}
