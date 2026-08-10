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

// Roles that can register themselves.
// Admin accounts are handled separately.
export const SELF_REGISTERABLE_ROLES = [
  ROLES.REQUESTER,
  ROLES.HOD,
  ROLES.DEAN,
  ROLES.PROVOST,
  ROLES.VC,
  ROLES.PROCUREMENT,
];

// Roles that participate in the approval chain.
export const APPROVER_ROLES = [
  ROLES.HOD,
  ROLES.DEAN,
  ROLES.PROVOST,
  ROLES.VC,
];

export const ALL_ROLES = Object.values(ROLES);

/*
 * Organizational scope for each role.
 *
 * Requester:
 *   College → Faculty → Department
 *
 * HOD:
 *   College → Faculty → Department
 *
 * Dean:
 *   College → Faculty
 *
 * Provost:
 *   College only
 *
 * Vice Chancellor:
 *   University-wide — no College, Faculty or Department
 *
 * Procurement Officer:
 *   University-wide — no College, Faculty or Department
 *
 * Admin:
 *   University-wide — no organizational placement
 */
export const ROLE_ORG_SCOPE = {
  [ROLES.REQUESTER]: ["collegeId", "facultyId", "department"],
  [ROLES.HOD]: ["collegeId", "facultyId", "department"],
  [ROLES.DEAN]: ["collegeId", "facultyId"],
  [ROLES.PROVOST]: ["collegeId"],
  [ROLES.VC]: [],
  [ROLES.PROCUREMENT]: [],
  [ROLES.ADMIN]: [],
};

// Value used for organizational fields that do not apply
// to the selected role.
export const ORG_FIELD_NOT_APPLICABLE = "N/A";
