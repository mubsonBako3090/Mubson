"use client";

import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import Button from "@/components/ui/Button";
import { formatNaira } from "@/utils/formatNaira";
import { ROLES } from "@/constants/roles";
import styles from "./ProcurementReviewPanel.module.css";

export default function ProcurementReviewPanel({
  requisition,
  onUpdated,
}) {
  const currentStep =
    requisition?.approvalChain?.[
      requisition.currentStepIndex
    ];

  const isReviewStage =
    currentStep?.role === ROLES.PROCUREMENT &&
    currentStep?.type === "procurement_review";

  // ...rest of your existing code
  const [items, setItems] = useState([]);
  const [notes, setNotes] = useState(requisition?.procurementNotes || "");
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!requisition) return;
    setItems(
      (requisition.items || []).map((item) => ({
        procurementUnitCost:
          item.procurementUnitCost ?? item.unitCost ?? 0,
        procurementNote: item.procurementNote || "",
      }))
    );
    setNotes(requisition.procurementNotes || "");
  }, [requisition]);

  const total = useMemo(
    () =>
      (requisition?.items || []).reduce(
        (sum, item, index) =>
          sum + Number(item.quantity || 0) * Number(items[index]?.procurementUnitCost || 0),
        0
      ),
    [requisition?.items, items]
  );

  if (!isReviewStage) return null;

  function updateItem(index, field, value) {
    setItems((current) =>
      current.map((item, i) => (i === index ? { ...item, [field]: value } : item))
    );
  }

  async function saveReview() {
    setSaving(true);
    try {
      const { data } = await axios.patch(`/api/requisitions/${requisition._id}/procurement-review`, {
        items: items.map((item) => ({
          procurementUnitCost: Number(item.procurementUnitCost),
          procurementNote: item.procurementNote,
        })),
        notes,
      });
      toast.success("Market-survey prices saved.");
      onUpdated?.(data.requisition);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to save Procurement review.");
    } finally {
      setSaving(false);
    }
  }

  async function submitToVc() {
    if (items.some((item) => item.procurementUnitCost === "" || Number(item.procurementUnitCost) < 0)) {
      toast.error("Enter a valid market-survey cost for every item.");
      return;
    }

    setSubmitting(true);
    try {
      await axios.patch(`/api/requisitions/${requisition._id}/procurement-review`, {
        items: items.map((item) => ({
          procurementUnitCost: Number(item.procurementUnitCost),
          procurementNote: item.procurementNote,
        })),
        notes,
      });

      const { data } = await axios.post(`/api/requisitions/${requisition._id}/procurement-review`, {
        comment,
      });

      toast.success("Market survey and BOQ pricing submitted to the VC.");
      onUpdated?.(data.requisition);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to submit to VC.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className={styles.panel}>
      <div className={styles.header}>
        <div>
          <h3>Procurement Market Survey</h3>
          <p>
            Review the requested prices against current market prices. Procurement may adjust
            the unit cost of every item and provide a reason before sending the BOQ to the VC.
          </p>
        </div>
        <Button
          type="button"
          variant="secondary"
          onClick={() => window.open(`/api/requisitions/${requisition._id}/pdf?type=boq`, "_blank")}
        >
          <i className="bi bi-file-earmark-pdf" /> Generate BOQ
        </Button>
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>#</th>
              <th>Item</th>
              <th>Qty</th>
              <th>Requested Unit Cost</th>
              <th>Market Unit Cost</th>
              <th>Market Total</th>
              <th>Reason / Note</th>
            </tr>
          </thead>
          <tbody>
            {(requisition.items || []).map((item, index) => {
              const marketCost = Number(items[index]?.procurementUnitCost || 0);
              return (
                <tr key={`${item.name}-${index}`}>
                  <td>{index + 1}</td>
                  <td>{item.name}</td>
                  <td>{item.quantity}</td>
                  <td>{formatNaira(item.requestedUnitCost ?? item.unitCost)}</td>
                  <td>
                    <input
                      className={styles.input}
                      type="number"
                      min="0"
                      step="0.01"
                      value={items[index]?.procurementUnitCost ?? ""}
                      onChange={(e) => updateItem(index, "procurementUnitCost", e.target.value)}
                    />
                  </td>
                  <td>{formatNaira(Number(item.quantity || 0) * marketCost)}</td>
                  <td>
                    <input
                      className={styles.input}
                      type="text"
                      placeholder="Reason for price"
                      value={items[index]?.procurementNote || ""}
                      onChange={(e) => updateItem(index, "procurementNote", e.target.value)}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <th colSpan="5" className={styles.totalLabel}>Revised Market-Survey Total</th>
              <th className={styles.total}>{formatNaira(total)}</th>
              <th />
            </tr>
          </tfoot>
        </table>
      </div>

      <label className={styles.label}>
        Procurement Market Survey Notes
        <textarea
          className={styles.textarea}
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Summarise quotations, market checks, supplier comparisons, or other pricing considerations."
        />
      </label>

      <label className={styles.label}>
        Comment to VC (optional)
        <textarea
          className={styles.textarea}
          rows={2}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Message that will accompany the submission to the VC."
        />
      </label>

      <div className={styles.actions}>
        <Button type="button" variant="secondary" onClick={saveReview} loading={saving}>
          <i className="bi bi-save" /> Save Market Survey
        </Button>
        <Button type="button" onClick={submitToVc} loading={submitting}>
          <i className="bi bi-send" /> Save & Submit to VC
        </Button>
      </div>
    </section>
  );
          }
