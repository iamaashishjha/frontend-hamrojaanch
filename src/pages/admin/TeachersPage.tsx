/**
 * README:
 * This page uses the real teachers API from `src/lib/teachers-api.ts`.
 * Replace those calls with real backend APIs later while keeping the same method signatures.
 */
import { useEffect, useMemo, useState } from "react";
import type { CheckedState } from "@radix-ui/react-checkbox";
import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  type PaginationState,
  type RowSelectionState,
  type SortingState,
  useReactTable,
} from "@tanstack/react-table";
import { format, formatDistanceToNowStrict } from "date-fns";
import {
  AlertTriangle,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Eye,
  FileDown,
  FileUp,
  KeyRound,
  MoreHorizontal,
  Plus,
  Search,
  ShieldAlert,
  UserPlus,
  Users,
} from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/components/ui/use-toast";
import {
  assignExams,
  assignGroups,
  bulkAssignGroups,
  bulkAssignRole,
  bulkDeactivate,
  bulkResendInvites,
  createTeacher,
  deactivateTeacher,
  deleteTeacher,
  getTeacherActivityLog,
  getTeacherById,
  listTeacherExams,
  listTeacherGroups,
  listTeachers,
  resendInvite,
  resetPassword,
  updateTeacher,
} from "@/lib/teachers-api";
import type {
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

type ScopeFilter = "Any Scope" | "All Groups" | "Selected Groups";
type PublishFilter = "Any" | "Yes" | "No";
type BulkActionType =
  | "assign-role"
  | "assign-groups"
  | "resend-invite"
  | "deactivate"
  | "export-selected"
  | null;

interface TeacherFilterForm {
  status: "All" | TeacherStatus;
  role: "All" | TeacherRole;
  scope: ScopeFilter;
  assignedExams: "Any" | "None" | "Has Assigned";
  query: string;
  createdFrom: string;
  createdTo: string;
  lastLoginFrom: string;
  lastLoginTo: string;
  hasPublishPermission: PublishFilter;
  groupName: string;
}

interface ImportPreviewRow {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  role: TeacherRole;
}

const permissionMeta: Array<{ key: keyof TeacherPermissions; label: string }> = [
  { key: "createEditQuestions", label: "Create/Edit Questions" },
  { key: "createEditExams", label: "Create/Edit Exams" },
  { key: "publishExams", label: "Publish Exams" },
  { key: "evaluateEssays", label: "Evaluate Essays" },
  { key: "viewReportsAssigned", label: "View Reports (Assigned)" },
  { key: "viewReportsAll", label: "View Reports (All)" },
  { key: "manageCandidates", label: "Manage Candidates" },
  { key: "manageGroups", label: "Manage Groups" },
];

const defaultPermissions: TeacherPermissions = {
  createEditQuestions: true,
  createEditExams: true,
  publishExams: false,
  evaluateEssays: true,
  viewReportsAssigned: true,
  viewReportsAll: false,
  manageCandidates: false,
  manageGroups: false,
};

const initialFilterForm: TeacherFilterForm = {
  status: "All",
  role: "All",
  scope: "Any Scope",
  assignedExams: "Any",
  query: "",
  createdFrom: "",
  createdTo: "",
  lastLoginFrom: "",
  lastLoginTo: "",
  hasPublishPermission: "Any",
  groupName: "",
};

const importPreviewSeed: ImportPreviewRow[] = [
  {
    firstName: "Aarav",
    lastName: "Sharma",
    email: "aarav.sharma@example.com",
    phone: "+1 555-111-9087",
    role: "Teacher",
  },
  {
    firstName: "Mina",
    lastName: "Gautam",
    email: "mina.gautam@example.com",
    phone: "+1 555-443-7811",
    role: "Evaluator",
  },
];

const toBoolean = (value: CheckedState): boolean => value === true;

function statusBadgeVariant(status: TeacherStatus) {
  if (status === "Active") return "success-light";
  if (status === "Invited") return "warning-light";
  if (status === "Locked") return "danger-light";
  return "secondary";
}

function roleBadgeVariant(role: TeacherRole) {
  if (role === "Exam Manager") return "warning-light";
  if (role === "Evaluator") return "secondary";
  if (role === "Custom") return "outline";
  return "default";
}

function formatRelativeTime(value: string | null): string {
  if (!value) return "Never";
  return formatDistanceToNowStrict(new Date(value), { addSuffix: true });
}

function getTeacherInitials(teacher: Teacher): string {
  const first = teacher.firstName?.[0] ?? "";
  const last = teacher.lastName?.[0] ?? "";
  const initials = `${first}${last}`.trim();
  return initials.length > 0 ? initials.toUpperCase() : "T";
}

function buildTeacherFilters(form: TeacherFilterForm): TeacherFilters {
  const output: TeacherFilters = {
    status: form.status,
    role: form.role,
    assignedExams: form.assignedExams,
  };
  if (form.query.trim()) output.query = form.query.trim();
  if (form.scope !== "Any Scope") output.scope = form.scope;
  if (form.createdFrom) output.createdFrom = form.createdFrom;
  if (form.createdTo) output.createdTo = form.createdTo;
  if (form.lastLoginFrom) output.lastLoginFrom = form.lastLoginFrom;
  if (form.lastLoginTo) output.lastLoginTo = form.lastLoginTo;
  if (form.groupName.trim()) output.groupName = form.groupName.trim();
  if (form.hasPublishPermission === "Yes") output.hasPublishPermission = true;
  if (form.hasPublishPermission === "No") output.hasPublishPermission = false;
  return output;
}

function exportTeachersAsCsv(teachers: Teacher[], filename: string, groupMap: Map<string, string>) {
  const header = [
    "Full Name",
    "Email",
    "Phone",
    "Role",
    "Status",
    "Scope",
    "Groups",
    "Assigned Exams",
    "Last Login",
    "Created At",
  ];
  const rows = teachers.map((teacher) => {
    const groups = teacher.groups.map((groupId) => groupMap.get(groupId) ?? groupId).join(" | ");
    return [
      teacher.fullName,
      teacher.email,
      teacher.phone,
      teacher.role,
      teacher.status,
      teacher.scopeType === "all" ? "All Groups" : "Selected Groups",
      groups,
      `${teacher.assignedExams.length}`,
      teacher.lastLoginAt ? format(new Date(teacher.lastLoginAt), "yyyy-MM-dd HH:mm") : "Never",
      format(new Date(teacher.createdAt), "yyyy-MM-dd"),
    ];
  });
  const csv = [header, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export default function TeachersPage() {
  const navigate = useNavigate();
  const { id: teacherIdParam } = useParams<{ id?: string }>();

  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [groups, setGroups] = useState<TeacherGroup[]>([]);
  const [exams, setExams] = useState<TeacherExam[]>([]);
  const [loadingTeachers, setLoadingTeachers] = useState(true);
  const [teachersError, setTeachersError] = useState<string | null>(null);
  const [loadingReferences, setLoadingReferences] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  const [summary, setSummary] = useState({
    total: 0,
    active: 0,
    invited: 0,
    permissionAlerts: 0,
  });

  const [filterForm, setFilterForm] = useState<TeacherFilterForm>(initialFilterForm);
  const [appliedFilters, setAppliedFilters] = useState<TeacherFilters>(() =>
    buildTeacherFilters(initialFilterForm)
  );
  const [moreFiltersOpen, setMoreFiltersOpen] = useState(false);

  const [sorting, setSorting] = useState<SortingState>([]);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 8 });

  const [bulkAction, setBulkAction] = useState<BulkActionType>(null);
  const [bulkActionLoading, setBulkActionLoading] = useState(false);
  const [bulkRole, setBulkRole] = useState<TeacherRole>("Teacher");
  const [bulkGroupIds, setBulkGroupIds] = useState<string[]>([]);
  const [bulkGroupSearch, setBulkGroupSearch] = useState("");

  const [importOpen, setImportOpen] = useState(false);
  const [importFilename, setImportFilename] = useState("");
  const [importPreviewRows, setImportPreviewRows] = useState<ImportPreviewRow[]>(importPreviewSeed);
  const [importing, setImporting] = useState(false);

  const [detailLoading, setDetailLoading] = useState(false);
  const [detailTeacher, setDetailTeacher] = useState<Teacher | null>(null);
  const [detailLogs, setDetailLogs] = useState<TeacherActivityLog[]>([]);
  const [detailTab, setDetailTab] = useState("profile");
  const [profileDraft, setProfileDraft] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    username: "",
    role: "Teacher" as TeacherRole,
  });
  const [permissionDraft, setPermissionDraft] = useState<TeacherPermissions>({ ...defaultPermissions });
  const [detailSavingProfile, setDetailSavingProfile] = useState(false);
  const [detailSavingPermissions, setDetailSavingPermissions] = useState(false);

  const [assignGroupsOpen, setAssignGroupsOpen] = useState(false);
  const [assignGroupsTeacher, setAssignGroupsTeacher] = useState<Teacher | null>(null);
  const [assignGroupsSaving, setAssignGroupsSaving] = useState(false);
  const [assignGroupsSearch, setAssignGroupsSearch] = useState("");
  const [assignGroupIds, setAssignGroupIds] = useState<string[]>([]);

  const [assignExamsOpen, setAssignExamsOpen] = useState(false);
  const [assignExamsTeacher, setAssignExamsTeacher] = useState<Teacher | null>(null);
  const [assignExamsSaving, setAssignExamsSaving] = useState(false);
  const [assignExamsSearch, setAssignExamsSearch] = useState("");
  const [assignExamIds, setAssignExamIds] = useState<string[]>([]);

  const [resetPasswordOpen, setResetPasswordOpen] = useState(false);
  const [resetPasswordTeacher, setResetPasswordTeacher] = useState<Teacher | null>(null);
  const [resetPasswordSending, setResetPasswordSending] = useState(false);
  const [resetSendEmail, setResetSendEmail] = useState(true);
  const [generatedPassword, setGeneratedPassword] = useState<string | null>(null);

  const [deleteTeacherOpen, setDeleteTeacherOpen] = useState(false);
  const [deleteTeacherTarget, setDeleteTeacherTarget] = useState<Teacher | null>(null);
  const [deletingTeacher, setDeletingTeacher] = useState(false);

  const groupNameById = useMemo(
    () => new Map(groups.map((group) => [group.id, group.name])),
    [groups]
  );
  const examNameById = useMemo(() => new Map(exams.map((exam) => [exam.id, exam.name])), [exams]);
  const selectedTeacherIds = useMemo(
    () => Object.entries(rowSelection).filter(([, selected]) => selected).map(([key]) => key),
    [rowSelection]
  );

  const filteredGroupsForBulk = useMemo(() => {
    const q = bulkGroupSearch.trim().toLowerCase();
    if (!q) return groups;
    return groups.filter((group) => group.name.toLowerCase().includes(q));
  }, [bulkGroupSearch, groups]);

  const filteredAssignGroups = useMemo(() => {
    const q = assignGroupsSearch.trim().toLowerCase();
    if (!q) return groups;
    return groups.filter((group) => group.name.toLowerCase().includes(q));
  }, [assignGroupsSearch, groups]);

  const filteredAssignExams = useMemo(() => {
    const q = assignExamsSearch.trim().toLowerCase();
    if (!q) return exams;
    return exams.filter((exam) => exam.name.toLowerCase().includes(q));
  }, [assignExamsSearch, exams]);

  const notifyError = (message: string) => {
    toast({ variant: "destructive", title: "Action failed", description: message });
  };
  const notifySuccess = (message: string) => {
    toast({ title: "Success", description: message });
  };

  const refreshTeachers = () => setRefreshKey((prev) => prev + 1);

  const loadTeachers = async () => {
    setLoadingTeachers(true);
    setTeachersError(null);
    try {
      const results = await listTeachers(appliedFilters);
      setTeachers(results);
      setPagination((prev) => ({ ...prev, pageIndex: 0 }));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to load teachers.";
      setTeachersError(message);
      notifyError(message);
    } finally {
      setLoadingTeachers(false);
    }
  };

  const loadSummary = async () => {
    try {
      const allRows = await listTeachers({});
      setSummary({
        total: allRows.length,
        active: allRows.filter((teacher) => teacher.status === "Active").length,
        invited: allRows.filter((teacher) => teacher.status === "Invited").length,
        permissionAlerts: allRows.filter((teacher) => teacher.permissions.publishExams).length,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to load teacher summary.";
      notifyError(message);
    }
  };

  const loadReferences = async () => {
    setLoadingReferences(true);
    try {
      const [groupRows, examRows] = await Promise.all([listTeacherGroups(), listTeacherExams()]);
      setGroups(groupRows);
      setExams(examRows);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to load groups and exams.";
      notifyError(message);
    } finally {
      setLoadingReferences(false);
    }
  };

  const loadTeacherDetail = async (teacherId: string) => {
    setDetailLoading(true);
    try {
      const [teacher, logs] = await Promise.all([
        getTeacherById(teacherId),
        getTeacherActivityLog(teacherId),
      ]);
      if (!teacher) {
        notifyError("Teacher not found.");
        navigate("/admin/teachers", { replace: true });
        return;
      }
      setDetailTeacher(teacher);
      setDetailLogs(logs);
      setProfileDraft({
        firstName: teacher.firstName,
        lastName: teacher.lastName,
        email: teacher.email,
        phone: teacher.phone,
        username: teacher.username,
        role: teacher.role,
      });
      setPermissionDraft({ ...teacher.permissions });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to load teacher details.";
      notifyError(message);
    } finally {
      setDetailLoading(false);
    }
  };

  useEffect(() => {
    void loadReferences();
  }, []);

  useEffect(() => {
    void loadTeachers();
  }, [appliedFilters, refreshKey]);

  useEffect(() => {
    void loadSummary();
  }, [refreshKey]);

  useEffect(() => {
    if (!teacherIdParam) {
      setDetailTeacher(null);
      setDetailLogs([]);
      return;
    }
    setDetailTab("profile");
    void loadTeacherDetail(teacherIdParam);
  }, [teacherIdParam, refreshKey]);

  const applyFilterForm = (nextForm: TeacherFilterForm) => {
    setAppliedFilters(buildTeacherFilters(nextForm));
  };

  const setFilterValue = <K extends keyof TeacherFilterForm>(
    key: K,
    value: TeacherFilterForm[K]
  ) => {
    setFilterForm((prev) => ({ ...prev, [key]: value }));
  };

  const applySummaryFilter = (kind: "total" | "active" | "invited" | "alerts") => {
    let nextForm: TeacherFilterForm = { ...filterForm };
    if (kind === "total") {
      nextForm = { ...nextForm, status: "All", hasPublishPermission: "Any" };
    }
    if (kind === "active") {
      nextForm = { ...nextForm, status: "Active" };
    }
    if (kind === "invited") {
      nextForm = { ...nextForm, status: "Invited" };
    }
    if (kind === "alerts") {
      nextForm = { ...nextForm, hasPublishPermission: "Yes" };
    }
    setFilterForm(nextForm);
    applyFilterForm(nextForm);
  };

  const closeDetailSheet = () => {
    navigate("/admin/teachers");
  };

  const openDetailSheet = (teacherId: string) => {
    navigate(`/admin/teachers/${teacherId}`);
  };

  const openAssignGroupsModal = (teacher: Teacher) => {
    setAssignGroupsTeacher(teacher);
    setAssignGroupIds([...teacher.groups]);
    setAssignGroupsSearch("");
    setAssignGroupsOpen(true);
  };

  const openAssignExamsModal = (teacher: Teacher) => {
    setAssignExamsTeacher(teacher);
    setAssignExamIds([...teacher.assignedExams]);
    setAssignExamsSearch("");
    setAssignExamsOpen(true);
  };

  const openResetPasswordModal = (teacher: Teacher) => {
    setResetPasswordTeacher(teacher);
    setGeneratedPassword(null);
    setResetSendEmail(true);
    setResetPasswordOpen(true);
  };

  const openDeleteTeacherModal = (teacher: Teacher) => {
    setDeleteTeacherTarget(teacher);
    setDeleteTeacherOpen(true);
  };

  const handleResendInvite = async (teacherId: string) => {
    try {
      await resendInvite(teacherId);
      notifySuccess("Invite sent.");
      refreshTeachers();
    } catch (error) {
      notifyError(error instanceof Error ? error.message : "Unable to resend invite.");
    }
  };

  const handleToggleActive = async (teacher: Teacher) => {
    const shouldActivate = teacher.status !== "Active";
    try {
      await deactivateTeacher(teacher.id, shouldActivate);
      notifySuccess(shouldActivate ? "Teacher activated." : "Teacher deactivated.");
      refreshTeachers();
    } catch (error) {
      notifyError(error instanceof Error ? error.message : "Unable to update status.");
    }
  };

  const handleDeleteTeacher = async () => {
    if (!deleteTeacherTarget) return;
    setDeletingTeacher(true);
    try {
      await deleteTeacher(deleteTeacherTarget.id);
      notifySuccess("Teacher deleted.");
      setDeleteTeacherOpen(false);
      setDeleteTeacherTarget(null);
      if (teacherIdParam === deleteTeacherTarget.id) {
        closeDetailSheet();
      }
      refreshTeachers();
    } catch (error) {
      notifyError(error instanceof Error ? error.message : "Unable to delete teacher.");
    } finally {
      setDeletingTeacher(false);
    }
  };

  const handleBulkSubmit = async () => {
    if (!bulkAction) return;
    if (selectedTeacherIds.length === 0) {
      notifyError("Select one or more teachers first.");
      return;
    }
    setBulkActionLoading(true);
    try {
      if (bulkAction === "assign-role") {
        await bulkAssignRole(selectedTeacherIds, bulkRole);
        notifySuccess(`Role assigned to ${selectedTeacherIds.length} teacher(s).`);
      } else if (bulkAction === "assign-groups") {
        await bulkAssignGroups(selectedTeacherIds, bulkGroupIds);
        notifySuccess(`Groups assigned to ${selectedTeacherIds.length} teacher(s).`);
      } else if (bulkAction === "resend-invite") {
        await bulkResendInvites(selectedTeacherIds);
        notifySuccess(`Invites processed for ${selectedTeacherIds.length} teacher(s).`);
      } else if (bulkAction === "deactivate") {
        await bulkDeactivate(selectedTeacherIds);
        notifySuccess(`${selectedTeacherIds.length} teacher(s) deactivated.`);
      } else if (bulkAction === "export-selected") {
        const selectedRows = teachers.filter((teacher) => selectedTeacherIds.includes(teacher.id));
        exportTeachersAsCsv(selectedRows, "teachers-selected.csv", groupNameById);
        notifySuccess("Selected teachers exported.");
      }
      setBulkAction(null);
      setRowSelection({});
      refreshTeachers();
    } catch (error) {
      notifyError(error instanceof Error ? error.message : "Bulk action failed.");
    } finally {
      setBulkActionLoading(false);
    }
  };

  const handleAssignGroupsSave = async () => {
    if (!assignGroupsTeacher) return;
    setAssignGroupsSaving(true);
    try {
      await assignGroups(assignGroupsTeacher.id, assignGroupIds);
      notifySuccess("Groups assignment updated.");
      setAssignGroupsOpen(false);
      setAssignGroupsTeacher(null);
      refreshTeachers();
    } catch (error) {
      notifyError(error instanceof Error ? error.message : "Unable to assign groups.");
    } finally {
      setAssignGroupsSaving(false);
    }
  };

  const handleAssignExamsSave = async () => {
    if (!assignExamsTeacher) return;
    setAssignExamsSaving(true);
    try {
      await assignExams(assignExamsTeacher.id, assignExamIds);
      notifySuccess("Exam assignments updated.");
      setAssignExamsOpen(false);
      setAssignExamsTeacher(null);
      refreshTeachers();
    } catch (error) {
      notifyError(error instanceof Error ? error.message : "Unable to assign exams.");
    } finally {
      setAssignExamsSaving(false);
    }
  };

  const handleResetPassword = async () => {
    if (!resetPasswordTeacher) return;
    setResetPasswordSending(true);
    try {
      const result = await resetPassword(resetPasswordTeacher.id, { sendEmail: resetSendEmail });
      setGeneratedPassword(result.password);
      notifySuccess("Password reset completed.");
      if (resetSendEmail) {
        notifySuccess("Password email sent.");
      }
      refreshTeachers();
    } catch (error) {
      notifyError(error instanceof Error ? error.message : "Unable to reset password.");
    } finally {
      setResetPasswordSending(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!detailTeacher) return;
    setDetailSavingProfile(true);
    try {
      await updateTeacher(detailTeacher.id, {
        firstName: profileDraft.firstName,
        lastName: profileDraft.lastName,
        email: profileDraft.email,
        phone: profileDraft.phone,
        username: profileDraft.username,
        role: profileDraft.role,
      });
      notifySuccess("Profile updated.");
      refreshTeachers();
    } catch (error) {
      notifyError(error instanceof Error ? error.message : "Unable to save profile.");
    } finally {
      setDetailSavingProfile(false);
    }
  };

  const handleSavePermissions = async () => {
    if (!detailTeacher) return;
    setDetailSavingPermissions(true);
    try {
      await updateTeacher(detailTeacher.id, { permissions: permissionDraft });
      notifySuccess("Permissions saved.");
      refreshTeachers();
    } catch (error) {
      notifyError(error instanceof Error ? error.message : "Unable to save permissions.");
    } finally {
      setDetailSavingPermissions(false);
    }
  };

  const handleImportTeachers = async () => {
    if (importPreviewRows.length === 0) {
      notifyError("No rows available to import.");
      return;
    }
    setImporting(true);
    try {
      for (const row of importPreviewRows) {
        await createTeacher({
          firstName: row.firstName,
          lastName: row.lastName,
          email: row.email,
          phone: row.phone,
          username: row.email,
          role: row.role,
          permissions: { ...defaultPermissions },
          scopeType: "all",
          groups: [],
          sendLoginDetails: true,
        });
      }
      notifySuccess(`${importPreviewRows.length} teacher(s) imported.`);
      setImportOpen(false);
      refreshTeachers();
    } catch (error) {
      notifyError(error instanceof Error ? error.message : "Import failed.");
    } finally {
      setImporting(false);
    }
  };

  const columns = useMemo<ColumnDef<Teacher>[]>(
    () => [
      {
        id: "select",
        header: ({ table }) => (
          <Checkbox
            aria-label="Select all teachers on this page"
            checked={table.getIsAllPageRowsSelected()}
            onCheckedChange={(value) => table.toggleAllPageRowsSelected(toBoolean(value))}
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            aria-label={`Select ${row.original.fullName}`}
            checked={row.getIsSelected()}
            onCheckedChange={(value) => row.toggleSelected(toBoolean(value))}
          />
        ),
        enableSorting: false,
        enableHiding: false,
      },
      {
        accessorKey: "fullName",
        header: "Teacher",
        cell: ({ row }) => (
          <div className="flex items-center gap-3">
            <Avatar className="h-9 w-9 border border-blue-100">
              <AvatarFallback className="bg-blue-100 text-blue-700">
                {getTeacherInitials(row.original)}
              </AvatarFallback>
            </Avatar>
            <div className="grid">
              <span className="font-medium text-slate-800">{row.original.fullName}</span>
              <span className="text-xs text-slate-500">{row.original.phone || "No phone"}</span>
            </div>
          </div>
        ),
      },
      { accessorKey: "email", header: "Email" },
      {
        accessorKey: "role",
        header: "Role",
        cell: ({ row }) => <Badge variant={roleBadgeVariant(row.original.role)}>{row.original.role}</Badge>,
      },
      {
        accessorKey: "scopeType",
        header: "Scope",
        cell: ({ row }) => (
          <Badge variant="outline">
            {row.original.scopeType === "all" ? "All Groups" : "Selected"}
          </Badge>
        ),
      },
      {
        id: "assignedExams",
        header: "Exams Assigned",
        accessorFn: (row) => row.assignedExams.length,
        cell: ({ row }) => row.original.assignedExams.length,
      },
      {
        id: "lastLoginAt",
        header: "Last Login",
        accessorFn: (row) => (row.lastLoginAt ? new Date(row.lastLoginAt).getTime() : 0),
        cell: ({ row }) => <span className="text-sm text-slate-600">{formatRelativeTime(row.original.lastLoginAt)}</span>,
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => <Badge variant={statusBadgeVariant(row.original.status)}>{row.original.status}</Badge>,
      },
      {
        id: "actions",
        header: "Actions",
        enableSorting: false,
        cell: ({ row }) => {
          const teacher = row.original;
          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" aria-label={`Open actions for ${teacher.fullName}`}>
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuItem onClick={() => openDetailSheet(teacher.id)}>
                  <Eye className="mr-2 h-4 w-4" />
                  View
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    openDetailSheet(teacher.id);
                    setDetailTab("profile");
                  }}
                >
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => openAssignGroupsModal(teacher)}>
                  Assign Groups
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => openAssignExamsModal(teacher)}>
                  Assign Exams
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    openDetailSheet(teacher.id);
                    setDetailTab("permissions");
                  }}
                >
                  Permissions
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => openResetPasswordModal(teacher)}>
                  Reset Password
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => void handleToggleActive(teacher)}>
                  {teacher.status === "Active" ? "Deactivate" : "Activate"}
                </DropdownMenuItem>
                {teacher.status === "Invited" && (
                  <DropdownMenuItem onClick={() => void handleResendInvite(teacher.id)}>
                    Resend Invite
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-red-600" onClick={() => openDeleteTeacherModal(teacher)}>
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          );
        },
      },
    ],
    []
  );

  const table = useReactTable({
    data: teachers,
    columns,
    state: { sorting, rowSelection, pagination },
    onSortingChange: setSorting,
    onRowSelectionChange: setRowSelection,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getRowId: (row) => row.id,
    enableRowSelection: true,
  });

  const pageRows = table.getRowModel().rows;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-800">Teachers</h1>
          <p className="mt-1 text-sm text-slate-600">
            Manage registered teachers, permissions, and assignments.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild>
            <Link to="/admin/teachers/new">
              <UserPlus className="h-4 w-4" />
              New Teacher
            </Link>
          </Button>
          <Button variant="outline" onClick={() => setImportOpen(true)}>
            <FileUp className="h-4 w-4" />
            Import Teachers
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              exportTeachersAsCsv(teachers, "teachers-filtered.csv", groupNameById);
              notifySuccess("Filtered teachers exported.");
            }}
          >
            <FileDown className="h-4 w-4" />
            Export
          </Button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Card className="cursor-pointer border-slate-200 hover:border-blue-300" onClick={() => applySummaryFilter("total")}>
          <CardHeader className="pb-2">
            <CardDescription>Total Teachers</CardDescription>
            <CardTitle className="text-2xl">{summary.total}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="cursor-pointer border-slate-200 hover:border-blue-300" onClick={() => applySummaryFilter("active")}>
          <CardHeader className="pb-2">
            <CardDescription>Active Teachers</CardDescription>
            <CardTitle className="text-2xl text-emerald-700">{summary.active}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="cursor-pointer border-slate-200 hover:border-blue-300" onClick={() => applySummaryFilter("invited")}>
          <CardHeader className="pb-2">
            <CardDescription>Pending Invites</CardDescription>
            <CardTitle className="text-2xl text-amber-700">{summary.invited}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="cursor-pointer border-slate-200 hover:border-blue-300" onClick={() => applySummaryFilter("alerts")}>
          <CardHeader className="pb-2">
            <CardDescription>Permission Alerts</CardDescription>
            <CardTitle className="text-2xl text-rose-700">{summary.permissionAlerts}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card className="border-slate-200">
        <CardContent className="space-y-4 pt-6">
          <div className="grid gap-2 lg:grid-cols-6">
            <Select
              value={filterForm.status}
              onValueChange={(value) => setFilterValue("status", value as TeacherFilterForm["status"])}
            >
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="All">All</SelectItem>
                <SelectItem value="Active">Active</SelectItem>
                <SelectItem value="Disabled">Disabled</SelectItem>
                <SelectItem value="Invited">Invited</SelectItem>
                <SelectItem value="Locked">Locked</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={filterForm.role}
              onValueChange={(value) => setFilterValue("role", value as TeacherFilterForm["role"])}
            >
              <SelectTrigger>
                <SelectValue placeholder="Role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="All">All</SelectItem>
                <SelectItem value="Teacher">Teacher</SelectItem>
                <SelectItem value="Evaluator">Evaluator</SelectItem>
                <SelectItem value="Exam Manager">Exam Manager</SelectItem>
                <SelectItem value="Custom">Custom</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={filterForm.scope}
              onValueChange={(value) => setFilterValue("scope", value as ScopeFilter)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Scope" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Any Scope">Any Scope</SelectItem>
                <SelectItem value="All Groups">All Groups</SelectItem>
                <SelectItem value="Selected Groups">Selected Groups</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={filterForm.assignedExams}
              onValueChange={(value) =>
                setFilterValue("assignedExams", value as TeacherFilterForm["assignedExams"])
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Assigned Exams" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Any">Any</SelectItem>
                <SelectItem value="None">None</SelectItem>
                <SelectItem value="Has Assigned">Has Assigned</SelectItem>
              </SelectContent>
            </Select>

            <Input
              value={filterForm.query}
              onChange={(event) => setFilterValue("query", event.target.value)}
              placeholder="Search name, email, phone..."
            />

            <div className="flex gap-2">
              <Button className="flex-1" onClick={() => applyFilterForm(filterForm)}>
                <Search className="h-4 w-4" />
                Search
              </Button>
              <Button variant="outline" onClick={() => setMoreFiltersOpen(true)}>
                More Filters
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {selectedTeacherIds.length > 0 && (
        <Card className="border-blue-200 bg-blue-50/60">
          <CardContent className="flex flex-wrap items-center gap-2 pt-5">
            <span className="mr-2 text-sm font-medium text-blue-900">
              {selectedTeacherIds.length} selected
            </span>
            <Button variant="outline" onClick={() => setBulkAction("assign-role")}>Assign Role</Button>
            <Button variant="outline" onClick={() => setBulkAction("assign-groups")}>Assign Groups</Button>
            <Button variant="outline" onClick={() => setBulkAction("resend-invite")}>Send Invite</Button>
            <Button variant="outline" onClick={() => setBulkAction("deactivate")}>Deactivate</Button>
            <Button variant="outline" onClick={() => setBulkAction("export-selected")}>Export Selected</Button>
            <Button variant="ghost" onClick={() => setRowSelection({})}>Clear</Button>
          </CardContent>
        </Card>
      )}

      <Card className="border-slate-200">
        <CardContent className="pt-5">
          {loadingTeachers ? (
            <div className="space-y-3">
              <Skeleton className="h-11 w-full" />
              <Skeleton className="h-11 w-full" />
              <Skeleton className="h-11 w-full" />
              <Skeleton className="h-11 w-full" />
              <Skeleton className="h-11 w-full" />
            </div>
          ) : teachersError ? (
            <div className="flex flex-col items-center gap-3 rounded-md border border-red-200 bg-red-50 p-6 text-center">
              <AlertTriangle className="h-6 w-6 text-red-600" />
              <p className="text-sm text-red-700">{teachersError}</p>
              <Button variant="outline" onClick={() => void loadTeachers()}>
                Retry
              </Button>
            </div>
          ) : teachers.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-md border border-slate-200 bg-slate-50 p-8 text-center">
              <Users className="h-6 w-6 text-slate-500" />
              <p className="font-medium text-slate-700">No teachers match your filters.</p>
              <p className="text-sm text-slate-500">Adjust filters or create a new teacher account.</p>
              <Button asChild>
                <Link to="/admin/teachers/new">
                  <Plus className="h-4 w-4" />
                  New Teacher
                </Link>
              </Button>
            </div>
          ) : (
            <>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    {table.getHeaderGroups().map((headerGroup) => (
                      <TableRow key={headerGroup.id}>
                        {headerGroup.headers.map((header) => (
                          <TableHead key={header.id}>
                            {header.isPlaceholder ? null : (
                              <button
                                type="button"
                                className="inline-flex items-center gap-1"
                                onClick={header.column.getToggleSortingHandler()}
                              >
                                {flexRender(header.column.columnDef.header, header.getContext())}
                                {header.column.getCanSort() && <ChevronDown className="h-3 w-3" />}
                              </button>
                            )}
                          </TableHead>
                        ))}
                      </TableRow>
                    ))}
                  </TableHeader>
                  <TableBody>
                    {pageRows.map((row) => (
                      <TableRow key={row.id} data-state={row.getIsSelected() && "selected"}>
                        {row.getVisibleCells().map((cell) => (
                          <TableCell key={cell.id}>
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-600">
                <div>
                  Showing {table.getState().pagination.pageIndex * table.getState().pagination.pageSize + 1}-
                  {Math.min(
                    (table.getState().pagination.pageIndex + 1) * table.getState().pagination.pageSize,
                    teachers.length
                  )}{" "}
                  of {teachers.length} teachers
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => table.previousPage()}
                    disabled={!table.getCanPreviousPage()}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span>
                    Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => table.nextPage()}
                    disabled={!table.getCanNextPage()}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card className="border-slate-200">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Audit Log</CardTitle>
            <Badge variant="secondary">Teacher actions</Badge>
          </div>
        </CardHeader>
        <CardContent className="text-sm text-slate-600">
          Updates to roles, permissions, invites, and assignments are tracked in each teacher&apos;s
          <span className="font-medium text-slate-700"> Activity Log</span> tab.
        </CardContent>
      </Card>

      {/* Drawers / dialogs */}
      <Sheet open={moreFiltersOpen} onOpenChange={setMoreFiltersOpen}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>Advanced Filters</SheetTitle>
            <SheetDescription>
              Refine teacher list by date ranges, permissions, and group assignment.
            </SheetDescription>
          </SheetHeader>

          <div className="mt-6 space-y-4">
            <div className="grid gap-2">
              <Label>Created Date From</Label>
              <Input
                type="date"
                value={filterForm.createdFrom}
                onChange={(event) => setFilterValue("createdFrom", event.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label>Created Date To</Label>
              <Input
                type="date"
                value={filterForm.createdTo}
                onChange={(event) => setFilterValue("createdTo", event.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label>Last Login From</Label>
              <Input
                type="date"
                value={filterForm.lastLoginFrom}
                onChange={(event) => setFilterValue("lastLoginFrom", event.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label>Last Login To</Label>
              <Input
                type="date"
                value={filterForm.lastLoginTo}
                onChange={(event) => setFilterValue("lastLoginTo", event.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label>Has Publish Permission</Label>
              <Select
                value={filterForm.hasPublishPermission}
                onValueChange={(value) => setFilterValue("hasPublishPermission", value as PublishFilter)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Any">Any</SelectItem>
                  <SelectItem value="Yes">Yes</SelectItem>
                  <SelectItem value="No">No</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Group Name</Label>
              <Input
                placeholder="e.g. Engineering"
                value={filterForm.groupName}
                onChange={(event) => setFilterValue("groupName", event.target.value)}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setMoreFiltersOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => {
                  applyFilterForm(filterForm);
                  setMoreFiltersOpen(false);
                }}
              >
                Apply Filters
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <Dialog open={Boolean(bulkAction)} onOpenChange={(open) => !open && setBulkAction(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Bulk Action</DialogTitle>
            <DialogDescription>
              Apply this action to {selectedTeacherIds.length} selected teacher(s).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {bulkAction === "assign-role" && (
              <div className="space-y-2">
                <Label>Assign Role</Label>
                <Select value={bulkRole} onValueChange={(value) => setBulkRole(value as TeacherRole)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Teacher">Teacher</SelectItem>
                    <SelectItem value="Evaluator">Evaluator</SelectItem>
                    <SelectItem value="Exam Manager">Exam Manager</SelectItem>
                    <SelectItem value="Custom">Custom</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {bulkAction === "assign-groups" && (
              <div className="space-y-2">
                <Input
                  placeholder="Search groups..."
                  value={bulkGroupSearch}
                  onChange={(event) => setBulkGroupSearch(event.target.value)}
                />
                <div className="max-h-56 space-y-2 overflow-y-auto rounded-md border p-3">
                  {filteredGroupsForBulk.map((group) => (
                    <label key={group.id} className="flex items-center justify-between gap-2 rounded-md p-2 hover:bg-slate-50">
                      <span className="text-sm">{group.name}</span>
                      <Checkbox
                        checked={bulkGroupIds.includes(group.id)}
                        onCheckedChange={(checked) =>
                          setBulkGroupIds((prev) =>
                            toBoolean(checked)
                              ? prev.includes(group.id)
                                ? prev
                                : [...prev, group.id]
                              : prev.filter((id) => id !== group.id)
                          )
                        }
                      />
                    </label>
                  ))}
                </div>
              </div>
            )}

            {bulkAction === "resend-invite" && (
              <p className="rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
                Invites will be sent or re-sent to selected teachers.
              </p>
            )}
            {bulkAction === "deactivate" && (
              <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                Selected teachers will be deactivated and unable to sign in.
              </p>
            )}
            {bulkAction === "export-selected" && (
              <p className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
                Export selected rows as a CSV file.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkAction(null)}>
              Cancel
            </Button>
            <Button onClick={() => void handleBulkSubmit()} disabled={bulkActionLoading}>
              {bulkActionLoading ? "Processing..." : "Apply"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Sheet
        open={Boolean(teacherIdParam)}
        onOpenChange={(open) => {
          if (!open) closeDetailSheet();
        }}
      >
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-2xl">
          <SheetHeader>
            <SheetTitle>Teacher Details</SheetTitle>
            <SheetDescription>Review profile, permissions, assignments, and recent activity.</SheetDescription>
          </SheetHeader>
          {detailLoading || !detailTeacher ? (
            <div className="mt-6 space-y-3">
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-44 w-full" />
              <Skeleton className="h-44 w-full" />
            </div>
          ) : (
            <div className="mt-6 space-y-4">
              <Card>
                <CardContent className="pt-5">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-14 w-14 border border-blue-100">
                        <AvatarFallback className="bg-blue-100 text-blue-700">
                          {getTeacherInitials(detailTeacher)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <h3 className="text-lg font-semibold text-slate-800">{detailTeacher.fullName}</h3>
                        <p className="text-sm text-slate-600">{detailTeacher.email}</p>
                        <p className="text-sm text-slate-600">{detailTeacher.phone || "No phone"}</p>
                        <p className="text-xs text-slate-500">
                          Last login: {formatRelativeTime(detailTeacher.lastLoginAt)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={roleBadgeVariant(detailTeacher.role)}>{detailTeacher.role}</Badge>
                      <Badge variant={statusBadgeVariant(detailTeacher.status)}>{detailTeacher.status}</Badge>
                      <Switch
                        checked={detailTeacher.status === "Active"}
                        onCheckedChange={async (checked) => {
                          try {
                            await deactivateTeacher(detailTeacher.id, checked);
                            notifySuccess(checked ? "Teacher activated." : "Teacher disabled.");
                            refreshTeachers();
                          } catch (error) {
                            notifyError(error instanceof Error ? error.message : "Unable to update status.");
                          }
                        }}
                      />
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button variant="outline" onClick={() => setDetailTab("profile")}>
                      Edit
                    </Button>
                    <Button variant="outline" onClick={() => openResetPasswordModal(detailTeacher)}>
                      Reset Password
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Tabs value={detailTab} onValueChange={setDetailTab}>
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="profile">Profile</TabsTrigger>
                  <TabsTrigger value="permissions">Permissions</TabsTrigger>
                  <TabsTrigger value="assignments">Assignments</TabsTrigger>
                  <TabsTrigger value="activity">Activity Log</TabsTrigger>
                </TabsList>

                <TabsContent value="profile">
                  <Card>
                    <CardContent className="space-y-3 pt-5">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="grid gap-2">
                          <Label>First Name</Label>
                          <Input
                            value={profileDraft.firstName}
                            onChange={(event) => setProfileDraft((prev) => ({ ...prev, firstName: event.target.value }))}
                          />
                        </div>
                        <div className="grid gap-2">
                          <Label>Last Name</Label>
                          <Input
                            value={profileDraft.lastName}
                            onChange={(event) => setProfileDraft((prev) => ({ ...prev, lastName: event.target.value }))}
                          />
                        </div>
                        <div className="grid gap-2">
                          <Label>Email</Label>
                          <Input
                            type="email"
                            value={profileDraft.email}
                            onChange={(event) => setProfileDraft((prev) => ({ ...prev, email: event.target.value }))}
                          />
                        </div>
                        <div className="grid gap-2">
                          <Label>Phone</Label>
                          <Input
                            value={profileDraft.phone}
                            onChange={(event) => setProfileDraft((prev) => ({ ...prev, phone: event.target.value }))}
                          />
                        </div>
                        <div className="grid gap-2">
                          <Label>Username</Label>
                          <Input
                            value={profileDraft.username}
                            onChange={(event) => setProfileDraft((prev) => ({ ...prev, username: event.target.value }))}
                          />
                        </div>
                        <div className="grid gap-2">
                          <Label>Role</Label>
                          <Select
                            value={profileDraft.role}
                            onValueChange={(value) => setProfileDraft((prev) => ({ ...prev, role: value as TeacherRole }))}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Teacher">Teacher</SelectItem>
                              <SelectItem value="Evaluator">Evaluator</SelectItem>
                              <SelectItem value="Exam Manager">Exam Manager</SelectItem>
                              <SelectItem value="Custom">Custom</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="flex justify-end">
                        <Button onClick={() => void handleSaveProfile()} disabled={detailSavingProfile}>
                          {detailSavingProfile ? "Saving..." : "Save Profile"}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="permissions">
                  <Card>
                    <CardContent className="space-y-3 pt-5">
                      {permissionMeta.map((permission) => (
                        <label
                          key={permission.key}
                          className="flex items-center justify-between gap-3 rounded-md border border-slate-200 px-3 py-2"
                        >
                          <span className="text-sm text-slate-700">{permission.label}</span>
                          <Checkbox
                            checked={permissionDraft[permission.key]}
                            onCheckedChange={(value) =>
                              setPermissionDraft((prev) => ({ ...prev, [permission.key]: toBoolean(value) }))
                            }
                          />
                        </label>
                      ))}
                      {permissionDraft.publishExams && (
                        <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                          <ShieldAlert className="mt-0.5 h-4 w-4" />
                          Enabling Publish Exams allows this teacher to publish live exams.
                        </div>
                      )}
                      <div className="flex justify-end">
                        <Button onClick={() => void handleSavePermissions()} disabled={detailSavingPermissions}>
                          {detailSavingPermissions ? "Saving..." : "Save Changes"}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="assignments">
                  <div className="space-y-3">
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">Assigned Groups</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        {detailTeacher.groups.length === 0 ? (
                          <p className="text-sm text-slate-500">No groups assigned.</p>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            {detailTeacher.groups.map((groupId) => (
                              <Badge key={groupId} variant="outline">
                                {groupNameById.get(groupId) ?? groupId}
                              </Badge>
                            ))}
                          </div>
                        )}
                        <Button variant="outline" onClick={() => openAssignGroupsModal(detailTeacher)}>
                          Assign Groups
                        </Button>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">Assigned Exams</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        {detailTeacher.assignedExams.length === 0 ? (
                          <p className="text-sm text-slate-500">No exams assigned.</p>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            {detailTeacher.assignedExams.map((examId) => (
                              <Badge key={examId} variant="outline">
                                {examNameById.get(examId) ?? examId}
                              </Badge>
                            ))}
                          </div>
                        )}
                        <Button variant="outline" onClick={() => openAssignExamsModal(detailTeacher)}>
                          Assign Exams
                        </Button>
                      </CardContent>
                    </Card>
                  </div>
                </TabsContent>

                <TabsContent value="activity">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Activity Log</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="rounded-md border">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Timestamp</TableHead>
                              <TableHead>Action</TableHead>
                              <TableHead>Done By</TableHead>
                              <TableHead>Details</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {detailLogs.length === 0 ? (
                              <TableRow>
                                <TableCell colSpan={4} className="text-center text-sm text-slate-500">
                                  No activity available.
                                </TableCell>
                              </TableRow>
                            ) : (
                              detailLogs.map((log) => (
                                <TableRow key={log.id}>
                                  <TableCell className="text-xs">
                                    {format(new Date(log.timestamp), "yyyy-MM-dd HH:mm")}
                                  </TableCell>
                                  <TableCell>{log.action}</TableCell>
                                  <TableCell>{log.doneBy}</TableCell>
                                  <TableCell>{log.details}</TableCell>
                                </TableRow>
                              ))
                            )}
                          </TableBody>
                        </Table>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </div>
          )}
        </SheetContent>
      </Sheet>

      <Dialog open={assignGroupsOpen} onOpenChange={setAssignGroupsOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Assign Groups</DialogTitle>
            <DialogDescription>
              {assignGroupsTeacher ? `Update groups for ${assignGroupsTeacher.fullName}.` : "Assign groups"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              placeholder="Search groups..."
              value={assignGroupsSearch}
              onChange={(event) => setAssignGroupsSearch(event.target.value)}
            />
            <div className="max-h-72 space-y-2 overflow-y-auto rounded-md border p-3">
              {filteredAssignGroups.map((group) => (
                <label key={group.id} className="flex items-center justify-between gap-2 rounded-md p-2 hover:bg-slate-50">
                  <div>
                    <p className="text-sm font-medium">{group.name}</p>
                    <p className="text-xs text-slate-500">{group.membersCount} members</p>
                  </div>
                  <Checkbox
                    checked={assignGroupIds.includes(group.id)}
                    onCheckedChange={(checked) =>
                      setAssignGroupIds((prev) =>
                        toBoolean(checked)
                          ? prev.includes(group.id)
                            ? prev
                            : [...prev, group.id]
                          : prev.filter((id) => id !== group.id)
                      )
                    }
                  />
                </label>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignGroupsOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void handleAssignGroupsSave()} disabled={assignGroupsSaving}>
              {assignGroupsSaving ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={assignExamsOpen} onOpenChange={setAssignExamsOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Assign Exams</DialogTitle>
            <DialogDescription>
              {assignExamsTeacher ? `Update exams for ${assignExamsTeacher.fullName}.` : "Assign exams"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              placeholder="Search exams..."
              value={assignExamsSearch}
              onChange={(event) => setAssignExamsSearch(event.target.value)}
            />
            <div className="max-h-72 space-y-2 overflow-y-auto rounded-md border p-3">
              {filteredAssignExams.map((exam) => (
                <label key={exam.id} className="flex items-center justify-between gap-2 rounded-md p-2 hover:bg-slate-50">
                  <div>
                    <p className="text-sm font-medium">{exam.name}</p>
                    <p className="text-xs text-slate-500">
                      {exam.status === "published" ? "Published" : "Draft"} •{" "}
                      {format(new Date(exam.scheduledAt), "MMM d, yyyy")}
                    </p>
                  </div>
                  <Checkbox
                    checked={assignExamIds.includes(exam.id)}
                    onCheckedChange={(checked) =>
                      setAssignExamIds((prev) =>
                        toBoolean(checked)
                          ? prev.includes(exam.id)
                            ? prev
                            : [...prev, exam.id]
                          : prev.filter((id) => id !== exam.id)
                      )
                    }
                  />
                </label>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignExamsOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void handleAssignExamsSave()} disabled={assignExamsSaving}>
              {assignExamsSaving ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={resetPasswordOpen} onOpenChange={setResetPasswordOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset Password</DialogTitle>
            <DialogDescription>
              {resetPasswordTeacher
                ? `Reset password for ${resetPasswordTeacher.fullName}.`
                : "Reset teacher password."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-md border p-3">
              <div className="space-y-1">
                <p className="text-sm font-medium">Send via email</p>
                <p className="text-xs text-slate-500">Email the generated password to teacher.</p>
              </div>
              <Switch checked={resetSendEmail} onCheckedChange={setResetSendEmail} />
            </div>
            {generatedPassword && (
              <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3">
                <p className="text-xs font-medium text-emerald-900">Generated Password</p>
                <div className="mt-1 flex items-center justify-between gap-2">
                  <code className="text-sm text-emerald-900">{generatedPassword}</code>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(generatedPassword);
                        notifySuccess("Password copied.");
                      } catch {
                        notifyError("Clipboard unavailable.");
                      }
                    }}
                  >
                    Copy
                  </Button>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetPasswordOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void handleResetPassword()} disabled={resetPasswordSending}>
              <KeyRound className="h-4 w-4" />
              {resetPasswordSending ? "Resetting..." : "Confirm Reset"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteTeacherOpen} onOpenChange={setDeleteTeacherOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Teacher</DialogTitle>
            <DialogDescription>
              This action cannot be undone. The teacher account and assignment references will be removed.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTeacherOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => void handleDeleteTeacher()} disabled={deletingTeacher}>
              {deletingTeacher ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Import Teachers</DialogTitle>
            <DialogDescription>
              Upload a file, validate preview rows, then import teacher accounts.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="rounded-md border border-dashed p-4">
              <Label htmlFor="import-file" className="mb-2 block text-sm">
                Upload CSV / XLSX (UI only)
              </Label>
              <Input
                id="import-file"
                type="file"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  setImportFilename(file?.name ?? "");
                  if (file) setImportPreviewRows(importPreviewSeed);
                }}
              />
              {importFilename && <p className="mt-2 text-xs text-slate-500">Selected: {importFilename}</p>}
            </div>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Role</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {importPreviewRows.map((row, index) => (
                    <TableRow key={`${row.email}-${index}`}>
                      <TableCell>{`${row.firstName} ${row.lastName}`}</TableCell>
                      <TableCell>{row.email}</TableCell>
                      <TableCell>{row.phone}</TableCell>
                      <TableCell>{row.role}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setImportOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void handleImportTeachers()} disabled={importing}>
              {importing ? "Importing..." : `Import ${importPreviewRows.length} Teachers`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
