import { getCollegeById } from "@/constants/colleges";
import { ROLES } from "@/constants/roles";
import User from "@/models/User";

const ESCALATION_THRESHOLD = Number(
  process.env.ESCALATION_THRESHOLD || 10000000
);

/*
 * Base hierarchy for each type of institution/college.
 *
 * The actual starting point is determined by the role of the person
 * creating the requisition.
 *
 * Example:
 *
 * Requester:
 * HOD → Dean → Provost → VC → Procurement
 *
 * HOD:
 * Dean → Provost → VC → Procurement
 *
 * Dean:
 * Provost → VC → Procurement
 *
 * Provost:
 * VC → Procurement
 *
 * VC:
 * Procurement
 *
 * Procurement:
 * VC → Procurement
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
 * Remove all approval levels that are at or below the creator's
 * position in the normal hierarchy.
 *
 * Procurement is handled separately because Procurement has a special
 * workflow:
 *
 * Procurement → VC → Procurement
 */
function getChainForCreator({ creatorRole, baseChain }) {
  switch (creatorRole) {
    case ROLES.REQUESTER:
      return baseChain;

    case ROLES.HOD:
      return baseChain.filter((role) => role !== ROLES.HOD);

    case ROLES.DEAN:
      return baseChain.filter(
        (role) => role !== ROLES.HOD && role !== ROLES.DEAN
      );

    case ROLES.PROVOST:
      return baseChain.filter(
        (role) =>
          role !== ROLES.HOD &&
          role !== ROLES.DEAN &&
          role !== ROLES.PROVOST
      );

    case ROLES.VC:
      return [];

    case ROLES.PROCUREMENT:
      /*
       * Procurement is a special case.
       *
       * A Procurement Officer-created requisition must go directly
       * to the Vice Chancellor and then return to Procurement.
       */
      return [ROLES.VC];

    default:
      throw new Error(
        `Unsupported creator role for requisition routing: ${creatorRole}`
      );
  }
}

// Builds the ordered approval chain for a requisition.
export async function buildApprovalChain({
  creatorRole,
  collegeId,
  facultyId,
  department,
  estimatedCost,
}) {
  const college = getCollegeById(collegeId);

  if (!college) {
    throw new Error(`Unknown college: ${collegeId}`);
  }

  const baseChain =
    ROUTING_CHAINS[college.routingType] || ROUTING_CHAINS.standard;

  const requiresGovernorApproval =
    Number(estimatedCost || 0) > ESCALATION_THRESHOLD;

  /*
   * Determine the approval roles based on who created the requisition.
   */
  let roleSequence = getChainForCreator({
    creatorRole,
    baseChain,
  });

  /*
   * Procurement-created requisitions:
   *
   * Procurement → VC → Procurement
   *
   * The first Procurement step represents the Procurement Officer
   * receiving the requisition back after VC approval.
   */
  const procurementCreated = creatorRole === ROLES.PROCUREMENT;

  /*
   * Normal requisitions always finish at Procurement.
   *
   * Procurement-created requisitions already have a special final
   * Procurement step, so we don't add it twice.
   */
  if (!procurementCreated) {
    roleSequence = [...roleSequence, ROLES.PROCUREMENT];
  } else {
    roleSequence = [
      ROLES.VC,
      ROLES.PROCUREMENT,
    ];
  }

  const chain = [];

  for (const role of roleSequence) {
    const approver = await resolveApproverForStep({
      role,
      collegeId,
      facultyId,
      department,
      creatorRole,
    });

    chain.push({
      role,
      approver: approver ? approver._id : undefined,
    });
  }

  return {
    chain,
    requiresGovernorApproval,
  };
}

/*
 * Finds the active user responsible for a particular approval step.
 *
 * HOD:
 *   College + Faculty + Department
 *
 * Dean:
 *   College + Faculty
 *
 * Provost:
 *   College
 *
 * VC:
 *   University-wide
 *
 * Procurement:
 *   University-wide
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

  if (role === ROLES.HOD) {
    query.collegeId = collegeId;
    query.facultyId = facultyId;
    query.department = department;
  }

  if (role === ROLES.DEAN) {
    query.collegeId = collegeId;
    query.facultyId = facultyId;
  }

  if (role === ROLES.PROVOST) {
    query.collegeId = collegeId;
  }

  /*
   * VC and Procurement are university-wide.
   *
   * Therefore no college/faculty/department filtering is applied.
   */

  return User.findOne(query);
}

export function isEscalated(estimatedCost) {
  return Number(estimatedCost || 0) > ESCALATION_THRESHOLD;
}

export { ESCALATION_THRESHOLD };
