"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import toast from "react-hot-toast";
import Button from "@/components/ui/Button";
import RequisitionWizardStep1 from "@/components/requisitions/RequisitionWizardStep1";
import RequisitionWizardStep2 from "@/components/requisitions/RequisitionWizardStep2";
import RequisitionWizardStep3 from "@/components/requisitions/RequisitionWizardStep3";
import styles from "./page.module.css";

const STEPS = ["Details", "Items", "Review & Submit"];

export default function NewRequisitionPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [requisitionId, setRequisitionId] = useState(null);
  const [data, setData] = useState({ category: "", urgency: "", purpose: "", items: [], attachments: [] });
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  function update(partial) {
    setData((d) => ({ ...d, ...partial }));
  }

  // Saves current progress as a draft — either creates it (first save) or
  // updates the existing draft (subsequent saves), so the user can leave
  // and resume from wherever they stopped.
  async function saveDraft({ silent = false } = {}) {
    setSaving(true);
    try {
      const payload = { category: data.category, purpose: data.purpose, urgency: data.urgency, items: data.items };
      if (requisitionId) {
        const { data: res } = await axios.patch(`/api/requisitions/${requisitionId}`, payload);
        if (!silent) toast.success("Draft saved.");
        return res.requisition;
      } else {
        const { data: res } = await axios.post("/api/requisitions", payload);
        setRequisitionId(res.requisition._id);
        if (!silent) toast.success("Draft saved.");
        return res.requisition;
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to save draft.");
      return null;
    } finally {
      setSaving(false);
    }
  }

  async function handleNext() {
    await saveDraft({ silent: true });
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }

  function handleBack() {
    setStep((s) => Math.max(s - 1, 0));
  }

  async function handleSubmit() {
    const saved = await saveDraft({ silent: true });
    if (!saved) return;

    setSubmitting(true);
    try {
      await axios.post(`/api/requisitions/${saved._id}/submit`);
      toast.success("Requisition submitted for approval.");
      router.push(`/requisitions/${saved._id}`);
    } catch (err) {
      toast.error(err.response?.data?.message || "Submission failed.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className={styles.wrapper}>
      <h1 className={styles.heading}>New Requisition</h1>

      <div className={styles.steps}>
        {STEPS.map((label, i) => (
          <div key={label} className={`${styles.stepIndicator} ${i === step ? styles.stepActive : ""} ${i < step ? styles.stepDone : ""}`}>
            <span className={styles.stepNumber}>{i + 1}</span>
            <span className={styles.stepLabel}>{label}</span>
          </div>
        ))}
      </div>

      <div className={styles.stepBody}>
        {step === 0 && <RequisitionWizardStep1 data={data} onChange={update} />}
        {step === 1 && <RequisitionWizardStep2 items={data.items} onChange={update} />}
        {step === 2 && (
          <RequisitionWizardStep3
            data={data}
            requisitionId={requisitionId}
            onAttachmentsUploaded={(attachments) => update({ attachments })}
          />
        )}
      </div>

      <div className={styles.actions}>
        <div className={styles.actionsLeft}>
          {step > 0 && (
            <Button variant="ghost" onClick={handleBack}>
              Back
            </Button>
          )}
        </div>
        <div className={styles.actionsRight}>
          <Button variant="secondary" onClick={() => saveDraft()} loading={saving}>
            Save Draft
          </Button>
          {step < STEPS.length - 1 ? (
            <Button onClick={handleNext} loading={saving}>
              Next
            </Button>
          ) : (
            <Button onClick={handleSubmit} loading={submitting}>
              Submit for Approval
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
