import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Award, Copy, AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/components/ui/use-toast";
import { listCertificates, issueCertificate, verifyCertificate, type CertificateItem, type VerifyResult } from "@/lib/certificates-api";

export default function CertificatesPage() {
  const queryClient = useQueryClient();
  const [verifyOpen, setVerifyOpen] = useState(false);
  const [verifyCode, setVerifyCode] = useState("");
  const [verifyResult, setVerifyResult] = useState<VerifyResult | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [issueAttemptId, setIssueAttemptId] = useState("");
  const [issuing, setIssuing] = useState(false);

  const {
    data: items = [],
    isError: listError,
    error: listErrorMessage,
    isFetching: listLoading,
    refetch: refetchList,
  } = useQuery({
    queryKey: ["admin", "certificates"],
    queryFn: listCertificates,
    retry: false,
  });

  const handleVerify = async () => {
    if (!verifyCode.trim()) return;
    setVerifying(true);
    try {
      const res = await verifyCertificate(verifyCode.trim());
      setVerifyResult(res);
    } catch {
      setVerifyResult({ valid: false });
    } finally {
      setVerifying(false);
    }
  };

  const handleIssue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!issueAttemptId.trim()) return;
    setIssuing(true);
    try {
      await issueCertificate(issueAttemptId.trim());
      toast({ title: "Certificate issued" });
      queryClient.invalidateQueries({ queryKey: ["admin", "certificates"] });
      setIssueAttemptId("");
    } catch (e) {
      toast({ variant: "destructive", title: e instanceof Error ? e.message : "Failed" });
    } finally {
      setIssuing(false);
    }
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast({ title: "Copied" });
  };

  return (
    <div className="space-y-6 p-4">
      <div>
        <h1 className="text-2xl font-semibold">Certificates</h1>
        <p className="text-muted-foreground">Issue and verify certificates. Public verification link below.</p>
      </div>
      {listError && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-destructive">Couldn’t load certificates</p>
                <p className="text-sm text-muted-foreground mt-1">
                  The backend may not be running or the API URL may be wrong. Make sure the backend is running on port 4000 (e.g. <code className="text-xs bg-muted px-1 rounded">npx tsx watch src/index.ts</code> in the backend folder) and that <code className="text-xs bg-muted px-1 rounded">VITE_API_BASE_URL</code> is set in <code className="text-xs bg-muted px-1 rounded">frontend/.env</code>.
                </p>
                <p className="text-sm text-muted-foreground mt-1">{listErrorMessage instanceof Error ? listErrorMessage.message : "Network or server error."}</p>
                <Button variant="outline" size="sm" className="mt-3" onClick={() => refetchList()} disabled={listLoading}>
                  <RefreshCw className={listLoading ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
                  Retry
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Award className="h-5 w-5" />
            Issued certificates
          </CardTitle>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setVerifyOpen(true)}>
              Verify code
            </Button>
            <form onSubmit={handleIssue} className="flex gap-2">
              <Input
                placeholder="Attempt ID"
                value={issueAttemptId}
                onChange={(e) => setIssueAttemptId(e.target.value)}
                className="w-[200px]"
              />
              <Button type="submit" disabled={issuing}>Issue</Button>
            </form>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Exam</TableHead>
                <TableHead>Candidate</TableHead>
                <TableHead>Code</TableHead>
                <TableHead>Issued</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-muted-foreground text-center py-6">
                    No certificates issued.
                  </TableCell>
                </TableRow>
              ) : (
                items.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>{c.attempt?.exam?.title ?? c.examId}</TableCell>
                    <TableCell>{c.attempt?.user?.email ?? "—"}</TableCell>
                    <TableCell>
                      <span className="font-mono">{c.verificationCode}</span>
                      <Button size="sm" variant="ghost" className="ml-1" onClick={() => copyCode(c.verificationCode)}>
                        <Copy className="h-3 w-3" />
                      </Button>
                    </TableCell>
                    <TableCell>{new Date(c.issuedAt).toLocaleDateString()}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Public verification</CardTitle>
          <CardDescription>
            Candidates can verify a certificate at:{" "}
            <Link to="/verify-certificate" className="text-primary underline">
              /verify-certificate
            </Link>{" "}
            or <code className="text-sm">GET /api/public/certificates/verify?code=XXX</code>
          </CardDescription>
        </CardHeader>
      </Card>
      <Dialog open={verifyOpen} onOpenChange={setVerifyOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Verify certificate</DialogTitle>
            <DialogDescription>Enter verification code.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Code</Label>
              <Input
                value={verifyCode}
                onChange={(e) => setVerifyCode(e.target.value.toUpperCase())}
                placeholder="e.g. A1B2C3D4"
              />
            </div>
            <Button onClick={handleVerify} disabled={verifying}>Verify</Button>
            {verifyResult && (
              <div className="rounded border p-3 text-sm">
                {verifyResult.valid ? (
                  <>
                    <p className="font-medium text-green-600">Valid</p>
                    <p>Exam: {verifyResult.examTitle}</p>
                    <p>Candidate: {verifyResult.candidateName}</p>
                    <p>Issued: {verifyResult.issuedAt && new Date(verifyResult.issuedAt).toLocaleString()}</p>
                  </>
                ) : (
                  <p className="text-destructive">Certificate not found.</p>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setVerifyOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
