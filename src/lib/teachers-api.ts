/**
 * Real backend API. Replaces previous mock implementation.
 *
 * The backend currently only exposes GET /admin/teachers and GET /admin/teachers/:id.
 * Backend Teacher shape (Prisma) differs from frontend Teacher; we adapt here so the
 * admin page never sees missing fields (e.g. permissions) and crashes with a blank page.
 */
import type {
  ScopeType,
  Teacher,
  TeacherActivityLog,
  TeacherCreatePayload,
  TeacherExam,
  TeacherFilters,
  TeacherGroup,
  TeacherPermissions,
  TeacherRole,
  TeacherStatus,
} from "@/lib/teachers-types";
import { get } from "@/lib/apiClient";

/** Backend teacher row as returned by the API (Prisma Teacher + user). */
interface BackendTeacherRow {
  id: string;
  userId?: string;
  department?: string | null;
  designation?: string | null;
  subjects?: string;
  status?: string;
  createdAt?: string;
  updatedAt?: string;
  user?: { id?: string; email?: string; name?: string };
}

const defaultPermissions: TeacherPermissions = {
  createEditQuestions: false,
  createEditExams: false,
  publishExams: false,
  evaluateEssays: false,
  viewReportsAssigned: false,
  viewReportsAll: false,
  manageCandidates: false,
  manageGroups: false,
};

function mapBackendTeacherToFrontend(row: BackendTeacherRow | null): Teacher | null {
  if (!row) return null;
  const name = row.user?.name ?? "Teacher";
  const parts = name.trim().split(/\s+/);
  const firstName = parts[0] ?? "";
  const lastName = parts.slice(1).join(" ") ?? "";
  const status = (row.status === "active" ? "Active" : "Invited") as TeacherStatus;
  return {
    id: row.id,
    firstName,
    lastName,
    fullName: name,
    email: row.user?.email ?? "",
    phone: "",
    username: row.user?.email ?? "",
    role: "Teacher" as TeacherRole,
    status,
    scopeType: "all" as ScopeType,
    groups: [],
    assignedExams: [],
    lastLoginAt: null,
    createdAt: row.createdAt ?? new Date().toISOString(),
    permissions: defaultPermissions,
  };
}

// ── List / Read (real backend) ──

export async function listTeachers(_filters: TeacherFilters = {}): Promise<Teacher[]> {
  try {
    const res = await get<{ items: BackendTeacherRow[] }>("/admin/teachers");
    const items = Array.isArray(res.items) ? res.items : [];
    return items.map((row) => mapBackendTeacherToFrontend(row)!).filter(Boolean);
  } catch {
    return [];
  }
}

export async function getTeacherById(id: string): Promise<Teacher | null> {
  try {
    const res = await get<{ teacher: BackendTeacherRow }>(`/admin/teachers/${id}`);
    return mapBackendTeacherToFrontend(res.teacher ?? null);
  } catch {
    return null;
  }
}

// ── Groups / Exams / Activity (no backend endpoints yet) ──

export async function listTeacherGroups(): Promise<TeacherGroup[]> {
  // TODO: No backend endpoint for teacher groups yet
  return [];
}

export async function listTeacherExams(): Promise<TeacherExam[]> {
  // TODO: No backend endpoint for teacher exams yet
  return [];
}

export async function getTeacherActivityLog(_teacherId: string): Promise<TeacherActivityLog[]> {
  // TODO: No backend endpoint for teacher activity logs yet
  return [];
}

// ── Create / Update / Delete (no backend endpoints yet) ──

export async function createTeacher(_payload: TeacherCreatePayload): Promise<Teacher> {
  // TODO: POST /admin/teachers not implemented on backend yet
  throw new Error("createTeacher: Backend endpoint not available yet.");
}

export async function updateTeacher(
  _id: string,
  _payload: Partial<
    Pick<Teacher, "firstName" | "lastName" | "email" | "phone" | "role" | "status" | "username"> & {
      permissions: TeacherPermissions;
      scopeType: ScopeType;
    }
  >
): Promise<Teacher> {
  // TODO: PATCH /admin/teachers/:id not implemented on backend yet
  throw new Error("updateTeacher: Backend endpoint not available yet.");
}

export async function assignGroups(_teacherId: string, _groupIds: string[]): Promise<Teacher> {
  // TODO: No backend endpoint yet
  throw new Error("assignGroups: Backend endpoint not available yet.");
}

export async function assignExams(_teacherId: string, _examIds: string[]): Promise<Teacher> {
  // TODO: No backend endpoint yet
  throw new Error("assignExams: Backend endpoint not available yet.");
}

export async function resetPassword(
  _teacherId: string,
  _options: { sendEmail: boolean }
): Promise<{ password: string }> {
  // TODO: No backend endpoint yet
  throw new Error("resetPassword: Backend endpoint not available yet.");
}

export async function resendInvite(_teacherId: string): Promise<void> {
  // TODO: No backend endpoint yet
  throw new Error("resendInvite: Backend endpoint not available yet.");
}

export async function deactivateTeacher(_teacherId: string, _active: boolean): Promise<Teacher> {
  // TODO: No backend endpoint yet
  throw new Error("deactivateTeacher: Backend endpoint not available yet.");
}

export async function deleteTeacher(_teacherId: string): Promise<void> {
  // TODO: No backend endpoint yet
  throw new Error("deleteTeacher: Backend endpoint not available yet.");
}

// ── Bulk operations (no backend endpoints yet) ──

export async function bulkAssignRole(_teacherIds: string[], _role: TeacherRole): Promise<void> {
  // TODO: No backend endpoint yet
  throw new Error("bulkAssignRole: Backend endpoint not available yet.");
}

export async function bulkDeactivate(_teacherIds: string[]): Promise<void> {
  // TODO: No backend endpoint yet
  throw new Error("bulkDeactivate: Backend endpoint not available yet.");
}

export async function bulkAssignGroups(_teacherIds: string[], _groupIds: string[]): Promise<void> {
  // TODO: No backend endpoint yet
  throw new Error("bulkAssignGroups: Backend endpoint not available yet.");
}

export async function bulkResendInvites(_teacherIds: string[]): Promise<void> {
  // TODO: No backend endpoint yet
  throw new Error("bulkResendInvites: Backend endpoint not available yet.");
}
