import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { CheckCircle2, AlertCircle, XCircle } from "lucide-react";
import LogoMark from "@/components/LogoMark";
import BrandText from "@/components/BrandText";
import { get } from "@/lib/apiClient";

interface StatusComponent {
  id: string;
  name: string;
  status: "operational" | "degraded" | "outage";
}

interface StatusResponse {
  status: "operational" | "degraded" | "outage";
  timestamp: string;
  components: StatusComponent[];
}

function StatusIcon({ status }: { status: string }) {
  if (status === "operational") return <CheckCircle2 className="h-5 w-5 text-green-600" />;
  if (status === "degraded") return <AlertCircle className="h-5 w-5 text-amber-600" />;
  return <XCircle className="h-5 w-5 text-red-600" />;
}

export default function StatusPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["status"],
    queryFn: () => get<StatusResponse>("/public/status"),
    refetchInterval: 60000,
  });

  const overall = data?.status ?? "operational";
  const components = data?.components ?? [];

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto flex h-16 items-center justify-between px-6">
          <Link to="/" className="flex items-center gap-2">
            <LogoMark className="h-8 w-8" />
            <BrandText className="font-bold text-xl" />
          </Link>
          <nav className="flex gap-4">
            <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">
              Home
            </Link>
            <Link to="/pages/contact" className="text-sm text-muted-foreground hover:text-foreground">
              Contact
            </Link>
          </nav>
        </div>
      </header>

      <main className="container mx-auto px-6 py-12 max-w-2xl">
        <h1 className="text-2xl font-bold mb-2">System Status</h1>
        <p className="text-muted-foreground mb-8">
          Real-time status of HamroJaanch services.
        </p>

        {isLoading ? (
          <p className="text-muted-foreground">Checking status…</p>
        ) : (
          <>
            <div className="rounded-lg border p-4 mb-6 flex items-center gap-3">
              <StatusIcon status={overall} />
              <div>
                <p className="font-medium capitalize">{overall}</p>
                <p className="text-sm text-muted-foreground">
                  {overall === "operational"
                    ? "All systems are running normally."
                    : overall === "degraded"
                      ? "Some systems are experiencing issues."
                      : "We are experiencing a major outage."}
                </p>
              </div>
            </div>

            <h2 className="text-lg font-semibold mb-4">Components</h2>
            <div className="space-y-3">
              {components.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between rounded-lg border p-4"
                >
                  <span className="font-medium">{c.name}</span>
                  <div className="flex items-center gap-2">
                    <StatusIcon status={c.status} />
                    <span className="text-sm capitalize text-muted-foreground">
                      {c.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {data?.timestamp && (
              <p className="text-xs text-muted-foreground mt-6">
                Last updated: {new Date(data.timestamp).toLocaleString()}
              </p>
            )}
          </>
        )}
      </main>
    </div>
  );
}
