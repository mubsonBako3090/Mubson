import { getCollegeById } from "@/constants/colleges";
import { ROLES } from "@/constants/roles";
import User from "@/models/User";

const ESCALATION_THRESHOLD = Number(process.env.ESCALATION_THRESHOLD || 10000000);

// Role sequence for each routing type. "governor" is a virtual step —
// there's no Governor user account in-system; it's represented as an
// extra checkpoint on the VC step when the threshold is crossed, and the
// UI/PDF can render it accordingly. Chain always terminates at Procurement.
const ROUTING_CHAINS = {
  standard: [ROLES.HOD, ROLES.DEAN, ROLES.PROVOST, ROLES.VC],
  postgraduate: [ROLES.HOD, ROLES.PROVOST, ROLES.VC], // HOD here = Postgraduate Programme Coordinator
  basicStudies: [ROLES.HOD, ROLES.PROVOST, ROLES.VC], // HOD here = Coordinator/Lecturer-in-Charge, Provost = Director
};

// Builds the ordered approval chain (role + resolved approver, where one exists)
// for a requisition based on the requester's college/faculty/department and
// the requisition's estimated cost.
export async function buildApprovalChain({ collegeId, facultyId, department, estimatedCost }) {
  const college = getCollegeById(collegeId);
  if (!college) throw new Error(`Unknown college: ${collegeId}`);

  const roleSequence = ROUTING_CHAINS[college.routingType] || ROUTING_CHAINS.standard;
  const requiresGovernorApproval = estimatedCost > ESCALATION_THRESHOLD;

  const chain = [];
  for (const role of roleSequence) {
    const approver = await resolveApproverForStep({ role, collegeId, facultyId, department });
    chain.push({ role, approver: approver ? approver._id : undefined });
  }

  // Final checkpoint: Procurement Unit, after VC (and Governor, if escalated).
  const procurementOfficer = await User.findOne({
    role: ROLES.PROCUREMENT,
    accountStatus: "active",
  });
  chain.push({ role: ROLES.PROCUREMENT, approver: procurementOfficer ? procurementOfficer._id : undefined });

  return { chain, requiresGovernorApproval };
}

// Finds the active user who should act as approver for a given role + org placement.
// HOD/Dean/Provost are scoped to the requester's department/faculty/college;
// VC and Procurement are university-wide (only one of each expected).
async function resolveApproverForStep({ role, collegeId, facultyId, department }) {
  const query = { role, accountStatus: "active" };

  if (role === ROLES.HOD) {
    query.collegeId = collegeId;
    query.facultyId = facultyId;
    query.department = department;
  } else if (role === ROLES.DEAN) {
    query.collegeId = collegeId;
    query.facultyId = facultyId;
  } else if (role === ROLES.PROVOST) {
    query.collegeId = collegeId;
  }
  // VC and Procurement: no extra scoping, university-wide role.

  return User.findOne(query);
}

export function isEscalated(estimatedCost) {
  return estimatedCost > ESCALATION_THRESHOLD;
}

export { ESCALATION_THRESHOLD };
