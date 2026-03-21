/**
 * Student certificates — lists certificates issued to the current user.
 */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Award, Download, QrCode } from "lucide-react";
import LogoMark from "@/components/LogoMark";
import BrandText from "@/components/BrandText";
import { StudentNavUser } from "@/components/StudentNavUser";
import { get } from "@/lib/apiClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const API_BASE = import.meta.env.VITE_API_BASE_URL ? String(import.meta.env.VITE_API_BASE_URL).replace(/\/$/, "") : "";

export default function StudentCertificatesPage() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    get<{ items: any[] }>("/students/me/certificates")
      .then((res) => setItems(res.items || []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b bg-white">
        <div className="mx-auto flex h-14 max-w-4xl items-center justify-between px-4">
          <Link to="/student-dashboard" className="flex items-center gap-2">
            <LogoMark className="h-8 w-8" />
            <BrandText />
          </Link>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" asChild>
              <Link to="/student-dashboard">
                <ArrowLeft className="mr-1 h-4 w-4" />
                Dashboard
              </Link>
            </Button>
            <StudentNavUser />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8">
        <div className="mb-6 flex items-center gap-2">
          <Award className="h-6 w-6 text-slate-600" />
          <h1 className="text-2xl font-semibold text-slate-900">My Certificates</h1>
        </div>

        {loading ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : items.length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">No certificates yet</CardTitle>
              <CardDescription>
                Certificates are issued by admin after you pass an exam.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild>
                <Link to="/student-dashboard">Back to Dashboard</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {items.map((c) => (
              <Card key={c.id}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{c.examTitle}</CardTitle>
                  <CardDescription>
                    Issued {c.issuedAt ? new Date(c.issuedAt).toLocaleDateString() : "—"}
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" asChild>
                    <a href={`/verify-certificate?code=${encodeURIComponent(c.verificationCode)}`} target="_blank" rel="noopener noreferrer">
                      <QrCode className="mr-1 h-4 w-4" />
                      Verify
                    </a>
                  </Button>
                  <Button variant="outline" size="sm" disabled title="PDF when available">
                    <Download className="mr-1 h-4 w-4" />
                    Download PDF
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
