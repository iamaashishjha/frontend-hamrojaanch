import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Shield } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { get } from "@/lib/apiClient";
import { format } from "date-fns";

interface SecurityEvent {
  id: string;
  eventType: string;
  email: string | null;
  ip: string | null;
  userAgent: string | null;
  details: string | null;
  createdAt: string;
}

export default function SecurityEventsPage() {
  const [eventFilter, setEventFilter] = useState("");
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "security-events", eventFilter],
    queryFn: () =>
      get<{ items: SecurityEvent[] }>("/admin/security-events", {
        eventType: eventFilter || undefined,
        limit: 50,
      } as Record<string, string | number | undefined>),
  });

  const items = data?.items ?? [];

  return (
    <div className="space-y-6 p-4">
      <div>
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <Shield className="h-6 w-6" />
          Security Events
        </h1>
        <p className="text-muted-foreground">
          Failed logins and other security-related events.
        </p>
      </div>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Events</CardTitle>
          <Select value={eventFilter || "all"} onValueChange={(v) => setEventFilter(v === "all" ? "" : v)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Event type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="failed_login">Failed login</SelectItem>
              <SelectItem value="locked_out">Locked out</SelectItem>
              <SelectItem value="password_reset">Password reset</SelectItem>
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground py-4">Loading…</p>
          ) : items.length === 0 ? (
            <p className="text-muted-foreground py-4">No security events recorded yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>Event</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>IP</TableHead>
                  <TableHead>Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {format(new Date(row.createdAt), "PPp")}
                    </TableCell>
                    <TableCell>
                      <span className="font-mono text-sm">{row.eventType.replace("_", " ")}</span>
                    </TableCell>
                    <TableCell>{row.email ?? "—"}</TableCell>
                    <TableCell className="font-mono text-xs">{row.ip ?? "—"}</TableCell>
                    <TableCell className="max-w-[200px] truncate text-xs" title={row.details ?? ""}>
                      {row.details ?? "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
