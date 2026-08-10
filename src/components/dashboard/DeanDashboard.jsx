"use client";

import ApproverDashboardBase from "./ApproverDashboardBase";

export default function DeanDashboard({ user }) {
  return <ApproverDashboardBase user={user} roleLabel="Dean of Faculty" />;
}
