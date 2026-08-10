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

                                                // Which organizational fields apply to each role when registering or being
                                                // invited/edited. A Dean is scoped to a faculty (no single department), a
                                                // Provost is scoped to a whole college (no single faculty or department),
                                                // while HOD/Requester are department-specific and VC/Procurement are
                                                // university-wide roles that still capture full placement for reference.
                                                export const ROLE_ORG_SCOPE = {
                                                  [ROLES.REQUESTER]: ["collegeId", "facultyId", "department"],
                                                    [ROLES.HOD]: ["collegeId", "facultyId", "department"],
                                                      [ROLES.DEAN]: ["collegeId", "facultyId"],
                                                        [ROLES.PROVOST]: ["collegeId"],
                                                          [ROLES.VC]: ["collegeId", "facultyId", "department"],
                                                            [ROLES.PROCUREMENT]: ["collegeId", "facultyId", "department"],
                                                            };

                                                            // Value stored for an organizational field that doesn't apply to the
                                                            // selected role (e.g. a Provost's facultyId/department), since the User
                                                            // model requires all three fields to be non-empty regardless of role.
                                                            export const ORG_FIELD_NOT_APPLICABLE = "N/A";