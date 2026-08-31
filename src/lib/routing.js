import { getCollegeById } from "@/constants/colleges";
import { ROLES } from "@/constants/roles";
import User from "@/models/User";

const ESCALATION_THRESHOLD = Number(
  process.env.ESCALATION_THRESHOLD || 10000000
);

/*
 * Standard organisational routing.
 */
const ROUTING_CHAINS = {
  standard: [
    ROLES.HOD,
    ROLES.DEAN,
    ROLES.PROVOST,
    ROLES.PROCUREMENT,
    ROLES.VC,
  ],

  postgraduate: [
    ROLES.HOD,
    ROLES.PROVOST,
    ROLES.PROCUREMENT,
    ROLES.VC,
  ],

  basicStudies: [
    ROLES.HOD,
    ROLES.PROVOST,
    ROLES.PROCUREMENT,
    ROLES.VC,
  ],
};

/*
 * Builds the approval/processing chain based on:
 *
 * 1. Who created the requisition
 * 2. The requester's organisational location
 * 3. The estimated cost
 *
 * IMPORTANT:
 *
 * Procurement is NOT an approval authority after VC.
 * Procurement is the processing stage after VC approval.
 */
export async function buildApprovalChain({
  requesterRole,
  collegeId,
  facultyId,
  department,
  estimatedCost,
}) {
  const requiresGovernorApproval =
    Number(estimatedCost || 0) > ESCALATION_THRESHOLD;

  let roleSequence = [];

  /*
   * PROCUREMENT creates the requisition:
   *
   * Procurement -> VC -> Procurement
   *
   * The Procurement Officer who created it must NOT approve
   * their own requisition. University-wide, so no college lookup
   * is needed here.
   */
  if (requesterRole === ROLES.PROCUREMENT) {
    roleSequence = [
      ROLES.VC,
    ];
  }

  /*
   * PROVOST creates:
   *
   * Provost -> Procurement Review -> VC -> Procurement Processing
   *
   * The Provost must not approve their own requisition, but
   * Procurement still performs the market-survey stage before VC.
   */
  else if (requesterRole === ROLES.PROVOST) {
    roleSequence = [
      ROLES.PROCUREMENT,
      ROLES.VC,
    ];
  }

  /*
   * VC creates:
   *
   * VC -> Procurement
   *
   * The VC cannot approve their own requisition.
   * Procurement becomes the post-approval processing stage.
   */
  else if (requesterRole === ROLES.VC) {
    roleSequence = [];
  }

  /*
   * ADMIN creates (e.g. a university-wide consolidated requisition
   * spanning multiple colleges):
   *
   * Admin -> VC -> Procurement
   *
   * University-wide, like Procurement — there is no single college
   * to resolve a Dean/Provost approver against.
   */
  else if (requesterRole === ROLES.ADMIN) {
    roleSequence = [
      ROLES.PROCUREMENT,
      ROLES.VC,
    ];
  }

  /*
   * Normal requester (also covers Dean-created requisitions and
   * Dean-created consolidations — both are scoped to a single
   * faculty, so they always have a real collegeId to resolve
   * routing type and the Provost approver against):
   *
   * Requester -> HOD -> Dean -> Provost -> VC -> Procurement
   */
  else {
    const college = getCollegeById(collegeId);

    if (!college) {
      throw new Error(`Unknown college: ${collegeId}`);
    }

    const routingType =
      college.routingType || "standard";

    const standardSequence =
      ROUTING_CHAINS[routingType] ||
      ROUTING_CHAINS.standard;

    roleSequence = [...standardSequence];

    /*
     * If the requester is already one of the authority levels,
     * do not route the requisition backwards to that same/lower
     * authority.
     *
     * This ensures the command chain always moves upward.
     */

    if (requesterRole === ROLES.HOD) {
      roleSequence = roleSequence.filter(
        (role) =>
          role !== ROLES.HOD
      );
    }

    if (requesterRole === ROLES.DEAN) {
      roleSequence = roleSequence.filter(
        (role) =>
          role !== ROLES.HOD &&
          role !== ROLES.DEAN
      );
    }
  }

  const chain = [];

  /*
   * Resolve each approval authority.
   */
  for (const role of roleSequence) {
    const approver =
      await resolveApproverForStep({
        role,
        collegeId,
        facultyId,
        department,
      });

    /*
     * VC and other approval authorities are required
     * to exist before submission.
     */
    if (!approver) {
      throw new Error(
        `No active ${role} is configured for this requisition's approval chain.`
      );
    }

    chain.push({
      role,
      approver: approver._id,
      type: role === ROLES.PROCUREMENT
        ? "procurement_review"
        : "approval",
    });
  }

  /*
   * PROCUREMENT HAS A SECOND, POST-VC PROCESSING STAGE.
   *
   * Normal chain: HOD -> Dean -> Provost -> Procurement Review
   * -> VC -> Procurement Processing
   *
   * Special creator chains above may already contain the first
   * Procurement stage. Only append the final processing stage.
   */
  const procurementOfficer =
    await User.findOne({
      role: ROLES.PROCUREMENT,
      accountStatus: "active",
    });

  if (!procurementOfficer) {
    throw new Error(
      "No active Procurement Officer is configured."
    );
  }

  chain.push({
    role: ROLES.PROCUREMENT,
    approver: procurementOfficer._id,
    type: "processing",
  });

  /*
   * Governor escalation remains represented in the
   * requisition metadata for now.
   */
  return {
    chain,
    requiresGovernorApproval,
  };
}

/*
 * Finds the correct active user for a given approval role.
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
   * HOD is department-specific.
   */
  if (role === ROLES.HOD) {
    query.collegeId = collegeId;
    query.facultyId = facultyId;
    query.department = department;
  }

  /*
   * Dean is faculty-specific.
   */
  else if (role === ROLES.DEAN) {
    query.collegeId = collegeId;
    query.facultyId = facultyId;
  }

  /*
   * Provost is college-specific.
   */
  else if (role === ROLES.PROVOST) {
    query.collegeId = collegeId;
  }

  /*
   * VC is university-wide.
   */

  return User.findOne(query);
}

export function isEscalated(
  estimatedCost
) {
  return (
    Number(estimatedCost || 0) >
    ESCALATION_THRESHOLD
  );
}

export { ESCALATION_THRESHOLD };
