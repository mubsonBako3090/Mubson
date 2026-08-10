"use client";

import { useEffect, useState } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import InputField from "@/components/forms/InputField";
import Button from "@/components/ui/Button";
import { ROLE_LABELS } from "@/constants/roles";
import { getCollegeById, getFaculty } from "@/constants/colleges";
import styles from "./page.module.css";

export default function SettingsPage() {
  const [user, setUser] = useState(null);
  const [fullName, setFullName] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  const [passwordForm, setPasswordForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => {
    axios
      .get("/api/users/me")
      .then(({ data }) => {
        setUser(data.user);
        setFullName(data.user.fullName);
      })
      .catch((err) => toast.error(err.response?.data?.message || "Failed to load profile."));
  }, []);

  async function handleProfileSave(e) {
    e.preventDefault();
    setSavingProfile(true);
    try {
      const { data } = await axios.patch("/api/users/me", { fullName });
      setUser(data.user);
      toast.success("Profile updated.");
    } catch (err) {
      toast.error(err.response?.data?.message || "Update failed.");
    } finally {
      setSavingProfile(false);
    }
  }

  async function handlePasswordSave(e) {
    e.preventDefault();
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.error("New passwords do not match.");
      return;
    }
    setSavingPassword(true);
    try {
      await axios.post("/api/auth/change-password", {
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      });
      toast.success("Password updated.");
      setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
    } catch (err) {
      toast.error(err.response?.data?.message || "Password change failed.");
    } finally {
      setSavingPassword(false);
    }
  }

  if (!user) return <p>Loading…</p>;

  const college = getCollegeById(user.collegeId);
  const faculty = getFaculty(user.collegeId, user.facultyId);

  return (
    <div className={styles.wrapper}>
      <h1 className={styles.heading}>Settings</h1>

      <section className={styles.section}>
        <h4 className={styles.sectionTitle}>Profile</h4>
        <form onSubmit={handleProfileSave} className={styles.form}>
          <InputField id="fullName" label="Full name" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
          <InputField id="email" label="Email address" value={user.email} disabled />
          <InputField id="role" label="Role" value={ROLE_LABELS[user.role] || user.role} disabled />
          <InputField id="college" label="College" value={college?.name || "-"} disabled />
          <InputField id="faculty" label="Faculty" value={faculty?.name || "-"} disabled />
          <InputField id="department" label="Department" value={user.department} disabled />
          <Button type="submit" loading={savingProfile}>
            Save Profile
          </Button>
        </form>
      </section>

      <section className={styles.section}>
        <h4 className={styles.sectionTitle}>Change Password</h4>
        <form onSubmit={handlePasswordSave} className={styles.form}>
          <InputField
            id="currentPassword"
            label="Current password"
            type="password"
            required
            value={passwordForm.currentPassword}
            onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
          />
          <InputField
            id="newPassword"
            label="New password"
            type="password"
            required
            minLength={8}
            value={passwordForm.newPassword}
            onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
          />
          <InputField
            id="confirmPassword"
            label="Confirm new password"
            type="password"
            required
            minLength={8}
            value={passwordForm.confirmPassword}
            onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
          />
          <Button type="submit" loading={savingPassword}>
            Update Password
          </Button>
        </form>
      </section>

      <section className={styles.section}>
        <h4 className={styles.sectionTitle}>System Info</h4>
        <dl className={styles.infoDl}>
          <dt>Application</dt>
          <dd>KSU Procurement Requisition System</dd>
          <dt>Institution</dt>
          <dd>Kaduna State University</dd>
        </dl>
      </section>
    </div>
  );
}
