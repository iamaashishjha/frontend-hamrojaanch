import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Award } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { verifyCertificate, type VerifyResult } from "@/lib/certificates-api";

export default function VerifyCertificatePage() {
  const [searchParams] = useSearchParams();
  const codeFromUrl = searchParams.get("code") ?? "";
  const [code, setCode] = useState(codeFromUrl);
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [loading, setLoading] = useState(false);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await verifyCertificate(code.trim());
      setResult(res);
    } catch {
      setResult({ valid: false });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-muted/30">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Award className="h-6 w-6" />
            Verify certificate
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Enter the verification code from the certificate.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={handleVerify} className="space-y-2">
            <Label htmlFor="code">Verification code</Label>
            <Input
              id="code"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="e.g. A1B2C3D4E5F6G7H8"
              className="font-mono"
            />
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Verifying…" : "Verify"}
            </Button>
          </form>
          {result && (
            <div className={`rounded-lg border p-4 ${result.valid ? "border-green-500/50 bg-green-500/5" : "border-destructive/50 bg-destructive/5"}`}>
              {result.valid ? (
                <>
                  <p className="font-semibold text-green-700 dark:text-green-400">Certificate is valid</p>
                  <p className="text-sm mt-1">Exam: {result.examTitle}</p>
                  <p className="text-sm">Candidate: {result.candidateName}</p>
                  <p className="text-sm text-muted-foreground">
                    Issued: {result.issuedAt && new Date(result.issuedAt).toLocaleString()}
                  </p>
                </>
              ) : (
                <p className="font-medium text-destructive">Certificate not found or invalid code.</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
