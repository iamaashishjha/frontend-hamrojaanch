export type TeacherStatus = "Active" | "Disabled" | "Invited" | "Locked";
export type TeacherRole =
  | "Teacher"
  | "Evaluator"
  | "Exam Manager"
  | "Custom";
export type ScopeType = "all" | "selected";

export interface TeacherPermissions {
  createEditQuestions: boolean;
  createEditExams: boolean;
  publishExams: boolean;
  evaluateEssays: boolean;
  viewReportsAssigned: boolean;
  viewReportsAll: boolean;
  manageCandidates: boolean;
  manageGroups: boolean;
}

export interface TeacherActivityLog {
  id: string;
  timestamp: string;
  action: string;
  doneBy: string;
  details: string;
}

export interface Teacher {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  phone: string;
  username: string;
  role: TeacherRole;
  status: TeacherStatus;
  scopeType: ScopeType;
  groups: string[];
  assignedExams: string[];
  lastLoginAt: string | null;
  createdAt: string;
  permissions: TeacherPermissions;
}

export interface TeacherGroup {
  id: string;
  name: string;
  membersCount: number;
}

export interface TeacherExam {
  id: string;
  name: string;
  status: "published" | "draft";
  scheduledAt: string;
}

export interface TeacherFilters {
  status?: "All" | TeacherStatus;
  role?: "All" | TeacherRole;
  scope?: "All Groups" | "Selected Groups";
  assignedExams?: "Any" | "None" | "Has Assigned";
  query?: string;
  createdFrom?: string;
  createdTo?: string;
  lastLoginFrom?: string;
  lastLoginTo?: string;
  hasPublishPermission?: boolean;
  groupName?: string;
}

export interface TeacherCreatePayload {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  username: string;
  role: TeacherRole;
  permissions: TeacherPermissions;
  scopeType: ScopeType;
  groups: string[];
  sendLoginDetails: boolean;
}
