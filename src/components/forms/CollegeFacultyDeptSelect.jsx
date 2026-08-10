"use client";

import { COLLEGES, getCollegeById, getFaculty } from "@/constants/colleges";
import { ROLE_ORG_SCOPE, ORG_FIELD_NOT_APPLICABLE } from "@/constants/roles";
import SelectField from "./SelectField";

// Controlled cascading selector: choosing a college resets faculty/department,
// choosing a faculty resets department. Parent owns the state and passes
// down { collegeId, facultyId, department } + a single onChange(partialUpdate) handler.
//
// `role` determines which fields are shown at all: a Dean only ever picks a
// College and Faculty (no single department), a Provost only picks a
// College. Fields hidden this way are automatically set to
// ORG_FIELD_NOT_APPLICABLE so the value stays valid for submission without
// the user having to interact with a field that doesn't apply to their role.
// When `role` is not yet chosen (or has no defined scope), all three fields
// show, matching the previous default behaviour.
export default function CollegeFacultyDeptSelect({ value, onChange, role }) {
  const { collegeId, facultyId, department } = value;

    const scope = (role && ROLE_ORG_SCOPE[role]) || ["collegeId", "facultyId", "department"];
      const showFaculty = scope.includes("facultyId");
        const showDepartment = scope.includes("department");

          const college = collegeId ? getCollegeById(collegeId) : null;
            const faculty = collegeId && facultyId ? getFaculty(collegeId, facultyId) : null;

              function handleCollegeChange(newCollegeId) {
                  onChange({
                        collegeId: newCollegeId,
                              facultyId: showFaculty ? "" : ORG_FIELD_NOT_APPLICABLE,
                                    department: showDepartment ? "" : ORG_FIELD_NOT_APPLICABLE,
                                        });
                                          }

                                            function handleFacultyChange(newFacultyId) {
                                                onChange({
                                                      facultyId: newFacultyId,
                                                            department: showDepartment ? "" : ORG_FIELD_NOT_APPLICABLE,
                                                                });
                                                                  }

                                                                    return (
                                                                        <>
                                                                              <SelectField
                                                                                      id="collegeId"
                                                                                              label="College"
                                                                                                      value={collegeId || ""}
                                                                                                              onChange={(e) => handleCollegeChange(e.target.value)}
                                                                                                                      required
                                                                                                                            >
                                                                                                                                    <option value="">Select college</option>
                                                                                                                                            {COLLEGES.map((c) => (
                                                                                                                                                      <option key={c.id} value={c.id}>
                                                                                                                                                                  {c.name}
                                                                                                                                                                            </option>
                                                                                                                                                                                    ))}
                                                                                                                                                                                          </SelectField>

                                                                                                                                                                                                {showFaculty && (
                                                                                                                                                                                                        <SelectField
                                                                                                                                                                                                                  id="facultyId"
                                                                                                                                                                                                                            label="Faculty"
                                                                                                                                                                                                                                      value={facultyId || ""}
                                                                                                                                                                                                                                                onChange={(e) => handleFacultyChange(e.target.value)}
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
                                                                                                                                                                                                                                                                                                                                                              )}

                                                                                                                                                                                                                                                                                                                                                                    {showDepartment && (
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
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  )}
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      </>
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        );
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        }