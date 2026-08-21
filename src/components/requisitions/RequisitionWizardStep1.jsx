"use client";

import SelectField from "@/components/forms/SelectField";
import RequestingOrganizationSelect from "@/components/requisitions/RequestingOrganizationSelect";

import styles from "./RequisitionWizardStep1.module.css";

import {
  REQUISITION_CATEGORIES,
  URGENCY_LEVELS,
} from "@/constants/requisitionOptions";

import { ROLES } from "@/constants/roles";

export default function RequisitionWizardStep1({
  data,
  onChange,
  requesterRole,
}) {
  const isProcurement =
    requesterRole === ROLES.PROCUREMENT;

  return (
    <div className={styles.wrapper}>
      {/* ------------------------------------------------
          PROCUREMENT REQUESTING ORGANIZATION
      ------------------------------------------------ */}

      {isProcurement && (
        <RequestingOrganizationSelect
          value={{
            collegeId:
              data.collegeId || "",

            facultyId:
              data.facultyId || "",

            department:
              data.department || "",
          }}
          onChange={onChange}
        />
      )}

      {/* ------------------------------------------------
          CATEGORY
      ------------------------------------------------ */}

      <SelectField
        id="category"
        label="Category"
        required
        value={
          data.category || ""
        }
        onChange={(e) =>
          onChange({
            category:
              e.target.value,
          })
        }
      >
        <option value="">
          Select category
        </option>

        {REQUISITION_CATEGORIES.map(
          (category) => (
            <option
              key={category}
              value={category}
            >
              {category}
            </option>
          )
        )}
      </SelectField>

      {/* ------------------------------------------------
          URGENCY
      ------------------------------------------------ */}

      <SelectField
        id="urgency"
        label="Urgency"
        required
        value={
          data.urgency || ""
        }
        onChange={(e) =>
          onChange({
            urgency:
              e.target.value,
          })
        }
      >
        <option value="">
          Select urgency
        </option>

        {URGENCY_LEVELS.map(
          (urgency) => (
            <option
              key={urgency.value}
              value={urgency.value}
            >
              {urgency.label}
            </option>
          )
        )}
      </SelectField>

      {/* ------------------------------------------------
          PURPOSE
      ------------------------------------------------ */}

      <div className={styles.field}>
        <label
          htmlFor="purpose"
          className={styles.label}
        >
          Purpose / Justification
        </label>

        <textarea
          id="purpose"
          className={styles.textarea}
          rows={4}
          required
          value={
            data.purpose || ""
          }
          onChange={(e) =>
            onChange({
              purpose:
                e.target.value,
            })
          }
          placeholder="Explain why this requisition is needed…"
        />
      </div>
    </div>
  );
      }
