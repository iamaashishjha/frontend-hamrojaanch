/**
 * Teacher profile creation — full-page design (same layout as Candidate Create).
 * Sections: Basic, Security, Role & permissions, Access scope, Send credentials.
 */
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import PageHeader from "@/components/admin/PageHeader";
import FormField from "@/components/admin/FormField";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Eye, EyeOff, RefreshCw } from "lucide-react";
import {
  createTeacher,
  listTeacherGroups,
  type TeacherCreatePayload,
} from "@/lib/teachers-api";
import type {
  TeacherGroup,
  TeacherPermissions,
  TeacherRole,
  ScopeType,
} from "@/lib/teachers-types";
import { toast } from "@/components/ui/use-toast";

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

type RolePreset = "Question Creator" | "Evaluator" | "Exam Manager" | "Full Teacher" | "Custom";

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

const rolePresetOptions: RolePreset[] = [
  "Question Creator",
  "Evaluator",
  "Exam Manager",
  "Full Teacher",
  "Custom",
];

function presetToRoleAndPermissions(
  preset: RolePreset
): { role: TeacherRole; permissions: TeacherPermissions } {
  if (preset === "Question Creator") {
    return {
      role: "Teacher",
      permissions: {
        ...defaultPermissions,
        createEditQuestions: true,
        createEditExams: false,
        evaluateEssays: false,
      },
    };
  }
  if (preset === "Evaluator") {
    return {
      role: "Evaluator",
      permissions: {
        ...defaultPermissions,
        createEditQuestions: false,
        createEditExams: false,
        evaluateEssays: true,
        viewReportsAll: true,
      },
    };
  }
  if (preset === "Exam Manager") {
    return {
      role: "Exam Manager",
      permissions: {
        ...defaultPermissions,
        createEditQuestions: true,
        createEditExams: true,
        publishExams: true,
        manageCandidates: true,
        manageGroups: true,
      },
    };
  }
  if (preset === "Full Teacher") {
    return {
      role: "Teacher",
      permissions: {
        ...defaultPermissions,
        createEditQuestions: true,
        createEditExams: true,
        evaluateEssays: true,
      },
    };
  }
  return { role: "Custom", permissions: { ...defaultPermissions } };
}

function generatePassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  let s = "";
  for (let i = 0; i < 10; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

export default function TeacherCreatePage() {
  const navigate = useNavigate();
  const [groups, setGroups] = useState<TeacherGroup[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [useEmailAsUsername, setUseEmailAsUsername] = useState(true);
  const [username, setUsername] = useState("");
  const [autoGeneratePassword, setAutoGeneratePassword] = useState(true);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [forcePasswordChange, setForcePasswordChange] = useState(true);
  const [rolePreset, setRolePreset] = useState<RolePreset>("Full Teacher");
  const [permissions, setPermissions] = useState<TeacherPermissions>(() =>
    presetToRoleAndPermissions("Full Teacher").permissions
  );
  const [scopeType, setScopeType] = useState<ScopeType>("all");
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
  const [sendLoginDetails, setSendLoginDetails] = useState(true);

  useEffect(() => {
    listTeacherGroups()
      .then(setGroups)
      .catch(() => toast({ variant: "destructive", title: "Could not load groups" }))
      .finally(() => setLoadingGroups(false));
  }, []);

  const usernameValue = useEmailAsUsername ? email : username;

  const handlePresetChange = (preset: RolePreset) => {
    setRolePreset(preset);
    const mapped = presetToRoleAndPermissions(preset);
    setPermissions(mapped.permissions);
  };

  const handleGeneratePassword = () => {
    const p = generatePassword();
    setPassword(p);
    setConfirmPassword(p);
    setAutoGeneratePassword(false);
  };

  const handleSubmit = async () => {
    if (!firstName.trim() || !lastName.trim() || !email.trim()) {
      toast({ variant: "destructive", title: "First name, last name, and email are required." });
      return;
    }
    let finalPassword = password;
    if (autoGeneratePassword) {
      finalPassword = generatePassword();
    } else {
      if (!password || password.length < 6) {
        toast({ variant: "destructive", title: "Password must be at least 6 characters." });
        return;
      }
      if (password !== confirmPassword) {
        toast({ variant: "destructive", title: "Password and confirm password do not match." });
        return;
      }
    }
    if (scopeType === "selected" && selectedGroupIds.length === 0) {
      toast({ variant: "destructive", title: "Select at least one group for selected-groups scope." });
      return;
    }
    const role = presetToRoleAndPermissions(rolePreset).role;
    const payload: TeacherCreatePayload = {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email.trim(),
      phone: phone.trim(),
      username: usernameValue.trim() || email.trim(),
      role,
      permissions,
      scopeType,
      groups: scopeType === "all" ? [] : selectedGroupIds,
      sendLoginDetails,
    };
    setSubmitting(true);
    try {
      await createTeacher(payload);
      toast({ title: "Teacher created.", description: sendLoginDetails ? "Login details will be sent via email." : "" });
      navigate("/admin/teachers", { replace: true });
    } catch (e) {
      toast({
        variant: "destructive",
        title: "Create failed",
        description: e instanceof Error ? e.message : "Unable to create teacher.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const toggleGroup = (groupId: string, checked: boolean) => {
    setSelectedGroupIds((prev) =>
      checked ? (prev.includes(groupId) ? prev : [...prev, groupId]) : prev.filter((id) => id !== groupId)
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Create New Teacher"
        subtitle="Add a teacher profile: basic info, login security, role & permissions, access scope, and send credentials."
        actions={
          <>
            <Button variant="outline" asChild>
              <Link to="/admin/teachers">Cancel</Link>
            </Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? "Creating…" : "Save & create"}
            </Button>
          </>
        }
      />

      {/* 1. Basic (required) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Basic info (required)</CardTitle>
          <CardDescription>First name, last name, email, mobile, username.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <FormField label="First name" required>
            <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="First name" />
          </FormField>
          <FormField label="Last name" required>
            <Input value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Last name" />
          </FormField>
          <FormField label="Email" required>
            <Input
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (useEmailAsUsername) setUsername(e.target.value);
              }}
              placeholder="name@example.com"
            />
          </FormField>
          <FormField label="Mobile">
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+977 98xxxxxxxx" />
          </FormField>
          <div className="flex items-center justify-between space-x-2 rounded-lg border p-4 md:col-span-2">
            <Label className="text-sm font-medium">Username same as email</Label>
            <Switch checked={useEmailAsUsername} onCheckedChange={setUseEmailAsUsername} />
          </div>
          <FormField label="Username">
            <Input
              value={usernameValue}
              disabled={useEmailAsUsername}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Username"
            />
          </FormField>
        </CardContent>
      </Card>

      {/* 2. Security */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Security</CardTitle>
          <CardDescription>Temp password (auto-generate or manual), force reset on first login.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="flex items-center justify-between space-x-2 rounded-lg border p-4">
            <Label className="text-sm font-medium">Auto-generate password</Label>
            <Switch
              checked={autoGeneratePassword}
              onCheckedChange={(c) => {
                setAutoGeneratePassword(c);
                if (c) {
                  setPassword("");
                  setConfirmPassword("");
                }
              }}
            />
          </div>
          {!autoGeneratePassword && (
            <>
              <FormField label="Password" required>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Min 6 characters"
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((p) => !p)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <Button type="button" variant="outline" onClick={handleGeneratePassword}>
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </div>
              </FormField>
              <FormField label="Confirm password" required>
                <Input
                  type={showPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm password"
                />
              </FormField>
            </>
          )}
          <div className="flex items-center justify-between space-x-2 rounded-lg border p-4 md:col-span-2">
            <Label className="text-sm font-medium">Force password change on first login</Label>
            <Switch checked={forcePasswordChange} onCheckedChange={setForcePasswordChange} />
          </div>
        </CardContent>
      </Card>

      {/* 3. Role & permissions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Role & permissions</CardTitle>
          <CardDescription>Choose a role preset or customize permissions.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <FormField label="Role preset">
            <Select value={rolePreset} onValueChange={(v) => handlePresetChange(v as RolePreset)}>
              <SelectTrigger className="w-[220px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {rolePresetOptions.map((opt) => (
                  <SelectItem key={opt} value={opt}>
                    {opt}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          <div className="space-y-2">
            <Label className="text-sm font-medium">Permissions</Label>
            <div className="grid gap-2 rounded-lg border p-4 sm:grid-cols-2">
              {permissionMeta.map(({ key, label }) => (
                <label key={key} className="flex items-center justify-between gap-3 rounded-md border border-slate-200 px-3 py-2">
                  <span className="text-sm text-slate-700">{label}</span>
                  <Checkbox
                    checked={permissions[key]}
                    onCheckedChange={(checked) =>
                      setPermissions((prev) => ({ ...prev, [key]: checked === true }))
                    }
                  />
                </label>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 4. Access scope */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Access scope</CardTitle>
          <CardDescription>All groups or selected groups only.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 rounded-md border border-slate-200 px-4 py-2">
              <Checkbox
                checked={scopeType === "all"}
                onCheckedChange={() => setScopeType("all")}
              />
              <span className="text-sm text-slate-700">All groups</span>
            </label>
            <label className="flex items-center gap-2 rounded-md border border-slate-200 px-4 py-2">
              <Checkbox
                checked={scopeType === "selected"}
                onCheckedChange={() => setScopeType("selected")}
              />
              <span className="text-sm text-slate-700">Selected groups</span>
            </label>
          </div>
          {scopeType === "selected" && (
            <div className="max-h-48 space-y-2 overflow-y-auto rounded-lg border p-4">
              {loadingGroups ? (
                <p className="text-sm text-muted-foreground">Loading groups…</p>
              ) : groups.length === 0 ? (
                <p className="text-sm text-muted-foreground">No groups yet.</p>
              ) : (
                groups.map((g) => (
                  <label key={g.id} className="flex items-center gap-2">
                    <Checkbox
                      checked={selectedGroupIds.includes(g.id)}
                      onCheckedChange={(c) => toggleGroup(g.id, c === true)}
                    />
                    <span className="text-sm text-slate-700">{g.name}</span>
                  </label>
                ))
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 5. Send credentials */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Send credentials</CardTitle>
          <CardDescription>Send login details (username + temp password) via email after creation.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between rounded-lg border p-4">
            <Label className="text-sm font-medium">Send login details via email</Label>
            <Switch checked={sendLoginDetails} onCheckedChange={setSendLoginDetails} />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button variant="outline" asChild>
          <Link to="/admin/teachers">Cancel</Link>
        </Button>
        <Button onClick={handleSubmit} disabled={submitting}>
          {submitting ? "Creating…" : "Save & create"}
        </Button>
      </div>
    </div>
  );
}
