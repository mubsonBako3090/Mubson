"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import toast from "react-hot-toast";
import axios from "axios";

import InputField from "@/components/forms/InputField";
import SelectField from "@/components/forms/SelectField";
import CollegeFacultyDeptSelect from "@/components/forms/CollegeFacultyDeptSelect";
import Button from "@/components/ui/Button";

import {
  SELF_REGISTERABLE_ROLES,
  ROLE_LABELS,
  ORG_FIELD_NOT_APPLICABLE,
} from "@/constants/roles";

import styles from "./page.module.css";

const initialState = {
  fullName: "",
  email: "",
  password: "",
  confirmPassword: "",
  role: "",
  collegeId: "",
  facultyId: "",
  department: "",
};

export default function RegisterPage() {
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
    /*
     * Reset all organizational values when the role changes.
     *
     * CollegeFacultyDeptSelect will then automatically set
     * the fields that do not apply to N/A.
     */
    update({
      role,
      collegeId: "",
      facultyId: "",
      department: "",
    });
  }

  async function handleSubmit(e) {
    e.preventDefault();

    if (form.password !== form.confirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }

    if (!form.role) {
      toast.error("Please select a role.");
      return;
    }

    setLoading(true);

    try {
      await axios.post("/api/auth/register", {
        fullName: form.fullName,
        email: form.email,
        password: form.password,
        role: form.role,

        collegeId:
          form.collegeId || ORG_FIELD_NOT_APPLICABLE,

        facultyId:
          form.facultyId || ORG_FIELD_NOT_APPLICABLE,

        department:
          form.department || ORG_FIELD_NOT_APPLICABLE,
      });

      toast.success(
        "Registration submitted — await admin approval."
      );

      router.push("/login");
    } catch (err) {
      toast.error(
        err.response?.data?.message ||
          "Registration failed."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.card}>
      <h2 className={styles.title}>
        Create an account
      </h2>

      <p className={styles.subtitle}>
        Your account will need admin approval before you can
        log in.
      </p>

      <form onSubmit={handleSubmit}>
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

          {SELF_REGISTERABLE_ROLES.map((role) => (
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

        <InputField
          id="password"
          label="Password"
          type="password"
          required
          value={form.password}
          onChange={(e) =>
            update({
              password: e.target.value,
            })
          }
        />

        <InputField
          id="confirmPassword"
          label="Confirm password"
          type="password"
          required
          value={form.confirmPassword}
          onChange={(e) =>
            update({
              confirmPassword: e.target.value,
            })
          }
        />

        <Button
          type="submit"
          fullWidth
          loading={loading}
        >
          Register
        </Button>
      </form>

      <p className={styles.footerText}>
        Already have an account?{" "}
        <Link
          href="/login"
          className={styles.link}
        >
          Sign in
        </Link>
      </p>
    </div>
  );
        }
