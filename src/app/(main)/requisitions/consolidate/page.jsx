"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import toast from "react-hot-toast";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import SelectField from "@/components/forms/SelectField";
import inputStyles from "@/components/forms/InputField.module.css";
import { getCollegeById, getFaculty } from "@/constants/colleges";
import { REQUISITION_CATEGORIES, URGENCY_LEVELS } from "@/constants/requisitionOptions";
import { formatNaira } from "@/utils/formatNaira";
import styles from "./page.module.css";

// Resolves the human-readable labels for a requisition's college/faculty,
// falling back to the raw id (or "N/A") when a lookup misses — organization
// ids on very old records may not match the current COLLEGES list.
function resolveOrgLabels(collegeId, facultyId) {
  const college = getCollegeById(collegeId);
  const faculty = college ? getFaculty(collegeId, facultyId) : null;
  return {
    collegeName: college?.name || collegeId || "N/A",
    facultyName: faculty?.name || facultyId || "N/A",
  };
}

export default function ConsolidateRequisitionPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [organizations, setOrganizations] = useState([]);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [submitting, setSubmitting] = useState(false);

  const [category, setCategory] = useState(REQUISITION_CATEGORIES[0]);
  const [urgency, setUrgency] = useState("normal");
  const [purpose, setPurpose] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await axios.get("/api/requisitions/consolidate/organizations");
      setOrganizations(data.organizations || []);
    } catch (err) {
      toast.error(
        err.response?.data?.message || "Failed to load requisitions available for consolidation."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Flat lookup of every selectable requisition, keyed by id — used to
  // build the selected-items summary without re-walking the tree.
  const requisitionsById = useMemo(() => {
    const map = new Map();
    for (const college of organizations) {
      for (const faculty of college.faculties) {
        for (const dept of faculty.departments) {
          for (const req of dept.requisitions) {
            map.set(req._id, req);
          }
        }
      }
    }
    return map;
  }, [organizations]);

  const selectedRequisitions = useMemo(
    () => [...selectedIds].map((id) => requisitionsById.get(id)).filter(Boolean),
    [selectedIds, requisitionsById]
  );

  const selectedTotal = useMemo(
    () => selectedRequisitions.reduce((sum, r) => sum + Number(r.estimatedCost || 0), 0),
    [selectedRequisitions]
  );

  function toggleOne(id) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function toggleDepartment(deptRequisitions, allSelected) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const req of deptRequisitions) {
        if (allSelected) {
          next.delete(req._id);
        } else {
          next.add(req._id);
        }
      }
      return next;
    });
  }

  async function handleSubmit(e) {
    e.preventDefault();

    if (selectedIds.size === 0) {
      toast.error("Select at least one requisition to consolidate.");
      return;
    }
    if (!purpose.trim()) {
      toast.error("Provide a purpose for the consolidated requisition.");
      return;
    }

    setSubmitting(true);
    try {
      const { data } = await axios.post("/api/requisitions/consolidate", {
        requisitionIds: [...selectedIds],
        category,
        urgency,
        purpose: purpose.trim(),
      });
      toast.success("Consolidated requisition created.");
      // Route to the detail (view) page, not /edit — the edit wizard is
      // built for the single-department creation flow and isn't aware of
      // consolidated records (requestingUnits, multi-department items).
      router.push(`/requisitions/${data.requisition._id}`);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to create consolidated requisition.");
    } finally {
      setSubmitting(false);
    }
  }

  const hasAnyRequisitions = organizations.some((college) =>
    college.faculties.some((faculty) => faculty.departments.some((d) => d.requisitions.length > 0))
  );

  return (
    <div className={styles.wrapper}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.heading}>Consolidate Requisitions</h1>
          <p className={styles.subheading}>
            Select submitted requisitions from the units under your authority and merge them into a
            single consolidated requisition. Each item keeps its originating department for
            traceability.
          </p>
        </div>
      </div>

      {loading ? (
        <p className={styles.hint}>Loading requisitions available for consolidation…</p>
      ) : !hasAnyRequisitions ? (
        <p className={styles.hint}>
          No pending or approved requisitions are currently available to consolidate within your
          scope.
        </p>
      ) : (
        <div className={styles.layout}>
          <div className={styles.treeCol}>
            {organizations.map((college) => (
              <div key={college.collegeId} className={styles.collegeBlock}>
                <h3 className={styles.collegeName}>
                  {resolveOrgLabels(college.collegeId, null).collegeName}
                </h3>

                {college.faculties.map((faculty) => (
                  <div key={faculty.facultyId} className={styles.facultyBlock}>
                    <h4 className={styles.facultyName}>
                      {resolveOrgLabels(college.collegeId, faculty.facultyId).facultyName}
                    </h4>

                    {faculty.departments.map((dept) => {
                      const allSelected =
                        dept.requisitions.length > 0 &&
                        dept.requisitions.every((r) => selectedIds.has(r._id));

                      return (
                        <div key={dept.department} className={styles.deptBlock}>
                          <div className={styles.deptHeader}>
                            <label className={styles.deptSelectAll}>
                              <input
                                type="checkbox"
                                checked={allSelected}
                                onChange={() => toggleDepartment(dept.requisitions, allSelected)}
                              />
                              <span>{dept.department === "N/A" ? "Unassigned" : dept.department}</span>
                            </label>
                          </div>

                          <ul className={styles.reqList}>
                            {dept.requisitions.map((req) => (
                              <li key={req._id} className={styles.reqItem}>
                                <label className={styles.reqLabel}>
                                  <input
                                    type="checkbox"
                                    checked={selectedIds.has(req._id)}
                                    onChange={() => toggleOne(req._id)}
                                  />
                                  <span className={styles.reqInfo}>
                                    <span className="mono">
                                      {req.requisitionNumber || req._id.slice(-6)}
                                    </span>
                                    <span className={styles.reqCategory}>{req.category}</span>
                                    <span className={styles.reqRequester}>
                                      {req.requester?.fullName || "Unknown requester"}
                                    </span>
                                  </span>
                                  <span className={styles.reqRight}>
                                    <Badge status={req.status} />
                                    <span className="mono">{formatNaira(req.estimatedCost)}</span>
                                  </span>
                                </label>
                              </li>
                            ))}
                          </ul>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            ))}
          </div>

          <form onSubmit={handleSubmit} className={styles.summaryCol}>
            <h3 className={styles.summaryHeading}>Consolidated Requisition</h3>

            <div className={styles.summaryStat}>
              <span className={styles.summaryLabel}>Selected requisitions</span>
              <span className={styles.summaryValue}>{selectedRequisitions.length}</span>
            </div>
            <div className={styles.summaryStat}>
              <span className={styles.summaryLabel}>Combined estimated cost</span>
              <span className={styles.summaryValue}>{formatNaira(selectedTotal)}</span>
            </div>

            {selectedRequisitions.length > 0 && (
              <ul className={styles.selectedList}>
                {selectedRequisitions.map((r) => (
                  <li key={r._id} className={styles.selectedListItem}>
                    <span className="mono">{r.requisitionNumber || r._id.slice(-6)}</span>
                    <button
                      type="button"
                      className={styles.removeBtn}
                      onClick={() => toggleOne(r._id)}
                      aria-label="Remove from selection"
                    >
                      <i className="bi bi-x-lg" />
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <SelectField
              label="Category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              {REQUISITION_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </SelectField>

            <SelectField
              label="Urgency"
              value={urgency}
              onChange={(e) => setUrgency(e.target.value)}
            >
              {URGENCY_LEVELS.map((u) => (
                <option key={u.value} value={u.value}>
                  {u.label}
                </option>
              ))}
            </SelectField>

            <div className={inputStyles.field}>
              <label htmlFor="purpose" className={inputStyles.label}>
                Purpose
              </label>
              <textarea
                id="purpose"
                className={inputStyles.input}
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                placeholder="Describe the combined purpose of this consolidated requisition"
                rows={4}
              />
            </div>

            <Button type="submit" fullWidth loading={submitting} disabled={selectedIds.size === 0}>
              Create Consolidated Requisition
            </Button>
            <p className={styles.summaryNote}>
              This creates a draft. You can review it and submit it into the approval workflow
              afterward.
            </p>
          </form>
        </div>
      )}
    </div>
  );
}
