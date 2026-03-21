/**
 * Candidate Profile Creation — Admin workflow.
 * Single candidate (manual) or Bulk upload (CSV/Excel).
 * Sections: Basic, Security, Optional, Verification, Assign access, Send credentials.
 */
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import PageHeader from "@/components/admin/PageHeader";
import FormField from "@/components/admin/FormField";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Eye, EyeOff, FileUp, UserPlus, RefreshCw } from "lucide-react";
import { createCandidate, type CreateCandidatePayload } from "@/lib/candidates-api";
import { listExamGroups } from "@/lib/exams-module-api";
import type { ExamGroup } from "@/lib/exams-module-types";
import { toast } from "@/components/ui/use-toast";

type CreationMode = "single" | "bulk";
type SendCredentialsVia = "email" | "sms" | "both" | "none";

const defaultBasic = {
  fullName: "",
  email: "",
  mobile: "",
  usernameMode: "auto" as "auto" | "manual",
  username: "",
  candidateIdMode: "auto" as "auto" | "manual",
  candidateIdRoll: "",
};
const defaultSecurity = { tempPassword: "", forceResetOnFirstLogin: true };
const defaultOptional = {
  dob: "",
  gender: "",
  address: "",
  nationality: "",
  category: "",
  organization: "",
};
const defaultVerification = {
  requireIdDocuments: false,
  requireSelfie: false,
  requireProfileCompletionBeforeLogin: false,
};
const defaultAccess = {
  groupId: "",
  validityStart: "",
  validityEnd: "",
};
const defaultSend: SendCredentialsVia = "none";
const defaultSendWelcome = false;

function generatePassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  let s = "";
  for (let i = 0; i < 10; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

export default function CandidateCreatePage() {
  const navigate = useNavigate();
  const [creationMode, setCreationMode] = useState<CreationMode>("single");
  const [groups, setGroups] = useState<ExamGroup[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [basic, setBasic] = useState(defaultBasic);
  const [security, setSecurity] = useState(defaultSecurity);
  const [optional, setOptional] = useState(defaultOptional);
  const [verification, setVerification] = useState(defaultVerification);
  const [access, setAccess] = useState(defaultAccess);
  const [sendVia, setSendVia] = useState<SendCredentialsVia>(defaultSend);
  const [sendWelcome, setSendWelcome] = useState(defaultSendWelcome);

  useEffect(() => {
    listExamGroups()
      .then(setGroups)
      .catch(() => toast({ variant: "destructive", title: "Could not load groups" }))
      .finally(() => setLoadingGroups(false));
  }, []);

  const usernameValue = useMemo(
    () => (basic.usernameMode === "auto" ? basic.email : basic.username),
    [basic.usernameMode, basic.email, basic.username]
  );
  const setBasicField = (key: keyof typeof basic, value: string | "auto" | "manual") => {
    setBasic((prev) => ({ ...prev, [key]: value }));
  };
  const setSecurityField = (key: keyof typeof security, value: string | boolean) => {
    setSecurity((prev) => ({ ...prev, [key]: value }));
  };

  const handleGeneratePassword = () => {
    setSecurity((prev) => ({ ...prev, tempPassword: generatePassword() }));
  };

  const handleSubmit = async () => {
    if (!basic.fullName.trim() || !basic.email.trim()) {
      toast({ variant: "destructive", title: "Full name and email are required." });
      return;
    }
    const password = security.tempPassword.trim();
    if (!password || password.length < 6) {
      toast({ variant: "destructive", title: "Please generate or enter a temp password (min 6 characters)." });
      return;
    }
    setSubmitting(true);
    try {
      const payload: CreateCandidatePayload = {
        name: basic.fullName.trim(),
        email: basic.email.trim(),
        password,
        phone: basic.mobile.trim() || undefined,
        forceResetOnFirstLogin: security.forceResetOnFirstLogin,
      };
      const candidate = await createCandidate(payload);
      toast({ title: "Candidate created", description: `${candidate.name} (${candidate.email}) — status saved.` });
      navigate("/candidates", { replace: true });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to create candidate.";
      toast({ variant: "destructive", title: "Create failed", description: msg });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Create New Candidate"
        subtitle="Single candidate (manual) or bulk upload. Required: full name, email, mobile, username, temp password."
        actions={
          <>
            <Button variant="outline" asChild>
              <Link to="/candidates">Cancel</Link>
            </Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? "Saving…" : "Save & create"}
            </Button>
          </>
        }
      />

      {/* Creation mode */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Choose creation mode</CardTitle>
          <CardDescription>Single candidate (manual) or bulk upload (CSV/Excel).</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-4">
          <Button
            variant={creationMode === "single" ? "default" : "outline"}
            onClick={() => setCreationMode("single")}
          >
            <UserPlus className="h-4 w-4 mr-2" />
            Single candidate (manual)
          </Button>
          <Button
            variant={creationMode === "bulk" ? "default" : "outline"}
            onClick={() => setCreationMode("bulk")}
          >
            <FileUp className="h-4 w-4 mr-2" />
            Bulk upload (CSV/Excel)
          </Button>
        </CardContent>
      </Card>

      {creationMode === "bulk" && (
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">
              Bulk upload: upload a CSV or Excel file with columns (Full name, Email, Mobile, etc.). This option is
              recommended for adding many candidates at once. Implementation can be wired to a backend import endpoint.
            </p>
            <Button variant="outline" className="mt-4" disabled>
              Upload file (coming soon)
            </Button>
          </CardContent>
        </Card>
      )}

      {creationMode === "single" && (
        <>
          {/* 1. Basic (required) */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Candidate details — Basic (required)</CardTitle>
              <CardDescription>Full name, Email, Mobile, Username, Candidate ID/Roll.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <FormField label="Full name" required>
                <Input
                  placeholder="Full name"
                  value={basic.fullName}
                  onChange={(e) => setBasicField("fullName", e.target.value)}
                />
              </FormField>
              <FormField label="Email" required>
                <Input
                  type="email"
                  placeholder="name@example.com"
                  value={basic.email}
                  onChange={(e) => setBasicField("email", e.target.value)}
                />
              </FormField>
              <FormField label="Mobile" required>
                <Input
                  placeholder="+977 98xxxxxxxx"
                  value={basic.mobile}
                  onChange={(e) => setBasicField("mobile", e.target.value)}
                />
              </FormField>
              <div className="space-y-2">
                <Label className="text-sm font-medium">Username</Label>
                <div className="flex flex-wrap items-center gap-2">
                  <Select
                    value={basic.usernameMode}
                    onValueChange={(v) => setBasicField("usernameMode", v as "auto" | "manual")}
                  >
                    <SelectTrigger className="w-[140px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto">Auto (email)</SelectItem>
                      <SelectItem value="manual">Manual</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    placeholder="Username"
                    value={usernameValue}
                    disabled={basic.usernameMode === "auto"}
                    onChange={(e) => setBasicField("username", e.target.value)}
                    className="flex-1 min-w-[180px]"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">Candidate ID / Roll</Label>
                <div className="flex flex-wrap items-center gap-2">
                  <Select
                    value={basic.candidateIdMode}
                    onValueChange={(v) => setBasicField("candidateIdMode", v as "auto" | "manual")}
                  >
                    <SelectTrigger className="w-[140px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto">Auto-generate</SelectItem>
                      <SelectItem value="manual">Manual</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    placeholder="ID or Roll number"
                    value={basic.candidateIdRoll}
                    disabled={basic.candidateIdMode === "auto"}
                    onChange={(e) => setBasicField("candidateIdRoll", e.target.value)}
                    className="flex-1 min-w-[180px]"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 2. Security */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Security</CardTitle>
              <CardDescription>Temp password (auto-generate), force reset on first login.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <FormField label="Temp password" required hint="Share with candidate securely.">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Input
                      type={showPassword ? "text" : "password"}
                      placeholder="Generate or enter"
                      value={security.tempPassword}
                      onChange={(e) => setSecurityField("tempPassword", e.target.value)}
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
              <div className="flex items-center justify-between space-x-2 rounded-lg border p-4">
                <Label className="text-sm font-medium">Force reset on first login</Label>
                <Switch
                  checked={security.forceResetOnFirstLogin}
                  onCheckedChange={(v) => setSecurityField("forceResetOnFirstLogin", v)}
                />
              </div>
            </CardContent>
          </Card>

          {/* 3. Optional */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Optional</CardTitle>
              <CardDescription>DOB, Gender, Address, Nationality, Category, Organization/College, Photo.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <FormField label="Date of birth">
                <Input
                  type="date"
                  value={optional.dob}
                  onChange={(e) => setOptional((p) => ({ ...p, dob: e.target.value }))}
                />
              </FormField>
              <FormField label="Gender">
                <Select value={optional.gender || "_"} onValueChange={(v) => setOptional((p) => ({ ...p, gender: v === "_" ? "" : v }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_">—</SelectItem>
                    <SelectItem value="male">Male</SelectItem>
                    <SelectItem value="female">Female</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </FormField>
              <div className="md:col-span-2">
                <FormField label="Address">
                  <Input
                    placeholder="Address"
                    value={optional.address}
                    onChange={(e) => setOptional((p) => ({ ...p, address: e.target.value }))}
                  />
                </FormField>
              </div>
              <FormField label="Nationality">
                <Input
                  placeholder="Nationality"
                  value={optional.nationality}
                  onChange={(e) => setOptional((p) => ({ ...p, nationality: e.target.value }))}
                />
              </FormField>
              <FormField label="Category">
                <Input
                  placeholder="Category"
                  value={optional.category}
                  onChange={(e) => setOptional((p) => ({ ...p, category: e.target.value }))}
                />
              </FormField>
              <FormField label="Organization / College">
                <Input
                  placeholder="Organization or college"
                  value={optional.organization}
                  onChange={(e) => setOptional((p) => ({ ...p, organization: e.target.value }))}
                />
              </FormField>
              <FormField label="Photo">
                <Input type="file" accept="image/*" className="cursor-pointer" />
              </FormField>
            </CardContent>
          </Card>

          {/* 4. Verification requirements */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Verification requirements (optional)</CardTitle>
              <CardDescription>Require ID documents, selfie, or profile completion before login/exam.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between rounded-lg border p-4">
                <Label>Require ID documents?</Label>
                <Select
                  value={verification.requireIdDocuments ? "yes" : "no"}
                  onValueChange={(v) => setVerification((p) => ({ ...p, requireIdDocuments: v === "yes" }))}
                >
                  <SelectTrigger className="w-[100px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="no">No</SelectItem>
                    <SelectItem value="yes">Yes</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between rounded-lg border p-4">
                <Label>Require selfie?</Label>
                <Select
                  value={verification.requireSelfie ? "yes" : "no"}
                  onValueChange={(v) => setVerification((p) => ({ ...p, requireSelfie: v === "yes" }))}
                >
                  <SelectTrigger className="w-[100px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="no">No</SelectItem>
                    <SelectItem value="yes">Yes</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between rounded-lg border p-4">
                <Label>Require profile completion before login/exam?</Label>
                <Switch
                  checked={verification.requireProfileCompletionBeforeLogin}
                  onCheckedChange={(v) => setVerification((p) => ({ ...p, requireProfileCompletionBeforeLogin: v }))}
                />
              </div>
            </CardContent>
          </Card>

          {/* 5. Assign access */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Assign access (optional at creation)</CardTitle>
              <CardDescription>Assign exam/product entitlement, batch/group, validity window.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <FormField label="Assign batch / group">
                <Select
                  value={access.groupId || "_"}
                  onValueChange={(v) => setAccess((p) => ({ ...p, groupId: v === "_" ? "" : v }))}
                  disabled={loadingGroups}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select group" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_">— None —</SelectItem>
                    {groups.map((g) => (
                      <SelectItem key={g.id} value={g.id}>
                        {g.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
              <FormField label="Exam/product entitlement">
                <Select>
                  <SelectTrigger>
                    <SelectValue placeholder="Free / Manual (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    <SelectItem value="free">Free</SelectItem>
                    <SelectItem value="manual">Manual</SelectItem>
                  </SelectContent>
                </Select>
              </FormField>
              <FormField label="Validity start">
                <Input
                  type="date"
                  value={access.validityStart}
                  onChange={(e) => setAccess((p) => ({ ...p, validityStart: e.target.value }))}
                />
              </FormField>
              <FormField label="Validity end">
                <Input
                  type="date"
                  value={access.validityEnd}
                  onChange={(e) => setAccess((p) => ({ ...p, validityEnd: e.target.value }))}
                />
              </FormField>
            </CardContent>
          </Card>

          {/* 6. Send credentials */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Send credentials</CardTitle>
              <CardDescription>
                Send username + temp password via Email, SMS, or both. Or save as draft (do not send now).
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Send via</Label>
                <Select value={sendVia} onValueChange={(v) => setSendVia(v as SendCredentialsVia)}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Do not send now (save draft)</SelectItem>
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="sms">SMS</SelectItem>
                    <SelectItem value="both">Both (Email + SMS)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {sendVia !== "none" && (
                <div className="flex items-center space-x-2">
                  <Switch checked={sendWelcome} onCheckedChange={setSendWelcome} />
                  <Label>Send welcome message + login URL</Label>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="flex justify-end gap-2">
            <Button variant="outline" asChild>
              <Link to="/candidates">Cancel</Link>
            </Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? "Saving…" : "Save & create"}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
