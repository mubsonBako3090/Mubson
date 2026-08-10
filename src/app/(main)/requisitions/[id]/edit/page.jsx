"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import axios from "axios";
import toast from "react-hot-toast";
import Button from "@/components/ui/Button";
import RequisitionWizardStep1 from "@/components/requisitions/RequisitionWizardStep1";
import RequisitionWizardStep2 from "@/components/requisitions/RequisitionWizardStep2";
import RequisitionWizardStep3 from "@/components/requisitions/RequisitionWizardStep3";
import wizardStyles from "./page.module.css";

const STEPS = ["Details", "Items", "Review & Submit"];

export default function EditRequisitionPage() {
  const { id } = useParams();
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [data, setData] = useState(null);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    axios
      .get(`/api/requisitions/${id}`)
      .then(({ data: res }) => setData(res.requisition))
      .catch((err) => toast.error(err.response?.data?.message || "Failed to load requisition."));
  }, [id]);

  function update(partial) {
    setData((d) => ({ ...d, ...partial }));
  }

  async function saveDraft({ silent = false } = {}) {
    setSaving(true);
    try {
      const payload = { category: data.category, purpose: data.purpose, urgency: data.urgency, items: data.items };
      const { data: res } = await axios.patch(`/api/requisitions/${id}`, payload);
      if (!silent) toast.success("Changes saved.");
      return res.requisition;
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to save.");
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
      await axios.post(`/api/requisitions/${id}/submit`);
      toast.success("Requisition submitted for approval.");
      router.push(`/requisitions/${id}`);
    } catch (err) {
      toast.error(err.response?.data?.message || "Submission failed.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!data) return <p>Loading…</p>;

  return (
    <div className={wizardStyles.wrapper}>
      <h1 className={wizardStyles.heading}>
        {data.status === "returned" ? "Amend & Resubmit Requisition" : "Resume Draft"}
      </h1>

      <div className={wizardStyles.steps}>
        {STEPS.map((label, i) => (
          <div
            key={label}
            className={`${wizardStyles.stepIndicator} ${i === step ? wizardStyles.stepActive : ""} ${
              i < step ? wizardStyles.stepDone : ""
            }`}
          >
            <span className={wizardStyles.stepNumber}>{i + 1}</span>
            <span className={wizardStyles.stepLabel}>{label}</span>
          </div>
        ))}
      </div>

      <div className={wizardStyles.stepBody}>
        {step === 0 && <RequisitionWizardStep1 data={data} onChange={update} />}
        {step === 1 && <RequisitionWizardStep2 items={data.items} onChange={update} />}
        {step === 2 && (
          <RequisitionWizardStep3
            data={data}
            requisitionId={id}
            onAttachmentsUploaded={(attachments) => update({ attachments })}
          />
        )}
      </div>

      <div className={wizardStyles.actions}>
        <div className={wizardStyles.actionsLeft}>
          {step > 0 && (
            <Button variant="ghost" onClick={handleBack}>
              Back
            </Button>
          )}
        </div>
        <div className={wizardStyles.actionsRight}>
          <Button variant="secondary" onClick={() => saveDraft()} loading={saving}>
            Save Changes
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
