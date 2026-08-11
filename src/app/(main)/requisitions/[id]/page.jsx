"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import axios from "axios";
import toast from "react-hot-toast";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import RequisitionItemsTable from "@/components/requisitions/RequisitionItemsTable";
import RequisitionStatusTimeline from "@/components/requisitions/RequisitionStatusTimeline";
import RequisitionCommentThread from "@/components/requisitions/RequisitionCommentThread";
import { formatNaira } from "@/utils/formatNaira";
import { formatDateTime } from "@/utils/formatDate";
import { REQUISITION_STATUS } from "@/constants/requisitionOptions";
import styles from "./page.module.css";

export default function RequisitionDetailPage() {
  const { id } = useParams();
  const [requisition, setRequisition] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await axios.get(`/api/requisitions/${id}`);
      setRequisition(data.requisition);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to load requisition.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <p>Loading…</p>;
  if (!requisition) return <p>Requisition not found.</p>;

  const canEditOrResubmit =
    requisition.status === REQUISITION_STATUS.RETURNED || requisition.status === REQUISITION_STATUS.DRAFT;

  return (
    <div className={styles.wrapper}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.heading}>{requisition.requisitionNumber || "Draft Requisition"}</h1>
          <Badge status={requisition.status} />
        </div>
        <div className={styles.headerActions}>
          <a href={`/api/requisitions/${id}/pdf`} target="_blank" rel="noreferrer">
            <Button variant="secondary">
              <i className="bi bi-file-earmark-pdf" /> Export PDF
            </Button>
          </a>
          {canEditOrResubmit && (
            <Link href={`/requisitions/${id}/edit`}>
              <Button>
                <i className="bi bi-pencil" /> Edit
              </Button>
            </Link>
          )}
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
        </div>

        <div className={styles.sideCol}>
          <section className={styles.section}>
  <h4 className={styles.sectionTitle}>
    Approval Progress
  </h4>

  <RequisitionStatusTimeline
    requisition={requisition}
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
