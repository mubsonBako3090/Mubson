"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import axios from "axios";
import toast from "react-hot-toast";

import Button from "@/components/ui/Button";

import RequisitionWizardStep1 from "@/components/requisitions/RequisitionWizardStep1";
import RequisitionWizardStep2 from "@/components/requisitions/RequisitionWizardStep2";
import RequisitionWizardStep3 from "@/components/requisitions/RequisitionWizardStep3";

import { ROLES } from "@/constants/roles";

import styles from "./page.module.css";

const STEPS = [
  "Details",
  "Items",
  "Review & Submit",
];

export default function NewRequisitionPage() {
  const router = useRouter();

  const [step, setStep] =
    useState(0);

  const [user, setUser] =
    useState(null);

  const [requisitionId, setRequisitionId] =
    useState(null);

  const [data, setData] =
    useState({
      category: "",
      urgency: "",
      purpose: "",
      items: [],
      attachments: [],

      /*
       * Used by Procurement/Dean/Provost to identify
       * the department(s) whose needs are being
       * requested.
       */
      requestingUnits: [],
    });

  const [saving, setSaving] =
    useState(false);

  const [submitting, setSubmitting] =
    useState(false);

  /*
   * Load the authenticated user.
   */
  useEffect(() => {
    axios
      .get("/api/users/me")
      .then(({ data: response }) => {
        setUser(response.user);
      })
      .catch((error) => {
        toast.error(
          error.response?.data?.message ||
            "Failed to load your account."
        );
      });
  }, []);

  function update(partial) {
    setData((current) => ({
      ...current,
      ...partial,
    }));
  }

  /*
   * Save current progress.
   */
  async function saveDraft({
    silent = false,
  } = {}) {
    setSaving(true);

    try {
      const payload = {
        category:
          data.category,

        purpose:
          data.purpose,

        urgency:
          data.urgency,

        items:
          data.items,

        /*
         * These fields are only meaningful
         * for Procurement/Dean/Provost.
         */
        requestingUnits:
          data.requestingUnits,
      };

      if (requisitionId) {
        const {
          data: response,
        } = await axios.patch(
          `/api/requisitions/${requisitionId}`,
          payload
        );

        if (!silent) {
          toast.success(
            "Draft saved."
          );
        }

        return response.requisition;
      }

      const {
        data: response,
      } = await axios.post(
        "/api/requisitions",
        payload
      );

      setRequisitionId(
        response.requisition._id
      );

      if (!silent) {
        toast.success(
          "Draft saved."
        );
      }

      return response.requisition;
    } catch (error) {
      toast.error(
        error.response?.data?.message ||
          "Failed to save draft."
      );

      return null;
    } finally {
      setSaving(false);
    }
  }

  async function handleNext() {
    const saved =
      await saveDraft({
        silent: true,
      });

    if (!saved) return;

    setStep((current) =>
      Math.min(
        current + 1,
        STEPS.length - 1
      )
    );
  }

  function handleBack() {
    setStep((current) =>
      Math.max(current - 1, 0)
    );
  }

  async function handleSubmit() {
    /*
     * Procurement/Dean/Provost must select at least one
     * requesting organization before submission.
     */
    if (
      user?.role === ROLES.PROCUREMENT ||
      user?.role === ROLES.DEAN ||
      user?.role === ROLES.PROVOST
    ) {
      if (
        !data.requestingUnits ||
        data.requestingUnits.length === 0
      ) {
        toast.error(
          "Please select at least one requesting College, Faculty and Department."
        );

        setStep(0);

        return;
      }

      if (data.requestingUnits.length > 1) {
        const untaggedItem = (
          data.items || []
        ).find(
          (item) =>
            !item.requestingDepartment
        );

        if (untaggedItem) {
          toast.error(
            "Please tag every item with which department it's for."
          );

          setStep(1);

          return;
        }
      }
    }

    const saved =
      await saveDraft({
        silent: true,
      });

    if (!saved) return;

    setSubmitting(true);

    try {
      await axios.post(
        `/api/requisitions/${saved._id}/submit`
      );

      toast.success(
        "Requisition submitted for approval."
      );

      router.push(
        `/requisitions/${saved._id}`
      );
    } catch (error) {
      toast.error(
        error.response?.data?.message ||
          "Submission failed."
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (!user) {
    return <p>Loading…</p>;
  }

  return (
    <div className={styles.wrapper}>
      <h1 className={styles.heading}>
        New Requisition
      </h1>

      <div className={styles.steps}>
        {STEPS.map(
          (label, index) => (
            <div
              key={label}
              className={`${styles.stepIndicator} ${
                index === step
                  ? styles.stepActive
                  : ""
              } ${
                index < step
                  ? styles.stepDone
                  : ""
              }`}
            >
              <span
                className={
                  styles.stepNumber
                }
              >
                {index + 1}
              </span>

              <span
                className={
                  styles.stepLabel
                }
              >
                {label}
              </span>
            </div>
          )
        )}
      </div>

      <div
        className={
          styles.stepBody
        }
      >
        {step === 0 && (
          <RequisitionWizardStep1
            data={data}
            onChange={update}
            requesterRole={
              user.role
            }
            requesterCollegeId={
              user.collegeId
            }
            requesterFacultyId={
              user.facultyId
            }
          />
        )}

        {step === 1 && (
          <RequisitionWizardStep2
            items={data.items}
            requestingUnits={data.requestingUnits}
            onChange={update}
          />
        )}

        {step === 2 && (
          <RequisitionWizardStep3
            data={data}
            requisitionId={
              requisitionId
            }
            onAttachmentsUploaded={(
              attachments
            ) =>
              update({
                attachments,
              })
            }
          />
        )}
      </div>

      <div
        className={
          styles.actions
        }
      >
        <div
          className={
            styles.actionsLeft
          }
        >
          {step > 0 && (
            <Button
              variant="ghost"
              onClick={handleBack}
            >
              Back
            </Button>
          )}
        </div>

        <div
          className={
            styles.actionsRight
          }
        >
          <Button
            variant="secondary"
            onClick={() =>
              saveDraft()
            }
            loading={saving}
          >
            Save Draft
          </Button>

          {step <
          STEPS.length - 1 ? (
            <Button
              onClick={handleNext}
              loading={saving}
            >
              Next
            </Button>
          ) : (
            <Button
              onClick={
                handleSubmit
              }
              loading={
                submitting
              }
            >
              Submit for Approval
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
