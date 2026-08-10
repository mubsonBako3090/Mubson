import { getCurrentUser } from "@/lib/getCurrentUser";
import { ROLES } from "@/constants/roles";
import RequesterDashboard from "@/components/dashboard/RequesterDashboard";
import HODDashboard from "@/components/dashboard/HODDashboard";
import DeanDashboard from "@/components/dashboard/DeanDashboard";
import ProvostDashboard from "@/components/dashboard/ProvostDashboard";
import VCDashboard from "@/components/dashboard/VCDashboard";
import ProcurementDashboard from "@/components/dashboard/ProcurementDashboard";
import AdminDashboard from "@/components/dashboard/AdminDashboard";

const DASHBOARD_BY_ROLE = {
  [ROLES.REQUESTER]: RequesterDashboard,
  [ROLES.HOD]: HODDashboard,
  [ROLES.DEAN]: DeanDashboard,
  [ROLES.PROVOST]: ProvostDashboard,
  [ROLES.VC]: VCDashboard,
  [ROLES.PROCUREMENT]: ProcurementDashboard,
  [ROLES.ADMIN]: AdminDashboard,
};

export default async function DashboardPage() {
  const user = await getCurrentUser();
  const DashboardComponent = DASHBOARD_BY_ROLE[user.role] || RequesterDashboard;

  return <DashboardComponent user={user} />;
}
