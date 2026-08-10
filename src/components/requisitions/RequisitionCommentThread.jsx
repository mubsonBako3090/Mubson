"use client";

import { useState } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import { formatDateTime } from "@/utils/formatDate";
import Button from "@/components/ui/Button";
import styles from "./RequisitionCommentThread.module.css";

export default function RequisitionCommentThread({ requisitionId, comments = [], onCommentAdded }) {
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  async function handleSend() {
    if (!message.trim()) return;
    setSending(true);
    try {
      const { data } = await axios.patch(`/api/requisitions/${requisitionId}`, {
        type: "comment",
        message,
      });
      onCommentAdded(data.requisition.comments);
      setMessage("");
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to send comment.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className={styles.wrapper}>
      <h3 className={styles.heading}>Clarification Thread</h3>

      <div className={styles.list}>
        {comments.length === 0 && <p className={styles.empty}>No comments yet.</p>}
        {comments.map((c, i) => (
          <div key={i} className={styles.comment}>
            <div className={styles.commentHeader}>
              <span className={styles.author}>{c.author?.fullName || "Unknown"}</span>
              <span className={styles.timestamp}>{formatDateTime(c.createdAt)}</span>
            </div>
            <p className={styles.message}>{c.message}</p>
          </div>
        ))}
      </div>

      <div className={styles.composer}>
        <textarea
          className={styles.textarea}
          rows={2}
          placeholder="Add a response…"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
        <Button onClick={handleSend} loading={sending} disabled={!message.trim()}>
          Send
        </Button>
      </div>
    </div>
  );
}
