// The 7 roles in the system.
export const ROLES = {
  REQUESTER: "requester",
  HOD: "hod",
  DEAN: "dean",
  PROVOST: "provost",
  VC: "vc",
  PROCUREMENT: "procurement",
  ADMIN: "admin",
};

export const ROLE_LABELS = {
  [ROLES.REQUESTER]: "Requester",
  [ROLES.HOD]: "Head of Department",
  [ROLES.DEAN]: "Dean of Faculty",
  [ROLES.PROVOST]: "Provost of College",
  [ROLES.VC]: "Vice Chancellor",
  [ROLES.PROCUREMENT]: "Procurement Officer",
  [ROLES.ADMIN]: "System Administrator",
};

// Roles a user can pick during self-registration.
// Admin is excluded here — admin accounts are created only via the
// register-admin route (capped at 2) or invited by an existing admin.
export const SELF_REGISTERABLE_ROLES = [
  ROLES.REQUESTER,
  ROLES.HOD,
  ROLES.DEAN,
  ROLES.PROVOST,
  ROLES.VC,
  ROLES.PROCUREMENT,
];

// Roles that act as approvers at some point in the chain.
export const APPROVER_ROLES = [
  ROLES.HOD,
  ROLES.DEAN,
  ROLES.PROVOST,
  ROLES.VC,
];

export const ALL_ROLES = Object.values(ROLES);
