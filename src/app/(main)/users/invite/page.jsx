"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import toast from "react-hot-toast";
import InputField from "@/components/forms/InputField";
import SelectField from "@/components/forms/SelectField";
import CollegeFacultyDeptSelect from "@/components/forms/CollegeFacultyDeptSelect";
import Button from "@/components/ui/Button";
import { ALL_ROLES, ROLE_LABELS, ROLES } from "@/constants/roles";
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
    setForm((f) => ({ ...f, ...partial }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      await axios.post("/api/users", form);
      toast.success("User invited — they'll receive an email to set their password.");
      router.push("/users");
    } catch (err) {
      toast.error(err.response?.data?.message || "Invite failed.");
    } finally {
      setLoading(false);
    }
  }

  // Admin accounts are created only through the self-locking /register-admin
  // route, never invited — exclude it here.
  const inviteRoles = ALL_ROLES.filter((r) => r !== ROLES.ADMIN);

  return (
    <div className={styles.wrapper}>
      <h1 className={styles.heading}>Invite a User</h1>
      <p className={styles.subheading}>
        The account will be active immediately — no self-registration approval needed.
      </p>

      <form onSubmit={handleSubmit} className={styles.form}>
        <InputField
          id="fullName"
          label="Full name"
          required
          value={form.fullName}
          onChange={(e) => update({ fullName: e.target.value })}
        />
        <InputField
          id="email"
          label="Email address"
          type="email"
          required
          value={form.email}
          onChange={(e) => update({ email: e.target.value })}
        />

        <SelectField
          id="role"
          label="Role"
          required
          value={form.role}
          onChange={(e) => update({ role: e.target.value })}
        >
          <option value="">Select role</option>
          {inviteRoles.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABELS[r]}
            </option>
          ))}
        </SelectField>

        <CollegeFacultyDeptSelect
          value={{ collegeId: form.collegeId, facultyId: form.facultyId, department: form.department }}
          onChange={update}
        />

        <Button type="submit" loading={loading}>
          Send Invite
        </Button>
      </form>
    </div>
  );
}
