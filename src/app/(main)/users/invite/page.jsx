"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import toast from "react-hot-toast";

import InputField from "@/components/forms/InputField";
import SelectField from "@/components/forms/SelectField";
import CollegeFacultyDeptSelect from "@/components/forms/CollegeFacultyDeptSelect";
import Button from "@/components/ui/Button";

import {
  ALL_ROLES,
  ROLE_LABELS,
  ROLES,
  ORG_FIELD_NOT_APPLICABLE,
} from "@/constants/roles";

import styles from "./page.module.css";

const initialState = {
  fullName: "",
  email: "",
  role: "",
  collegeId: "",
  facultyId: "",
  department: "",
};

export default function InviteUserPage() {
  const router = useRouter();

  const [form, setForm] = useState(initialState);
  const [loading, setLoading] = useState(false);

  function update(partial) {
    setForm((current) => ({
      ...current,
      ...partial,
    }));
  }

  function handleRoleChange(role) {
    update({
      role,
      collegeId: "",
      facultyId: "",
      department: "",
    });
  }

  async function handleSubmit(e) {
    e.preventDefault();

    if (!form.role) {
      toast.error("Please select a role.");
      return;
    }

    setLoading(true);

    try {
      await axios.post("/api/users", {
        fullName: form.fullName,
        email: form.email,
        role: form.role,

        collegeId:
          form.collegeId || ORG_FIELD_NOT_APPLICABLE,

        facultyId:
          form.facultyId || ORG_FIELD_NOT_APPLICABLE,

        department:
          form.department || ORG_FIELD_NOT_APPLICABLE,
      });

      toast.success(
        "User invited — they'll receive an email to set their password."
      );

      router.push("/users");
    } catch (err) {
      toast.error(
        err.response?.data?.message ||
          "Invite failed."
      );
    } finally {
      setLoading(false);
    }
  }

  // Admin accounts are created separately.
  const inviteRoles = ALL_ROLES.filter(
    (role) => role !== ROLES.ADMIN
  );

  return (
    <div className={styles.wrapper}>
      <h1 className={styles.heading}>
        Invite a User
      </h1>

      <p className={styles.subheading}>
        The account will be active immediately — no
        self-registration approval needed.
      </p>

      <form
        onSubmit={handleSubmit}
        className={styles.form}
      >
        <InputField
          id="fullName"
          label="Full name"
          required
          value={form.fullName}
          onChange={(e) =>
            update({
              fullName: e.target.value,
            })
          }
        />

        <InputField
          id="email"
          label="Email address"
          type="email"
          required
          value={form.email}
          onChange={(e) =>
            update({
              email: e.target.value,
            })
          }
        />

        <SelectField
          id="role"
          label="Role"
          required
          value={form.role}
          onChange={(e) =>
            handleRoleChange(e.target.value)
          }
        >
          <option value="">
            Select role
          </option>

          {inviteRoles.map((role) => (
            <option key={role} value={role}>
              {ROLE_LABELS[role]}
            </option>
          ))}
        </SelectField>

        <CollegeFacultyDeptSelect
          value={{
            collegeId: form.collegeId,
            facultyId: form.facultyId,
            department: form.department,
          }}
          onChange={update}
          role={form.role}
        />

        <Button
          type="submit"
          loading={loading}
        >
          Send Invite
        </Button>
      </form>
    </div>
  );
}
