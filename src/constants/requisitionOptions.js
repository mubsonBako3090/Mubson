export const REQUISITION_CATEGORIES = [
  "Office Supplies & Stationery",
  "ICT Equipment & Software",
  "Laboratory Equipment & Reagents",
  "Furniture & Fittings",
  "Construction & Maintenance",
  "Medical & Pharmaceutical Supplies",
  "Vehicles & Transportation",
  "Books & Instructional Materials",
  "Utilities & Services",
  "Other",
];

export const URGENCY_LEVELS = [
  { value: "low", label: "Low" },
  { value: "normal", label: "Normal" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" },
];

// Lifecycle status of a requisition.
export const REQUISITION_STATUS = {
  DRAFT: "draft",
  PENDING: "pending",
  RETURNED: "returned",
  APPROVED: "approved",
  REJECTED: "rejected",
};

export const REQUISITION_STATUS_LABELS = {
  [REQUISITION_STATUS.DRAFT]: "Draft",
  [REQUISITION_STATUS.PENDING]: "Pending Approval",
  [REQUISITION_STATUS.RETURNED]: "Returned for Clarification",
  [REQUISITION_STATUS.APPROVED]: "Approved",
  [REQUISITION_STATUS.REJECTED]: "Rejected",
};

// Outcome an approver can record on a requisition at their step.
export const APPROVAL_ACTIONS = {
  APPROVE: "approve",
  RETURN: "return",
  REJECT: "reject",
};

export const ACCEPTED_UPLOAD_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/jpg",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];
