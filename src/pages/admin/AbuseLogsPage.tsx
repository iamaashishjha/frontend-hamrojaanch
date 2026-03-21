import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ShieldAlert } from "lucide-react";
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

interface AbuseLogEntry {
  id: string;
  eventType: string;
  userId: string | null;
  email: string | null;
  ip: string | null;
  details: string | null;
  createdAt: string;
}

export default function AbuseLogsPage() {
  const [eventFilter, setEventFilter] = useState("");
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "abuse-logs", eventFilter],
    queryFn: () =>
      get<{ items: AbuseLogEntry[] }>("/admin/abuse-logs", {
        eventType: eventFilter || undefined,
        limit: 50,
      } as Record<string, string | number | undefined>),
  });

  const items = data?.items ?? [];

  return (
    <div className="space-y-6 p-4">
      <div>
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <ShieldAlert className="h-6 w-6" />
          Abuse & Fraud Log
        </h1>
        <p className="text-muted-foreground">
          Suspicious events: attempt limit exceeded, rate limits, etc.
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
              <SelectItem value="attempt_limit_exceeded">Attempt limit exceeded</SelectItem>
              <SelectItem value="suspicious_ip">Suspicious IP</SelectItem>
              <SelectItem value="rate_limit_hit">Rate limit hit</SelectItem>
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground py-4">Loading…</p>
          ) : items.length === 0 ? (
            <p className="text-muted-foreground py-4">No abuse events recorded yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>Event</TableHead>
                  <TableHead>User</TableHead>
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
                      <span className="font-mono text-sm">{row.eventType}</span>
                    </TableCell>
                    <TableCell>
                      {row.email ?? row.userId ?? "—"}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{row.ip ?? "—"}</TableCell>
                    <TableCell className="max-w-[300px] truncate text-xs" title={row.details ?? ""}>
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
