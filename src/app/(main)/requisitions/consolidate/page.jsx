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
import { ROLES } from "@/constants/roles";
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
  const [userRole, setUserRole] = useState(null);

  const [category, setCategory] = useState(REQUISITION_CATEGORIES[0]);
  const [urgency, setUrgency] = useState("normal");
  const [purpose, setPurpose] = useState("");

  /*
   * Handling an individual requisition separately (return/reject)
   * instead of folding it into the consolidation — one panel open
   * at a time, keyed by requisition id.
   */
  const [handlingId, setHandlingId] = useState(null);
  const [handlingComment, setHandlingComment] = useState("");
  const [handlingBusy, setHandlingBusy] = useState(null); // "return" | "reject" | null
  const [handlingRejectConfirm, setHandlingRejectConfirm] = useState(false);

  /*
   * Dean/Provost/VC: consolidating IS their approval — the
   * result is either sent to the next approver (Dean/Provost)
   * or finalized immediately (VC, the last approval step).
   *
   * Procurement/Admin: consolidating only ever pulls from
   * already-approved requisitions, so the merged result is
   * created ready for processing straight away.
   */
  const isPreApprovalRole =
    userRole === ROLES.DEAN ||
    userRole === ROLES.PROVOST ||
    userRole === ROLES.VC;

  // Dean/Provost specifically: their result is a draft that goes
  // through a review step (drop items/sources) before being sent —
  // VC's result is finalized immediately, same as Procurement/Admin.
  const isDraftOutcomeRole =
    userRole === ROLES.DEAN ||
    userRole === ROLES.PROVOST;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [{ data }, { data: meData }] = await Promise.all([
        axios.get("/api/requisitions/consolidate/organizations"),
        axios.get("/api/users/me"),
      ]);
      setOrganizations(data.organizations || []);
      setUserRole(meData.user?.role || null);
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

  // Removes a requisition from the local tree (and selection) once it's
  // been handled separately — it's no longer eligible for consolidation.
  function removeFromTree(id) {
    setOrganizations((prev) =>
      prev
        .map((college) => ({
          ...college,
          faculties: college.faculties
            .map((faculty) => ({
              ...faculty,
              departments: faculty.departments
                .map((dept) => ({
                  ...dept,
                  requisitions: dept.requisitions.filter((r) => r._id !== id),
                }))
                .filter((dept) => dept.requisitions.length > 0),
            }))
            .filter((faculty) => faculty.departments.length > 0),
        }))
        .filter((college) => college.faculties.length > 0)
    );

    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }

  function openHandlePanel(id) {
    setHandlingId(id);
    setHandlingComment("");
    setHandlingRejectConfirm(false);
    // Can't consolidate and reject/return the same requisition.
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }

  function closeHandlePanel() {
    setHandlingId(null);
    setHandlingComment("");
    setHandlingRejectConfirm(false);
  }

  async function handleReturnOne(id) {
    if (!handlingComment.trim()) {
      toast.error("Add a comment explaining what needs clarification.");
      return;
    }
    setHandlingBusy("return");
    try {
      await axios.post(`/api/approvals/${id}/return`, { comment: handlingComment.trim() });
      toast.success("Requisition returned for clarification.");
      removeFromTree(id);
      closeHandlePanel();
    } catch (err) {
      toast.error(err.response?.data?.message || "Return failed.");
    } finally {
      setHandlingBusy(null);
    }
  }

  async function handleRejectOne(id, isFinal) {
    if (!handlingComment.trim()) {
      toast.error("A comment is required to reject a requisition.");
      return;
    }
    setHandlingBusy("reject");
    try {
      await axios.post(`/api/approvals/${id}/reject`, { comment: handlingComment.trim(), isFinal });
      toast.success(isFinal ? "Requisition rejected." : "Requisition rejected and returned to requester.");
      removeFromTree(id);
      closeHandlePanel();
    } catch (err) {
      toast.error(err.response?.data?.message || "Rejection failed.");
    } finally {
      setHandlingBusy(null);
    }
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

      const created = data.requisition;

      if (created.status === "draft") {
        /*
         * Dean/Provost: consolidating doubles as their
         * approval for the selected requisitions, but they
         * may still want to drop one before it goes out —
         * take them to the review step rather than sending
         * it immediately.
         */
        toast.success("Consolidated draft created — review it before sending.");
        router.push(`/requisitions/consolidate/${created._id}/review`);
        return;
      }

      // VC/Procurement/Admin: already finalized, ready for processing.
      toast.success("Consolidated requisition created and ready for processing.");
      router.push(`/requisitions/${created._id}`);
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
            {isDraftOutcomeRole
              ? "Select requisitions currently pending your approval and merge them into one. Consolidating doubles as your approval — you'll get a chance to review before it's sent to the next approver."
              : isPreApprovalRole
              ? "Select requisitions currently pending your approval and merge them into one. Consolidating doubles as your approval and finalizes them for Procurement."
              : "Select already fully-approved requisitions from the units under your authority and merge them into one for processing."}{" "}
            Each item keeps its originating department for traceability.
          </p>
        </div>
      </div>

      {loading ? (
        <p className={styles.hint}>Loading requisitions available for consolidation…</p>
      ) : !hasAnyRequisitions ? (
        <p className={styles.hint}>
          {isPreApprovalRole
            ? "No requisitions are currently pending your approval within your scope."
            : "No fully-approved requisitions are currently available to consolidate within your scope."}
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

                                {isPreApprovalRole && handlingId !== req._id && (
                                  <button
                                    type="button"
                                    className={styles.handleSeparatelyBtn}
                                    onClick={() => openHandlePanel(req._id)}
                                  >
                                    Handle separately
                                  </button>
                                )}

                                {handlingId === req._id && (
                                  <div className={styles.handlePanel}>
                                    <p className={styles.handlePanelHint}>
                                      Return this requisition for clarification, or reject it — it
                                      won't be included in the consolidation.
                                    </p>

                                    <textarea
                                      className={styles.handlePanelTextarea}
                                      rows={2}
                                      placeholder="Comment (required)…"
                                      value={handlingComment}
                                      onChange={(e) => setHandlingComment(e.target.value)}
                                    />

                                    {!handlingRejectConfirm ? (
                                      <div className={styles.handlePanelActions}>
                                        <Button
                                          type="button"
                                          variant="secondary"
                                          onClick={() => handleReturnOne(req._id)}
                                          loading={handlingBusy === "return"}
                                        >
                                          Return for Clarification
                                        </Button>
                                        <Button
                                          type="button"
                                          variant="danger"
                                          onClick={() => setHandlingRejectConfirm(true)}
                                        >
                                          Reject
                                        </Button>
                                        <Button type="button" variant="ghost" onClick={closeHandlePanel}>
                                          Cancel
                                        </Button>
                                      </div>
                                    ) : (
                                      <div className={styles.handlePanelActions}>
                                        <Button
                                          type="button"
                                          variant="secondary"
                                          onClick={() => handleRejectOne(req._id, false)}
                                          loading={handlingBusy === "reject"}
                                        >
                                          Reject — Allow Resubmission
                                        </Button>
                                        <Button
                                          type="button"
                                          variant="danger"
                                          onClick={() => handleRejectOne(req._id, true)}
                                          loading={handlingBusy === "reject"}
                                        >
                                          Reject — Final
                                        </Button>
                                        <Button
                                          type="button"
                                          variant="ghost"
                                          onClick={() => setHandlingRejectConfirm(false)}
                                        >
                                          Back
                                        </Button>
                                      </div>
                                    )}
                                  </div>
                                )}
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
              {isDraftOutcomeRole
                ? "Consolidate & Review"
                : isPreApprovalRole
                ? "Consolidate & Approve"
                : "Create Consolidated Requisition"}
            </Button>
            <p className={styles.summaryNote}>
              {isDraftOutcomeRole
                ? "This approves the selected requisitions via consolidation. You'll review the merged draft — and can still drop one — before it's sent to the next approver."
                : isPreApprovalRole
                ? "This immediately approves the selected requisitions (via consolidation) and routes the merged requisition to Procurement."
                : "The merged requisition will be created ready for Procurement processing."}
            </p>
          </form>
        </div>
      )}
    </div>
  );
}
