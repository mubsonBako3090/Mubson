"use client";

import { useState } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import Button from "@/components/ui/Button";
import { ROLES } from "@/constants/roles";
import { useAuthStore } from "@/store/authStore";
import styles from "./ProcurementReviewPanel.module.css";

export default function ProcurementProcessingPanel({ requisition, onUpdated }) {
  const user = useAuthStore((s) => s.user);
  const step = requisition?.approvalChain?.[requisition.currentStepIndex];
  const isAssigned =
    user?.role === ROLES.PROCUREMENT &&
    step?.role === ROLES.PROCUREMENT &&
    step?.type === "processing" &&
    String(step?.approver?._id || step?.approver) === String(user?.id);

  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(null);

  if (!isAssigned || requisition?.status !== "approved") return null;

  async function act(action) {
    setBusy(action);
    try {
      const { data } = await axios.post(
        `/api/requisitions/${requisition._id}/procurement-processing`,
        { action, comment }
      );
      toast.success(action === "start" ? "Procurement processing started." : "Procurement processing completed.");
      setComment("");
      onUpdated?.(data.requisition);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to update Procurement processing.");
    } finally {
      setBusy(null);
    }
  }

  const status = requisition.procurementStatus;

  return (
    <section className={styles.panel}>
      <div className={styles.header}>
        <div>
          <h3>Procurement Processing</h3>
          <p>
            VC has approved the market-surveyed amount. Continue with procurement processing
            and record completion when the procurement action is finished.
          </p>
        </div>
      </div>

      <p><strong>Status:</strong> {status || "ready"}</p>

      <label className={styles.label}>
        Processing Note (optional)
        <textarea
          className={styles.textarea}
          rows={3}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Record a procurement processing note…"
        />
      </label>

      <div className={styles.actions}>
        {status === "ready" && (
          <Button type="button" onClick={() => act("start")} loading={busy === "start"}>
            <i className="bi bi-play-fill" /> Start Processing
          </Button>
        )}
        {status === "processing" && (
          <Button type="button" onClick={() => act("complete")} loading={busy === "complete"}>
            <i className="bi bi-check-lg" /> Complete Processing
          </Button>
        )}
      </div>
    </section>
  );
      }
