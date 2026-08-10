"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import axios from "axios";
import toast from "react-hot-toast";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import RequisitionItemsTable from "@/components/requisitions/RequisitionItemsTable";
import RequisitionStatusTimeline from "@/components/requisitions/RequisitionStatusTimeline";
import RequisitionCommentThread from "@/components/requisitions/RequisitionCommentThread";
import { formatNaira } from "@/utils/formatNaira";
import { formatDateTime } from "@/utils/formatDate";
import styles from "./page.module.css";

export default function ApprovalActionPage() {
  const { id } = useParams();
  const router = useRouter();
  const [requisition, setRequisition] = useState(null);
  const [comment, setComment] = useState("");
  const [busyAction, setBusyAction] = useState(null); // "approve" | "return" | "reject" | null
  const [showRejectConfirm, setShowRejectConfirm] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data } = await axios.get(`/api/requisitions/${id}`);
      setRequisition(data.requisition);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to load requisition.");
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleApprove() {
    setBusyAction("approve");
    try {
      await axios.post(`/api/approvals/${id}/approve`, { comment });
      toast.success("Requisition approved.");
      router.push("/approvals");
    } catch (err) {
      toast.error(err.response?.data?.message || "Approval failed.");
    } finally {
      setBusyAction(null);
    }
  }

  async function handleReturn() {
    if (!comment.trim()) {
      toast.error("Add a comment explaining what needs clarification.");
      return;
    }
    setBusyAction("return");
    try {
      await axios.post(`/api/approvals/${id}/return`, { comment });
      toast.success("Requisition returned for clarification.");
      router.push("/approvals");
    } catch (err) {
      toast.error(err.response?.data?.message || "Return failed.");
    } finally {
      setBusyAction(null);
    }
  }

  async function handleReject(isFinal) {
    if (!comment.trim()) {
      toast.error("A comment is required to reject a requisition.");
      return;
    }
    setBusyAction("reject");
    try {
      await axios.post(`/api/approvals/${id}/reject`, { comment, isFinal });
      toast.success(isFinal ? "Requisition rejected." : "Requisition rejected and returned to requester.");
      router.push("/approvals");
    } catch (err) {
      toast.error(err.response?.data?.message || "Rejection failed.");
    } finally {
      setBusyAction(null);
      setShowRejectConfirm(false);
    }
  }

  if (!requisition) return <p>Loading…</p>;

  return (
    <div className={styles.wrapper}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.heading}>{requisition.requisitionNumber}</h1>
          <Badge status={requisition.status} />
        </div>
      </div>

      <div className={styles.grid}>
        <div className={styles.mainCol}>
          <section className={styles.section}>
            <h4 className={styles.sectionTitle}>Details</h4>
            <dl className={styles.dl}>
              <dt>Requester</dt>
              <dd>{requisition.requester?.fullName}</dd>
              <dt>Department</dt>
              <dd>{requisition.department}</dd>
              <dt>Category</dt>
              <dd>{requisition.category}</dd>
              <dt>Urgency</dt>
              <dd>{requisition.urgency}</dd>
              <dt>Purpose</dt>
              <dd>{requisition.purpose}</dd>
              <dt>Submitted</dt>
              <dd>{formatDateTime(requisition.submittedAt)}</dd>
            </dl>
          </section>

          <section className={styles.section}>
            <h4 className={styles.sectionTitle}>Items</h4>
            <RequisitionItemsTable items={requisition.items} readOnly />
          </section>

          {requisition.attachments?.length > 0 && (
            <section className={styles.section}>
              <h4 className={styles.sectionTitle}>Supporting Documents</h4>
              <ul className={styles.fileList}>
                {requisition.attachments.map((a) => (
                  <li key={a.publicId}>
                    <a href={a.url} target="_blank" rel="noreferrer">
                      <i className="bi bi-file-earmark" /> {a.fileName}
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <RequisitionCommentThread
            requisitionId={id}
            comments={requisition.comments}
            onCommentAdded={(comments) => setRequisition((r) => ({ ...r, comments }))}
          />

          <section className={styles.section}>
            <h4 className={styles.sectionTitle}>Your Decision</h4>
            <textarea
              className={styles.decisionTextarea}
              rows={3}
              placeholder="Add a comment (required for return/reject, optional for approve)…"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />

            {!showRejectConfirm ? (
              <div className={styles.decisionActions}>
                <Button onClick={handleApprove} loading={busyAction === "approve"}>
                  <i className="bi bi-check-lg" /> Approve
                </Button>
                <Button variant="secondary" onClick={handleReturn} loading={busyAction === "return"}>
                  <i className="bi bi-arrow-return-left" /> Return for Clarification
                </Button>
                <Button variant="danger" onClick={() => setShowRejectConfirm(true)}>
                  <i className="bi bi-x-lg" /> Reject
                </Button>
              </div>
            ) : (
              <div className={styles.rejectConfirm}>
                <p className={styles.rejectPrompt}>Should the requester be allowed to edit and resubmit?</p>
                <div className={styles.decisionActions}>
                  <Button variant="secondary" onClick={() => handleReject(false)} loading={busyAction === "reject"}>
                    Reject — Allow Resubmission
                  </Button>
                  <Button variant="danger" onClick={() => handleReject(true)} loading={busyAction === "reject"}>
                    Reject — Final
                  </Button>
                  <Button variant="ghost" onClick={() => setShowRejectConfirm(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </section>
        </div>

        <div className={styles.sideCol}>
          <section className={styles.section}>
            <h4 className={styles.sectionTitle}>Approval Progress</h4>
            <RequisitionStatusTimeline
              approvalChain={requisition.approvalChain}
              currentStepIndex={requisition.currentStepIndex}
              status={requisition.status}
            />
          </section>

          <section className={styles.section}>
            <h4 className={styles.sectionTitle}>Estimated Cost</h4>
            <div className={styles.costDisplay}>{formatNaira(requisition.estimatedCost)}</div>
            {requisition.requiresGovernorApproval && (
              <p className={styles.escalationNote}>
                <i className="bi bi-exclamation-triangle" /> Exceeds ₦10,000,000 — requires Governor approval.
              </p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
