import { getCollegeById } from "@/constants/colleges";
import { ROLES } from "@/constants/roles";
import User from "@/models/User";

const ESCALATION_THRESHOLD = Number(
  process.env.ESCALATION_THRESHOLD || 10000000
);

/*
|--------------------------------------------------------------------------
| APPROVAL HIERARCHY
|--------------------------------------------------------------------------
|
| Procurement is deliberately NOT included here.
|
| Procurement Officer is a processing role, not an approval role.
|
*/

const ROUTING_CHAINS = {
  standard: [
    ROLES.HOD,
    ROLES.DEAN,
    ROLES.PROVOST,
    ROLES.VC,
  ],

  postgraduate: [
    ROLES.HOD,
    ROLES.PROVOST,
    ROLES.VC,
  ],

  basicStudies: [
    ROLES.HOD,
    ROLES.PROVOST,
    ROLES.VC,
  ],
};

/*
|--------------------------------------------------------------------------
| Build Approval Chain
|--------------------------------------------------------------------------
|
| The chain is based on the REQUESTER'S role.
|
| Example:
|
| Requester → HOD → Dean → Provost → VC
| HOD       → Dean → Provost → VC
| Dean      → Provost → VC
| Provost   → VC
| VC        → [no approval needed]
| Procurement → VC
|
*/

export async function buildApprovalChain({
  requesterRole,
  collegeId,
  facultyId,
  department,
  estimatedCost,
}) {
  const college = getCollegeById(collegeId);

  if (!college) {
    throw new Error(`Unknown college: ${collegeId}`);
  }

  const fullChain =
    ROUTING_CHAINS[college.routingType] ||
    ROUTING_CHAINS.standard;

  /*
  |--------------------------------------------------------------------------
  | Determine starting point based on requester's position
  |--------------------------------------------------------------------------
  */

  let roleSequence = [...fullChain];

  switch (requesterRole) {
    case ROLES.REQUESTER:
      // Normal staff/lecturer requester starts from HOD.
      break;

    case ROLES.HOD:
      // HOD must not approve his/her own requisition.
      roleSequence = roleSequence.slice(
        roleSequence.indexOf(ROLES.DEAN)
      );
      break;

    case ROLES.DEAN:
      // Dean must not approve his/her own requisition.
      roleSequence = roleSequence.slice(
        roleSequence.indexOf(ROLES.PROVOST)
      );
      break;

    case ROLES.PROVOST:
      // Provost → VC.
      roleSequence = roleSequence.slice(
        roleSequence.indexOf(ROLES.VC)
      );
      break;

    case ROLES.VC:
      /*
       * VC is already the highest approval authority.
       * Therefore there is no approval step.
       *
       * The requisition will be considered approved
       * and sent directly to Procurement.
       */
      roleSequence = [];
      break;

    case ROLES.PROCUREMENT:
      /*
       * Procurement-created requisition:
       *
       * Procurement Officer → VC → Procurement Officer
       *
       * Only VC approves.
       */
      roleSequence = [ROLES.VC];
      break;

    default:
      throw new Error(
        `Unsupported requester role: ${requesterRole}`
      );
  }

  /*
  |--------------------------------------------------------------------------
  | Governor escalation
  |--------------------------------------------------------------------------
  */

  const requiresGovernorApproval =
    Number(estimatedCost || 0) > ESCALATION_THRESHOLD;

  /*
   * NOTE:
   * Governor is currently not represented as an actual approval user.
   *
   * If you later decide to implement Governor approval,
   * it should be added as a separate approval authority.
   */

  const chain = [];

  for (const role of roleSequence) {
    const approver = await resolveApproverForStep({
      role,
      collegeId,
      facultyId,
      department,
    });

    chain.push({
      role,
      approver: approver ? approver._id : undefined,
    });
  }

  /*
  |--------------------------------------------------------------------------
  | Procurement is NOT added to approvalChain.
  |--------------------------------------------------------------------------
  */

  return {
    chain,
    requiresGovernorApproval,
    procurementRequired: true,
  };
}

/*
|--------------------------------------------------------------------------
| Resolve Approver
|--------------------------------------------------------------------------
*/

async function resolveApproverForStep({
  role,
  collegeId,
  facultyId,
  department,
}) {
  const query = {
    role,
    accountStatus: "active",
  };

  /*
   * HOD:
   * Same college + faculty + department.
   */
  if (role === ROLES.HOD) {
    query.collegeId = collegeId;
    query.facultyId = facultyId;
    query.department = department;
  }

  /*
   * Dean:
   * Same college + faculty.
   */
  else if (role === ROLES.DEAN) {
    query.collegeId = collegeId;
    query.facultyId = facultyId;
  }

  /*
   * Provost:
   * Same college.
   */
  else if (role === ROLES.PROVOST) {
    query.collegeId = collegeId;
  }

  /*
   * VC:
   * University-wide.
   */

  return User.findOne(query);
}

/*
|--------------------------------------------------------------------------
| Procurement Officer
|--------------------------------------------------------------------------
*/

export async function resolveProcurementOfficer() {
  return User.findOne({
    role: ROLES.PROCUREMENT,
    accountStatus: "active",
  });
}

/*
|--------------------------------------------------------------------------
| Escalation helper
|--------------------------------------------------------------------------
*/

export function isEscalated(estimatedCost) {
  return Number(estimatedCost || 0) > ESCALATION_THRESHOLD;
}

export { ESCALATION_THRESHOLD };
