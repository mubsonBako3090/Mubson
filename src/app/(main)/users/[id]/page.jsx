"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
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

export default function EditUserPage() {
  const { id } = useParams();
  const router = useRouter();

  const [user, setUser] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    axios
      .get(`/api/users/${id}`)
      .then(({ data }) => {
        setUser(data.user);
      })
      .catch((err) => {
        toast.error(
          err.response?.data?.message ||
            "Failed to load user."
        );
      });
  }, [id]);

  function update(partial) {
    setUser((current) => ({
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

  async function handleSave(e) {
    e.preventDefault();

    setSaving(true);

    try {
      const {
        fullName,
        role,
        collegeId,
        facultyId,
        department,
      } = user;

      await axios.patch(`/api/users/${id}`, {
        fullName,
        role,

        collegeId:
          collegeId || ORG_FIELD_NOT_APPLICABLE,

        facultyId:
          facultyId || ORG_FIELD_NOT_APPLICABLE,

        department:
          department || ORG_FIELD_NOT_APPLICABLE,
      });

      toast.success("User updated.");
      router.push("/users");
    } catch (err) {
      toast.error(
        err.response?.data?.message ||
          "Update failed."
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleActive() {
    const nextStatus =
      user.accountStatus === "deactivated"
        ? "active"
        : "deactivated";

    setSaving(true);

    try {
      const { data } = await axios.patch(
        `/api/users/${id}`,
        {
          accountStatus: nextStatus,
        }
      );

      setUser(data.user);

      toast.success(
        nextStatus === "deactivated"
          ? "Account deactivated."
          : "Account reactivated."
      );
    } catch (err) {
      toast.error(
        err.response?.data?.message ||
          "Update failed."
      );
    } finally {
      setSaving(false);
    }
  }

  if (!user) {
    return <p>Loading…</p>;
  }

  const inviteRoles = ALL_ROLES.filter(
    (role) => role !== ROLES.ADMIN
  );

  return (
    <div className={styles.wrapper}>
      <h1 className={styles.heading}>
        Edit User
      </h1>

      <form
        onSubmit={handleSave}
        className={styles.form}
      >
        <InputField
          id="fullName"
          label="Full name"
          required
          value={user.fullName}
          onChange={(e) =>
            update({
              fullName: e.target.value,
            })
          }
        />

        <InputField
          id="email"
          label="Email address"
          value={user.email}
          disabled
        />

        <SelectField
          id="role"
          label="Role"
          required
          value={user.role}
          onChange={(e) =>
            handleRoleChange(e.target.value)
          }
          disabled={user.isSystemAdmin}
        >
          {inviteRoles.map((role) => (
            <option key={role} value={role}>
              {ROLE_LABELS[role]}
            </option>
          ))}
        </SelectField>

        <CollegeFacultyDeptSelect
          value={{
            collegeId: user.collegeId,
            facultyId: user.facultyId,
            department: user.department,
          }}
          onChange={update}
          role={user.role}
        />

        <div className={styles.actions}>
          <Button
            type="submit"
            loading={saving}
          >
            Save Changes
          </Button>

          {!user.isSystemAdmin && (
            <Button
              type="button"
              variant={
                user.accountStatus === "deactivated"
                  ? "secondary"
                  : "danger"
              }
              onClick={handleToggleActive}
              loading={saving}
            >
              {user.accountStatus === "deactivated"
                ? "Reactivate Account"
                : "Deactivate Account"}
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}
